import { generateRegistrationOptions } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  MAX_PASSKEYS,
  PASSKEY_CHALLENGE_COOKIE,
  createPasskeyChallenge,
  getPasskeyUserId,
  listPasskeys,
  passkeyChallengeCookieOptions,
  resolvePasskeyRequestConfig,
} from "../../../../../lib/passkeys";
import {
  DEFAULT_ADMIN_USERNAME,
  SESSION_COOKIE,
  verifySessionToken,
} from "../../../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

/** @param {Request} request */
export async function POST(request) {
  const jar = await cookies();
  if (!verifySessionToken(jar.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json(
      { error: "Sign in before adding a passkey." },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  const config = resolvePasskeyRequestConfig(
    request.url,
    process.env,
    request.headers.get("origin"),
  );
  if (!config) {
    return NextResponse.json(
      { error: "Passkeys are not available on this address." },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const passkeys = await listPasskeys();
    if (passkeys.length >= MAX_PASSKEYS) {
      return NextResponse.json(
        { error: "Remove a passkey before adding another." },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }

    const userId = await getPasskeyUserId();
    const username =
      process.env.ADMIN_USERNAME?.trim() || DEFAULT_ADMIN_USERNAME;
    const options = await generateRegistrationOptions({
      rpName: config.rpName,
      rpID: config.rpID,
      userID: new Uint8Array(Buffer.from(userId, "base64url")),
      userName: username,
      userDisplayName: username,
      attestationType: "none",
      timeout: 60_000,
      excludeCredentials: passkeys.map((passkey) => ({
        id: passkey.id,
        transports: passkey.transports,
      })),
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
      supportedAlgorithmIDs: [-7, -257],
    });
    const token = await createPasskeyChallenge({
      type: "registration",
      challenge: options.challenge,
      userId,
      rpID: config.rpID,
      origin: config.origin,
    });

    const response = NextResponse.json(options, {
      headers: NO_STORE_HEADERS,
    });
    response.cookies.set(
      PASSKEY_CHALLENGE_COOKIE,
      token,
      passkeyChallengeCookieOptions(),
    );
    return response;
  } catch {
    return NextResponse.json(
      { error: "Passkey setup is temporarily unavailable." },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}

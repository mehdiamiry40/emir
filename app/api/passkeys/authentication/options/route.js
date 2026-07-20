import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import {
  PASSKEY_CHALLENGE_COOKIE,
  createPasskeyChallenge,
  hasRegisteredPasskeys,
  passkeyChallengeCookieOptions,
  resolvePasskeyRequestConfig,
} from "../../../../../lib/passkeys";
import {
  checkPasskeyRateLimit,
  getRateLimitIdentifier,
} from "../../../../../lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

/** @param {Request} request */
export async function POST(request) {
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

  const limit = await checkPasskeyRateLimit(
    getRateLimitIdentifier(request.headers),
  );
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: limit.unavailable
          ? "Passkey sign-in is temporarily unavailable."
          : "Too many passkey attempts. Try again later.",
      },
      {
        status: limit.unavailable ? 503 : 429,
        headers: {
          ...NO_STORE_HEADERS,
          ...(limit.retryAfterSeconds
            ? { "Retry-After": String(limit.retryAfterSeconds) }
            : {}),
        },
      },
    );
  }

  try {
    if (!(await hasRegisteredPasskeys())) {
      return NextResponse.json(
        { error: "No passkey is registered. Sign in with your password first." },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    const options = await generateAuthenticationOptions({
      rpID: config.rpID,
      allowCredentials: [],
      userVerification: "required",
      timeout: 60_000,
    });
    const token = await createPasskeyChallenge({
      type: "authentication",
      challenge: options.challenge,
      userId: null,
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
      { error: "Passkey sign-in is temporarily unavailable." },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}

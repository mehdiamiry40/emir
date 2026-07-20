import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  PASSKEY_CHALLENGE_COOKIE,
  addPasskey,
  consumePasskeyChallenge,
  passkeyChallengeCookieOptions,
  resolvePasskeyRequestConfig,
} from "../../../../../lib/passkeys";
import {
  SESSION_COOKIE,
  verifySessionToken,
} from "../../../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

/** @param {unknown} body @param {number} status */
function responseAndClearChallenge(body, status) {
  const response = NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
  response.cookies.set(PASSKEY_CHALLENGE_COOKIE, "", {
    ...passkeyChallengeCookieOptions(),
    maxAge: 0,
  });
  return response;
}

/** @param {Request} request */
export async function POST(request) {
  const jar = await cookies();
  if (!verifySessionToken(jar.get(SESSION_COOKIE)?.value)) {
    return responseAndClearChallenge(
      { error: "Sign in before adding a passkey." },
      401,
    );
  }

  const challenge = await consumePasskeyChallenge(
    jar.get(PASSKEY_CHALLENGE_COOKIE)?.value,
    "registration",
  ).catch(() => null);
  if (!challenge?.userId) {
    return responseAndClearChallenge(
      { error: "Passkey setup expired. Try again." },
      400,
    );
  }

  const config = resolvePasskeyRequestConfig(
    request.url,
    process.env,
    request.headers.get("origin"),
  );
  if (
    !config ||
    config.rpID !== challenge.rpID ||
    config.origin !== challenge.origin
  ) {
    return responseAndClearChallenge(
      { error: "Passkey setup origin is invalid." },
      400,
    );
  }

  try {
    /** @type {import('@simplewebauthn/server').RegistrationResponseJSON} */
    const registrationResponse = await request.json();
    const verification = await verifyRegistrationResponse({
      response: registrationResponse,
      expectedChallenge: challenge.challenge,
      expectedOrigin: challenge.origin,
      expectedRPID: challenge.rpID,
      requireUserVerification: true,
      supportedAlgorithmIDs: [-7, -257],
    });
    if (!verification.verified) {
      return responseAndClearChallenge(
        { error: "Passkey could not be verified." },
        400,
      );
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;
    const passkeys = await addPasskey({
      userId: challenge.userId,
      id: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    });
    return responseAndClearChallenge({ verified: true, passkeys }, 200);
  } catch {
    return responseAndClearChallenge(
      { error: "Passkey could not be verified." },
      400,
    );
  }
}

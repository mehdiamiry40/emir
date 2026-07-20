import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  PASSKEY_CHALLENGE_COOKIE,
  consumePasskeyChallenge,
  findPasskey,
  getPasskeyUserId,
  passkeyChallengeCookieOptions,
  resolvePasskeyRequestConfig,
  updatePasskeyCounter,
} from "../../../../../lib/passkeys";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
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
  const challenge = await consumePasskeyChallenge(
    jar.get(PASSKEY_CHALLENGE_COOKIE)?.value,
    "authentication",
  ).catch(() => null);
  if (!challenge) {
    return responseAndClearChallenge(
      { error: "Passkey sign-in expired. Try again." },
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
      { error: "Passkey sign-in origin is invalid." },
      400,
    );
  }

  try {
    /** @type {import('@simplewebauthn/server').AuthenticationResponseJSON} */
    const authenticationResponse = await request.json();
    const passkey = await findPasskey(authenticationResponse.id);
    const userId = await getPasskeyUserId();
    if (
      !passkey ||
      authenticationResponse.response.userHandle !== userId
    ) {
      return responseAndClearChallenge(
        { error: "Passkey could not be verified." },
        400,
      );
    }

    const verification = await verifyAuthenticationResponse({
      response: authenticationResponse,
      expectedChallenge: challenge.challenge,
      expectedOrigin: challenge.origin,
      expectedRPID: challenge.rpID,
      credential: {
        id: passkey.id,
        publicKey: new Uint8Array(
          Buffer.from(passkey.publicKey, "base64url"),
        ),
        counter: passkey.counter,
        transports: passkey.transports,
      },
      requireUserVerification: true,
    });
    if (!verification.verified) {
      return responseAndClearChallenge(
        { error: "Passkey could not be verified." },
        400,
      );
    }

    await updatePasskeyCounter(
      passkey.id,
      verification.authenticationInfo.newCounter,
    );
    const response = responseAndClearChallenge({ verified: true }, 200);
    response.cookies.set(
      SESSION_COOKIE,
      await createSessionToken({ passkeyId: passkey.id }),
      sessionCookieOptions(),
    );
    return response;
  } catch {
    return responseAndClearChallenge(
      { error: "Passkey could not be verified." },
      400,
    );
  }
}

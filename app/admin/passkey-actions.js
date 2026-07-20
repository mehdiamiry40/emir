"use server";

import { cookies } from "next/headers";
import { removePasskey } from "../../lib/passkeys";
import { SESSION_COOKIE, verifySessionToken } from "../../lib/session";

/**
 * @param {unknown} id
 * @returns {Promise<
 *   | { ok: true, passkeys: Awaited<ReturnType<typeof removePasskey>> }
 *   | { ok: false, error: string }
 * >}
 */
export async function removePasskeyAction(id) {
  const jar = await cookies();
  if (!verifySessionToken(jar.get(SESSION_COOKIE)?.value)) {
    return { ok: false, error: "Your session expired. Sign in again." };
  }
  if (typeof id !== "string") {
    return { ok: false, error: "Passkey could not be removed." };
  }

  try {
    const passkeys = await removePasskey(id);
    return { ok: true, passkeys };
  } catch {
    return { ok: false, error: "Passkey could not be removed." };
  }
}

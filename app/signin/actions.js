"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  getRateLimitIdentifier,
  getSignInRateLimit,
  isRateLimitConfigured,
  recordFailedSignIn,
} from "../../lib/rate-limit";
import {
  SESSION_COOKIE,
  createSessionToken,
  isConfigured,
  revokeSessionToken,
  sessionCookieOptions,
  verifyPassword,
  verifyUsername,
} from "../../lib/session";

export async function signIn(prevState, formData) {
  if (!isConfigured() || !isRateLimitConfigured()) {
    return { error: "Sign-in is temporarily unavailable." };
  }

  const headerList = await headers();
  const key = getRateLimitIdentifier(headerList);
  const limit = await getSignInRateLimit(key);
  if (!limit.allowed) {
    return {
      error: limit.unavailable
        ? "Sign-in is temporarily unavailable."
        : "Too many attempts. Try again later.",
    };
  }

  const usernameIsValid = verifyUsername(formData.get("username"));
  const passwordIsValid = verifyPassword(formData.get("password"));
  if (!usernameIsValid || !passwordIsValid) {
    await recordFailedSignIn(key);
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { error: "Incorrect username or password." };
  }

  let token;
  try {
    token = await createSessionToken();
  } catch {
    return { error: "Sign-in is temporarily unavailable." };
  }

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions());
  redirect("/admin");
}

export async function signOut() {
  const jar = await cookies();
  await revokeSessionToken(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  redirect("/");
}

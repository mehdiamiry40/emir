"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  checkSignInRateLimit,
  getRateLimitIdentifier,
  isRateLimitConfigured,
} from "../../lib/rate-limit";
import {
  SESSION_COOKIE,
  createSessionToken,
  isConfigured,
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
  const limit = await checkSignInRateLimit(key);
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
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { error: "Incorrect username or password." };
  }

  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions());
  redirect("/admin");
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/");
}

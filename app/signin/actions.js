"use server";

import { createHmac } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  checkSignInRateLimit,
  isRateLimitConfigured,
} from "../../lib/rate-limit";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  isConfigured,
  verifyPassword,
  verifyUsername,
} from "../../lib/session";

function clientKey(headerList) {
  const address =
    headerList.get("x-real-ip") ||
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const secret = process.env.SESSION_SECRET || "local-development";
  return createHmac("sha256", secret).update(address).digest("hex");
}

export async function signIn(prevState, formData) {
  if (!isConfigured() || !isRateLimitConfigured()) {
    return { error: "Sign-in is temporarily unavailable." };
  }

  const headerList = await headers();
  const key = clientKey(headerList);
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
  jar.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect("/admin");
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/");
}

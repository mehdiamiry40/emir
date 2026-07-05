"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  isConfigured,
  verifyPassword,
} from "../../lib/session";

export async function signIn(prevState, formData) {
  if (!isConfigured()) {
    return {
      error:
        "Sign-in is not configured yet — set the ADMIN_PASSWORD environment variable.",
    };
  }
  if (!verifyPassword(formData.get("password"))) {
    return { error: "Wrong password." };
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

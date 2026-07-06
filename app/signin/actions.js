"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  isConfigured,
  verifyPassword,
} from "../../lib/session";

// Best-effort brute-force protection. Per-instance memory: resets on
// cold starts and is not shared between serverless instances, but still
// makes hammering a warm instance impractical.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map();

function clientKey(headerList) {
  return (
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  );
}

function isLockedOut(key) {
  const rec = failures.get(key);
  if (!rec) return false;
  if (Date.now() - rec.start > WINDOW_MS) {
    failures.delete(key);
    return false;
  }
  return rec.count >= MAX_FAILURES;
}

function recordFailure(key) {
  const rec = failures.get(key);
  if (rec && Date.now() - rec.start <= WINDOW_MS) {
    rec.count += 1;
  } else {
    failures.set(key, { start: Date.now(), count: 1 });
  }
}

export async function signIn(prevState, formData) {
  if (!isConfigured()) {
    return {
      error:
        "Sign-in is not configured yet — set the ADMIN_PASSWORD environment variable.",
    };
  }

  const headerList = await headers();
  const key = clientKey(headerList);
  if (isLockedOut(key)) {
    return { error: "Too many attempts — try again in a few minutes." };
  }

  if (!verifyPassword(formData.get("password"))) {
    recordFailure(key);
    return { error: "Wrong password." };
  }

  failures.delete(key);
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

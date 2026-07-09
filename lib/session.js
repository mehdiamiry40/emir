import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "eagle_session";
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // one week, in seconds

/** @returns {Buffer | null} */
function secretKey() {
  const seed = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!seed) return null;
  return createHash("sha256").update(`eagle-session:${seed}`).digest();
}

/**
 * @param {string} value
 * @returns {string | null}
 */
function sign(value) {
  const key = secretKey();
  if (!key) return null;
  return createHmac("sha256", key).update(value).digest("base64url");
}

export function isConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

/** @param {unknown} input */
export function verifyPassword(input) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof input !== "string") return false;
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** @param {number} [now] */
export function createSessionToken(now = Date.now()) {
  const exp = String(Math.floor(now / 1000) + SESSION_MAX_AGE);
  const mac = sign(exp);
  if (!mac) {
    throw new Error(
      "createSessionToken called without ADMIN_PASSWORD/SESSION_SECRET set"
    );
  }
  return `${exp}.${mac}`;
}

/** @param {string | undefined} token */
export function verifySessionToken(token) {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const exp = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  if (!/^\d+$/.test(exp) || Number(exp) * 1000 < Date.now()) return false;
  const expected = sign(exp);
  if (!expected) return false;
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

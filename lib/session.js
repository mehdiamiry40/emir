import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "eagle_session";
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // one week, in seconds

function secretKey() {
  const seed = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!seed) return null;
  return createHash("sha256").update(`eagle-session:${seed}`).digest();
}

function sign(value) {
  return createHmac("sha256", secretKey()).update(value).digest("base64url");
}

export function isConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function verifyPassword(input) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof input !== "string") return false;
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function createSessionToken(now = Date.now()) {
  const exp = String(Math.floor(now / 1000) + SESSION_MAX_AGE);
  return `${exp}.${sign(exp)}`;
}

export function verifySessionToken(token) {
  if (!token || !secretKey()) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const exp = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  if (!/^\d+$/.test(exp) || Number(exp) * 1000 < Date.now()) return false;
  const a = Buffer.from(mac);
  const b = Buffer.from(sign(exp));
  return a.length === b.length && timingSafeEqual(a, b);
}

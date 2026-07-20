import { createHmac } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { createRedisClient } from "./redis.js";

const MAX_ATTEMPTS = 5;
const PASSKEY_MAX_ATTEMPTS = 20;
const WINDOW_MS = 15 * 60 * 1000;
const redis = createRedisClient();
const allowMemoryFallback =
  process.env.NODE_ENV !== "production" ||
  process.env.AUTH_RATE_LIMIT_TEST_MODE === "memory";

const limiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(MAX_ATTEMPTS, "15 m"),
      prefix: "emir:signin",
    })
  : null;
const passkeyLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(PASSKEY_MAX_ATTEMPTS, "15 m"),
      prefix: "emir:passkey",
    })
  : null;

const localAttempts = new Map();
const localPasskeyAttempts = new Map();

/** @param {Headers} headerList */
export function getRateLimitIdentifier(headerList) {
  const address =
    headerList.get("x-real-ip") ||
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const secret = `emir-rate-limit:${
    process.env.ADMIN_PASSWORD || "local-development"
  }`;
  return createHmac("sha256", secret).update(address).digest("hex");
}

export function isRateLimitConfigured() {
  return Boolean(limiter || allowMemoryFallback);
}

/** @param {string} identifier */
export async function checkSignInRateLimit(identifier) {
  if (limiter) {
    try {
      const result = await limiter.limit(identifier);
      return {
        allowed: result.success,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((result.reset - Date.now()) / 1000),
        ),
      };
    } catch {
      return { allowed: false, unavailable: true };
    }
  }

  if (!allowMemoryFallback) {
    return { allowed: false, unavailable: true };
  }

  const now = Date.now();
  const current = localAttempts.get(identifier);
  const record =
    current && now - current.startedAt < WINDOW_MS
      ? current
      : { count: 0, startedAt: now };

  record.count += 1;
  localAttempts.set(identifier, record);

  return {
    allowed: record.count <= MAX_ATTEMPTS,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((record.startedAt + WINDOW_MS - now) / 1000),
    ),
  };
}

/** @param {string} identifier */
export async function checkPasskeyRateLimit(identifier) {
  if (passkeyLimiter) {
    try {
      const result = await passkeyLimiter.limit(identifier);
      return {
        allowed: result.success,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((result.reset - Date.now()) / 1000),
        ),
      };
    } catch {
      return { allowed: false, unavailable: true };
    }
  }

  if (!allowMemoryFallback) {
    return { allowed: false, unavailable: true };
  }

  const now = Date.now();
  const current = localPasskeyAttempts.get(identifier);
  const record =
    current && now - current.startedAt < WINDOW_MS
      ? current
      : { count: 0, startedAt: now };
  record.count += 1;
  localPasskeyAttempts.set(identifier, record);

  return {
    allowed: record.count <= PASSKEY_MAX_ATTEMPTS,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((record.startedAt + WINDOW_MS - now) / 1000),
    ),
  };
}

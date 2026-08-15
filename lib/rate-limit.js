import { createHmac } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { createRedisClient } from "./redis.js";

const MAX_ATTEMPTS = 5;
const PASSKEY_MAX_ATTEMPTS = 20;
const WINDOW_MS = 15 * 60 * 1000;
const WINDOW_SECONDS = WINDOW_MS / 1000;
const FAIL_KEY_PREFIX = "emir:signin:fail:";
const redis = createRedisClient();
const allowMemoryFallback =
  process.env.NODE_ENV !== "production" ||
  process.env.AUTH_RATE_LIMIT_TEST_MODE === "memory";

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
  return Boolean(redis || allowMemoryFallback);
}

/** @param {string} identifier */
function failKey(identifier) {
  return `${FAIL_KEY_PREFIX}${identifier}`;
}

/**
 * @param {number} count
 * @param {number} retryAfterSeconds
 */
function limitResult(count, retryAfterSeconds) {
  return {
    allowed: count < MAX_ATTEMPTS,
    retryAfterSeconds: Math.max(1, retryAfterSeconds),
  };
}

/** @param {string} identifier */
function readLocalFailures(identifier) {
  const now = Date.now();
  const current = localAttempts.get(identifier);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    return { count: 0, startedAt: now };
  }
  return current;
}

/** @param {string} identifier */
export async function getSignInRateLimit(identifier) {
  if (redis) {
    try {
      const key = failKey(identifier);
      const [count, ttl] = await Promise.all([redis.get(key), redis.ttl(key)]);
      const failures = Number(count) || 0;
      return limitResult(
        failures,
        typeof ttl === "number" && ttl > 0 ? ttl : WINDOW_SECONDS,
      );
    } catch {
      return { allowed: false, unavailable: true };
    }
  }

  if (!allowMemoryFallback) {
    return { allowed: false, unavailable: true };
  }

  const record = readLocalFailures(identifier);
  return limitResult(
    record.count,
    Math.ceil((record.startedAt + WINDOW_MS - Date.now()) / 1000),
  );
}

/** @param {string} identifier */
export async function recordFailedSignIn(identifier) {
  if (redis) {
    try {
      const key = failKey(identifier);
      const count = Number(await redis.incr(key)) || 0;
      if (count === 1) await redis.expire(key, WINDOW_SECONDS);
      const ttl = Number(await redis.ttl(key));
      return {
        allowed: count <= MAX_ATTEMPTS,
        retryAfterSeconds: Math.max(1, ttl > 0 ? ttl : WINDOW_SECONDS),
      };
    } catch {
      return { allowed: false, unavailable: true };
    }
  }

  if (!allowMemoryFallback) {
    return { allowed: false, unavailable: true };
  }

  const now = Date.now();
  const current = readLocalFailures(identifier);
  const record =
    current.count === 0
      ? { count: 1, startedAt: now }
      : { count: current.count + 1, startedAt: current.startedAt };
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

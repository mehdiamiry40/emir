import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const redisConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);
const allowMemoryFallback =
  process.env.NODE_ENV !== "production" ||
  process.env.AUTH_RATE_LIMIT_TEST_MODE === "memory";

const limiter = redisConfigured
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(MAX_ATTEMPTS, "15 m"),
      prefix: "emir:signin",
    })
  : null;

const localAttempts = new Map();

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

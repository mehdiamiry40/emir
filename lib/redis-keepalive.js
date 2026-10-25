import { createHash, timingSafeEqual } from "node:crypto";
import { createRedisClient } from "./redis.js";

/**
 * Activity marker for the Upstash free database. This key is the only one the
 * daily cron writes. Auth, session, rate-limit, and notes keys stay untouched.
 */
export const REDIS_KEEPALIVE_KEY = "emir:ops:redis-keepalive";

export const REDIS_KEEPALIVE_LOG_PREFIX = "[redis-keepalive]";

/**
 * Constant-time check for `Authorization: Bearer ${CRON_SECRET}`.
 * A missing secret never matches, including the header `Bearer undefined`.
 * @param {string | null | undefined} authorizationHeader
 * @param {string | undefined} secret
 */
export function isCronAuthorized(authorizationHeader, secret) {
  if (typeof secret !== "string" || secret.length === 0) return false;
  const expected = createHash("sha256").update(`Bearer ${secret}`, "utf8").digest();
  const actual = createHash("sha256")
    .update(authorizationHeader ?? "", "utf8")
    .digest();
  return timingSafeEqual(expected, actual);
}

/**
 * Vercel adds `x-vercel-cron-schedule` to scheduled invocations. The header
 * does not authenticate the request; it only marks a rejection worth logging.
 * @param {Headers} headers
 */
export function isScheduledCronRequest(headers) {
  return (
    headers.has("x-vercel-cron-schedule") ||
    headers.get("user-agent") === "vercel-cron/1.0"
  );
}

/**
 * @param {string} detail
 */
export function logRedisKeepaliveFailure(detail) {
  console.error(
    `${REDIS_KEEPALIVE_LOG_PREFIX} Redis keepalive failed: ${detail}. The Upstash database may be unreachable or deleted. Sign-in rate limits, passkeys, and notes depend on it.`,
  );
}

/**
 * Write a timestamp, then read it back. Both are real Redis commands so an
 * idle Upstash free database records activity. The read-back has to match;
 * a silent miss is treated as failure.
 * @param {import("@upstash/redis").Redis} redis
 * @param {Date} [now]
 */
export async function recordRedisKeepalive(redis, now = new Date()) {
  const timestamp = now.toISOString();
  await redis.set(REDIS_KEEPALIVE_KEY, timestamp);
  const stored = await redis.get(REDIS_KEEPALIVE_KEY);
  if (stored !== timestamp) {
    throw new Error(
      "Redis keepalive read-back did not match the timestamp just written",
    );
  }
}

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function unauthorized() {
  return new Response(null, { status: 401, headers: NO_STORE_HEADERS });
}

function failed() {
  return Response.json({ ok: false }, { status: 500, headers: NO_STORE_HEADERS });
}

/**
 * Daily cron entry point. Accepts only `Authorization: Bearer ${CRON_SECRET}`
 * and never returns stored data.
 * @param {Request} request
 */
export async function handleRedisKeepaliveRequest(request) {
  const secret = process.env.CRON_SECRET;
  const scheduled = isScheduledCronRequest(request.headers);
  if (!isCronAuthorized(request.headers.get("authorization"), secret)) {
    if (scheduled) {
      console.error(
        secret
          ? `${REDIS_KEEPALIVE_LOG_PREFIX} Rejected the scheduled cron request. Authorization did not match CRON_SECRET.`
          : `${REDIS_KEEPALIVE_LOG_PREFIX} CRON_SECRET is not set. Refusing the scheduled request. Set CRON_SECRET in Vercel or the daily cron cannot reach Redis.`,
      );
    }
    return unauthorized();
  }

  const redis = createRedisClient();
  if (!redis) {
    logRedisKeepaliveFailure("Redis is not configured");
    return failed();
  }

  try {
    await recordRedisKeepalive(redis);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    logRedisKeepaliveFailure(detail);
    return failed();
  }

  return Response.json({ ok: true }, { headers: NO_STORE_HEADERS });
}

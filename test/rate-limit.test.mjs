import test from "node:test";
import assert from "node:assert/strict";

process.env.AUTH_RATE_LIMIT_TEST_MODE = "memory";
const {
  checkPasskeyRateLimit,
  checkSignInRateLimit,
  getRateLimitIdentifier,
  isRateLimitConfigured,
} = await import("../lib/rate-limit.js");
const { resolveRedisConfig } = await import("../lib/redis.js");

test("Redis configuration supports direct Upstash and Vercel KV names", () => {
  assert.deepEqual(
    resolveRedisConfig({
      UPSTASH_REDIS_REST_URL: "https://direct.example",
      UPSTASH_REDIS_REST_TOKEN: "direct-token",
    }),
    { url: "https://direct.example", token: "direct-token" },
  );
  assert.deepEqual(
    resolveRedisConfig({
      KV_REST_API_URL: "https://vercel.example",
      KV_REST_API_TOKEN: "vercel-token",
    }),
    { url: "https://vercel.example", token: "vercel-token" },
  );
  assert.equal(resolveRedisConfig({ KV_REST_API_URL: "incomplete" }), null);
});

test("development sign-in limiter blocks the sixth attempt", async () => {
  assert.equal(isRateLimitConfigured(), true);
  const identifier = `test-${Date.now()}-${Math.random()}`;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await checkSignInRateLimit(identifier);
    assert.equal(result.allowed, true);
  }

  const blocked = await checkSignInRateLimit(identifier);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);
});

test("passkey ceremony limiter uses a separate higher threshold", async () => {
  const identifier = `passkey-${Date.now()}-${Math.random()}`;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = await checkPasskeyRateLimit(identifier);
    assert.equal(result.allowed, true);
  }

  const blocked = await checkPasskeyRateLimit(identifier);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);
});

test("rate-limit identifiers do not retain the client IP", () => {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.42, 10.0.0.1" });
  const first = getRateLimitIdentifier(headers);
  const second = getRateLimitIdentifier(headers);

  assert.equal(first, second);
  assert.equal(first.length, 64);
  assert.doesNotMatch(first, /203\.0\.113\.42/);
});

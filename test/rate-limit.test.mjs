import test from "node:test";
import assert from "node:assert/strict";

process.env.AUTH_RATE_LIMIT_TEST_MODE = "memory";
const { checkSignInRateLimit, isRateLimitConfigured } = await import(
  "../lib/rate-limit.js"
);

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

import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import {
  handleRedisKeepaliveRequest,
  isCronAuthorized,
  REDIS_KEEPALIVE_KEY,
  REDIS_KEEPALIVE_LOG_PREFIX,
} from "../lib/redis-keepalive.js";

const PROTECTED_KEYS = {
  "emir:auth:passkeys:v1": "passkey-account",
  "emir:auth:passkeys:v1:revision": "7",
  "emir:notes:primary": "encrypted-note",
  "emir:notes:attachments": "attachment-index",
  "emir:notes:attachment:file-1": "file-bytes",
  "emir:notes:attachments:lock": "lock-token",
  "emir:auth:session:v1:abc": "session",
  "emir:auth:passkey-challenge:abc": "challenge",
  "emir:signin:fail:abc": "1",
  "emir:passkey:rl:abc": "1",
};

const SECRET = "cron-test-secret";
const REDIS_TOKEN = "redis-test-token";

test("cron authorization matches only Bearer CRON_SECRET", () => {
  assert.equal(isCronAuthorized(`Bearer ${SECRET}`, SECRET), true);
  assert.equal(isCronAuthorized(null, SECRET), false);
  assert.equal(isCronAuthorized("", SECRET), false);
  assert.equal(isCronAuthorized("Bearer", SECRET), false);
  assert.equal(isCronAuthorized(`Bearer ${SECRET} `, SECRET), false);
  assert.equal(isCronAuthorized(`bearer ${SECRET}`, SECRET), false);
  assert.equal(isCronAuthorized(`Bearer ${SECRET}`, undefined), false);
  assert.equal(isCronAuthorized(`Bearer ${SECRET}`, ""), false);
  assert.equal(isCronAuthorized("Bearer undefined", undefined), false);
  assert.equal(isCronAuthorized(`Bearer ${SECRET.slice(0, -1)}`, SECRET), false);
  assert.equal(isCronAuthorized(`Bearer ${SECRET}x`, SECRET), false);
});

test("keepalive key is separate from auth and notes data", () => {
  assert.equal(REDIS_KEEPALIVE_KEY, "emir:ops:redis-keepalive");
  for (const key of Object.keys(PROTECTED_KEYS)) {
    assert.notEqual(REDIS_KEEPALIVE_KEY, key);
    assert.equal(REDIS_KEEPALIVE_KEY.startsWith(key), false);
    assert.equal(key.startsWith(REDIS_KEEPALIVE_KEY), false);
  }
  assert.equal(REDIS_KEEPALIVE_KEY.startsWith("emir:auth:"), false);
  assert.equal(REDIS_KEEPALIVE_KEY.startsWith("emir:notes:"), false);
  assert.equal(REDIS_KEEPALIVE_KEY.startsWith("emir:signin:"), false);
  assert.equal(REDIS_KEEPALIVE_KEY.startsWith("emir:passkey"), false);
});

test("daily cron is valid on the Vercel Hobby plan and leaves security headers alone", async () => {
  const config = JSON.parse(
    await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  );
  assert.equal(config.headers, undefined);
  assert.deepEqual(Object.keys(config).sort(), ["$schema", "crons"]);
  assert.equal(config.crons.length, 1);
  assert.equal(config.crons[0].path, "/api/cron/redis-keepalive");
  assert.equal(config.crons[0].schedule, "0 4 * * *");

  const [minute, hour, dayOfMonth, month, dayOfWeek] = config.crons[0].schedule.split(
    " ",
  );
  assert.match(minute, /^(?:[0-9]|[1-5][0-9])$/);
  assert.match(hour, /^(?:[0-9]|1[0-9]|2[0-3])$/);
  assert.equal(dayOfMonth, "*");
  assert.equal(month, "*");
  assert.equal(dayOfWeek, "*");

  const nextConfig = await readFile(
    new URL("../next.config.mjs", import.meta.url),
    "utf8",
  );
  assert.match(nextConfig, /Content-Security-Policy/);
  assert.match(nextConfig, /X-Content-Type-Options/);
  assert.match(nextConfig, /X-Frame-Options/);
  assert.match(nextConfig, /Referrer-Policy/);
  assert.match(nextConfig, /Cross-Origin-Opener-Policy/);
  assert.match(nextConfig, /Cross-Origin-Resource-Policy/);
  assert.match(nextConfig, /Permissions-Policy/);

  const route = await readFile(
    new URL("../app/api/cron/redis-keepalive/route.js", import.meta.url),
    "utf8",
  );
  assert.match(route, /export const dynamic = "force-dynamic"/);
  assert.match(route, /handleRedisKeepaliveRequest\(request\)/);
  assert.doesNotMatch(route, /passkeys|notes:primary|FLUSH|flushdb/i);
});

test("keepalive route rejects strangers and writes only its own Redis key", async () => {
  /** @type {Map<string, string>} */
  const store = new Map(Object.entries(PROTECTED_KEYS));
  /** @type {unknown[][]} */
  const requests = [];
  let failWrites = false;
  let corruptRead = false;

  function execute(command) {
    requests.push(command);
    const name = String(command[0]).toLowerCase();
    if (name === "set") {
      if (failWrites) {
        return { status: 500, body: { error: "ERR database unavailable" } };
      }
      store.set(String(command[1]), String(command[2]));
      return { status: 200, body: { result: "OK" } };
    }
    if (name === "get") {
      if (corruptRead && command[1] === REDIS_KEEPALIVE_KEY) {
        return {
          status: 200,
          body: { result: Buffer.from("stale-keepalive").toString("base64") },
        };
      }
      const value = store.get(String(command[1]));
      return {
        status: 200,
        body: {
          result:
            value === undefined ? null : Buffer.from(value).toString("base64"),
        },
      };
    }
    return { status: 500, body: { error: `unexpected command ${name}` } };
  }

  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const batch = Array.isArray(body[0]);
    const outcomes = (batch ? body : [body]).map((command) => execute(command));
    const failed = outcomes.find((outcome) => outcome.status !== 200);
    const payload = batch
      ? outcomes.map((outcome) => outcome.body)
      : outcomes[0].body;
    response.writeHead(failed && !batch ? failed.status : 200, {
      "content-type": "application/json",
      "upstash-sync-token": "keepalive-test",
    });
    response.end(JSON.stringify(payload));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const environmentKeys = [
    "CRON_SECRET",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "KV_REST_API_URL",
    "KV_REST_API_TOKEN",
    "NODE_ENV",
  ];
  const savedEnvironment = Object.fromEntries(
    environmentKeys.map((key) => [key, process.env[key]]),
  );
  /** @type {string[]} */
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => {
    errors.push(args.map((part) => String(part)).join(" "));
  };

  try {
    process.env.CRON_SECRET = SECRET;
    process.env.KV_REST_API_URL = `http://127.0.0.1:${address.port}`;
    process.env.KV_REST_API_TOKEN = REDIS_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    /**
     * @param {Record<string, string>} [headers]
     */
    function call(headers = {}) {
      return handleRedisKeepaliveRequest(
        new Request("https://www.emir.com.au/api/cron/redis-keepalive", {
          headers,
        }),
      );
    }

    async function assertClosed(headers) {
      const before = requests.length;
      const response = await call(headers);
      assert.equal(response.status, 401);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(await response.text(), "");
      assert.equal(requests.length, before);
    }

    await assertClosed();
    await assertClosed({ authorization: "Bearer wrong" });
    await assertClosed({ authorization: `bearer ${SECRET}` });
    await assertClosed({ authorization: "Bearer undefined" });
    assert.equal(
      errors.some((line) => line.includes(REDIS_KEEPALIVE_LOG_PREFIX)),
      false,
    );

    const spoofedCron = await call({ "user-agent": "vercel-cron/1.0" });
    assert.equal(spoofedCron.status, 401);
    assert.equal(await spoofedCron.text(), "");
    assert.equal(requests.length, 0);
    assert.match(errors.join("\n"), /did not match CRON_SECRET/);

    delete process.env.CRON_SECRET;
    errors.length = 0;
    const missingSecret = await call({ "user-agent": "vercel-cron/1.0" });
    assert.equal(missingSecret.status, 401);
    assert.equal(missingSecret.headers.get("cache-control"), "no-store");
    assert.equal(await missingSecret.text(), "");
    assert.equal(requests.length, 0);
    assert.match(
      errors.join("\n"),
      /CRON_SECRET is not set/,
    );
    assert.equal(errors.join("\n").includes(REDIS_TOKEN), false);

    errors.length = 0;
    const quietProbe = await call();
    assert.equal(quietProbe.status, 401);
    assert.equal(errors.length, 0);

    process.env.CRON_SECRET = SECRET;
    errors.length = 0;
    const mismatch = await call({
      authorization: "Bearer wrong",
      "x-vercel-cron-schedule": "0 4 * * *",
    });
    assert.equal(mismatch.status, 401);
    assert.match(errors.join("\n"), /did not match CRON_SECRET/);
    assert.equal(requests.length, 0);

    errors.length = 0;
    const ok = await call({ authorization: `Bearer ${SECRET}` });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("cache-control"), "no-store");
    const body = await ok.json();
    assert.deepEqual(body, { ok: true });
    assert.equal(JSON.stringify(body).includes(REDIS_KEEPALIVE_KEY), false);
    assert.equal(errors.length, 0);

    const commands = requests.map((command) => String(command[0]).toLowerCase());
    assert.deepEqual(commands, ["set", "get"]);
    for (const command of requests) {
      assert.equal(command[1], REDIS_KEEPALIVE_KEY);
      assert.equal(JSON.stringify(command).includes(REDIS_TOKEN), false);
    }
    const written = store.get(REDIS_KEEPALIVE_KEY);
    assert.match(written ?? "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.equal(JSON.stringify(body).includes(written ?? "missing"), false);

    for (const [key, value] of Object.entries(PROTECTED_KEYS)) {
      assert.equal(store.get(key), value);
    }

    requests.length = 0;
    failWrites = true;
    errors.length = 0;
    const down = await call({ authorization: `Bearer ${SECRET}` });
    assert.equal(down.status, 500);
    assert.equal(down.headers.get("cache-control"), "no-store");
    assert.deepEqual(await down.json(), { ok: false });
    assert.match(errors.join("\n"), /Redis keepalive failed/);
    assert.match(errors.join("\n"), /unreachable or deleted/);
    assert.match(errors.join("\n"), /database unavailable/);
    assert.equal(errors.join("\n").includes(REDIS_TOKEN), false);
    assert.equal(store.has(REDIS_KEEPALIVE_KEY), true);
    assert.deepEqual(
      requests.map((command) => String(command[0]).toLowerCase()),
      ["set"],
    );

    failWrites = false;
    corruptRead = true;
    requests.length = 0;
    errors.length = 0;
    const mismatchRead = await call({ authorization: `Bearer ${SECRET}` });
    assert.equal(mismatchRead.status, 500);
    assert.equal(mismatchRead.headers.get("cache-control"), "no-store");
    const mismatchBody = await mismatchRead.json();
    assert.deepEqual(mismatchBody, { ok: false });
    assert.equal(JSON.stringify(mismatchBody).includes("stale-keepalive"), false);
    assert.match(errors.join("\n"), /read-back did not match/);
    assert.match(errors.join("\n"), /unreachable or deleted/);

    corruptRead = false;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    requests.length = 0;
    errors.length = 0;
    const unconfigured = await call({ authorization: `Bearer ${SECRET}` });
    assert.equal(unconfigured.status, 500);
    assert.equal(unconfigured.headers.get("cache-control"), "no-store");
    assert.deepEqual(await unconfigured.json(), { ok: false });
    assert.match(errors.join("\n"), /Redis is not configured/);
    assert.equal(requests.length, 0);
    for (const [key, value] of Object.entries(PROTECTED_KEYS)) {
      assert.equal(store.get(key), value);
    }
  } finally {
    console.error = originalError;
    for (const [key, value] of Object.entries(savedEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await new Promise((resolve) => server.close(resolve));
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";

function sha1(value) {
  return createHash("sha1").update(value).digest("hex");
}

function encodeUpstashResult(value) {
  if (typeof value === "string") {
    return Buffer.from(value).toString("base64");
  }
  if (Array.isArray(value)) return value.map(encodeUpstashResult);
  return value;
}

test("Redis passkey mutations use revisioned compare-and-set scripts", async () => {
  let account = null;
  let revision = "0";
  let forceConflict = false;
  const scripts = new Map();
  const requests = [];

  function executeCommand(command) {
    requests.push(command);
    const name = String(command[0]).toLowerCase();
    let script;
    if (name === "eval" || name === "eval_ro") {
      script = command[1];
      scripts.set(sha1(script), script);
    } else if (name === "evalsha" || name === "evalsha_ro") {
      script = scripts.get(command[1]);
      if (!script) {
        return {
          result: null,
          error: "NOSCRIPT No matching script. Please use EVAL.",
        };
      }
    } else {
      throw new Error(`Unexpected Redis command: ${name}`);
    }

    const keyCount = Number(command[2]);
    const args = command.slice(3 + keyCount).map(String);
    let result;
    if (
      script.includes('return { account, revision, redis.sha1hex(account) }')
    ) {
      result = [account || "", revision, account ? sha1(account) : ""];
    } else if (script.includes('redis.call("SET", KEYS[1], ARGV[5])')) {
      const exists = account === null ? "0" : "1";
      const fingerprint = account ? sha1(account) : "";
      if (forceConflict) {
        forceConflict = false;
        revision = String(Number(revision) + 1);
        result = 0;
      } else if (
        exists !== args[0] ||
        revision !== args[1] ||
        fingerprint !== args[2]
      ) {
        result = 0;
      } else {
        revision = args[3];
        account = args[4];
        result = 1;
      }
    } else {
      throw new Error("Unexpected Redis script");
    }
    return { result: encodeUpstashResult(result) };
  }

  const server = createServer(async (request, response) => {
    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const batch = Array.isArray(body[0]);
      const result = batch
        ? body.map((command) => executeCommand(command))
        : executeCommand(body);

      response.writeHead(200, {
        "content-type": "application/json",
        "upstash-sync-token": `test-${requests.length}`,
      });
      response.end(JSON.stringify(result));
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: error.message }));
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const environmentKeys = [
    "NODE_ENV",
    "PASSKEY_STORAGE_TEST_MODE",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "KV_REST_API_URL",
    "KV_REST_API_TOKEN",
  ];
  const savedEnvironment = Object.fromEntries(
    environmentKeys.map((key) => [key, process.env[key]]),
  );

  try {
    process.env.NODE_ENV = "production";
    delete process.env.PASSKEY_STORAGE_TEST_MODE;
    process.env.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${address.port}`;
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;

    const {
      addPasskey,
      findPasskey,
      getPasskeyUserId,
      removePasskey,
      updatePasskeyCounter,
    } = await import(`../lib/passkeys.js?redis-test=${Date.now()}`);
    const userId = await getPasskeyUserId();
    const credentialId = Buffer.from("redis-script-passkey").toString(
      "base64url",
    );

    await addPasskey({
      userId,
      id: credentialId,
      publicKey: new Uint8Array([1, 2, 3, 4]),
      counter: 0,
      transports: ["internal"],
      deviceType: "singleDevice",
      backedUp: false,
    });
    forceConflict = true;
    await updatePasskeyCounter(credentialId, 4);
    assert.equal((await findPasskey(credentialId)).counter, 4);
    assert.deepEqual(await removePasskey(credentialId), []);
    assert.equal(await findPasskey(credentialId), null);
  } finally {
    for (const [key, value] of Object.entries(savedEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await new Promise((resolve) => server.close(resolve));
  }

  assert.ok(requests.some(([name]) => name === "eval_ro"));
  assert.ok(requests.some(([name]) => name === "eval"));
  assert.ok(requests.some(([name]) => name === "evalsha_ro"));
  assert.ok(requests.some(([name]) => name === "evalsha"));

  const compareAndSetRequest = requests.find(
    ([name, script]) =>
      name === "eval" &&
      typeof script === "string" &&
      script.includes('redis.call("SET", KEYS[1], ARGV[5])'),
  );
  assert.ok(compareAndSetRequest);
  assert.equal(compareAndSetRequest[2], 2);
  const compareAndSetArgs = compareAndSetRequest.slice(5);
  assert.deepEqual(compareAndSetArgs.slice(0, 4), [
    "0",
    "0",
    "",
    "1",
  ]);
  assert.equal(JSON.parse(compareAndSetArgs[4]).credentials.length, 1);
});

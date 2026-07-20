import test from "node:test";
import assert from "node:assert/strict";

process.env.PASSKEY_STORAGE_TEST_MODE = "memory";

const {
  addPasskey,
  consumePasskeyChallenge,
  createPasskeyChallenge,
  getPasskeyUserId,
  listPasskeys,
  parsePasskeyAccount,
  removePasskey,
  resolvePasskeyRequestConfig,
} = await import("../lib/passkeys.js");

test("production passkey config accepts only configured RP origins", () => {
  const env = {
    NODE_ENV: "production",
    PASSKEY_RP_ID: "emir.com.au",
    PASSKEY_ORIGINS: "https://www.emir.com.au,https://emir.com.au",
  };

  assert.deepEqual(
    resolvePasskeyRequestConfig(
      "https://www.emir.com.au/api/passkeys/authentication/options",
      env,
    ),
    {
      rpID: "emir.com.au",
      rpName: "EMIR",
      origin: "https://www.emir.com.au",
    },
  );
  assert.equal(
    resolvePasskeyRequestConfig("https://evil.example/api/passkeys", env),
    null,
  );
  assert.equal(
    resolvePasskeyRequestConfig("http://www.emir.com.au/api/passkeys", env),
    null,
  );
});

test("passkey challenges expire after one atomic consumption", async () => {
  const challenge = {
    type: "authentication",
    challenge: Buffer.alloc(32, 3).toString("base64url"),
    userId: null,
    rpID: "localhost",
    origin: "http://localhost:3000",
  };
  const token = await createPasskeyChallenge(challenge);
  const consumed = await consumePasskeyChallenge(token, "authentication");

  assert.ok(consumed);
  const { createdAt, ...storedChallenge } = consumed;
  assert.equal(typeof createdAt, "number");
  assert.deepEqual(storedChallenge, challenge);
  assert.equal(
    await consumePasskeyChallenge(token, "authentication"),
    null,
  );
});

test("passkey credentials retain public verification data and can be removed", async () => {
  const userId = await getPasskeyUserId();
  const credentialId = Buffer.alloc(32, 4).toString("base64url");
  const passkeys = await addPasskey({
    userId,
    id: credentialId,
    publicKey: new Uint8Array([1, 2, 3, 4]),
    counter: 0,
    transports: ["internal"],
    deviceType: "multiDevice",
    backedUp: true,
  });

  assert.equal(passkeys.length, 1);
  assert.equal(passkeys[0].id, credentialId);
  assert.equal(passkeys[0].backedUp, true);
  assert.deepEqual(await listPasskeys(), passkeys);
  assert.deepEqual(await removePasskey(credentialId), []);
});

test("malformed persisted passkey data fails closed", () => {
  assert.throws(
    () =>
      parsePasskeyAccount({
        version: 1,
        userId: "valid-looking-id",
        credentials: [{ id: "missing-public-key" }],
      }),
    /invalid/,
  );
});

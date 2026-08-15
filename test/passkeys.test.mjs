import test from "node:test";
import assert from "node:assert/strict";

process.env.PASSKEY_STORAGE_TEST_MODE = "memory";

const {
  MAX_PASSKEYS,
  addPasskey,
  consumePasskeyChallenge,
  createPasskeyChallenge,
  findPasskey,
  getPasskeyUserId,
  listPasskeys,
  parsePasskeyAccount,
  removePasskey,
  resolvePasskeyRequestConfig,
  updatePasskeyCounter,
} = await import("../lib/passkeys.js");

function deferred() {
  let resolve;
  const promise = new Promise((release) => {
    resolve = release;
  });
  return { promise, resolve };
}

function controlRemovalCommitFirst() {
  const bothLoaded = deferred();
  const removalCommitted = deferred();
  let initialLoads = 0;

  return {
    async afterAccountLoad(operation, attempt) {
      if (attempt !== 0) return;
      initialLoads += 1;
      if (initialLoads === 2) bothLoaded.resolve();
      await bothLoaded.promise;
      if (operation !== "remove") await removalCommitted.promise;
    },
    afterAccountCommit(operation, attempt) {
      if (operation === "remove" && attempt === 0) removalCommitted.resolve();
    },
  };
}

function controlSecondCounterCommitFirst() {
  const bothLoaded = deferred();
  const secondCommitted = deferred();
  let initialLoads = 0;

  return {
    async afterAccountLoad(operation, attempt) {
      if (operation !== "counter" || attempt !== 0) return;
      initialLoads += 1;
      if (initialLoads === 1) {
        await bothLoaded.promise;
        await secondCommitted.promise;
      } else {
        bothLoaded.resolve();
      }
    },
    afterAccountCommit(operation, attempt) {
      if (operation === "counter" && attempt === 0) {
        secondCommitted.resolve();
      }
    },
  };
}

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
      "https://www.emir.com.au",
    ),
    {
      rpID: "emir.com.au",
      rpName: "EMIR",
      origin: "https://www.emir.com.au",
    },
  );
  assert.equal(
    resolvePasskeyRequestConfig(
      "https://www.emir.com.au/api/passkeys/authentication/options",
      env,
    ),
    null,
  );
  assert.equal(
    resolvePasskeyRequestConfig(
      "https://www.emir.com.au/api/passkeys/authentication/options",
      env,
      "https://emir.com.au",
    ),
    null,
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

test("removing a passkey wins over an overlapping counter update", async () => {
  const userId = await getPasskeyUserId();
  const credentialId = Buffer.from("counter-race-passkey").toString("base64url");
  await addPasskey({
    userId,
    id: credentialId,
    publicKey: new Uint8Array([5, 6, 7, 8]),
    counter: 0,
    transports: ["internal"],
    deviceType: "singleDevice",
    backedUp: false,
  });

  globalThis.__emirPasskeyMemory.testHooks = controlRemovalCommitFirst();
  let removal;
  let counterUpdate;
  try {
    [removal, counterUpdate] = await Promise.allSettled([
      removePasskey(credentialId),
      updatePasskeyCounter(credentialId, 1),
    ]);
  } finally {
    delete globalThis.__emirPasskeyMemory.testHooks;
  }

  assert.equal(removal.status, "fulfilled");
  assert.equal(counterUpdate.status, "rejected");
  assert.match(counterUpdate.reason.message, /Passkey does not exist/);
  assert.equal(await findPasskey(credentialId), null);
});

test("registration cannot restore a concurrently removed passkey", async () => {
  const userId = await getPasskeyUserId();
  const removedId = Buffer.from("removed-during-registration").toString(
    "base64url",
  );
  const replacementId = Buffer.from("replacement-registration").toString(
    "base64url",
  );
  const input = (id) => ({
    userId,
    id,
    publicKey: new Uint8Array([9, 10, 11, 12]),
    counter: 0,
    transports: ["internal"],
    deviceType: "multiDevice",
    backedUp: true,
  });
  await addPasskey(input(removedId));

  globalThis.__emirPasskeyMemory.testHooks = controlRemovalCommitFirst();
  let removal;
  let registration;
  try {
    [removal, registration] = await Promise.allSettled([
      removePasskey(removedId),
      addPasskey(input(replacementId)),
    ]);
  } finally {
    delete globalThis.__emirPasskeyMemory.testHooks;
  }

  assert.equal(removal.status, "fulfilled");
  assert.equal(registration.status, "fulfilled");
  assert.equal(await findPasskey(removedId), null);
  assert.ok(await findPasskey(replacementId));

  await removePasskey(replacementId);
});

test("a stale counter update cannot roll back a concurrent advance", async () => {
  const userId = await getPasskeyUserId();
  const credentialId = Buffer.from("monotonic-counter-passkey").toString(
    "base64url",
  );
  await addPasskey({
    userId,
    id: credentialId,
    publicKey: new Uint8Array([17, 18, 19, 20]),
    counter: 5,
    transports: ["internal"],
    deviceType: "singleDevice",
    backedUp: false,
  });

  globalThis.__emirPasskeyMemory.testHooks =
    controlSecondCounterCommitFirst();
  let lowerUpdate;
  let higherUpdate;
  try {
    [lowerUpdate, higherUpdate] = await Promise.allSettled([
      updatePasskeyCounter(credentialId, 6),
      updatePasskeyCounter(credentialId, 7),
    ]);
  } finally {
    delete globalThis.__emirPasskeyMemory.testHooks;
  }

  const finalCounter = (await findPasskey(credentialId)).counter;
  await removePasskey(credentialId);
  assert.equal(higherUpdate.status, "fulfilled");
  assert.equal(lowerUpdate.status, "rejected");
  assert.match(lowerUpdate.reason.message, /counter did not increase/i);
  assert.equal(finalCounter, 7);
});

test("atomic updates preserve passkey account constraints and counters", async () => {
  const userId = await getPasskeyUserId();
  const input = (id, overrides = {}) => ({
    userId,
    id,
    publicKey: new Uint8Array([13, 14, 15, 16]),
    counter: 0,
    transports: ["internal"],
    deviceType: "singleDevice",
    backedUp: false,
    ...overrides,
  });
  const counterId = Buffer.from("counter-control-passkey").toString("base64url");
  await addPasskey(input(counterId));

  await assert.rejects(
    addPasskey(input(counterId)),
    /Passkey is already registered/,
  );
  await assert.rejects(
    addPasskey(
      input(Buffer.from("wrong-user-passkey").toString("base64url"), {
        userId: Buffer.from("different-user").toString("base64url"),
      }),
    ),
    /Passkey user ID does not match the stored account/,
  );

  await updatePasskeyCounter(counterId, 7);
  const updated = await findPasskey(counterId);
  assert.equal(updated.counter, 7);
  assert.equal(typeof updated.lastUsedAt, "string");
  await removePasskey(counterId);

  const zeroCounterId = Buffer.from("zero-counter-passkey").toString(
    "base64url",
  );
  await addPasskey(input(zeroCounterId));
  await updatePasskeyCounter(zeroCounterId, 0);
  assert.equal((await findPasskey(zeroCounterId)).counter, 0);
  await removePasskey(zeroCounterId);

  const duplicateId = Buffer.from("concurrent-duplicate").toString("base64url");
  const duplicateResults = await Promise.allSettled([
    addPasskey(input(duplicateId)),
    addPasskey(input(duplicateId)),
  ]);
  assert.deepEqual(
    duplicateResults.map(({ status }) => status).sort(),
    ["fulfilled", "rejected"],
  );
  const duplicateFailure = duplicateResults.find(
    ({ status }) => status === "rejected",
  );
  assert.match(duplicateFailure.reason.message, /Passkey is already registered/);
  await removePasskey(duplicateId);

  const capacityIds = Array.from({ length: MAX_PASSKEYS + 1 }, (_, index) =>
    Buffer.from(`capacity-passkey-${index}`).toString("base64url"),
  );
  for (const id of capacityIds.slice(0, MAX_PASSKEYS - 1)) {
    await addPasskey(input(id));
  }
  const capacityResults = await Promise.allSettled(
    capacityIds.slice(MAX_PASSKEYS - 1).map((id) => addPasskey(input(id))),
  );
  assert.deepEqual(
    capacityResults.map(({ status }) => status).sort(),
    ["fulfilled", "rejected"],
  );
  const capacityFailure = capacityResults.find(
    ({ status }) => status === "rejected",
  );
  assert.match(capacityFailure.reason.message, /Maximum number of passkeys reached/);
  assert.equal((await listPasskeys()).length, MAX_PASSKEYS);

  for (const id of capacityIds) await removePasskey(id);
});

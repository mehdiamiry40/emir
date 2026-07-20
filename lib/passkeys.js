import { randomBytes } from "node:crypto";
import { createRedisClient } from "./redis.js";

export const PASSKEY_CHALLENGE_COOKIE = "emir_passkey_challenge";
export const PASSKEY_CHALLENGE_MAX_AGE = 5 * 60;
export const MAX_PASSKEYS = 10;

const PASSKEY_ACCOUNT_KEY = "emir:auth:passkeys:v1";
const PASSKEY_ACCOUNT_REVISION_KEY = "emir:auth:passkeys:v1:revision";
const PASSKEY_CHALLENGE_PREFIX = "emir:auth:passkey-challenge:";
/** @type {1} */
const PASSKEY_ACCOUNT_VERSION = 1;
const PASSKEY_RP_NAME = "EMIR";
const VALID_TRANSPORTS = new Set([
  "ble",
  "cable",
  "hybrid",
  "internal",
  "nfc",
  "smart-card",
  "usb",
]);
const VALID_DEVICE_TYPES = new Set(["singleDevice", "multiDevice"]);
const redis = createRedisClient();
const allowMemoryFallback =
  process.env.NODE_ENV !== "production" ||
  process.env.PASSKEY_STORAGE_TEST_MODE === "memory";
const PASSKEY_ACCOUNT_UPDATE_ATTEMPTS = 8;
const loadAccountSnapshotScript = redis?.createScript(
  `
local account = redis.call("GET", KEYS[1])
local revision = redis.call("GET", KEYS[2]) or "0"

if account == false then
  return { "", revision, "" }
end

return { account, revision, redis.sha1hex(account) }
`,
  { readonly: true },
);
const compareAndSetAccountScript = redis?.createScript(`
local account = redis.call("GET", KEYS[1])
local revision = redis.call("GET", KEYS[2]) or "0"
local exists = account == false and "0" or "1"

if exists ~= ARGV[1] or revision ~= ARGV[2] then
  return 0
end

if account ~= false and redis.sha1hex(account) ~= ARGV[3] then
  return 0
end

redis.call("SET", KEYS[1], ARGV[5])
redis.call("SET", KEYS[2], ARGV[4])
return 1
`);

/**
 * @typedef {'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb'} PasskeyTransport
 * @typedef {'singleDevice' | 'multiDevice'} PasskeyDeviceType
 * @typedef {{
 *   id: string,
 *   publicKey: string,
 *   counter: number,
 *   transports: PasskeyTransport[],
 *   deviceType: PasskeyDeviceType,
 *   backedUp: boolean,
 *   createdAt: string,
 *   lastUsedAt: string | null,
 * }} StoredPasskey
 * @typedef {{ version: 1, userId: string, credentials: StoredPasskey[] }} PasskeyAccount
 * @typedef {{ account: PasskeyAccount | null, exists: boolean, revision: number, fingerprint: string }} PasskeyAccountSnapshot
 * @typedef {'add' | 'counter' | 'remove'} PasskeyAccountOperation
 * @typedef {{
 *   type: 'registration' | 'authentication',
 *   challenge: string,
 *   userId: string | null,
 *   rpID: string,
 *   origin: string,
 *   createdAt: number,
 * }} PasskeyChallenge
 * @typedef {{
 *   account: PasskeyAccount | null,
 *   accountRevision: number,
 *   challenges: Map<string, PasskeyChallenge>,
 *   testHooks?: {
 *     afterAccountLoad?: (operation: PasskeyAccountOperation, attempt: number) => Promise<void> | void,
 *     afterAccountCommit?: (operation: PasskeyAccountOperation, attempt: number) => Promise<void> | void,
 *   },
 * }} PasskeyMemoryState
 */

const globalScope = /** @type {typeof globalThis & {
 *   __emirPasskeyMemory?: PasskeyMemoryState,
 * }} */ (globalThis);
/** @type {PasskeyMemoryState} */
const memoryState = (globalScope.__emirPasskeyMemory ||= {
  account: null,
  accountRevision: 0,
  challenges: new Map(),
});
memoryState.accountRevision ??= 0;

/** @param {unknown} value */
function isBase64URL(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 2048 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

/** @param {unknown} value */
function isISODate(value) {
  return (
    typeof value === "string" &&
    value.length <= 40 &&
    Number.isFinite(Date.parse(value))
  );
}

/** @param {unknown} value @returns {StoredPasskey} */
function parseStoredPasskey(value) {
  if (!value || typeof value !== "object") {
    throw new Error("Stored passkey is invalid");
  }

  const transports =
    "transports" in value && Array.isArray(value.transports)
      ? value.transports
      : [];
  if (
    !("id" in value && isBase64URL(value.id)) ||
    !("publicKey" in value && isBase64URL(value.publicKey)) ||
    !("counter" in value &&
      typeof value.counter === "number" &&
      Number.isSafeInteger(value.counter) &&
      value.counter >= 0) ||
    !("deviceType" in value &&
      typeof value.deviceType === "string" &&
      VALID_DEVICE_TYPES.has(value.deviceType)) ||
    !("backedUp" in value && typeof value.backedUp === "boolean") ||
    !("createdAt" in value && isISODate(value.createdAt)) ||
    !("lastUsedAt" in value &&
      (value.lastUsedAt === null || isISODate(value.lastUsedAt))) ||
    transports.some(
      (transport) =>
        typeof transport !== "string" || !VALID_TRANSPORTS.has(transport),
    )
  ) {
    throw new Error("Stored passkey is invalid");
  }

  const stored = /** @type {StoredPasskey} */ (value);
  return {
    id: stored.id,
    publicKey: stored.publicKey,
    counter: stored.counter,
    /** @type {PasskeyTransport[]} */
    transports: [...new Set(transports)],
    deviceType: stored.deviceType,
    backedUp: stored.backedUp,
    createdAt: stored.createdAt,
    lastUsedAt: stored.lastUsedAt,
  };
}

/** @param {unknown} value @returns {PasskeyAccount | null} */
export function parsePasskeyAccount(value) {
  if (value === null || value === undefined) return null;
  if (
    !value ||
    typeof value !== "object" ||
    !("version" in value && value.version === PASSKEY_ACCOUNT_VERSION) ||
    !("userId" in value && isBase64URL(value.userId)) ||
    !("credentials" in value && Array.isArray(value.credentials)) ||
    value.credentials.length > MAX_PASSKEYS
  ) {
    throw new Error("Stored passkey account is invalid");
  }

  const stored = /** @type {{
   *   version: 1,
   *   userId: string,
   *   credentials: unknown[],
   * }} */ (value);
  const credentials = stored.credentials.map(parseStoredPasskey);
  if (new Set(credentials.map((credential) => credential.id)).size !== credentials.length) {
    throw new Error("Stored passkey account contains duplicate credentials");
  }

  return {
    version: PASSKEY_ACCOUNT_VERSION,
    userId: stored.userId,
    credentials,
  };
}

/** @param {unknown} value */
function parseChallenge(value) {
  if (
    !value ||
    typeof value !== "object" ||
    !("type" in value &&
      (value.type === "registration" || value.type === "authentication")) ||
    !("challenge" in value && isBase64URL(value.challenge)) ||
    !("userId" in value &&
      (value.userId === null || isBase64URL(value.userId))) ||
    !("rpID" in value &&
      typeof value.rpID === "string" &&
      value.rpID.length > 0) ||
    !("origin" in value &&
      typeof value.origin === "string" &&
      value.origin.length > 0) ||
    !("createdAt" in value &&
      typeof value.createdAt === "number" &&
      Number.isFinite(value.createdAt))
  ) {
    throw new Error("Stored passkey challenge is invalid");
  }

  return /** @type {PasskeyChallenge} */ ({ ...value });
}

export function isPasskeyStorageConfigured() {
  return Boolean(redis || allowMemoryFallback);
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {{
 *   httpOnly: true,
 *   sameSite: 'strict',
 *   secure: boolean,
 *   path: '/api/passkeys',
 *   maxAge: number,
 * }}
 */
export function passkeyChallengeCookieOptions(env = process.env) {
  return {
    httpOnly: true,
    sameSite: "strict",
    secure: env.NODE_ENV === "production",
    path: "/api/passkeys",
    maxAge: PASSKEY_CHALLENGE_MAX_AGE,
  };
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 */
export function isPasskeyConfigured(env = process.env) {
  if (!isPasskeyStorageConfigured()) return false;
  if (env.NODE_ENV !== "production") return true;
  return Boolean(env.PASSKEY_RP_ID?.trim() && env.PASSKEY_ORIGINS?.trim());
}

/**
 * @param {string} requestUrl
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @param {string | null} [requestOrigin]
 */
export function resolvePasskeyRequestConfig(
  requestUrl,
  env = process.env,
  requestOrigin = null,
) {
  if (!isPasskeyConfigured(env)) return null;

  let request;
  try {
    request = new URL(requestUrl);
  } catch {
    return null;
  }

  let ceremonyOrigin;
  try {
    ceremonyOrigin = requestOrigin
      ? new URL(requestOrigin).origin
      : request.origin;
  } catch {
    return null;
  }

  const ceremonyUrl = new URL(ceremonyOrigin);
  const configuredRPID = env.PASSKEY_RP_ID?.trim().toLowerCase();
  const rpID = configuredRPID || ceremonyUrl.hostname.toLowerCase();
  const origins = env.PASSKEY_ORIGINS
    ? env.PASSKEY_ORIGINS.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [request.origin];

  let normalizedOrigins;
  try {
    normalizedOrigins = origins.map((origin) => new URL(origin).origin);
  } catch {
    return null;
  }

  const hostname = ceremonyUrl.hostname.toLowerCase();
  const rpMatchesHost = hostname === rpID || hostname.endsWith(`.${rpID}`);
  const secureOrigin =
    ceremonyUrl.protocol === "https:" ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";

  if (
    !rpMatchesHost ||
    !secureOrigin ||
    !normalizedOrigins.includes(ceremonyOrigin)
  ) {
    return null;
  }

  return {
    rpID,
    rpName: PASSKEY_RP_NAME,
    origin: ceremonyOrigin,
  };
}

/** @returns {Promise<PasskeyAccountSnapshot>} */
async function loadAccountSnapshot() {
  if (redis && loadAccountSnapshotScript) {
    const result = await loadAccountSnapshotScript.exec(
      [PASSKEY_ACCOUNT_KEY, PASSKEY_ACCOUNT_REVISION_KEY],
      [],
    );
    if (!Array.isArray(result) || result.length !== 3) {
      throw new Error("Stored passkey account snapshot is invalid");
    }

    const [value, rawRevision, rawFingerprint] = result;
    const revision =
      typeof rawRevision === "number"
        ? rawRevision
        : Number.parseInt(String(rawRevision), 10);
    if (
      !Number.isSafeInteger(revision) ||
      revision < 0 ||
      String(revision) !== String(rawRevision)
    ) {
      throw new Error("Stored passkey account revision is invalid");
    }

    const exists = value !== "";
    if (
      typeof rawFingerprint !== "string" ||
      (exists && !/^[a-f0-9]{40}$/.test(rawFingerprint)) ||
      (!exists && rawFingerprint !== "")
    ) {
      throw new Error("Stored passkey account fingerprint is invalid");
    }

    return {
      account: parsePasskeyAccount(exists ? value : null),
      exists,
      revision,
      fingerprint: rawFingerprint,
    };
  }
  if (allowMemoryFallback) {
    const value = memoryState.account
      ? structuredClone(memoryState.account)
      : null;
    return {
      account: parsePasskeyAccount(value),
      exists: value !== null,
      revision: memoryState.accountRevision,
      fingerprint: value ? JSON.stringify(value) : "",
    };
  }
  throw new Error("Passkey storage is not configured");
}

async function loadAccount() {
  return (await loadAccountSnapshot()).account;
}

/**
 * @param {PasskeyAccountSnapshot} snapshot
 * @param {PasskeyAccount} account
 */
async function saveAccountIfUnchanged(snapshot, account) {
  if (snapshot.revision >= Number.MAX_SAFE_INTEGER) {
    throw new Error("Stored passkey account revision is invalid");
  }
  const nextRevision = snapshot.revision + 1;

  if (redis && compareAndSetAccountScript) {
    const changed = await compareAndSetAccountScript.exec(
      [PASSKEY_ACCOUNT_KEY, PASSKEY_ACCOUNT_REVISION_KEY],
      [
        snapshot.exists ? "1" : "0",
        String(snapshot.revision),
        snapshot.fingerprint,
        String(nextRevision),
        JSON.stringify(account),
      ],
    );
    return changed === 1;
  }
  if (allowMemoryFallback) {
    const currentFingerprint = memoryState.account
      ? JSON.stringify(memoryState.account)
      : "";
    if (
      (memoryState.account !== null) !== snapshot.exists ||
      memoryState.accountRevision !== snapshot.revision ||
      currentFingerprint !== snapshot.fingerprint
    ) {
      return false;
    }
    memoryState.account = structuredClone(account);
    memoryState.accountRevision = nextRevision;
    return true;
  }
  throw new Error("Passkey storage is not configured");
}

/**
 * @param {PasskeyAccountOperation} operation
 * @param {(account: PasskeyAccount | null) => PasskeyAccount | undefined} update
 */
async function updateAccount(operation, update) {
  for (let attempt = 0; attempt < PASSKEY_ACCOUNT_UPDATE_ATTEMPTS; attempt += 1) {
    const snapshot = await loadAccountSnapshot();
    await memoryState.testHooks?.afterAccountLoad?.(operation, attempt);
    const account = update(snapshot.account);
    if (account === undefined) return snapshot.account;
    if (await saveAccountIfUnchanged(snapshot, account)) {
      await memoryState.testHooks?.afterAccountCommit?.(operation, attempt);
      return account;
    }
  }
  throw new Error("Passkey account changed too frequently; try again");
}

export async function getPasskeyUserId() {
  const account = await loadAccount();
  return account?.userId || randomBytes(32).toString("base64url");
}

export async function hasRegisteredPasskeys() {
  const account = await loadAccount();
  return Boolean(account?.credentials.length);
}

export async function listPasskeys() {
  const account = await loadAccount();
  return (account?.credentials || []).map((credential, index) => ({
    id: credential.id,
    label: `Passkey ${index + 1}`,
    transports: credential.transports,
    deviceType: credential.deviceType,
    backedUp: credential.backedUp,
    createdAt: credential.createdAt,
    lastUsedAt: credential.lastUsedAt,
  }));
}

/** @param {string} id */
export async function findPasskey(id) {
  if (!isBase64URL(id)) return null;
  const account = await loadAccount();
  const credential = account?.credentials.find((item) => item.id === id);
  return credential ? structuredClone(credential) : null;
}

/**
 * @param {{
 *   userId: string,
 *   id: string,
 *   publicKey: Uint8Array,
 *   counter: number,
 *   transports?: PasskeyTransport[],
 *   deviceType: PasskeyDeviceType,
 *   backedUp: boolean,
 * }} input
 */
export async function addPasskey(input) {
  await updateAccount("add", (account) => {
    if (account && account.userId !== input.userId) {
      throw new Error("Passkey user ID does not match the stored account");
    }
    if (account?.credentials.some((credential) => credential.id === input.id)) {
      throw new Error("Passkey is already registered");
    }
    if ((account?.credentials.length || 0) >= MAX_PASSKEYS) {
      throw new Error("Maximum number of passkeys reached");
    }

    const credential = parseStoredPasskey({
      id: input.id,
      publicKey: Buffer.from(input.publicKey).toString("base64url"),
      counter: input.counter,
      transports: input.transports || [],
      deviceType: input.deviceType,
      backedUp: input.backedUp,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
    });
    return {
      version: PASSKEY_ACCOUNT_VERSION,
      userId: account?.userId || input.userId,
      credentials: [...(account?.credentials || []), credential],
    };
  });

  return listPasskeys();
}

/** @param {string} id @param {number} counter */
export async function updatePasskeyCounter(id, counter) {
  await updateAccount("counter", (account) => {
    if (!account) throw new Error("Passkey account does not exist");
    const credential = account.credentials.find((item) => item.id === id);
    if (!credential) throw new Error("Passkey does not exist");
    if (!Number.isSafeInteger(counter) || counter < 0) {
      throw new Error("Passkey counter is invalid");
    }
    if (
      (counter > 0 || credential.counter > 0) &&
      counter <= credential.counter
    ) {
      throw new Error("Passkey counter did not increase");
    }

    credential.counter = counter;
    credential.lastUsedAt = new Date().toISOString();
    return account;
  });
}

/** @param {string} id */
export async function removePasskey(id) {
  if (!isBase64URL(id)) return listPasskeys();
  await updateAccount("remove", (account) => {
    if (!account) return undefined;
    account.credentials = account.credentials.filter(
      (credential) => credential.id !== id,
    );
    return account;
  });
  return listPasskeys();
}

/**
 * @param {Omit<PasskeyChallenge, 'createdAt'>} challenge
 */
export async function createPasskeyChallenge(challenge) {
  const token = randomBytes(32).toString("base64url");
  const record = parseChallenge({ ...challenge, createdAt: Date.now() });

  if (redis) {
    await redis.set(`${PASSKEY_CHALLENGE_PREFIX}${token}`, record, {
      ex: PASSKEY_CHALLENGE_MAX_AGE,
    });
  } else if (allowMemoryFallback) {
    memoryState.challenges.set(token, record);
  } else {
    throw new Error("Passkey challenge storage is not configured");
  }

  return token;
}

/**
 * @param {string | undefined} token
 * @param {'registration' | 'authentication'} expectedType
 */
export async function consumePasskeyChallenge(token, expectedType) {
  if (!token || !isBase64URL(token)) return null;

  let value;
  if (redis) {
    value = await redis.getdel(`${PASSKEY_CHALLENGE_PREFIX}${token}`);
  } else if (allowMemoryFallback) {
    value = memoryState.challenges.get(token) || null;
    memoryState.challenges.delete(token);
  } else {
    throw new Error("Passkey challenge storage is not configured");
  }
  if (!value) return null;

  const challenge = parseChallenge(value);
  const expired =
    Date.now() - challenge.createdAt > PASSKEY_CHALLENGE_MAX_AGE * 1000;
  if (challenge.type !== expectedType || expired) return null;
  return challenge;
}

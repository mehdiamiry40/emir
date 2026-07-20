import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { findPasskey } from "./passkeys.js";
import { createRedisClient } from "./redis.js";

export const SESSION_COOKIE = "emir_session";
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // one week, in seconds
export const DEFAULT_ADMIN_USERNAME = "emir";

const SESSION_VERSION = 1;
const SESSION_KEY_PREFIX = "emir:auth:session:v1:";
const SESSION_SIGNING_CONTEXT = "emir-session-signing:v1";
const ADMIN_CREDENTIAL_CONTEXT = "emir-admin-credential:v1";
const PASSKEY_CREDENTIAL_CONTEXT = "emir-passkey-credential:v1";
const redis = createRedisClient();
const allowMemoryFallback =
  process.env.NODE_ENV !== "production" ||
  process.env.SESSION_STORAGE_TEST_MODE === "memory";

/**
 * @typedef {'password' | 'passkey'} SessionAuthenticationMethod
 * @typedef {{
 *   version: 1,
 *   expiresAt: number,
 *   authenticationMethod: SessionAuthenticationMethod,
 *   passkeyId: string | null,
 *   passkeyVersion: string | null,
 *   credentialVersion: string,
 * }} StoredSession
 * @typedef {StoredSession & { id: string, body: string }} ParsedSessionToken
 */

const globalScope = /** @type {typeof globalThis & {
 *   __emirSessionMemory?: Map<string, StoredSession>,
 * }} */ (globalThis);
const memorySessions = (globalScope.__emirSessionMemory ||= new Map());

/**
 * @param {string} input
 * @param {string} expected
 */
function secureEqual(input, expected) {
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** @param {unknown} value */
function isBase64URL(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 2048 &&
    /^[A-Za-z0-9_-]+$/.test(value) &&
    Buffer.from(value, "base64url").toString("base64url") === value
  );
}

/**
 * @param {string | undefined} encoded
 * @returns {Buffer | null}
 */
function decodeSigningMaterial(encoded) {
  const value = encoded?.trim();
  if (!value) return null;
  if (!/^(?:[A-Za-z0-9+/]{4}){10}[A-Za-z0-9+/]{3}=$/.test(value)) {
    return null;
  }
  const key = Buffer.from(value, "base64");
  return key.length === 32 && key.toString("base64") === value ? key : null;
}

/**
 * A dedicated secret takes precedence. Falling back to the existing note key
 * keeps deployments compatible while deriving a domain-separated session key.
 * An explicitly configured but invalid SESSION_SECRET fails closed.
 *
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 */
function sessionSigningKey(env = process.env) {
  const hasDedicatedSecret = env.SESSION_SECRET !== undefined;
  const material = decodeSigningMaterial(
    hasDedicatedSecret ? env.SESSION_SECRET : env.NOTES_ENCRYPTION_KEY,
  );
  if (!material) return null;
  return createHmac("sha256", material)
    .update(SESSION_SIGNING_CONTEXT)
    .digest();
}

/** @param {string} value */
function sign(value) {
  const key = sessionSigningKey();
  if (!key) return null;
  return createHmac("sha256", key).update(value).digest("base64url");
}

function currentCredentialVersion() {
  const key = sessionSigningKey();
  const password = process.env.ADMIN_PASSWORD;
  if (!key || !password) return null;
  return createHmac("sha256", key)
    .update(ADMIN_CREDENTIAL_CONTEXT)
    .update("\0")
    .update(password)
    .digest("base64url");
}

/**
 * @param {{ id: string, publicKey: string, createdAt: string }} passkey
 */
function passkeyCredentialVersion(passkey) {
  const key = sessionSigningKey();
  if (!key) return null;
  return createHmac("sha256", key)
    .update(PASSKEY_CREDENTIAL_CONTEXT)
    .update("\0")
    .update(passkey.id)
    .update("\0")
    .update(passkey.publicKey)
    .update("\0")
    .update(passkey.createdAt)
    .digest("base64url");
}

/** @param {string} id */
function sessionStorageKey(id) {
  const digest = createHash("sha256").update(id).digest("base64url");
  return `${SESSION_KEY_PREFIX}${digest}`;
}

/** @param {unknown} value @returns {StoredSession} */
function parseStoredSession(value) {
  if (
    !value ||
    typeof value !== "object" ||
    !("version" in value && value.version === SESSION_VERSION) ||
    !("expiresAt" in value &&
      typeof value.expiresAt === "number" &&
      Number.isSafeInteger(value.expiresAt) &&
      value.expiresAt > 0) ||
    !("authenticationMethod" in value &&
      (value.authenticationMethod === "password" ||
        value.authenticationMethod === "passkey")) ||
    !("passkeyId" in value &&
      (value.passkeyId === null || isBase64URL(value.passkeyId))) ||
    !("passkeyVersion" in value &&
      (value.passkeyVersion === null ||
        (typeof value.passkeyVersion === "string" &&
          isBase64URL(value.passkeyVersion) &&
          value.passkeyVersion.length === 43))) ||
    !("credentialVersion" in value &&
      typeof value.credentialVersion === "string" &&
      isBase64URL(value.credentialVersion) &&
      value.credentialVersion.length === 43) ||
    (value.authenticationMethod === "password" &&
      (value.passkeyId !== null || value.passkeyVersion !== null)) ||
    (value.authenticationMethod === "passkey" &&
      (value.passkeyId === null || value.passkeyVersion === null))
  ) {
    throw new Error("Stored session is invalid");
  }
  return /** @type {StoredSession} */ ({ ...value });
}

/**
 * @param {string | undefined} token
 * @param {{ allowExpired?: boolean }} [options]
 * @returns {ParsedSessionToken | null}
 */
function parseSessionToken(token, { allowExpired = false } = {}) {
  if (!token || token.length > 4096) return null;
  const parts = token.split(".");
  if (parts.length !== 6 && parts.length !== 8) return null;

  const [version, id, exp, authenticationMethod] = parts;
  const passkeyId = parts.length === 8 ? parts[4] : null;
  const passkeyVersion = parts.length === 8 ? parts[5] : null;
  const credentialVersion = parts.at(-2) || "";
  const mac = parts.at(-1) || "";
  if (
    version !== String(SESSION_VERSION) ||
    !isBase64URL(id) ||
    id.length !== 43 ||
    !/^\d+$/.test(exp) ||
    !Number.isSafeInteger(Number(exp)) ||
    (authenticationMethod !== "password" &&
      authenticationMethod !== "passkey") ||
    (authenticationMethod === "password" && parts.length !== 6) ||
    (authenticationMethod === "passkey" &&
      (parts.length !== 8 ||
        !isBase64URL(passkeyId) ||
        typeof passkeyVersion !== "string" ||
        !isBase64URL(passkeyVersion) ||
        passkeyVersion.length !== 43)) ||
    !isBase64URL(credentialVersion) ||
    credentialVersion.length !== 43 ||
    !isBase64URL(mac)
  ) {
    return null;
  }

  const expiresAt = Number(exp) * 1000;
  if (!allowExpired && expiresAt <= Date.now()) return null;
  const body = parts.slice(0, -1).join(".");
  const expected = sign(body);
  if (!expected || !secureEqual(mac, expected)) return null;

  return {
    version: SESSION_VERSION,
    id,
    body,
    expiresAt,
    authenticationMethod,
    passkeyId,
    passkeyVersion,
    credentialVersion,
  };
}

/** @param {string} id @param {StoredSession} session */
async function saveSession(id, session) {
  const key = sessionStorageKey(id);
  if (redis) {
    const ttl = Math.max(1, Math.ceil((session.expiresAt - Date.now()) / 1000));
    await redis.set(key, session, { ex: ttl });
    return;
  }
  if (allowMemoryFallback) {
    memorySessions.set(key, structuredClone(session));
    return;
  }
  throw new Error("Session storage is not configured");
}

/** @param {string} id */
async function loadSession(id) {
  const key = sessionStorageKey(id);
  const value = redis
    ? await redis.get(key)
    : allowMemoryFallback
      ? memorySessions.get(key) || null
      : null;
  if (!redis && !allowMemoryFallback) {
    throw new Error("Session storage is not configured");
  }
  if (!value) return null;
  const session = parseStoredSession(value);
  if (session.expiresAt <= Date.now()) {
    if (redis) await redis.del(key);
    else memorySessions.delete(key);
    return null;
  }
  return session;
}

/** @param {string} id */
async function deleteSession(id) {
  const key = sessionStorageKey(id);
  if (redis) return (await redis.del(key)) > 0;
  if (allowMemoryFallback) return memorySessions.delete(key);
  throw new Error("Session storage is not configured");
}

/** @param {ParsedSessionToken} token @param {StoredSession} stored */
function sessionMatchesToken(token, stored) {
  return (
    stored.version === token.version &&
    stored.expiresAt === token.expiresAt &&
    stored.authenticationMethod === token.authenticationMethod &&
    stored.passkeyId === token.passkeyId &&
    stored.passkeyVersion === token.passkeyVersion &&
    stored.credentialVersion === token.credentialVersion
  );
}

export function isConfigured() {
  return Boolean(
    process.env.ADMIN_PASSWORD &&
      sessionSigningKey() &&
      (redis || allowMemoryFallback),
  );
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {{
 *   httpOnly: true,
 *   sameSite: 'lax',
 *   secure: boolean,
 *   path: '/',
 *   maxAge: number,
 * }}
 */
export function sessionCookieOptions(env = process.env) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

/** @param {unknown} input */
export function verifyUsername(input) {
  if (typeof input !== "string") return false;
  const username = input.trim();
  if (!username || username.length > 64) return false;
  const expected =
    process.env.ADMIN_USERNAME?.trim() || DEFAULT_ADMIN_USERNAME;
  return secureEqual(username.toLowerCase(), expected.toLowerCase());
}

/** @param {unknown} input */
export function verifyPassword(input) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof input !== "string") return false;
  return secureEqual(input, expected);
}

/**
 * @param {{ passkeyId?: string, now?: number }} [options]
 */
export async function createSessionToken({ passkeyId, now = Date.now() } = {}) {
  const credentialVersion = currentCredentialVersion();
  if (!credentialVersion) {
    throw new Error("Session signing key is not configured");
  }
  if (!Number.isFinite(now)) throw new TypeError("Session time is invalid");
  let passkeyVersion = null;
  if (passkeyId !== undefined) {
    const passkey = isBase64URL(passkeyId)
      ? await findPasskey(passkeyId)
      : null;
    passkeyVersion = passkey ? passkeyCredentialVersion(passkey) : null;
    if (!passkey || !passkeyVersion) {
      throw new Error("Session passkey does not exist");
    }
  }

  const id = randomBytes(32).toString("base64url");
  const exp = Math.floor(now / 1000) + SESSION_MAX_AGE;
  const authenticationMethod = passkeyId ? "passkey" : "password";
  const body = passkeyId
    ? `${SESSION_VERSION}.${id}.${exp}.${authenticationMethod}.${passkeyId}.${passkeyVersion}.${credentialVersion}`
    : `${SESSION_VERSION}.${id}.${exp}.${authenticationMethod}.${credentialVersion}`;
  const mac = sign(body);
  if (!mac) throw new Error("Session signing key is not configured");

  await saveSession(id, {
    version: SESSION_VERSION,
    expiresAt: exp * 1000,
    authenticationMethod,
    passkeyId: passkeyId || null,
    passkeyVersion,
    credentialVersion,
  });
  return `${body}.${mac}`;
}

/** @param {string | undefined} token */
export async function verifySessionToken(token) {
  const parsed = parseSessionToken(token);
  if (!parsed) return false;
  try {
    const credentialVersion = currentCredentialVersion();
    if (
      !credentialVersion ||
      !secureEqual(parsed.credentialVersion, credentialVersion)
    ) {
      return false;
    }
    const stored = await loadSession(parsed.id);
    if (!stored || !sessionMatchesToken(parsed, stored)) return false;
    if (stored.passkeyId) {
      const passkey = await findPasskey(stored.passkeyId);
      const passkeyVersion = passkey
        ? passkeyCredentialVersion(passkey)
        : null;
      if (
        !passkeyVersion ||
        !stored.passkeyVersion ||
        !secureEqual(stored.passkeyVersion, passkeyVersion)
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/** @param {string | undefined} token */
export async function revokeSessionToken(token) {
  const parsed = parseSessionToken(token, { allowExpired: true });
  if (!parsed) return false;
  const stored = await loadSession(parsed.id);
  if (!stored || !sessionMatchesToken(parsed, stored)) return false;
  return deleteSession(parsed.id);
}

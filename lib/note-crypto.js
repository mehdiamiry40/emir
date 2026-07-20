import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const ALGORITHM_LABEL = "A256GCM";
const ENVELOPE_VERSION = 1;
const KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const ADDITIONAL_DATA = Buffer.from("emir-private-note:v1", "utf8");

/**
 * @typedef {{
 *   version: 1,
 *   algorithm: "A256GCM",
 *   iv: string,
 *   tag: string,
 *   ciphertext: string,
 * }} EncryptedNoteEnvelope
 */

export class NotesEncryptionError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotesEncryptionError";
  }
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 * @returns {Buffer | null}
 */
function resolveEncryptionKey(env = process.env) {
  const encoded = env.NOTES_ENCRYPTION_KEY?.trim();
  if (!encoded) return null;

  if (!/^(?:[A-Za-z0-9+/]{4}){10}[A-Za-z0-9+/]{3}=$/.test(encoded)) {
    throw new NotesEncryptionError(
      "NOTES_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
    );
  }

  const key = Buffer.from(encoded, "base64");
  if (key.length !== KEY_BYTES || key.toString("base64") !== encoded) {
    throw new NotesEncryptionError(
      "NOTES_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
    );
  }

  return key;
}

/** @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env] */
export function isNotesEncryptionConfigured(env = process.env) {
  try {
    return resolveEncryptionKey(env) !== null;
  } catch {
    return false;
  }
}

/**
 * @param {string} value
 * @param {string} field
 */
function decodeBase64Url(value, field) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new NotesEncryptionError(`Encrypted note ${field} is invalid.`);
  }

  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) {
    throw new NotesEncryptionError(`Encrypted note ${field} is invalid.`);
  }
  return decoded;
}

/**
 * @param {unknown} value
 * @returns {value is EncryptedNoteEnvelope}
 */
export function isEncryptedNoteEnvelope(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      "version" in value &&
      value.version === ENVELOPE_VERSION &&
      "algorithm" in value &&
      value.algorithm === ALGORITHM_LABEL &&
      "iv" in value &&
      typeof value.iv === "string" &&
      "tag" in value &&
      typeof value.tag === "string" &&
      "ciphertext" in value &&
      typeof value.ciphertext === "string",
  );
}

/**
 * Encrypts a complete note record so its content and metadata stay private.
 *
 * @param {unknown} note
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 */
export function encryptNoteRecord(note, env = process.env) {
  const key = resolveEncryptionKey(env);
  if (!key) {
    throw new NotesEncryptionError("NOTES_ENCRYPTION_KEY is not configured.");
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_BYTES,
  });
  cipher.setAAD(ADDITIONAL_DATA);

  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(note), "utf8"),
    cipher.final(),
  ]);

  return {
    version: ENVELOPE_VERSION,
    algorithm: ALGORITHM_LABEL,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  };
}

/**
 * @param {unknown} envelope
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {unknown}
 */
export function decryptNoteRecord(envelope, env = process.env) {
  const key = resolveEncryptionKey(env);
  if (!key) {
    throw new NotesEncryptionError("NOTES_ENCRYPTION_KEY is not configured.");
  }
  if (!isEncryptedNoteEnvelope(envelope)) {
    throw new NotesEncryptionError("Encrypted note format is invalid.");
  }

  const iv = decodeBase64Url(envelope.iv, "IV");
  const tag = decodeBase64Url(envelope.tag, "authentication tag");
  const ciphertext = decodeBase64Url(envelope.ciphertext, "ciphertext");
  if (iv.length !== IV_BYTES || tag.length !== AUTH_TAG_BYTES) {
    throw new NotesEncryptionError("Encrypted note format is invalid.");
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_BYTES,
    });
    decipher.setAAD(ADDITIONAL_DATA);
    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");

    return JSON.parse(plaintext);
  } catch {
    throw new NotesEncryptionError(
      "Encrypted note could not be authenticated or decrypted.",
    );
  }
}

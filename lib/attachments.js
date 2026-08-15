import { randomBytes } from "node:crypto";
import { createRedisClient } from "./redis.js";
import {
  decryptNoteRecord,
  encryptNoteRecord,
  isEncryptedNoteEnvelope,
  isNotesEncryptionConfigured,
} from "./note-crypto.js";

export const MAX_ATTACHMENTS = 10;
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
export const MAX_ATTACHMENT_NAME_LENGTH = 120;

// C0/C1 controls, which must never reach a Content-Disposition header.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g;

/**
 * Only formats that render safely from the private page. SVG is deliberately
 * absent: it is an active document, not a picture. `thumbnail` marks the ones
 * the tray can preview directly in an <img>.
 *
 * @type {Record<string, { extension: string, label: string, thumbnail: boolean }>}
 */
export const ATTACHMENT_TYPES = {
  "application/pdf": { extension: ".pdf", label: "PDF", thumbnail: false },
  "image/png": { extension: ".png", label: "PNG", thumbnail: true },
  "image/jpeg": { extension: ".jpg", label: "JPG", thumbnail: true },
  "image/webp": { extension: ".webp", label: "WEBP", thumbnail: true },
  "image/gif": { extension: ".gif", label: "GIF", thumbnail: true },
};

export const ACCEPTED_ATTACHMENT_TYPES = Object.keys(ATTACHMENT_TYPES);

const INDEX_KEY = "emir:notes:attachments";
const BLOB_KEY_PREFIX = "emir:notes:attachment:";
const ID_BYTES = 16;
const ID_LENGTH = 22;
const redis = createRedisClient();
const allowMemoryFallback =
  process.env.NODE_ENV !== "production" ||
  process.env.NOTES_STORAGE_TEST_MODE === "memory";

/**
 * Route handlers and the admin page are separate server bundles, so the
 * development fallback lives on the global scope to stay one store.
 */
const globalScope = /** @type {typeof globalThis & {
 *   __emirAttachmentMemory?: Map<string, unknown>,
 * }} */ (globalThis);
const memoryStore = (globalScope.__emirAttachmentMemory ||= new Map());

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   type: string,
 *   size: number,
 *   addedAt: string,
 * }} AttachmentMetadata
 */

export class AttachmentError extends Error {
  /** @param {string} message @param {string} code */
  constructor(message, code) {
    super(message);
    this.name = "AttachmentError";
    this.code = code;
  }
}

/** @param {Uint8Array} bytes @param {number[]} signature @param {number} offset */
function startsWith(bytes, signature, offset = 0) {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/**
 * Resolves the real format from the bytes themselves. The browser-declared
 * content type is never trusted, so a renamed executable cannot be stored.
 *
 * @param {Uint8Array} bytes
 * @returns {string | null}
 */
export function detectAttachmentType(bytes) {
  // %PDF-
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return "application/pdf";
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  // GIF87a / GIF89a
  if (
    startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }
  // RIFF....WEBP
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * @param {unknown} value
 * @param {string} type
 */
export function normalizeAttachmentName(value, type) {
  const { extension } = ATTACHMENT_TYPES[type];
  const raw = typeof value === "string" ? value : "";
  const cleaned = raw
    .replace(CONTROL_CHARACTERS, " ")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+/, "")
    .trim()
    .slice(0, MAX_ATTACHMENT_NAME_LENGTH)
    .trim();

  const name = cleaned || `attachment${extension}`;
  return name.toLowerCase().endsWith(extension) ? name : `${name}${extension}`;
}

/** @param {unknown} value @returns {value is string} */
export function isAttachmentId(value) {
  return (
    typeof value === "string" &&
    value.length === ID_LENGTH &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

/** @param {unknown} value @returns {AttachmentMetadata | null} */
function parseAttachmentMetadata(value) {
  if (!value || typeof value !== "object") return null;
  const { id, name, type, size, addedAt } =
    /** @type {Record<string, unknown>} */ (value);
  if (
    !isAttachmentId(id) ||
    typeof name !== "string" ||
    typeof type !== "string" ||
    !Object.hasOwn(ATTACHMENT_TYPES, type) ||
    typeof size !== "number" ||
    !Number.isSafeInteger(size) ||
    size <= 0 ||
    size > MAX_ATTACHMENT_BYTES ||
    typeof addedAt !== "string"
  ) {
    return null;
  }
  return {
    id,
    name: normalizeAttachmentName(name, type),
    type,
    size,
    addedAt,
  };
}

/** @param {unknown} value @returns {AttachmentMetadata[]} */
export function decodeStoredIndex(value) {
  if (value === null || value === undefined) return [];
  if (!isEncryptedNoteEnvelope(value)) {
    throw new Error("Stored attachments have an unsupported format");
  }
  const decoded = decryptNoteRecord(value);
  const items =
    decoded && typeof decoded === "object" && "items" in decoded
      ? decoded.items
      : null;
  if (!Array.isArray(items)) return [];
  return items
    .map(parseAttachmentMetadata)
    .filter(
      /** @returns {item is AttachmentMetadata} */ (item) => item !== null,
    )
    .slice(0, MAX_ATTACHMENTS);
}

/** @param {string} id */
function blobKey(id) {
  return `${BLOB_KEY_PREFIX}${id}`;
}

function assertConfigured() {
  if (!isNotesEncryptionConfigured()) {
    throw new Error("Notes encryption is not configured");
  }
  if (!redis && !allowMemoryFallback) {
    throw new Error("Notes storage is not configured");
  }
}

export function isAttachmentStorageConfigured() {
  return Boolean(
    (redis || allowMemoryFallback) && isNotesEncryptionConfigured(),
  );
}

/** @returns {Promise<AttachmentMetadata[]>} */
export async function listAttachments() {
  assertConfigured();
  const stored = redis
    ? await redis.get(INDEX_KEY)
    : memoryStore.get(INDEX_KEY);
  return decodeStoredIndex(stored);
}

/** @param {AttachmentMetadata[]} items */
async function writeIndex(items) {
  const envelope = encryptNoteRecord({ items });
  if (redis) {
    await redis.set(INDEX_KEY, envelope);
    return;
  }
  memoryStore.set(INDEX_KEY, envelope);
}

/**
 * @param {{ name: unknown, bytes: Uint8Array }} input
 * @returns {Promise<AttachmentMetadata[]>}
 */
export async function addAttachment({ name, bytes }) {
  assertConfigured();

  if (!bytes?.length) {
    throw new AttachmentError("The file is empty.", "empty");
  }
  if (bytes.length > MAX_ATTACHMENT_BYTES) {
    throw new AttachmentError("The file is too large.", "too_large");
  }

  const type = detectAttachmentType(bytes);
  if (!type) {
    throw new AttachmentError(
      "Only PDF, PNG, JPG, WEBP, and GIF files can be attached.",
      "unsupported_type",
    );
  }

  const existing = await listAttachments();
  if (existing.length >= MAX_ATTACHMENTS) {
    throw new AttachmentError(
      `Notes cannot hold more than ${MAX_ATTACHMENTS} attachments.`,
      "too_many",
    );
  }

  const id = randomBytes(ID_BYTES).toString("base64url");
  const metadata = {
    id,
    name: normalizeAttachmentName(name, type),
    type,
    size: bytes.length,
    addedAt: new Date().toISOString(),
  };
  const envelope = encryptNoteRecord({
    data: Buffer.from(bytes).toString("base64"),
  });

  if (redis) {
    await redis.set(blobKey(id), envelope);
  } else {
    memoryStore.set(blobKey(id), envelope);
  }

  const items = [...existing, metadata];
  try {
    await writeIndex(items);
  } catch (error) {
    // Never leave an unreferenced blob behind when the index write fails.
    if (redis) await redis.del(blobKey(id)).catch(() => {});
    else memoryStore.delete(blobKey(id));
    throw error;
  }
  return items;
}

/**
 * @param {unknown} id
 * @returns {Promise<{ metadata: AttachmentMetadata, bytes: Buffer } | null>}
 */
export async function loadAttachment(id) {
  assertConfigured();
  if (!isAttachmentId(id)) return null;

  const metadata = (await listAttachments()).find((item) => item.id === id);
  if (!metadata) return null;

  const stored = redis
    ? await redis.get(blobKey(id))
    : memoryStore.get(blobKey(id));
  if (!stored) return null;
  if (!isEncryptedNoteEnvelope(stored)) {
    throw new Error("Stored attachment has an unsupported format");
  }

  const decoded = decryptNoteRecord(stored);
  const data =
    decoded && typeof decoded === "object" && "data" in decoded
      ? decoded.data
      : null;
  if (typeof data !== "string") return null;

  const bytes = Buffer.from(data, "base64");
  if (bytes.length !== metadata.size) return null;
  if (detectAttachmentType(bytes) !== metadata.type) return null;

  return { metadata, bytes };
}

/**
 * @param {unknown} id
 * @returns {Promise<AttachmentMetadata[] | null>}
 */
export async function removeAttachment(id) {
  assertConfigured();
  if (!isAttachmentId(id)) return null;

  const existing = await listAttachments();
  const items = existing.filter((item) => item.id !== id);
  if (items.length === existing.length) return null;

  await writeIndex(items);
  if (redis) await redis.del(blobKey(id));
  else memoryStore.delete(blobKey(id));
  return items;
}

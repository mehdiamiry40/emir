import { createRedisClient } from "./redis.js";
import {
  decryptNoteRecord,
  encryptNoteRecord,
  isEncryptedNoteEnvelope,
  isNotesEncryptionConfigured,
} from "./note-crypto.js";

export const MAX_NOTE_LENGTH = 100_000;

const NOTE_KEY = "emir:notes:primary";
const redis = createRedisClient();
const allowMemoryFallback =
  process.env.NODE_ENV !== "production" ||
  process.env.NOTES_STORAGE_TEST_MODE === "memory";

/** @type {unknown} */
let memoryStoredNote = null;

/** @param {unknown} value */
export function normalizeNote(value) {
  if (typeof value !== "string") {
    throw new TypeError("Note content must be text");
  }
  if (value.length > MAX_NOTE_LENGTH) {
    throw new RangeError(`Note content exceeds ${MAX_NOTE_LENGTH} characters`);
  }
  return value.replaceAll("\r\n", "\n");
}

/** @param {unknown} value */
function parseStoredNote(value) {
  if (typeof value === "string") {
    return { content: normalizeNote(value), updatedAt: null };
  }
  if (
    value &&
    typeof value === "object" &&
    "content" in value &&
    typeof value.content === "string"
  ) {
    return {
      content: normalizeNote(value.content),
      updatedAt:
        "updatedAt" in value && typeof value.updatedAt === "string"
          ? value.updatedAt
          : null,
    };
  }
  return { content: "", updatedAt: null };
}

/** @param {unknown} value */
function isLegacyStoredNote(value) {
  return (
    typeof value === "string" ||
    Boolean(
      value &&
        typeof value === "object" &&
        "content" in value &&
        typeof value.content === "string",
    )
  );
}

/** @param {unknown} value */
export function decodeStoredNote(value) {
  if (value === null || value === undefined) {
    return { note: { content: "", updatedAt: null }, needsMigration: false };
  }
  if (isEncryptedNoteEnvelope(value)) {
    return {
      note: parseStoredNote(decryptNoteRecord(value)),
      needsMigration: false,
    };
  }
  if (isLegacyStoredNote(value)) {
    return { note: parseStoredNote(value), needsMigration: true };
  }
  throw new Error("Stored note has an unsupported format");
}

/** @param {unknown} value */
async function writeStoredNote(value) {
  if (redis) {
    await redis.set(NOTE_KEY, value);
    return;
  }
  memoryStoredNote = value;
}

export function isNotesConfigured() {
  return Boolean(
    (redis || allowMemoryFallback) && isNotesEncryptionConfigured(),
  );
}

export async function loadNote() {
  if (!isNotesEncryptionConfigured()) {
    throw new Error("Notes encryption is not configured");
  }
  if (!redis && !allowMemoryFallback) {
    throw new Error("Notes storage is not configured");
  }

  const stored = redis ? await redis.get(NOTE_KEY) : memoryStoredNote;
  const { note, needsMigration } = decodeStoredNote(stored);
  if (needsMigration) {
    await writeStoredNote(encryptNoteRecord(note));
  }
  return note;
}

/** @param {unknown} value */
export async function saveNote(value) {
  const note = {
    content: normalizeNote(value),
    updatedAt: new Date().toISOString(),
  };

  if (!isNotesEncryptionConfigured()) {
    throw new Error("Notes encryption is not configured");
  }
  if (!redis && !allowMemoryFallback) {
    throw new Error("Notes storage is not configured");
  }

  await writeStoredNote(encryptNoteRecord(note));
  return note;
}

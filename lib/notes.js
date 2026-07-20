import { createRedisClient } from "./redis.js";

export const MAX_NOTE_LENGTH = 100_000;

const NOTE_KEY = "emir:notes:primary";
const redis = createRedisClient();
const allowMemoryFallback =
  process.env.NODE_ENV !== "production" ||
  process.env.NOTES_STORAGE_TEST_MODE === "memory";

/** @type {{ content: string, updatedAt: string | null }} */
let memoryNote = { content: "", updatedAt: null };

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

export function isNotesConfigured() {
  return Boolean(redis || allowMemoryFallback);
}

export async function loadNote() {
  if (redis) {
    return parseStoredNote(await redis.get(NOTE_KEY));
  }
  if (allowMemoryFallback) return { ...memoryNote };
  throw new Error("Notes storage is not configured");
}

/** @param {unknown} value */
export async function saveNote(value) {
  const note = {
    content: normalizeNote(value),
    updatedAt: new Date().toISOString(),
  };

  if (redis) {
    await redis.set(NOTE_KEY, note);
    return note;
  }
  if (allowMemoryFallback) {
    memoryNote = note;
    return { ...memoryNote };
  }
  throw new Error("Notes storage is not configured");
}

import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_NOTE_LENGTH,
  decodeStoredNote,
  loadNote,
  normalizeNote,
  saveNote,
} from "../lib/notes.js";
import {
  encryptNoteRecord,
  isEncryptedNoteEnvelope,
} from "../lib/note-crypto.js";

process.env.NOTES_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");

test("notes preserve content and normalize line endings", async () => {
  const content = "First line\r\n\r\n  Indented line  ";
  const saved = await saveNote(content);
  const loaded = await loadNote();

  assert.equal(saved.content, "First line\n\n  Indented line  ");
  assert.deepEqual(loaded, saved);
});

test("legacy plaintext records are marked for encrypted migration", () => {
  const legacy = {
    content: "Existing private note",
    updatedAt: "2026-07-20T10:00:00.000Z",
  };
  const decoded = decodeStoredNote(legacy);

  assert.deepEqual(decoded, { note: legacy, needsMigration: true });
  assert.equal(isEncryptedNoteEnvelope(legacy), false);
});

test("encrypted records load without another migration", () => {
  const note = {
    content: "Encrypted private note",
    updatedAt: "2026-07-20T10:00:00.000Z",
  };
  const envelope = encryptNoteRecord(note);

  assert.equal(JSON.stringify(envelope).includes(note.content), false);
  assert.deepEqual(decodeStoredNote(envelope), {
    note,
    needsMigration: false,
  });
});

test("notes reject content beyond the storage limit", () => {
  assert.throws(
    () => normalizeNote("x".repeat(MAX_NOTE_LENGTH + 1)),
    RangeError,
  );
});

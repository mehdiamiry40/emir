import test from "node:test";
import assert from "node:assert/strict";
import {
  NotesEncryptionError,
  decryptNoteRecord,
  encryptNoteRecord,
  isEncryptedNoteEnvelope,
  isNotesEncryptionConfigured,
} from "../lib/note-crypto.js";

const TEST_KEY = Buffer.alloc(32, 7).toString("base64");
const TEST_ENV = { NOTES_ENCRYPTION_KEY: TEST_KEY };

test("notes are encrypted with randomized authenticated envelopes", () => {
  const note = {
    content: "A private note that must not appear in Redis.",
    updatedAt: "2026-07-20T10:00:00.000Z",
  };
  const first = encryptNoteRecord(note, TEST_ENV);
  const second = encryptNoteRecord(note, TEST_ENV);

  assert.equal(isEncryptedNoteEnvelope(first), true);
  assert.equal(JSON.stringify(first).includes(note.content), false);
  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.ciphertext, second.ciphertext);
  assert.deepEqual(decryptNoteRecord(first, TEST_ENV), note);
});

test("modified ciphertext and the wrong key are rejected", () => {
  const envelope = encryptNoteRecord({ content: "private" }, TEST_ENV);
  const finalCharacter = envelope.ciphertext.at(-1);
  const tampered = {
    ...envelope,
    ciphertext: `${envelope.ciphertext.slice(0, -1)}${finalCharacter === "A" ? "B" : "A"}`,
  };
  const wrongKey = {
    NOTES_ENCRYPTION_KEY: Buffer.alloc(32, 8).toString("base64"),
  };

  assert.throws(
    () => decryptNoteRecord(tampered, TEST_ENV),
    NotesEncryptionError,
  );
  assert.throws(
    () => decryptNoteRecord(envelope, wrongKey),
    NotesEncryptionError,
  );
});

test("encryption requires one valid 32-byte base64 key", () => {
  assert.equal(isNotesEncryptionConfigured(TEST_ENV), true);
  assert.equal(isNotesEncryptionConfigured({}), false);
  assert.equal(
    isNotesEncryptionConfigured({ NOTES_ENCRYPTION_KEY: "not-a-key" }),
    false,
  );
  assert.throws(() => encryptNoteRecord({}, {}), NotesEncryptionError);
});

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAX_NOTE_LENGTH,
  decodeStoredNote,
  encryptLegacyNoteForMigration,
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

test("normal reads reject unauthenticated legacy plaintext", () => {
  assert.throws(
    () => decodeStoredNote("Forged private note"),
    /unsupported unauthenticated format/,
  );
  assert.throws(
    () =>
      decodeStoredNote({
        content: "Forged private note",
        updatedAt: "2037-01-01T00:00:00.000Z",
      }),
    /unsupported unauthenticated format/,
  );
});

test("the explicit migration helper produces an authenticated envelope", () => {
  const legacy = {
    content: "Existing private note",
    updatedAt: "2026-07-20T10:00:00.000Z",
  };
  const envelope = encryptLegacyNoteForMigration(legacy);

  assert.equal(isEncryptedNoteEnvelope(envelope), true);
  assert.deepEqual(decodeStoredNote(envelope), {
    note: legacy,
    needsMigration: false,
  });
  assert.throws(
    () => encryptLegacyNoteForMigration({ ciphertext: "not legacy" }),
    /unsupported format/,
  );
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
  const oversizedContent = "x".repeat(MAX_NOTE_LENGTH + 1);

  assert.throws(
    () => normalizeNote(oversizedContent),
    RangeError,
  );
  assert.throws(
    () =>
      decodeStoredNote(
        encryptNoteRecord({ content: oversizedContent, updatedAt: null }),
      ),
    RangeError,
  );
  assert.throws(
    () => encryptLegacyNoteForMigration({ content: oversizedContent }),
    RangeError,
  );
});

test("an absent stored note still loads as empty state", () => {
  assert.deepEqual(decodeStoredNote(null), {
    note: { content: "", updatedAt: null },
    needsMigration: false,
  });
});

test("the offline migration tool requires a trusted input fingerprint", async () => {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "emir-note-migration-"),
  );
  const inputPath = join(temporaryDirectory, "legacy-note.json");
  const scriptPath = fileURLToPath(
    new URL("../scripts/migrate-legacy-note.mjs", import.meta.url),
  );
  const input = JSON.stringify({
    content: "Reviewed legacy note",
    updatedAt: "2026-07-20T10:00:00.000Z",
  });
  const digest = createHash("sha256").update(input).digest("hex");

  try {
    await writeFile(inputPath, input);
    const environment = { ...process.env };
    const accepted = spawnSync(
      process.execPath,
      [scriptPath, inputPath, digest],
      { encoding: "utf8", env: environment },
    );
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.deepEqual(decodeStoredNote(JSON.parse(accepted.stdout)).note, {
      content: "Reviewed legacy note",
      updatedAt: "2026-07-20T10:00:00.000Z",
    });

    const rejected = spawnSync(
      process.execPath,
      [scriptPath, inputPath, "0".repeat(64)],
      { encoding: "utf8", env: environment },
    );
    assert.equal(rejected.status, 1);
    assert.equal(rejected.stdout, "");
    assert.match(rejected.stderr, /does not match the trusted SHA-256/);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

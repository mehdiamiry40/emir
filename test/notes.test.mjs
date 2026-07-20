import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_NOTE_LENGTH,
  loadNote,
  normalizeNote,
  saveNote,
} from "../lib/notes.js";

test("notes preserve content and normalize line endings", async () => {
  const content = "First line\r\n\r\n  Indented line  ";
  const saved = await saveNote(content);
  const loaded = await loadNote();

  assert.equal(saved.content, "First line\n\n  Indented line  ");
  assert.deepEqual(loaded, saved);
});

test("notes reject content beyond the storage limit", () => {
  assert.throws(
    () => normalizeNote("x".repeat(MAX_NOTE_LENGTH + 1)),
    RangeError,
  );
});

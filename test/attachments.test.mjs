import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ATTACHMENT_TYPES,
  AttachmentError,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_NAME_LENGTH,
  addAttachment,
  decodeStoredIndex,
  detectAttachmentType,
  isAttachmentId,
  listAttachments,
  loadAttachment,
  normalizeAttachmentName,
  removeAttachment,
} from "../lib/attachments.js";
import { encryptNoteRecord } from "../lib/note-crypto.js";

process.env.NOTES_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

const fileRouteSource = await readFile(
  new URL("../app/api/notes/attachments/[id]/route.js", import.meta.url),
  "utf8",
);
const configSource = await readFile(
  new URL("../next.config.mjs", import.meta.url),
  "utf8",
);
const traySource = await readFile(
  new URL("../app/admin/note-attachments.jsx", import.meta.url),
  "utf8",
);

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(24, 1),
]);
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(24, 2),
]);
const GIF = Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(24, 3)]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.alloc(4, 0),
  Buffer.from("WEBP"),
  Buffer.alloc(16, 4),
]);
const PDF = Buffer.concat([
  Buffer.from("%PDF-1.7\n"),
  Buffer.from("body\n%%EOF\n"),
]);

test("attachment types are resolved from the bytes, not the file name", () => {
  assert.equal(detectAttachmentType(PDF), "application/pdf");
  assert.equal(detectAttachmentType(PNG), "image/png");
  assert.equal(detectAttachmentType(JPEG), "image/jpeg");
  assert.equal(detectAttachmentType(GIF), "image/gif");
  assert.equal(detectAttachmentType(WEBP), "image/webp");

  // Active or unknown formats are refused, whatever they claim to be.
  assert.equal(detectAttachmentType(Buffer.from("<svg xmlns='...'>")), null);
  assert.equal(detectAttachmentType(Buffer.from("<!doctype html>")), null);
  assert.equal(detectAttachmentType(Buffer.from("MZ")), null);
  assert.equal(detectAttachmentType(Buffer.alloc(0)), null);
  // A truncated RIFF header must not pass as WEBP.
  assert.equal(detectAttachmentType(Buffer.from("RIFF")), null);
});

test("files preview in place, and only pictures carry a thumbnail", () => {
  for (const [type, kind] of Object.entries(ATTACHMENT_TYPES)) {
    assert.equal(
      kind.thumbnail,
      type.startsWith("image/"),
      `${type} thumbnail flag should follow its media type`,
    );
  }

  // Previewing is only safe because the response is inert and never sniffed.
  assert.match(fileRouteSource, /inline; filename="/);
  assert.doesNotMatch(fileRouteSource, /attachment; filename/);
  assert.match(fileRouteSource, /"X-Content-Type-Options": "nosniff"/);
  // The sandbox has to live in the config: a route-level CSP loses to the
  // global /(.*) header entry.
  assert.match(configSource, /source: "\/api\/notes\/attachments\/:id"/);
  assert.match(configSource, /default-src 'none'; sandbox/);
});

test("file paste does not steal text from the notes editor", () => {
  assert.match(traySource, /closest\("textarea, input"\)/);
});

test("attachment names are sanitized and keep a matching extension", () => {
  assert.equal(
    normalizeAttachmentName("../../etc/passwd", "application/pdf"),
    "etc passwd.pdf",
  );
  assert.equal(
    normalizeAttachmentName("report.pdf", "application/pdf"),
    "report.pdf",
  );
  assert.equal(
    normalizeAttachmentName("holiday.PNG", "image/png"),
    "holiday.PNG",
  );
  // Header-breaking characters never survive into Content-Disposition.
  assert.equal(
    normalizeAttachmentName('a"b\r\nX-Evil: 1', "image/png"),
    "a b X-Evil 1.png",
  );
  assert.equal(normalizeAttachmentName("", "image/jpeg"), "attachment.jpg");
  assert.equal(normalizeAttachmentName(null, "image/gif"), "attachment.gif");
  assert.equal(normalizeAttachmentName("   ", "image/webp"), "attachment.webp");

  const long = normalizeAttachmentName("n".repeat(400), "image/png");
  assert.ok(long.length <= MAX_ATTACHMENT_NAME_LENGTH + ".png".length);
  assert.ok(long.endsWith(".png"));
});

test("attachments round-trip through encrypted storage", async () => {
  const items = await addAttachment({ name: "Scan 1.pdf", bytes: PDF });
  assert.equal(items.length, 1);

  const [metadata] = items;
  assert.equal(metadata.name, "Scan 1.pdf");
  assert.equal(metadata.type, "application/pdf");
  assert.equal(metadata.size, PDF.length);
  assert.equal(isAttachmentId(metadata.id), true);

  const loaded = await loadAttachment(metadata.id);
  assert.ok(loaded);
  assert.deepEqual(loaded.metadata, metadata);
  assert.deepEqual(Buffer.from(loaded.bytes), PDF);
  assert.deepEqual(await listAttachments(), items);

  assert.equal(await loadAttachment("not-a-valid-id"), null);
  assert.equal(await loadAttachment("A".repeat(22)), null);
});

test("attachments are rejected unless they are a supported picture or PDF", async () => {
  await assert.rejects(
    () => addAttachment({ name: "note.html", bytes: Buffer.from("<h1>hi") }),
    (error) =>
      error instanceof AttachmentError && error.code === "unsupported_type",
  );
  await assert.rejects(
    () => addAttachment({ name: "empty.png", bytes: Buffer.alloc(0) }),
    (error) => error instanceof AttachmentError && error.code === "empty",
  );
  await assert.rejects(
    () =>
      addAttachment({
        name: "huge.png",
        bytes: Buffer.concat([PNG, Buffer.alloc(MAX_ATTACHMENT_BYTES)]),
      }),
    (error) => error instanceof AttachmentError && error.code === "too_large",
  );
});

test("removing an attachment drops both its bytes and its index entry", async () => {
  const items = await addAttachment({ name: "photo.png", bytes: PNG });
  const target = items.at(-1);

  const remaining = await removeAttachment(target.id);
  assert.ok(remaining);
  assert.equal(
    remaining.some((item) => item.id === target.id),
    false,
  );
  assert.equal(await loadAttachment(target.id), null);
  assert.equal(await removeAttachment(target.id), null);
  assert.equal(await removeAttachment("bad-id"), null);
});

test("concurrent writes to the index cannot lose an entry", async () => {
  const before = await listAttachments();
  const names = Array.from({ length: 6 }, (_, index) => `race-${index}.png`);

  const added = await Promise.all(
    names.map((name) => addAttachment({ name, bytes: PNG })),
  );
  const stored = await listAttachments();

  assert.equal(stored.length, before.length + names.length);
  for (const name of names) {
    assert.ok(
      stored.some((item) => item.name === name),
      `${name} should have survived the concurrent writes`,
    );
  }
  // Every caller sees a list, and the last one to land sees them all.
  assert.equal(Math.max(...added.map((items) => items.length)), stored.length);

  const raced = stored.filter((item) => names.includes(item.name));
  await Promise.all(raced.map((item) => removeAttachment(item.id)));
  assert.deepEqual(await listAttachments(), before);
});

test("the attachment count is capped", async () => {
  const before = await listAttachments();
  for (let index = before.length; index < MAX_ATTACHMENTS; index += 1) {
    await addAttachment({ name: `file-${index}.png`, bytes: PNG });
  }
  assert.equal((await listAttachments()).length, MAX_ATTACHMENTS);

  await assert.rejects(
    () => addAttachment({ name: "one-too-many.png", bytes: PNG }),
    (error) => error instanceof AttachmentError && error.code === "too_many",
  );
});

test("the stored index rejects unauthenticated plaintext", () => {
  assert.deepEqual(decodeStoredIndex(null), []);
  assert.throws(
    () => decodeStoredIndex({ items: [] }),
    /unsupported format/,
  );
  assert.throws(
    () => decodeStoredIndex("[]"),
    /unsupported format/,
  );
});

test("index entries that no longer describe a valid attachment are dropped", () => {
  const valid = {
    id: "A".repeat(22),
    name: "keep.png",
    type: "image/png",
    size: 12,
    addedAt: "2026-08-01T00:00:00.000Z",
  };
  const index = decodeStoredIndex(
    encryptNoteRecord({
      items: [
        valid,
        { ...valid, id: "short" },
        { ...valid, type: "image/svg+xml" },
        { ...valid, size: MAX_ATTACHMENT_BYTES + 1 },
        { ...valid, size: 0 },
        "not an object",
      ],
    }),
  );

  assert.deepEqual(index, [valid]);
  assert.equal(Object.hasOwn(ATTACHMENT_TYPES, "image/svg+xml"), false);
});

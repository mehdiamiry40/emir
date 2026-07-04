import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const pageSource = await readFile(new URL("../app/page.jsx", import.meta.url), "utf8");
const prerenderedHome = await readFile(
  new URL("../.next/server/app/index.html", import.meta.url),
  "utf8",
);
const prerenderedManifest = JSON.parse(
  await readFile(
    new URL("../.next/server/app/manifest.webmanifest.body", import.meta.url),
    "utf8",
  ),
);

test("homepage keeps the requested frozen July 5 date", () => {
  assert.match(pageSource, /DATE_LABEL\s*=\s*"Sunday, July 5, 2026"/);
  assert.match(pageSource, /DATE_ISO\s*=\s*"2026-07-05"/);
  assert.match(pageSource, /dateTime=\{DATE_ISO\}/);
  assert.match(pageSource, /\{DATE_LABEL\}/);
  assert.doesNotMatch(pageSource, /new Date\(|formatToday|DateDisplay|force-dynamic/);
});

test("prerendered homepage exposes the frozen July 5 date", () => {
  assert.match(prerenderedHome, /<title>Eagle — Sunday, July 5, 2026<\/title>/);
  assert.match(prerenderedHome, /dateTime="2026-07-05"/);
  assert.match(prerenderedHome, />Sunday, July 5, 2026</);
  assert.doesNotMatch(prerenderedHome, /Today is|Saturday, July 4, 2026/);
});

test("manifest uses the current light background color", () => {
  assert.equal(prerenderedManifest.background_color, "#f6f7f2");
  assert.equal(prerenderedManifest.theme_color, "#f6f7f2");
});

import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const siteSource = await readFile(new URL("../app/site.js", import.meta.url), "utf8");
const pageSource = await readFile(new URL("../app/page.jsx", import.meta.url), "utf8");
const prerenderedHome = await readFile(
  new URL("../.next/server/app/index.html", import.meta.url),
  "utf8",
);
const prerenderedNotFound = await readFile(
  new URL("../.next/server/app/_not-found.html", import.meta.url),
  "utf8",
);
const prerenderedManifest = JSON.parse(
  await readFile(
    new URL("../.next/server/app/manifest.webmanifest.body", import.meta.url),
    "utf8",
  ),
);

test("homepage keeps the requested frozen July 5 date", () => {
  assert.match(siteSource, /DATE_LABEL\s*=\s*"Sunday, July 5, 2026"/);
  assert.match(siteSource, /DATE_ISO\s*=\s*"2026-07-05"/);
  assert.match(pageSource, /dateTime=\{DATE_ISO\}/);
  assert.match(pageSource, /\{DATE_LABEL\}/);
  assert.doesNotMatch(pageSource, /DATE_LABEL\s*=|DATE_ISO\s*=|new Date\(|formatToday|DateDisplay|force-dynamic/);
});

test("prerendered homepage exposes the frozen July 5 date", () => {
  assert.match(prerenderedHome, /<title>Eagle — Sunday, July 5, 2026<\/title>/);
  assert.match(prerenderedHome, /dateTime="2026-07-05"/);
  assert.match(prerenderedHome, />Sunday, July 5, 2026</);
  assert.match(prerenderedHome, /https:\/\/www\.emir\.com\.au\/og\.jpg/);
  assert.doesNotMatch(prerenderedHome, /Today is|Saturday, July 4, 2026/);
});

test("prerendered 404 page exposes the not-found title and content", () => {
  assert.match(prerenderedNotFound, /<title>Eagle — Not found<\/title>/);
  assert.match(prerenderedNotFound, /<h1 class="notFoundCode">404<\/h1>/);
  assert.match(prerenderedNotFound, />This page has flown away\.</);
});

test("manifest uses the current light background color", () => {
  assert.equal(prerenderedManifest.background_color, "#f6f7f2");
  assert.equal(prerenderedManifest.theme_color, "#f6f7f2");
  assert.ok(
    prerenderedManifest.icons.some(
      (icon) => icon.src === "/icon-512-maskable.png" && icon.purpose === "maskable",
    ),
  );
});

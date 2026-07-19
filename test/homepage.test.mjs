import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const siteSource = await readFile(new URL("../app/site.js", import.meta.url), "utf8");
const pageSource = await readFile(new URL("../app/page.jsx", import.meta.url), "utf8");
const dateLibSource = await readFile(new URL("../lib/date.js", import.meta.url), "utf8");
const prerenderedHome = await readFile(
  new URL("../.next/server/app/index.html", import.meta.url),
  "utf8",
);
const prerenderedNotFound = await readFile(
  new URL("../.next/server/app/_not-found.html", import.meta.url),
  "utf8",
);
const prerenderedSignIn = await readFile(
  new URL("../.next/server/app/signin.html", import.meta.url),
  "utf8",
);
const prerenderedManifest = JSON.parse(
  await readFile(
    new URL("../.next/server/app/manifest.webmanifest.body", import.meta.url),
    "utf8",
  ),
);

test("homepage keeps the requested frozen July 20 date", () => {
  assert.match(siteSource, /DATE_LABEL\s*=\s*"Monday, July 20, 2026"/);
  assert.match(siteSource, /DATE_ISO\s*=\s*"2026-07-20"/);
  // the page renders the fixed date resolved by lib/date.js
  assert.match(pageSource, /getDate\(\)/);
  assert.match(pageSource, /dateTime=\{date\.iso\}/);
  assert.match(pageSource, /\{date\.label\}/);
  // no clocks or live-date machinery: the date must never advance on its own
  assert.doesNotMatch(
    pageSource,
    /new Date\(|formatToday|DateDisplay|force-dynamic|setInterval|setTimeout/,
  );
  assert.doesNotMatch(dateLibSource, /new Date\(\)/);
});

test("date cannot be overridden by production runtime storage", () => {
  assert.doesNotMatch(dateLibSource, /process\.env/);
  assert.doesNotMatch(dateLibSource, /EDGE_CONFIG|@vercel\/edge-config/);
});

test("prerendered homepage exposes the frozen July 20 date", () => {
  assert.match(prerenderedHome, /<title>EMIR — Monday, July 20, 2026<\/title>/);
  assert.match(prerenderedHome, /dateTime="2026-07-20">20\.07\.26<\/time>/);
  assert.match(prerenderedHome, /class="date footerDate" dateTime="2026-07-20">Monday, July 20, 2026<\/time>/);
  assert.match(prerenderedHome, />EMIR</);
  assert.match(prerenderedHome, /class="heroQuote" data-text="Rise above the noise\."/);
  assert.match(prerenderedHome, /aria-label="Rise above the noise\."/);
  assert.equal((prerenderedHome.match(/class="signalRay"/g) || []).length, 96);
  assert.match(prerenderedHome, /href="\/signin"/);
  assert.match(prerenderedHome, />Sign in</);
  assert.doesNotMatch(prerenderedHome, /themeToggle/);
  assert.doesNotMatch(prerenderedHome, /MMXXVI/);
  // social card is generated dynamically and uses the same frozen date source
  assert.match(prerenderedHome, /https:\/\/www\.emir\.com\.au\/opengraph-image/);
  assert.match(prerenderedHome, /rel="canonical" href="https:\/\/www\.emir\.com\.au"/);
  assert.doesNotMatch(prerenderedHome, /Today is|Tuesday, July 7, 2026/);
});

test("prerendered 404 page exposes the not-found title and content", () => {
  assert.match(prerenderedNotFound, /<title>EMIR — Not found<\/title>/);
  assert.match(prerenderedNotFound, /<h1 class="notFoundCode">404<\/h1>/);
  assert.match(prerenderedNotFound, />This page has flown away\.</);
});

test("prerendered sign-in page exposes the expected form", () => {
  assert.match(prerenderedSignIn, /<title>EMIR — Sign in<\/title>/);
  assert.match(prerenderedSignIn, /aria-label="Sign in"/);
  assert.match(prerenderedSignIn, /<h1 class="signinTitle" id="signin-title">Sign in<\/h1>/);
  assert.doesNotMatch(prerenderedSignIn, /name="email"/);
  assert.match(prerenderedSignIn, /name="password"/);
  assert.match(prerenderedSignIn, /name="robots" content="noindex, nofollow, nocache"/);
  assert.match(prerenderedSignIn, />Home</);
});

test("manifest uses the current background color", () => {
  assert.equal(prerenderedManifest.background_color, "#2f64c7");
  assert.equal(prerenderedManifest.theme_color, "#2f64c7");
  assert.ok(
    prerenderedManifest.icons.some(
      (icon) => icon.src === "/icon-512-maskable.png" && icon.purpose === "maskable",
    ),
  );
});

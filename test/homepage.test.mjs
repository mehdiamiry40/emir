import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const siteSource = await readFile(new URL("../app/site.js", import.meta.url), "utf8");
const pageSource = await readFile(new URL("../app/page.jsx", import.meta.url), "utf8");
const signalSource = await readFile(
  new URL("../app/signal-field.jsx", import.meta.url),
  "utf8",
);
const opengraphSource = await readFile(
  new URL("../app/opengraph-image.jsx", import.meta.url),
  "utf8",
);
const signInPageSource = await readFile(
  new URL("../app/signin/page.jsx", import.meta.url),
  "utf8",
);
const signInFormSource = await readFile(
  new URL("../app/signin/signin-form.jsx", import.meta.url),
  "utf8",
);
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

test("the site carries no date source or date markup", () => {
  assert.doesNotMatch(siteSource, /DATE_LABEL|DATE_ISO/);
  // no date plumbing, clocks, or live-date machinery anywhere on the page
  assert.doesNotMatch(pageSource, /getDate|lib\/date|<time|dateTime/);
  assert.doesNotMatch(
    pageSource,
    /new Date\(|formatToday|DateDisplay|force-dynamic|setInterval|setTimeout/,
  );
  assert.doesNotMatch(opengraphSource, /getDate|lib\/date|date\.label/);
});

test("prerendered homepage renders no date", () => {
  assert.match(prerenderedHome, /<title>EMIR<\/title>/);
  assert.doesNotMatch(prerenderedHome, /<time/);
  assert.doesNotMatch(prerenderedHome, /datetime=/i);
  assert.doesNotMatch(prerenderedHome, /26\.07\.26|Sunday, July|July 26, 2026/);
  assert.match(prerenderedHome, />EMIR</);
  assert.match(prerenderedHome, /class="heroQuote" data-text="Rise above the noise\."/);
  assert.match(prerenderedHome, /aria-label="Rise above the noise\."/);
  assert.match(signalSource, /RAY_COUNT\s*=\s*128/);
  assert.match(prerenderedHome, /data-ray-count="128"/);
  assert.match(prerenderedHome, /<canvas class="signalCanvas"><\/canvas>/);
  assert.match(prerenderedHome, /href="\/signin"/);
  assert.match(prerenderedHome, />Sign in</);
  assert.doesNotMatch(prerenderedHome, /themeToggle/);
  assert.doesNotMatch(prerenderedHome, /MMXXVI/);
  // social card is generated dynamically and carries no date either
  assert.match(prerenderedHome, /https:\/\/www\.emir\.com\.au\/opengraph-image/);
  assert.match(prerenderedHome, /rel="canonical" href="https:\/\/www\.emir\.com\.au"/);
  assert.doesNotMatch(prerenderedHome, /Today is/);
});

test("prerendered 404 page exposes the not-found title and content", () => {
  assert.match(prerenderedNotFound, /<title>EMIR — Not found<\/title>/);
  assert.match(prerenderedNotFound, /<h1 class="notFoundCode">404<\/h1>/);
  assert.match(prerenderedNotFound, />This page has flown away\.</);
});

test("sign-in page exposes password and passkey authentication", () => {
  assert.match(signInPageSource, /title: `\$\{SITE_NAME\} — Sign in`/);
  assert.match(signInPageSource, /aria-label="Sign in"/);
  assert.match(signInPageSource, /className="signinTitle"/);
  assert.doesNotMatch(signInFormSource, /name="email"/);
  assert.match(signInFormSource, /name="username"/);
  assert.match(signInFormSource, /autoComplete="username"/);
  assert.match(signInFormSource, /name="password"/);
  assert.match(signInFormSource, /Sign in with passkey/);
  assert.match(signInPageSource, /\n\s+Home\n/);
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

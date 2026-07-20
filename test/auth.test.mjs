import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import assert from "node:assert/strict";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import {
  DEFAULT_ADMIN_USERNAME,
  createSessionToken,
  verifySessionToken,
  verifyUsername,
} from "../lib/session.js";

const TEST_PASSWORD = "test-eagle-password";
const TEST_USERNAME = "emir-admin";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const nextBin = fileURLToPath(
  new URL("../node_modules/next/dist/bin/next", import.meta.url),
);

test("username validation is configurable and case-insensitive", () => {
  const originalUsername = process.env.ADMIN_USERNAME;

  try {
    delete process.env.ADMIN_USERNAME;
    assert.equal(verifyUsername(DEFAULT_ADMIN_USERNAME.toUpperCase()), true);
    assert.equal(verifyUsername("not-the-default"), false);

    process.env.ADMIN_USERNAME = TEST_USERNAME;
    assert.equal(verifyUsername(TEST_USERNAME.toUpperCase()), true);
    assert.equal(verifyUsername(DEFAULT_ADMIN_USERNAME), false);
  } finally {
    if (originalUsername === undefined) delete process.env.ADMIN_USERNAME;
    else process.env.ADMIN_USERNAME = originalUsername;
  }
});

test("session tokens are signed with the admin password", () => {
  const originalPassword = process.env.ADMIN_PASSWORD;

  try {
    process.env.ADMIN_PASSWORD = TEST_PASSWORD;
    const token = createSessionToken();
    assert.equal(verifySessionToken(token), true);

    process.env.ADMIN_PASSWORD = "a-different-admin-password";
    assert.equal(verifySessionToken(token), false);
  } finally {
    if (originalPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = originalPassword;
  }
});

async function findOpenPort() {
  const server = createServer();

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const { port } = server.address();

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.close(resolve);
  });

  return port;
}

async function startServer() {
  const port = await findOpenPort();
  const url = `http://127.0.0.1:${port}`;
  let output = "";
  const server = spawn(
    process.execPath,
    [nextBin, "start", "-H", "127.0.0.1", "-p", String(port)],
    {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ADMIN_USERNAME: TEST_USERNAME,
        ADMIN_PASSWORD: TEST_PASSWORD,
        AUTH_RATE_LIMIT_TEST_MODE: "memory",
        NOTES_STORAGE_TEST_MODE: "memory",
      },
    },
  );

  server.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode != null) {
      throw new Error(`next start exited early:\n${output}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return { server, url };
      }
    } catch {}

    await delay(250);
  }

  server.kill();
  throw new Error(`Timed out waiting for next start:\n${output}`);
}

test("sign-in flow protects the admin page", async (t) => {
  const { server, url } = await startServer();
  t.after(async () => {
    server.kill();
    await once(server, "exit").catch(() => {});
  });

  const publicResponse = await fetch(url);
  assert.match(
    publicResponse.headers.get("content-security-policy") ?? "",
    /default-src 'self'/,
  );
  assert.equal(publicResponse.headers.get("x-powered-by"), null);

  // unauthenticated /admin redirects to /signin
  const adminResponse = await fetch(`${url}/admin`, { redirect: "manual" });
  assert.equal(adminResponse.status, 307);
  assert.match(adminResponse.headers.get("location") ?? "", /\/signin$/);

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  });
  t.after(() => browser.close());

  const context = await browser.newContext({ reducedMotion: "reduce" });
  t.after(() => context.close());
  const page = await context.newPage();

  // wrong password shows a generic error and stays on /signin
  await page.goto(`${url}/signin`, { waitUntil: "load" });
  await page.fill('input[name="username"]', TEST_USERNAME);
  await page.fill('input[name="password"]', "not-the-password");
  await page.click(".signinSubmit");
  await page.waitForSelector(".signinStatus");
  assert.equal(
    (await page.textContent(".signinStatus"))?.trim(),
    "Incorrect username or password.",
  );
  assert.match(page.url(), /\/signin$/);

  // wrong username is rejected without revealing which credential failed
  await page.reload({ waitUntil: "load" });
  await page.fill('input[name="username"]', "not-the-username");
  await page.fill('input[name="password"]', TEST_PASSWORD);
  await page.click(".signinSubmit");
  await page.waitForSelector(".signinStatus");
  assert.equal(
    (await page.textContent(".signinStatus"))?.trim(),
    "Incorrect username or password.",
  );
  assert.match(page.url(), /\/signin$/);

  // correct credentials land on the read-only private page
  await page.reload({ waitUntil: "load" });
  await page.fill('input[name="username"]', TEST_USERNAME.toUpperCase());
  await page.fill('input[name="password"]', TEST_PASSWORD);
  await page.click(".signinSubmit");
  await page.waitForURL("**/admin", { timeout: 15000 });
  await page.waitForSelector(".notesEditor");
  assert.equal((await page.textContent(".notesTitle"))?.trim(), "Notes");

  const noteContent = "A persisted private note.\nSecond line.";
  await page.fill(".notesEditor", noteContent);
  assert.equal((await page.textContent(".notesStatus"))?.trim(), "Unsaved");
  await page.click(".notesSave");
  await page.waitForFunction(
    () => document.querySelector(".notesStatus")?.textContent?.trim() === "Saved",
  );
  await page.reload({ waitUntil: "load" });
  assert.equal(await page.inputValue(".notesEditor"), noteContent);

  const accessibility = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(
    accessibility.violations,
    [],
    "authenticated notes editor should have no WCAG A/AA violations",
  );

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
    { width: 390, height: 667 },
  ]) {
    await page.setViewportSize(viewport);
    await page.reload({ waitUntil: "load" });
    const layout = await page.evaluate(() => {
      const editor = document.querySelector(".notesEditor")?.getBoundingClientRect();
      const footer = document.querySelector(".notesFooter")?.getBoundingClientRect();
      const signOut = document.querySelector(".adminSignout")?.getBoundingClientRect();
      return {
        editorVisible: Boolean(
          editor && editor.top >= 0 && editor.bottom <= window.innerHeight,
        ),
        footerVisible: Boolean(
          footer && footer.top >= 0 && footer.bottom <= window.innerHeight,
        ),
        signOutVisible: Boolean(
          signOut && signOut.top >= 0 && signOut.bottom <= window.innerHeight,
        ),
        noHorizontalScroll:
          document.documentElement.scrollWidth <= window.innerWidth + 1,
        noVerticalScroll:
          document.documentElement.scrollHeight <= window.innerHeight + 1,
      };
    });
    assert.deepEqual(
      layout,
      {
        editorVisible: true,
        footerVisible: true,
        signOutVisible: true,
        noHorizontalScroll: true,
        noVerticalScroll: true,
      },
      `${viewport.width}x${viewport.height} notes layout should remain visible without page scroll`,
    );
  }

  // sign out returns home and /admin is locked again
  await page.click(".adminSignout");
  await page.waitForURL(new RegExp(`${url.replaceAll(".", "\\.")}/?$`), {
    timeout: 15000,
  });
  await page.goto(`${url}/admin`, { waitUntil: "load" });
  assert.match(page.url(), /\/signin$/);
});

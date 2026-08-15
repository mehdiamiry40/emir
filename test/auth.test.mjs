import { spawn } from "node:child_process";
import { createHash, createHmac } from "node:crypto";
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
  MAX_PASSWORD_LENGTH,
  SESSION_MAX_AGE,
  createSessionToken,
  isConfigured,
  revokeSessionToken,
  verifyPassword,
  verifySessionToken,
  verifyUsername,
} from "../lib/session.js";
import { addPasskey, removePasskey } from "../lib/passkeys.js";

const TEST_PASSWORD = "test-eagle-password";
const TEST_USERNAME = "emir-admin";
// A real 64x64 PNG, so the tray renders a thumbnail instead of a broken image.
const TEST_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAP0lEQVR42u3PQREAAAgDoC251a3gLzhQwM2qYwQCgUAgEAgEAoFAIBAIBAKBQCAQCAQCgUAgEAgEAoFAIBAI3g8WWAABtVXvBQAAAABJRU5ErkJggg==",
  "base64",
);
const TEST_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);
const TEST_NOTES_ENCRYPTION_KEY = Buffer.alloc(32, 11).toString("base64");
const TEST_SESSION_SECRET = Buffer.alloc(32, 23).toString("base64");

/** @param {() => Promise<void>} run */
async function withSessionSecret(run) {
  const originalSessionSecret = process.env.SESSION_SECRET;
  const originalPassword = process.env.ADMIN_PASSWORD;
  process.env.SESSION_SECRET = TEST_SESSION_SECRET;
  process.env.ADMIN_PASSWORD = TEST_PASSWORD;
  try {
    await run();
  } finally {
    if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSessionSecret;
    if (originalPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = originalPassword;
  }
}

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

test("password verification rejects empty and oversized secrets", () => {
  const originalPassword = process.env.ADMIN_PASSWORD;

  try {
    process.env.ADMIN_PASSWORD = TEST_PASSWORD;
    assert.equal(verifyPassword(TEST_PASSWORD), true);
    assert.equal(verifyPassword(""), false);
    assert.equal(verifyPassword("a".repeat(MAX_PASSWORD_LENGTH + 1)), false);
  } finally {
    if (originalPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = originalPassword;
  }
});

test("session tokens do not disclose a password-verification oracle", async () => {
  const originalPassword = process.env.ADMIN_PASSWORD;

  try {
    process.env.ADMIN_PASSWORD = TEST_PASSWORD;
    await withSessionSecret(async () => {
      const token = await createSessionToken();
      assert.equal(await verifySessionToken(token), true);

      const parts = token.split(".");
      const body = parts.slice(0, -1).join(".");
      const passwordDerivedKey = createHash("sha256")
        .update(`emir-session:${TEST_PASSWORD}`)
        .digest();
      const passwordDerivedMac = createHmac("sha256", passwordDerivedKey)
        .update(body)
        .digest("base64url");
      assert.notEqual(parts.at(-1), passwordDerivedMac);

      process.env.ADMIN_PASSWORD = "a-different-admin-password";
      assert.equal(await verifySessionToken(token), false);
    });
  } finally {
    if (originalPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = originalPassword;
  }
});

test("session signing migrates safely from the notes key and fails closed on invalid override", async () => {
  const originalPassword = process.env.ADMIN_PASSWORD;
  const originalNotesKey = process.env.NOTES_ENCRYPTION_KEY;
  const originalSessionSecret = process.env.SESSION_SECRET;

  try {
    process.env.ADMIN_PASSWORD = TEST_PASSWORD;
    process.env.NOTES_ENCRYPTION_KEY = TEST_NOTES_ENCRYPTION_KEY;
    delete process.env.SESSION_SECRET;
    assert.equal(isConfigured(), true);

    const token = await createSessionToken();
    assert.equal(await verifySessionToken(token), true);

    process.env.SESSION_SECRET = "not-a-valid-base64-key";
    assert.equal(isConfigured(), false);
    assert.equal(await verifySessionToken(token), false);
    await assert.rejects(createSessionToken(), /signing key is not configured/);
  } finally {
    if (originalPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = originalPassword;
    if (originalNotesKey === undefined) delete process.env.NOTES_ENCRYPTION_KEY;
    else process.env.NOTES_ENCRYPTION_KEY = originalNotesKey;
    if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSessionSecret;
  }
});

test("session authentication method and expiry are integrity protected", async () => {
  await withSessionSecret(async () => {
    const token = await createSessionToken();
    const parts = token.split(".");

    const changedExpiry = [...parts];
    changedExpiry[2] = String(Number(changedExpiry[2]) + 3600);
    assert.equal(await verifySessionToken(changedExpiry.join(".")), false);

    const changedMethod = [...parts];
    changedMethod[3] = "passkey";
    changedMethod.splice(4, 0, "Zm9yZ2VkLWNyZWRlbnRpYWw");
    assert.equal(await verifySessionToken(changedMethod.join(".")), false);
  });
});

test("sessions still expire after the configured one-week lifetime", async () => {
  await withSessionSecret(async () => {
    const expiredToken = await createSessionToken({
      now: Date.now() - (SESSION_MAX_AGE + 1) * 1000,
    });
    assert.equal(await verifySessionToken(expiredToken), false);
  });
});

test("revoking a session rejects a copied token", async () => {
  await withSessionSecret(async () => {
    const token = await createSessionToken();
    assert.equal(await verifySessionToken(token), true);

    assert.equal(await revokeSessionToken(token), true);
    assert.equal(await verifySessionToken(token), false);
  });
});

test("removing a passkey invalidates sessions created by it", async () => {
  const credentialId = "c2Vzc2lvbi10ZXN0LWNyZWRlbnRpYWw";
  const userId = "c2Vzc2lvbi10ZXN0LXVzZXI";
  await addPasskey({
    userId,
    id: credentialId,
    publicKey: new Uint8Array([1, 2, 3, 4]),
    counter: 0,
    transports: ["internal"],
    deviceType: "singleDevice",
    backedUp: false,
  });

  await withSessionSecret(async () => {
    const token = await createSessionToken({ passkeyId: credentialId });
    assert.equal(await verifySessionToken(token), true);

    await removePasskey(credentialId);
    assert.equal(await verifySessionToken(token), false);

    await addPasskey({
      userId,
      id: credentialId,
      publicKey: new Uint8Array([9, 8, 7, 6]),
      counter: 0,
      transports: ["internal"],
      deviceType: "singleDevice",
      backedUp: false,
    });
    assert.equal(await verifySessionToken(token), false);
    await removePasskey(credentialId);
  });
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
  const url = `http://localhost:${port}`;
  let output = "";
  const server = spawn(
    process.execPath,
    [nextBin, "start", "-H", "localhost", "-p", String(port)],
    {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ADMIN_USERNAME: TEST_USERNAME,
        ADMIN_PASSWORD: TEST_PASSWORD,
        NOTES_ENCRYPTION_KEY: TEST_NOTES_ENCRYPTION_KEY,
        AUTH_RATE_LIMIT_TEST_MODE: "memory",
        NOTES_STORAGE_TEST_MODE: "memory",
        PASSKEY_STORAGE_TEST_MODE: "memory",
        SESSION_STORAGE_TEST_MODE: "memory",
        PASSKEY_RP_ID: "localhost",
        PASSKEY_ORIGINS: url,
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
  assert.match(
    publicResponse.headers.get("permissions-policy") ?? "",
    /publickey-credentials-get=\(self\)/,
  );
  assert.equal(publicResponse.headers.get("x-powered-by"), null);

  // unauthenticated /admin redirects to /signin
  const adminResponse = await fetch(`${url}/admin`, { redirect: "manual" });
  assert.equal(adminResponse.status, 307);
  assert.match(adminResponse.headers.get("location") ?? "", /\/signin$/);

  const registrationResponse = await fetch(
    `${url}/api/passkeys/registration/options`,
    { method: "POST" },
  );
  assert.equal(registrationResponse.status, 401);

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  });
  t.after(() => browser.close());

  const context = await browser.newContext({ reducedMotion: "reduce" });
  t.after(() => context.close());
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    },
  );
  t.after(async () => {
    await cdp
      .send("WebAuthn.removeVirtualAuthenticator", { authenticatorId })
      .catch(() => {});
    await cdp.send("WebAuthn.disable").catch(() => {});
  });

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

  await page.goto(`${url}/signin`, { waitUntil: "load" });
  await page.waitForURL("**/admin", { timeout: 15000 });
  await page.waitForSelector(".notesEditor");

  // passkey registration is available only inside the authenticated page
  await page.click(".adminPasskeys");
  await page.waitForFunction(
    () => document.querySelector(".passkeyDialog")?.open === true,
  );
  assert.equal((await page.textContent(".passkeyEmpty"))?.trim(), "No passkeys");
  const passkeyDialogAccessibility = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(
    passkeyDialogAccessibility.violations,
    [],
    "open passkey manager should have no accessibility violations",
  );
  await page.click(".passkeyAdd");
  await page.waitForFunction(
    () => {
      const status = document.querySelector(".passkeyStatus")?.textContent?.trim();
      return Boolean(status && status !== "Waiting for your device...");
    },
  );
  assert.equal(
    (await page.textContent(".passkeyStatus"))?.trim(),
    "Passkey added.",
  );
  assert.equal(await page.locator(".passkeyItem").count(), 1);
  // the row says how the credential is stored, and prints no date
  assert.match(
    (await page.textContent(".passkeyDetails span"))?.trim() ?? "",
    /^(Synced|Device)$/,
  );
  const listedPasskeyAccessibility = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(
    listedPasskeyAccessibility.violations,
    [],
    "passkey manager listing a credential should have no accessibility violations",
  );
  await page.click(".passkeyClose");

  const noteContent = "A persisted private note.\nSecond line.";
  await page.fill(".notesEditor", noteContent);
  assert.equal((await page.textContent(".notesStatus"))?.trim(), "Unsaved");
  await page.click(".notesSave");
  await page.waitForFunction(
    () => document.querySelector(".notesStatus")?.textContent?.trim() === "Saved",
  );
  await page.reload({ waitUntil: "load" });
  assert.equal(await page.inputValue(".notesEditor"), noteContent);

  // attachments, so the axe run below covers a populated tray rather than an
  // empty one: thumbnails, type badges, and the per-file remove buttons
  await page.setInputFiles(".notesFilePicker", [
    { name: "note photo.png", mimeType: "image/png", buffer: TEST_PNG },
    { name: "note scan.pdf", mimeType: "application/pdf", buffer: TEST_PDF },
  ]);
  await page.waitForFunction(
    () => document.querySelectorAll(".notesAttachment").length === 2,
    null,
    { timeout: 15000 },
  );
  assert.deepEqual(
    await page.$$eval(".notesAttachmentName", (nodes) =>
      nodes.map((node) => node.textContent),
    ),
    ["note photo.png", "note scan.pdf"],
  );

  const accessibility = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(
    accessibility.violations,
    [],
    "authenticated notes editor and attachment tray should have no WCAG A/AA violations",
  );

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
    { width: 390, height: 667 },
  ]) {
    await page.setViewportSize(viewport);
    await page.reload({ waitUntil: "load" });
    // measure with the tray populated: it is the tallest the page ever gets
    await page.waitForFunction(
      () => document.querySelectorAll(".notesAttachment").length === 2,
      null,
      { timeout: 15000 },
    );
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

  const passwordSession = (await context.cookies()).find(
    (cookie) => cookie.name === "emir_session",
  );
  assert.ok(passwordSession);

  // sign out, then sign back in without a username or password
  await page.click(".adminSignout");
  await page.waitForURL(new RegExp(`${url.replaceAll(".", "\\.")}/?$`), {
    timeout: 15000,
  });
  const copiedPasswordSessionResponse = await fetch(`${url}/admin`, {
    headers: {
      Cookie: `${passwordSession.name}=${passwordSession.value}`,
    },
    redirect: "manual",
  });
  assert.equal(copiedPasswordSessionResponse.status, 307);
  assert.match(
    copiedPasswordSessionResponse.headers.get("location") ?? "",
    /\/signin$/,
  );
  await page.goto(`${url}/signin`, { waitUntil: "load" });
  await page.click(".signinPasskey");
  await page.waitForURL("**/admin", { timeout: 15000 });
  assert.equal(await page.inputValue(".notesEditor"), noteContent);
  const passkeySession = (await context.cookies()).find(
    (cookie) => cookie.name === "emir_session",
  );
  assert.ok(passkeySession);

  // removal immediately prevents another passkey sign-in
  await page.click(".adminPasskeys");
  await page.waitForFunction(
    () => document.querySelector(".passkeyDialog")?.open === true,
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.click(".passkeyRemove");
  await page.waitForSelector(".passkeyEmpty");
  const removedPasskeySessionResponse = await fetch(`${url}/admin`, {
    headers: {
      Cookie: `${passkeySession.name}=${passkeySession.value}`,
    },
    redirect: "manual",
  });
  assert.equal(removedPasskeySessionResponse.status, 307);
  assert.match(
    removedPasskeySessionResponse.headers.get("location") ?? "",
    /\/signin$/,
  );
  await page.click(".passkeyClose");
  await page.click(".adminSignout");
  await page.waitForURL(new RegExp(`${url.replaceAll(".", "\\.")}/?$`), {
    timeout: 15000,
  });
  await page.goto(`${url}/signin`, { waitUntil: "load" });
  await page.click(".signinPasskey");
  await page.waitForFunction(
    () =>
      document.querySelector(".signinStatus")?.textContent?.trim() ===
      "No passkey is registered. Sign in with your password first.",
  );

  await page.goto(`${url}/admin`, { waitUntil: "load" });
  assert.match(page.url(), /\/signin$/);
});

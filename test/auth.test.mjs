import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const TEST_PASSWORD = "test-eagle-password";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const nextBin = fileURLToPath(
  new URL("../node_modules/next/dist/bin/next", import.meta.url),
);

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
      env: { ...process.env, ADMIN_PASSWORD: TEST_PASSWORD },
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

  // unauthenticated /admin redirects to /signin
  const adminResponse = await fetch(`${url}/admin`, { redirect: "manual" });
  assert.equal(adminResponse.status, 307);
  assert.match(adminResponse.headers.get("location") ?? "", /\/signin$/);

  // unauthenticated date API is rejected
  const apiResponse = await fetch(`${url}/api/date`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ iso: "2030-01-01" }),
  });
  assert.equal(apiResponse.status, 401);

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  });
  t.after(() => browser.close());

  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();

  // wrong password shows an error and stays on /signin
  await page.goto(`${url}/signin`, { waitUntil: "load" });
  await page.fill('input[name="password"]', "not-the-password");
  await page.click(".signinSubmit");
  await page.waitForSelector(".signinStatus");
  assert.equal(
    (await page.textContent(".signinStatus"))?.trim(),
    "Wrong password.",
  );
  assert.match(page.url(), /\/signin$/);

  // correct password lands on /admin with the date editor
  await page.fill('input[name="password"]', TEST_PASSWORD);
  await page.click(".signinSubmit");
  await page.waitForURL("**/admin", { timeout: 15000 });
  await page.waitForSelector(".adminPreview");
  assert.ok((await page.textContent(".adminPreview"))?.includes("2026"));

  // authenticated date changes are disabled: API responds 501
  const saveStatus = await page.evaluate(async () => {
    const res = await fetch("/api/date", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ iso: "2030-01-01" }),
    });
    return res.status;
  });
  assert.equal(saveStatus, 501);

  // sign out returns home and /admin is locked again
  await page.click(".adminSignout");
  await page.waitForURL(new RegExp(`${url.replaceAll(".", "\\.")}/?$`), {
    timeout: 15000,
  });
  await page.goto(`${url}/admin`, { waitUntil: "load" });
  assert.match(page.url(), /\/signin$/);
});

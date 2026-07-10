import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";

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

test("homepage and sign-in page are visible and non-scrollable", async (t) => {
  const { server, url } = await startServer();
  t.after(async () => {
    server.kill();
    await once(server, "exit").catch(() => {});
  });

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  });
  t.after(() => browser.close());

  const page = await browser.newPage();
  const viewports = [
    { label: "desktop", width: 1280, height: 720 },
    { label: "mobile", width: 390, height: 844 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(url, { waitUntil: "load" });

    const state = await page.evaluate(() => {
      const eagle = document.querySelector(".eagleWrap");
      const date = document.querySelector(".date");
      const login = document.querySelector(".signinCta");

      function rectFor(element) {
        const rect = element?.getBoundingClientRect();
        return rect
          ? {
              bottom: rect.bottom,
              height: rect.height,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              width: rect.width,
            }
          : null;
      }

      function inViewport(rect) {
        return (
          rect &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.left >= -1 &&
          rect.top >= -1 &&
          rect.right <= window.innerWidth + 1 &&
          rect.bottom <= window.innerHeight + 1
        );
      }

      const eagleRect = rectFor(eagle);
      const dateRect = rectFor(date);
      const loginRect = rectFor(login);

      return {
        dateTime: date?.getAttribute("datetime"),
        dateText: date?.textContent?.trim(),
        dateFontSize: Number.parseFloat(getComputedStyle(date).fontSize),
        eagleLabel: eagle?.getAttribute("aria-label"),
        eagleTag: eagle?.tagName,
        eagleVisible: inViewport(eagleRect),
        dateVisible: inViewport(dateRect),
        loginHref: login?.getAttribute("href"),
        loginText: login?.textContent?.trim(),
        loginVisible: inViewport(loginRect),
        quoteTextNodes: document.querySelectorAll(".heroQuote text").length,
        noHorizontalScroll:
          document.documentElement.scrollWidth <= window.innerWidth + 1 &&
          document.body.scrollWidth <= window.innerWidth + 1,
        noVerticalScroll:
          document.documentElement.scrollHeight <= window.innerHeight + 1 &&
          document.body.scrollHeight <= window.innerHeight + 1,
      };
    });

    assert.deepEqual(
      state,
      {
        dateTime: "2026-07-09",
        dateText: "Thursday, July 9, 2026",
        dateFontSize: 11,
        dateVisible: true,
        eagleLabel: "Animate eagle",
        eagleTag: "BUTTON",
        eagleVisible: true,
        loginHref: "/signin",
        loginText: "Sign in",
        loginVisible: true,
        quoteTextNodes: 6,
        noHorizontalScroll: true,
        noVerticalScroll: true,
      },
      `${viewport.label} layout should keep the eagle/date visible without scroll`,
    );

    await page.goto(`${url}/signin`, { waitUntil: "load" });

    const signInState = await page.evaluate(() => {
      const panel = document.querySelector(".signinPanel");
      const password = document.querySelector('input[name="password"]');
      const submit = document.querySelector(".signinSubmit");
      const home = document.querySelector(".loginButton");

      function rectFor(element) {
        const rect = element?.getBoundingClientRect();
        return rect
          ? {
              bottom: rect.bottom,
              height: rect.height,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              width: rect.width,
            }
          : null;
      }

      function inViewport(rect) {
        return (
          rect &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.left >= -1 &&
          rect.top >= -1 &&
          rect.right <= window.innerWidth + 1 &&
          rect.bottom <= window.innerHeight + 1
        );
      }

      return {
        emailPresent: Boolean(document.querySelector('input[name="email"]')),
        homeHref: home?.getAttribute("href"),
        homeText: home?.textContent?.trim(),
        panelVisible: inViewport(rectFor(panel)),
        passwordVisible: inViewport(rectFor(password)),
        submitText: submit?.textContent?.trim(),
        submitVisible: inViewport(rectFor(submit)),
        title: document.querySelector(".signinTitle")?.textContent?.trim(),
        noHorizontalScroll:
          document.documentElement.scrollWidth <= window.innerWidth + 1 &&
          document.body.scrollWidth <= window.innerWidth + 1,
        noVerticalScroll:
          document.documentElement.scrollHeight <= window.innerHeight + 1 &&
          document.body.scrollHeight <= window.innerHeight + 1,
      };
    });

    assert.deepEqual(
      signInState,
      {
        emailPresent: false,
        homeHref: "/",
        homeText: "Home",
        noHorizontalScroll: true,
        noVerticalScroll: true,
        panelVisible: true,
        passwordVisible: true,
        submitText: "Sign in",
        submitVisible: true,
        title: "Sign in",
      },
      `${viewport.label} sign-in layout should stay visible without scroll`,
    );
  }
});

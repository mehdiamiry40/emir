import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  inlineScripts,
  requiredScriptHashes,
  sha256Source,
  stripPreviewToolbar,
  uncoveredInlineScripts,
} from "../lib/csp-inline.mjs";
import {
  CSP_HASH_PLACEHOLDER,
  assertProductionScriptSrc,
  buildContentSecurityPolicy,
  buildDevContentSecurityPolicy,
  directiveValue,
} from "../lib/csp-policy.mjs";
import {
  assertDeploymentOutput,
  publishInlineScriptHashes,
  rewriteSitePolicies,
  stripPreviewToolbarFiles,
} from "../lib/csp-publish.mjs";

const GTAG = "window.dataLayer = window.dataLayer || [];";

function page(extra = "") {
  const payload = JSON.stringify([0, { children: GTAG, id: "analytics" }]);
  return `<!doctype html><script src="/_next/static/chunks/app.js"></script>
<script type="application/ld+json">{"@type":"WebSite"}</script>
<script>(self.__next_s=self.__next_s||[]).push(${payload})</script>
<script>(self.__next_f=self.__next_f||[]).push([0])</script>
${extra}`;
}

test("hashes the script source the browser hashes", () => {
  assert.equal(sha256Source("window.__ok = 1"), "'sha256-jHIk/15hbltKLWfuHJjRVWpRTvmtGvByNu5yNRfH7oc='");
});

test("ignores JSON-LD and external scripts, and hashes next/script payloads", () => {
  const scripts = inlineScripts(page());
  assert.equal(scripts.length, 2);
  assert.deepEqual(scripts[0]?.dynamic, [GTAG]);
  const hashes = requiredScriptHashes(page());
  assert.ok(hashes.includes(sha256Source(scripts[0].text)));
  assert.ok(hashes.includes(sha256Source(GTAG)));
  assert.ok(hashes.includes(sha256Source("(self.__next_f=self.__next_f||[]).push([0])")));
});

test("keeps unsafe-eval out of the production script-src", () => {
  const policy = buildContentSecurityPolicy([sha256Source("var ready = true;")]);
  assert.equal(directiveValue(policy, "script-src").includes("'unsafe-inline'"), false);
  assert.equal(directiveValue(policy, "script-src").includes("'unsafe-eval'"), false);
  assert.equal(directiveValue(policy, "script-src-attr"), "'none'");
  assert.equal(directiveValue(policy, "frame-ancestors"), "'none'");
  assert.match(directiveValue(policy, "style-src"), /'unsafe-inline'/);
  assert.equal(policy.includes("vercel.live"), false);
  assert.equal(policy.includes("googletagmanager.com"), false);
  assert.doesNotThrow(() => assertProductionScriptSrc(policy));
  assert.equal(uncoveredInlineScripts("<script>var ready = true;</script>", policy).length, 0);
});

test("ships a placeholder until the post-build step fills hashes", () => {
  const policy = buildContentSecurityPolicy([]);
  assert.ok(policy.includes(CSP_HASH_PLACEHOLDER));
  assert.throws(() => assertProductionScriptSrc(policy), /placeholder/);
});

test("allows eval only in the development policy", () => {
  const dev = buildDevContentSecurityPolicy();
  assert.match(directiveValue(dev, "script-src"), /'unsafe-eval'/);
  assert.match(directiveValue(dev, "script-src"), /'unsafe-inline'/);
  assert.match(directiveValue(dev, "script-src"), /va\.vercel-scripts\.com/);
  assert.equal(dev.includes("upgrade-insecure-requests"), false);
});

test("strips the unconditional preview toolbar and keeps the production cookie gate", () => {
  const injected =
    'before;var r=document.createElement("script");r.src="https://vercel.live/_next-live/feedback/feedback.js",r.setAttribute("data-deployment-id",globalThis.NEXT_DEPLOYMENT_ID),(document.head||document.documentElement).appendChild(r);after';
  assert.equal(stripPreviewToolbar(injected), "before;void 0;after");
  assert.equal(stripPreviewToolbar("var ready = true;"), "var ready = true;");
  const production =
    'if(e.i(47167),/(?:^|;\\s)__vercel_toolbar=1(?:;|$)/.test(document.cookie)){var r=document.createElement("script");r.src="https://vercel.live/_next-live/feedback/feedback.js",r.setAttribute("data-explicit-opt-in","true"),r.setAttribute("data-cookie-opt-in","true"),r.setAttribute("data-deployment-id",globalThis.NEXT_DEPLOYMENT_ID),(document.head||document.documentElement).appendChild(r)}';
  assert.equal(stripPreviewToolbar(production), production);
  assert.throws(
    () => stripPreviewToolbar('const src = "https://vercel.live/_next-live/feedback/feedback.js";'),
    /unrecognized/,
  );
});

test("strips a symlinked chunk in the deployment output", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "csp-toolbar-"));
  const injected =
    'before;var r=document.createElement("script");r.src="https://vercel.live/_next-live/feedback/feedback.js",r.setAttribute("data-deployment-id",globalThis.NEXT_DEPLOYMENT_ID),(document.head||document.documentElement).appendChild(r);after';
  try {
    const realDir = path.join(root, "real");
    const linkDir = path.join(root, "output", "static");
    await mkdir(realDir, { recursive: true });
    await mkdir(path.dirname(linkDir), { recursive: true });
    const realFile = path.join(realDir, "chunk.js");
    await writeFile(realFile, injected);
    await symlink(realDir, linkDir);
    const stripped = await stripPreviewToolbarFiles(path.join(root, "output"));
    assert.equal(stripped.length, 1);
    assert.equal(await readFile(realFile, "utf8"), "before;void 0;after");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rewrites a deployment config that the adapter wrote with the placeholder", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "csp-"));
  const dist = path.join(root, ".next");
  const html = "<!doctype html><script>var ready = true;</script>";
  const placeholder = buildContentSecurityPolicy([]);
  const attachmentPolicy = "default-src 'none'; sandbox";
  await mkdir(path.join(dist, "server", "app"), { recursive: true });
  await mkdir(path.join(dist, "output"), { recursive: true });
  await writeFile(path.join(dist, "server", "app", "index.html"), html);
  await writeFile(
    path.join(dist, "routes-manifest.json"),
    JSON.stringify({
      headers: [
        { source: "/:path*", headers: [{ key: "Content-Security-Policy", value: placeholder }] },
        {
          source: "/api/notes/attachments/:id",
          headers: [{ key: "Content-Security-Policy", value: attachmentPolicy }],
        },
      ],
    }),
  );
  const routing = {
    beforeMiddleware: [{ headers: { "content-security-policy": placeholder } }],
    attachment: { headers: { "content-security-policy": attachmentPolicy } },
  };
  const published = await publishInlineScriptHashes({ distDir: dist, routing });
  assert.equal(JSON.stringify(routing).includes(CSP_HASH_PLACEHOLDER), false);
  assert.ok(published.hashList.length >= 1);
  assert.equal(routing.attachment.headers["content-security-policy"], attachmentPolicy);

  const dropped = published.policy.replace(published.hashList[0], "");
  await writeFile(
    path.join(dist, "output", "config.json"),
    JSON.stringify({
      routes: [
        { headers: { "Content-Security-Policy": dropped } },
        { headers: { "Content-Security-Policy": attachmentPolicy } },
      ],
    }),
  );
  await assertDeploymentOutput({ projectRoot: root, distDir: dist, routing, requireDeploymentOutput: true });
  const config = JSON.parse(await readFile(path.join(dist, "output", "config.json"), "utf8"));
  const serialised = JSON.stringify(config);
  assert.equal(serialised.includes(CSP_HASH_PLACEHOLDER), false);
  assert.equal(serialised.includes(published.hashList[0]), true);
  assert.equal(serialised.includes(published.policy), true);
  assert.equal(config.routes[1].headers["Content-Security-Policy"], attachmentPolicy);
  assert.equal(rewriteSitePolicies({ policy: attachmentPolicy }, published.policy), 0);
  await rm(root, { recursive: true, force: true });
});

test("fails closed when a prerendered inline script has no hash", () => {
  const policy = buildContentSecurityPolicy([sha256Source("var ready = true;")]);
  const missing = uncoveredInlineScripts("<script>var other = true;</script>", policy);
  assert.deepEqual(missing, [sha256Source("var other = true;")]);
});

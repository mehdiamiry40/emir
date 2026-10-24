import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { stripPreviewToolbar } from "./csp-inline.mjs";
import {
  CSP_HASH_PLACEHOLDER,
  assertProductionScriptSrc,
  buildContentSecurityPolicy,
  missingScriptHashes,
} from "./csp-policy.mjs";
import { requiredScriptHashes } from "./csp-inline.mjs";

const SKIP_DIRS = new Set(["cache", "dev", "node_modules"]);

/**
 * @typedef {{
 *   files: { file: string, hashes: string[] }[],
 *   hashList: string[],
 *   policy: string,
 * }} HashCollection
 */

/** @param {string} dir @param {(file: string) => Promise<void>} visit */
async function walk(dir, visit) {
  /** @type {import('node:fs').Dirent[]} */
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") return;
    throw err;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, visit);
    else if (entry.isFile()) await visit(full);
  }
}

/** @param {string} distDir */
export async function collectInlineHashes(distDir) {
  const serverDir = path.join(distDir, "server");
  /** @type {string[]} */
  const html = [];
  await walk(serverDir, async (file) => {
    if (file.endsWith(".html")) html.push(file);
  });
  html.sort();
  if (html.length === 0) {
    throw new Error(`no prerendered HTML under ${serverDir}`);
  }

  /** @type {Set<string>} */
  const required = new Set();
  /** @type {{ file: string, hashes: string[] }[]} */
  const files = [];
  for (const file of html) {
    const body = await readFile(file, "utf8");
    const hashes = requiredScriptHashes(body);
    if (hashes.length === 0) throw new Error(`${file} has no executable inline script to hash`);
    files.push({ file, hashes });
    for (const hash of hashes) required.add(hash);
  }

  const hashList = [...required].sort();
  const policy = buildContentSecurityPolicy(hashList);
  assertProductionScriptSrc(policy);
  if (policy.includes(CSP_HASH_PLACEHOLDER)) {
    throw new Error("built policy still contains the placeholder");
  }
  return { files, hashList, policy };
}

/** Replace the placeholder in place. Returns true when a string changed. @param {unknown} value @param {string} hashList */
export function replacePlaceholder(value, hashList) {
  let changed = false;
  /** @param {unknown} current */
  const visit = (current) => {
    if (typeof current === "string") {
      if (!current.includes(CSP_HASH_PLACEHOLDER)) return current;
      changed = true;
      return current.split(CSP_HASH_PLACEHOLDER).join(hashList);
    }
    if (Array.isArray(current)) {
      for (let index = 0; index < current.length; index += 1) current[index] = visit(current[index]);
      return current;
    }
    if (current && typeof current === "object") {
      const record = /** @type {Record<string, unknown>} */ (current);
      for (const key of Object.keys(record)) record[key] = visit(record[key]);
    }
    return current;
  };
  visit(value);
  return changed;
}

/** @param {unknown} value @param {string[]} [found] */
export function policiesIn(value, found = []) {
  if (typeof value === "string") {
    if (value.includes("script-src ") && value.includes("default-src ")) found.push(value);
    return found;
  }
  if (Array.isArray(value)) {
    for (const item of value) policiesIn(item, found);
    return found;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (key.toLowerCase() === "content-security-policy" && typeof item === "string") found.push(item);
      else policiesIn(item, found);
    }
  }
  return found;
}

/** @param {string} value */
function isSitePolicy(value) {
  return (
    value.includes("default-src 'self'") &&
    value.includes("script-src ") &&
    value.includes("frame-ancestors ")
  );
}

/** Overwrite every copy of this site's CSP. Returns how many strings changed. @param {unknown} value @param {string} policy */
export function rewriteSitePolicies(value, policy) {
  let rewritten = 0;
  /** @param {unknown} current */
  const visit = (current) => {
    if (typeof current === "string") {
      if (!isSitePolicy(current) || current === policy) return current;
      rewritten += 1;
      return policy;
    }
    if (Array.isArray(current)) {
      for (let index = 0; index < current.length; index += 1) current[index] = visit(current[index]);
      return current;
    }
    if (current && typeof current === "object") {
      const record = /** @type {Record<string, unknown>} */ (current);
      for (const key of Object.keys(record)) record[key] = visit(record[key]);
    }
    return current;
  };
  visit(value);
  return rewritten;
}

/** @param {string} projectRoot @param {string} distDir */
export function deploymentConfigPaths(projectRoot, distDir) {
  return [
    path.join(distDir, "output", "config.json"),
    path.join(projectRoot, ".vercel", "output", "config.json"),
    "/vercel/output/config.json",
  ];
}

/** @param {string} distDir @param {string} hashList */
async function patchFiles(distDir, hashList) {
  const placeholder = Buffer.from(CSP_HASH_PLACEHOLDER);
  /** @type {string[]} */
  const patched = [];
  await walk(distDir, async (file) => {
    const body = await readFile(file);
    if (!body.includes(placeholder)) return;
    const next = Buffer.from(body.toString("utf8").split(CSP_HASH_PLACEHOLDER).join(hashList));
    if (next.includes(placeholder)) throw new Error(`placeholder survived replacement in ${file}`);
    await writeFile(file, next);
    patched.push(file);
  });
  return patched;
}

/**
 * @param {{ distDir: string, routing?: unknown }} options
 */
export async function publishInlineScriptHashes(options) {
  const collected = await collectInlineHashes(options.distDir);
  const hashList = collected.hashList.join(" ");

  if (options.routing) {
    const before = JSON.stringify(options.routing);
    if (!before.includes("script-src ")) {
      throw new Error("Deployment routing has no script-src policy to publish");
    }
    if (before.includes(CSP_HASH_PLACEHOLDER)) replacePlaceholder(options.routing, hashList);
    if (JSON.stringify(options.routing).includes(CSP_HASH_PLACEHOLDER)) {
      throw new Error("CSP placeholder is still in the deployment routing");
    }
  }

  const patchedFiles = await patchFiles(options.distDir, hashList);
  const manifestPath = path.join(options.distDir, "routes-manifest.json");
  const manifest = await readFile(manifestPath, "utf8");
  if (manifest.includes(CSP_HASH_PLACEHOLDER)) {
    throw new Error(`CSP placeholder is still in ${manifestPath}`);
  }
  const policies = policiesIn(JSON.parse(manifest)).filter((policy) => isSitePolicy(policy));
  if (policies.length === 0) throw new Error(`${manifestPath} does not contain a Content-Security-Policy`);
  for (const policy of policies) assertHashes(policy, collected.hashList, manifestPath);

  if (options.routing) {
    const policiesInRouting = policiesIn(options.routing).filter((policy) => isSitePolicy(policy));
    if (policiesInRouting.length === 0) throw new Error("Deployment routing lost its script-src policy");
    for (const policy of policiesInRouting) assertHashes(policy, collected.hashList, "deployment routing");
  }

  return { ...collected, patchedFiles };
}

/** @param {string} policy @param {string[]} hashList @param {string} label */
function assertHashes(policy, hashList, label) {
  try {
    assertProductionScriptSrc(policy);
  } catch (err) {
    throw new Error(`${label}: ${err instanceof Error ? err.message : String(err)}`);
  }
  const missing = missingScriptHashes(policy, hashList);
  if (missing.length) {
    throw new Error(`${label} is missing ${missing.length} inline-script hash(es), first ${missing[0]}`);
  }
}

/**
 * Vercel serialises the routing object into `.next/output/config.json` during
 * onBuildComplete. Rewrite that policy from the routes manifest and refuse to
 * finish when the placeholder or a missing hash would be what production serves.
 * @param {{
 *   projectRoot: string,
 *   distDir: string,
 *   routing?: unknown,
 *   requireDeploymentOutput: boolean,
 * }} options
 */
export async function assertDeploymentOutput(options) {
  const collected = await collectInlineHashes(options.distDir);
  const manifestPath = path.join(options.distDir, "routes-manifest.json");
  const manifestText = await readFile(manifestPath, "utf8");
  if (manifestText.includes(CSP_HASH_PLACEHOLDER)) {
    throw new Error(`CSP placeholder is still in ${manifestPath}`);
  }
  const manifestPolicies = policiesIn(JSON.parse(manifestText)).filter((policy) => isSitePolicy(policy));
  if (manifestPolicies.length === 0) throw new Error(`Content-Security-Policy is missing from ${manifestPath}`);
  const policy = manifestPolicies[0];
  for (const published of manifestPolicies) assertHashes(published, collected.hashList, manifestPath);

  if (options.routing) {
    if (JSON.stringify(options.routing).includes(CSP_HASH_PLACEHOLDER)) {
      throw new Error("CSP placeholder is still in the deployment routing");
    }
    for (const published of policiesIn(options.routing).filter((item) => isSitePolicy(item))) {
      assertHashes(published, collected.hashList, "deployment routing");
    }
  }

  /** @type {string[]} */
  const configs = [];
  for (const file of deploymentConfigPaths(options.projectRoot, options.distDir)) {
    try {
      await readFile(file, "utf8");
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") continue;
      throw err;
    }
    configs.push(file);
  }

  if (options.requireDeploymentOutput && configs.length === 0) {
    throw new Error(
      `Vercel adapter did not write a deployment config. Looked for ${deploymentConfigPaths(options.projectRoot, options.distDir).join(", ")}.`,
    );
  }

  for (const file of configs) {
    const data = JSON.parse(await readFile(file, "utf8"));
    rewriteSitePolicies(data, policy);
    const serialised = JSON.stringify(data);
    if (serialised.includes(CSP_HASH_PLACEHOLDER)) {
      throw new Error(`CSP placeholder is still in ${file}`);
    }
    await writeFile(file, serialised);
    const policies = policiesIn(JSON.parse(serialised)).filter((published) => isSitePolicy(published));
    if (policies.length === 0) throw new Error(`Content-Security-Policy is missing from ${file}`);
    for (const published of policies) assertHashes(published, collected.hashList, file);
  }

  for (const { file, hashes } of collected.files) {
    for (const published of manifestPolicies) {
      const missing = missingScriptHashes(published, hashes);
      if (missing.length) throw new Error(`${file} hash ${missing[0]} is not in ${manifestPath}`);
    }
  }

  return { configs };
}

/** Remove the unconditional preview toolbar before Vercel copies the chunks. @param {string} distDir */
export async function stripPreviewToolbarFiles(distDir) {
  /** @type {string[]} */
  const toolbarFiles = [];
  await walk(distDir, async (file) => {
    if (!file.endsWith(".js") && !file.endsWith(".html")) return;
    const body = await readFile(file, "utf8");
    if (!body.includes("vercel.live/_next-live/feedback/feedback.js")) return;
    const stripped = stripPreviewToolbar(body);
    if (stripped !== body) {
      await writeFile(file, stripped);
      toolbarFiles.push(file);
    }
  });
  return toolbarFiles;
}

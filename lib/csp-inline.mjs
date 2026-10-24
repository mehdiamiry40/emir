import { createHash } from "node:crypto";
import { missingScriptHashes } from "./csp-policy.mjs";

const NEXT_S_PUSH = "(self.__next_s=self.__next_s||[]).push(";

const JS_TYPES = new Set([
  "",
  "text/javascript",
  "application/javascript",
  "text/ecmascript",
  "application/ecmascript",
  "module",
]);

/**
 * @typedef {{
 *   text: string,
 *   dynamic: string[],
 * }} InlineScript
 */

/** @param {string} attrs @param {string} name */
function attr(attrs, name) {
  const match = attrs.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\`]+))`, "i"),
  );
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? "";
}

/** @param {string} attrs */
function isExecutableScript(attrs) {
  if (attr(attrs, "src") !== null) return false;
  const type = attr(attrs, "type");
  if (type === null) return true;
  return JS_TYPES.has(type.trim().toLowerCase());
}

/** Children Next will assign to a new script element via innerHTML. @param {string} text */
export function nextScriptPayloads(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith(NEXT_S_PUSH)) return [];
  if (!trimmed.endsWith(")")) {
    throw new Error("truncated __next_s inline script");
  }
  /** @type {unknown} */
  let payload;
  try {
    payload = JSON.parse(trimmed.slice(NEXT_S_PUSH.length, -1));
  } catch (err) {
    throw new Error(
      `unparseable __next_s inline script: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!Array.isArray(payload)) return [];
  const props = payload[1];
  if (!props || typeof props !== "object" || !("children" in props)) return [];
  const children = /** @type {{ children?: unknown }} */ (props).children;
  if (typeof children !== "string" || children.length === 0) return [];
  return [children];
}

/** Parser-inserted executable inline scripts, in document order. JSON-LD is ignored. @param {string} html */
export function inlineScripts(html) {
  /** @type {InlineScript[]} */
  const scripts = [];
  const open = /<script\b([^>]*)>/gi;
  /** @type {RegExpExecArray | null} */
  let match;
  while ((match = open.exec(html))) {
    const attrs = match[1] ?? "";
    const start = open.lastIndex;
    const end = html.toLowerCase().indexOf("</script>", start);
    if (end === -1) throw new Error("unterminated <script> in prerendered HTML");
    const text = html.slice(start, end);
    open.lastIndex = end + "</script>".length;
    if (!isExecutableScript(attrs) || text.length === 0) continue;
    scripts.push({ text, dynamic: nextScriptPayloads(text) });
  }
  return scripts;
}

/** @param {string} content */
export function sha256Source(content) {
  const digest = createHash("sha256").update(content, "utf8").digest("base64");
  return `'sha256-${digest}'`;
}

/** Every hash the CSP must list for this HTML document. @param {string} html */
export function requiredScriptHashes(html) {
  const hashes = new Set();
  for (const script of inlineScripts(html)) {
    hashes.add(sha256Source(script.text));
    for (const payload of script.dynamic) hashes.add(sha256Source(payload));
  }
  return [...hashes].sort();
}

/** @param {string} html @param {string} policy */
export function uncoveredInlineScripts(html, policy) {
  return missingScriptHashes(policy, requiredScriptHashes(html));
}

const PREVIEW_TOOLBAR_URL = "https://vercel.live/_next-live/feedback/feedback.js";

/**
 * Preview builds fold the environment check away and append this script on every page.
 * That would run for every preview visitor, and the CSP does not allow vercel.live.
 */
const UNCONDITIONAL_TOOLBAR_INJECTION =
  /var \w+=document\.createElement\("script"\);\w+\.src="https:\/\/vercel\.live\/_next-live\/feedback\/feedback\.js",\w+\.setAttribute\("data-deployment-id",globalThis\.NEXT_DEPLOYMENT_ID\),\(document\.head\|\|document\.documentElement\)\.appendChild\(\w+\)/g;

/**
 * Production leaves the same injector in the client bundle, but only runs it when the
 * document cookie `__vercel_toolbar=1` is set (Vercel's explicit toolbar opt-in).
 * Public responses never set that cookie, so the reference does not load the script.
 * @param {string} source
 */
function cookieGatedToolbarOnly(source) {
  let from = 0;
  while (from < source.length) {
    const index = source.indexOf(PREVIEW_TOOLBAR_URL, from);
    if (index === -1) return true;
    const before = source.slice(Math.max(0, index - 800), index);
    const after = source.slice(index, index + 500);
    const gated =
      before.includes("__vercel_toolbar=1") &&
      before.includes("document.cookie") &&
      after.includes("data-cookie-opt-in") &&
      after.includes("appendChild(");
    if (!gated) return false;
    from = index + PREVIEW_TOOLBAR_URL.length;
  }
  return true;
}

/** @param {string} source */
export function stripPreviewToolbar(source) {
  UNCONDITIONAL_TOOLBAR_INJECTION.lastIndex = 0;
  const code = source.replace(UNCONDITIONAL_TOOLBAR_INJECTION, "void 0");
  if (!code.includes(PREVIEW_TOOLBAR_URL)) return code;
  if (cookieGatedToolbarOnly(code)) return code;
  throw new Error("unrecognized Vercel preview toolbar injection still references vercel.live");
}

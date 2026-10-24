// Production script-src is a list of sha256 hashes plus 'self'.
// Vercel Web Analytics loads /_vercel/insights/script.js and beacons to
// /_vercel/insights, both same-origin, so no third-party script host is required.
// The debug build of that script (va.vercel-scripts.com) is development-only.
// vercel.live is the preview toolbar and is intentionally not allowlisted.

export const CSP_HASH_PLACEHOLDER = "__CSP_INLINE_HASHES__";

const DEV_ANALYTICS_SCRIPT_HOST = "https://va.vercel-scripts.com";

function join(directive, sources) {
  return `${directive} ${sources.join(" ")}`;
}

/**
 * Production policy. `scriptHashes` are `'sha256-...'` sources.
 * An empty list leaves a placeholder that the build must replace inside the
 * header Vercel actually serves. Shipping the placeholder blocks every inline script.
 * @param {string[]} scriptHashes
 */
export function buildContentSecurityPolicy(scriptHashes) {
  const hashes = scriptHashes.length > 0 ? [...scriptHashes].sort() : [CSP_HASH_PLACEHOLDER];
  return [
    join("default-src", ["'self'"]),
    join("base-uri", ["'self'"]),
    join("form-action", ["'self'"]),
    join("frame-ancestors", ["'none'"]),
    join("object-src", ["'none'"]),
    join("img-src", ["'self'", "data:", "blob:"]),
    join("font-src", ["'self'", "data:"]),
    join("style-src", ["'self'", "'unsafe-inline'"]),
    join("script-src", ["'self'", ...hashes]),
    join("script-src-attr", ["'none'"]),
    join("connect-src", ["'self'"]),
    join("manifest-src", ["'self'"]),
    "upgrade-insecure-requests",
  ].join("; ");
}

/** React's development overlay needs eval, and dev inline scripts change every compile. */
export function buildDevContentSecurityPolicy() {
  return [
    join("default-src", ["'self'"]),
    join("base-uri", ["'self'"]),
    join("form-action", ["'self'"]),
    join("frame-ancestors", ["'none'"]),
    join("object-src", ["'none'"]),
    join("img-src", ["'self'", "data:", "blob:"]),
    join("font-src", ["'self'", "data:"]),
    join("style-src", ["'self'", "'unsafe-inline'"]),
    join("script-src", ["'self'", "'unsafe-inline'", "'unsafe-eval'", DEV_ANALYTICS_SCRIPT_HOST]),
    join("connect-src", ["'self'", "ws:", "http:", "https:"]),
    join("manifest-src", ["'self'"]),
  ].join("; ");
}

/** @param {string} policy @param {string} name */
export function directiveValue(policy, name) {
  const match = policy
    .split(";")
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `));
  if (!match) throw new Error(`CSP is missing ${name}`);
  return match.slice(name.length).trim();
}

/** @param {string} policy */
export function assertProductionScriptSrc(policy) {
  const scriptSrc = directiveValue(policy, "script-src");
  if (scriptSrc.includes("'unsafe-inline'") || scriptSrc.includes("'unsafe-eval'")) {
    throw new Error(`production script-src must not allow unsafe-inline or unsafe-eval: ${scriptSrc}`);
  }
  if (scriptSrc.includes(CSP_HASH_PLACEHOLDER) || policy.includes(CSP_HASH_PLACEHOLDER)) {
    throw new Error("production CSP still contains the inline-script hash placeholder");
  }
  if (!scriptSrc.includes("'sha256-")) {
    throw new Error("production script-src has no sha256 hashes");
  }
  if (policy.includes("vercel.live")) {
    throw new Error("production CSP must not allowlist vercel.live");
  }
}

/** @param {string} policy @param {string[]} required */
export function missingScriptHashes(policy, required) {
  const scriptSrc = directiveValue(policy, "script-src");
  return required.filter((hash) => !scriptSrc.includes(hash));
}

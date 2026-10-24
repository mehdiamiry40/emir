import { fileURLToPath, pathToFileURL } from "node:url";
import { stripPreviewToolbarFiles, assertDeploymentOutput, publishInlineScriptHashes } from "../lib/csp-publish.mjs";

const adapterFile = fileURLToPath(new URL("./csp-adapter.mjs", import.meta.url));

async function loadDelegatedAdapter() {
  const adapterPath = process.env.NEXT_ADAPTER_PATH;
  if (!adapterPath || adapterPath === adapterFile) return null;
  const loaded = await import(pathToFileURL(adapterPath).href);
  return loaded.default ?? loaded;
}

export const name = "EMIR CSP";

/**
 * @param {import('next').NextConfig} config
 * @param {unknown} context
 */
export async function modifyConfig(config, context) {
  const delegated = await loadDelegatedAdapter();
  if (typeof delegated?.modifyConfig === "function") {
    config = await delegated.modifyConfig(config, context);
  }
  // Vercel's modifyConfig points adapterPath back at itself. This file has to
  // stay the adapter so hashes are in the routing object before it is serialised.
  config.adapterPath = adapterFile;
  return config;
}

/**
 * Publish hashes before the platform adapter writes `.next/output/config.json`.
 * @param {{ distDir: string, routing: unknown, projectDir: string }} payload
 */
export async function onBuildComplete(payload) {
  const stripped = await stripPreviewToolbarFiles(payload.distDir);
  if (stripped.length) {
    console.log(`CSP: removed the unconditional preview toolbar injection from ${stripped.length} file(s)`);
  }

  const published = await publishInlineScriptHashes({
    distDir: payload.distDir,
    routing: payload.routing,
  });
  console.log(
    `CSP: published ${published.hashList.length} inline-script hashes into the build routing ` +
      `(${published.patchedFiles.length} file(s), policy ${published.policy.length} bytes)`,
  );

  const delegated = await loadDelegatedAdapter();
  if (typeof delegated?.onBuildComplete === "function") {
    await delegated.onBuildComplete(payload);
  } else if (process.env.NEXT_ADAPTER_PATH) {
    throw new Error(
      `CSP adapter could not call onBuildComplete on NEXT_ADAPTER_PATH (${process.env.NEXT_ADAPTER_PATH})`,
    );
  }

  const checked = await assertDeploymentOutput({
    projectRoot: payload.projectDir,
    distDir: payload.distDir,
    routing: payload.routing,
    requireDeploymentOutput: Boolean(process.env.NEXT_ADAPTER_PATH),
  });
  console.log(`CSP: deployment config has the hashed policy (${checked.configs.length} file(s))`);
}

const cspAdapter = { name, modifyConfig, onBuildComplete };
export default cspAdapter;

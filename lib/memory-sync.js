import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Session and passkey records live in process memory during tests and local
 * development. The Node proxy that gates /admin is a separate bundle, so it
 * cannot see that Map. When EMIR_AUTH_SNAPSHOT_DIR is set, writers publish a
 * snapshot the proxy can read. Production uses Redis and does not set the
 * directory.
 */
export function snapshotDirectory() {
  const configured = process.env.EMIR_AUTH_SNAPSHOT_DIR?.trim();
  return configured || null;
}

/** @type {Promise<void>} */
let writeChain = Promise.resolve();

/**
 * @param {string} directory
 * @param {string} name
 * @param {string} payload
 */
async function writePayload(directory, name, payload) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const target = path.join(directory, `${name}.json`);
  const temporary = `${target}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(temporary, payload, { mode: 0o600 });
  await rename(temporary, target);
}

/** @param {string} name @param {unknown} value */
export function writeSnapshot(name, value) {
  const directory = snapshotDirectory();
  if (!directory) return Promise.resolve();
  const payload = JSON.stringify(value);
  const task = writeChain.then(() => writePayload(directory, name, payload));
  writeChain = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}

/** @param {string} name */
export async function readSnapshot(name) {
  const directory = snapshotDirectory();
  if (!directory) return null;
  try {
    return JSON.parse(await readFile(path.join(directory, `${name}.json`), "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

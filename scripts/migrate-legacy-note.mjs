#!/usr/bin/env node

import { createHash, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { encryptLegacyNoteForMigration } from "../lib/notes.js";

const usage = `Usage:
  node scripts/migrate-legacy-note.mjs <legacy-note.json> <trusted-sha256>

The SHA-256 fingerprint must come from a trusted backup or operator review.
This tool performs no Redis operations and writes no storage. It emits one
authenticated note envelope to stdout for a controlled maintenance import.`;

function fail(message) {
  process.stderr.write(`${message}\n\n${usage}\n`);
  process.exitCode = 1;
}

const [inputPath, expectedDigest, ...extraArguments] = process.argv.slice(2);

if (
  !inputPath ||
  !expectedDigest ||
  extraArguments.length > 0 ||
  !/^[a-f0-9]{64}$/i.test(expectedDigest)
) {
  fail("Provide one input file and its trusted SHA-256 fingerprint.");
} else {
  try {
    const input = await readFile(inputPath);
    const actualDigest = createHash("sha256").update(input).digest("hex");
    if (
      !timingSafeEqual(
        Buffer.from(actualDigest, "hex"),
        Buffer.from(expectedDigest, "hex"),
      )
    ) {
      throw new Error("Input does not match the trusted SHA-256 fingerprint.");
    }

    const legacyValue = JSON.parse(input.toString("utf8"));
    const envelope = encryptLegacyNoteForMigration(legacyValue);
    process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
  } catch (error) {
    fail(error instanceof Error ? error.message : "Legacy migration failed.");
  }
}

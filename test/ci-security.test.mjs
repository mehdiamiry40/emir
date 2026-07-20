import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflowUrl = new URL("../.github/workflows/ci.yml", import.meta.url);

test("CI keeps pull-request credentials read-only and out of the checkout", async () => {
  const workflow = await readFile(workflowUrl, "utf8");

  assert.match(workflow, /^permissions:\n  contents: read\n\njobs:/m);
  assert.doesNotMatch(
    workflow,
    /\bwrite(?:-all)?\b/i,
    "CI must not request write permission in any syntax",
  );

  const checkoutSteps = workflow
    .split(/\n(?=\s{6}- name:)/)
    .filter((step) => /^\s*uses:\s+actions\/checkout@/m.test(step));

  assert.ok(checkoutSteps.length > 0, "CI must check out the repository");
  for (const step of checkoutSteps) {
    assert.match(step, /^\s+persist-credentials:\s+false\s*$/m);
  }
});

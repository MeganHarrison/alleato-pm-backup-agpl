import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";

import {
  assertManualJobPlannerSync,
} from "../manual-sync-mode.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

test("JobPlanner writes fail closed without both manual confirmations", () => {
  const attempts = [
    { argv: [], env: {} },
    { argv: ["--manual"], env: {} },
    { argv: [], env: { JOBPLANNER_MANUAL_SYNC_CONFIRMED: "true" } },
    {
      argv: ["--manual"],
      env: { JOBPLANNER_MANUAL_SYNC_CONFIRMED: "false" },
    },
  ];

  for (const attempt of attempts) {
    assert.throws(
      () => assertManualJobPlannerSync(attempt),
      /JobPlanner automatic sync is disabled/,
    );
  }
});

test("JobPlanner accepts a deliberately confirmed manual write run", () => {
  assert.doesNotThrow(() =>
    assertManualJobPlannerSync({
      argv: ["--manual"],
      env: { JOBPLANNER_MANUAL_SYNC_CONFIRMED: "TRUE" },
    }),
  );
});

test("JobPlanner dry runs remain available without write confirmation", () => {
  assert.doesNotThrow(() =>
    assertManualJobPlannerSync({ argv: ["--dry-run"], env: {}, dryRun: true }),
  );
});

test("JobPlanner workflow is dispatch-only and passes both confirmations", () => {
  const workflowPath = path.join(
    repoRoot,
    ".github/workflows/jobplanner-nightly-sync.yml",
  );
  const workflow = yaml.load(fs.readFileSync(workflowPath, "utf8"));
  const events = workflow.on;
  const runStep = workflow.jobs.sync.steps.find(
    (step) => step.name === "Run manual JobPlanner sync",
  );

  assert.deepEqual(Object.keys(events), ["workflow_dispatch"]);
  assert.equal(events.schedule, undefined);
  assert.equal(
    events.workflow_dispatch.inputs.confirm.type,
    "choice",
  );
  assert.match(runStep.run, /--manual/);
  assert.equal(runStep.env.JOBPLANNER_MANUAL_SYNC_CONFIRMED, "true");
});

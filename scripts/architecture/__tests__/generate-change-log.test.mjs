import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildArchitectureChanges,
  parseTaskMarkdown,
  renderGeneratedModule,
  runGenerator,
} from "../generate-change-log.mjs";

const TASK = `# Task: Architecture proof

Status: Complete
Owner: Codex
Created: 2026-07-16
Task ID: AAI-1
Linear Issue: [AAI-1](https://linear.app/example/issue/AAI-1/architecture-proof)

## Objective

Publish accepted architecture proof.
`;

const RESULT = {
  status: "PASS",
  taskId: "AAI-1",
  independentReview: {
    decision: "APPROVED",
    artifact: "docs/review.md",
  },
};

async function createFixture(overrides = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "architecture-change-log-"));
  await mkdir(path.join(root, "docs"), { recursive: true });
  await mkdir(path.join(root, "frontend/src/data"), { recursive: true });
  await writeFile(path.join(root, "docs/task.md"), overrides.task ?? TASK, "utf8");
  await writeFile(
    path.join(root, "docs/result.json"),
    JSON.stringify(overrides.result ?? RESULT),
    "utf8",
  );
  await writeFile(
    path.join(root, "docs/registry.json"),
    JSON.stringify({
      schemaVersion: 1,
      changes: [
        {
          taskFile: "docs/task.md",
          verificationResult: "docs/result.json",
          repository: "example/repo",
          revision: "0123456789abcdef0123456789abcdef01234567",
          whyItMatters: "Leaders can verify the published architecture change.",
          ...overrides.source,
        },
      ],
    }),
    "utf8",
  );
  return root;
}

test("parses the accepted task contract", () => {
  assert.deepEqual(parseTaskMarkdown(TASK), {
    title: "Architecture proof",
    status: "Complete",
    created: "2026-07-16",
    taskId: "AAI-1",
    issueUrl: "https://linear.app/example/issue/AAI-1/architecture-proof",
    objective: "Publish accepted architecture proof.",
  });
});

test("builds accepted architecture changes from task and review evidence", async () => {
  const root = await createFixture();
  try {
    const changes = await buildArchitectureChanges({
      repoRoot: root,
      registryPath: "docs/registry.json",
    });
    assert.equal(changes.length, 1);
    assert.equal(changes[0].status, "Accepted");
    assert.equal(changes[0].revision.slice(0, 10), "0123456789");
    assert.match(renderGeneratedModule(changes), /AUTO-GENERATED/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

for (const scenario of [
  {
    name: "incomplete task",
    task: TASK.replace("Status: Complete", "Status: In Progress"),
    expected: /must be Complete/,
  },
  {
    name: "failed verification",
    result: { ...RESULT, status: "FAIL" },
    expected: /must be PASS/,
  },
  {
    name: "unapproved review",
    result: {
      ...RESULT,
      independentReview: { ...RESULT.independentReview, decision: "BLOCKED" },
    },
    expected: /must be APPROVED/,
  },
  {
    name: "missing immutable revision",
    source: { revision: "abc123" },
    expected: /40-character commit SHA/,
  },
]) {
  test(`rejects ${scenario.name}`, async () => {
    const root = await createFixture(scenario);
    try {
      await assert.rejects(
        buildArchitectureChanges({
          repoRoot: root,
          registryPath: "docs/registry.json",
        }),
        scenario.expected,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

test("check mode fails loudly when generated output drifts", async () => {
  const root = await createFixture();
  try {
    await assert.rejects(
      runGenerator({
        repoRoot: root,
        registryPath: "docs/registry.json",
        outputPath: "frontend/src/data/generated.ts",
        check: true,
      }),
      /generated architecture changes are stale/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

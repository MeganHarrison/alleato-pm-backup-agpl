import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { checkHandoff, resolveHandoffsForChangedFiles } from "../check-review-queue-verification.mjs";

function makeFixture(resultStatus = "PASS") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "review-queue-verification-"));
  fs.mkdirSync(path.join(root, "docs/ops/tasks"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs/ops/handoffs"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs/ops/tasks/task.md"), "Task ID: FIXTURE\nVerification contract: Required\n");
  fs.mkdirSync(path.join(root, "scripts/verification/fixtures"), { recursive: true });
  fs.mkdirSync(path.join(root, "scripts/verification/fixtures/evidence"), { recursive: true });
  fs.writeFileSync(path.join(root, "scripts/verification/fixtures/evidence/proof.txt"), "proof");
  fs.writeFileSync(path.join(root, "scripts/verification/fixtures/manifest.json"), JSON.stringify({
    contractVersion: 1,
    taskId: "FIXTURE",
    feature: "Fixture",
    route: "/fixture",
    flows: [{ name: "flow", steps: ["run"], expectedOutcome: "works" }],
    requiredEvidence: ["summary"],
    visual: { viewports: ["desktop"] },
    independentReview: { required: true },
    claims: [{ id: "flow", description: "flow works", evidence: [{ key: "summary", min: 1 }] }],
  }));
  fs.writeFileSync(path.join(root, "scripts/verification/fixtures/result.json"), JSON.stringify({
    status: resultStatus,
    taskId: "FIXTURE",
    reason: resultStatus === "PASS" ? undefined : "fixture blocked",
    evidence: { summary: ["scripts/verification/fixtures/evidence/proof.txt"] },
    claims: { flow: { summary: ["scripts/verification/fixtures/evidence/proof.txt"] } },
    independentReview: { reviewer: "fixture-reviewer", decision: "APPROVED", reviewedAt: "2026-07-14", artifact: "scripts/verification/fixtures/evidence/proof.txt" },
  }));
  fs.writeFileSync(path.join(root, "docs/ops/handoffs/handoff.md"), [
    "Task ID: FIXTURE",
    "Task file: docs/ops/tasks/task.md",
    "Verification manifest: scripts/verification/fixtures/manifest.json",
    "Verification result: scripts/verification/fixtures/result.json",
  ].join("\n"));
  return root;
}

test("accepts Required handoff only when the result is PASS and contract-valid", () => {
  const root = makeFixture();
  assert.deepEqual(checkHandoff("docs/ops/handoffs/handoff.md", { rootDir: root, strict: true }), { errors: [], warnings: [] });
});

test("rejects Required handoff with BLOCKED result", () => {
  const root = makeFixture("BLOCKED");
  const result = checkHandoff("docs/ops/handoffs/handoff.md", { rootDir: root, strict: true });
  assert.match(result.errors.join("\n"), /requires result status PASS/);
});

test("strict mode rejects missing task metadata while rollout mode warns", () => {
  const root = makeFixture();
  fs.writeFileSync(path.join(root, "docs/ops/tasks/task.md"), "# Legacy task\n");
  assert.equal(checkHandoff("docs/ops/handoffs/handoff.md", { rootDir: root, strict: true }).errors.length, 1);
  assert.equal(checkHandoff("docs/ops/handoffs/handoff.md", { rootDir: root, strict: false }).warnings.length, 1);
});

test("changed result and task files resolve their linked handoff", () => {
  const root = makeFixture();
  const resolved = resolveHandoffsForChangedFiles([
    "scripts/verification/fixtures/result.json",
    "scripts/verification/fixtures/evidence/proof.txt",
    "docs/ops/tasks/task.md",
  ], root);
  assert.deepEqual(resolved.orphaned, []);
  assert.deepEqual(resolved.handoffs, ["docs/ops/handoffs/handoff.md"]);
});

test("changed verification artifacts without a linked handoff are orphaned", () => {
  const root = makeFixture();
  const resolved = resolveHandoffsForChangedFiles(["scripts/verification/fixtures/unlinked-result.json"], root);
  assert.deepEqual(resolved.orphaned, ["scripts/verification/fixtures/unlinked-result.json"]);
});

test("shared package metadata is not fanned out to every historical handoff", () => {
  const root = makeFixture();
  const resolved = resolveHandoffsForChangedFiles(["package.json"], root);
  assert.deepEqual(resolved, { handoffs: [], orphaned: [] });
});

test("handoff task identity cannot borrow another task's PASS fixture", () => {
  const root = makeFixture();
  fs.writeFileSync(path.join(root, "docs/ops/handoffs/handoff.md"), [
    "Task ID: DIFFERENT-TASK",
    "Task file: docs/ops/tasks/task.md",
    "Verification manifest: scripts/verification/fixtures/manifest.json",
    "Verification result: scripts/verification/fixtures/result.json",
  ].join("\n"));
  const result = checkHandoff("docs/ops/handoffs/handoff.md", { rootDir: root, strict: true });
  assert.match(result.errors.join("\n"), /does not match task file Task ID FIXTURE/);
});

test("handoff Task ID must match the referenced task file", () => {
  const root = makeFixture();
  fs.writeFileSync(path.join(root, "docs/ops/handoffs/handoff.md"), [
    "Task ID: DIFFERENT-TASK",
    "Task file: docs/ops/tasks/task.md",
    "Verification manifest: scripts/verification/fixtures/manifest.json",
    "Verification result: scripts/verification/fixtures/result.json",
  ].join("\n"));
  const result = checkHandoff("docs/ops/handoffs/handoff.md", { rootDir: root, strict: true });
  assert.match(result.errors.join("\n"), /does not match task file Task ID FIXTURE/);
});

test("changed template manifest resolves its linked handoff", () => {
  const root = makeFixture();
  fs.mkdirSync(path.join(root, "scripts/templates"), { recursive: true });
  const templatePath = "scripts/templates/verification-manifest.example.json";
  fs.writeFileSync(path.join(root, templatePath), "{}");
  fs.appendFileSync(path.join(root, "docs/ops/handoffs/handoff.md"), `\nTemplate: ${templatePath}\n`);
  const resolved = resolveHandoffsForChangedFiles([templatePath], root);
  assert.deepEqual(resolved, { handoffs: ["docs/ops/handoffs/handoff.md"], orphaned: [] });
});

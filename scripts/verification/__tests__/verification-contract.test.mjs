import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { validateManifest, validateResult } from "../verification-contract.mjs";

function fixture() {
  return {
    contractVersion: 1,
    taskId: "FIXTURE",
    riskLevel: "high",
    feature: "Example create flow",
    route: "/876/example/new",
    flows: [{ name: "create", steps: ["fill", "submit", "reload"], expectedOutcome: "Record persists and is editable" }],
    requiredEvidence: ["screenshots", "videos", "actionLog", "databaseReadback", "reloadProof", "negativePath", "visualReview", "regressionTest"],
    visual: { viewports: ["desktop", "mobile"] },
    independentReview: { required: true },
    claims: [
      { id: "start", description: "Starting state captured", evidence: [{ key: "screenshots", min: 1 }] },
      { id: "complete", description: "Completed state captured", evidence: [{ key: "screenshots", min: 1 }] },
      { id: "result", description: "Result state captured", evidence: [{ key: "screenshots", min: 1 }] },
      { id: "persistence", description: "All fields persisted", evidence: [{ key: "databaseReadback", min: 1 }] },
      { id: "reload", description: "Edit state prefills after reload", evidence: [{ key: "reloadProof", min: 1 }] },
      { id: "negative", description: "Failure path verified", evidence: [{ key: "negativePath", min: 1 }] },
      { id: "visual", description: "Visual review completed", evidence: [{ key: "visualReview", min: 1 }] },
      { id: "regression", description: "Regression test exists", evidence: [{ key: "regressionTest", min: 1 }] },
    ],
  };
}

function evidenceFiles() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "verification-contract-"));
  const files = {};
  for (const key of ["screenshots", "videos", "actionLog", "databaseReadback", "reloadProof", "negativePath", "visualReview", "regressionTest"]) {
    const file = `${key}.txt`;
    fs.writeFileSync(path.join(root, file), "evidence");
    files[key] = [file];
  }
  return {
    root,
    files,
    claims: {
      start: { screenshots: files.screenshots },
      complete: { screenshots: files.screenshots },
      result: { screenshots: files.screenshots },
      persistence: { databaseReadback: files.databaseReadback },
      reload: { reloadProof: files.reloadProof },
      negative: { negativePath: files.negativePath },
      visual: { visualReview: files.visualReview },
      regression: { regressionTest: files.regressionTest },
    },
  };
}

test("accepts a PASS result only when every declared artifact exists", () => {
  const { root, files, claims } = evidenceFiles();
  assert.deepEqual(validateResult({
    manifest: fixture(),
    result: {
      status: "PASS",
      taskId: "FIXTURE",
      evidence: files,
      claims,
      independentReview: { reviewer: "qa-subagent-1", decision: "APPROVED", reviewedAt: "2026-07-14T16:00:00Z", artifact: files.visualReview[0] },
    },
    rootDir: root,
  }), []);
});

test("rejects PASS when database or reload evidence is missing", () => {
  const { root, files, claims } = evidenceFiles();
  delete files.databaseReadback;
  delete files.reloadProof;
  const errors = validateResult({ manifest: fixture(), result: { status: "PASS", taskId: "FIXTURE", evidence: files, claims, independentReview: { reviewer: "qa", decision: "APPROVED", reviewedAt: "2026-07-14", artifact: files.visualReview[0] } }, rootDir: root });
  assert.match(errors.join("\n"), /evidence\.databaseReadback/);
  assert.match(errors.join("\n"), /evidence\.reloadProof/);
});

test("does not promote non-PASS results to PASS", () => {
  const { root, files } = evidenceFiles();
  for (const status of ["FAIL", "BLOCKED", "INCONCLUSIVE", "NOT_RUN"]) {
    assert.deepEqual(validateResult({ manifest: fixture(), result: { status, taskId: "FIXTURE", reason: "Evidence is not available yet", evidence: files }, rootDir: root }), []);
  }
});

test("rejects malformed manifests with actionable field errors", () => {
  const errors = validateManifest({ contractVersion: 99, feature: "", route: "", flows: [], requiredEvidence: ["fake"], visual: {} });
  assert.match(errors.join("\n"), /contractVersion/);
  assert.match(errors.join("\n"), /feature/);
  assert.match(errors.join("\n"), /flows/);
  assert.match(errors.join("\n"), /unsupported evidence key/);
  assert.match(errors.join("\n"), /riskLevel/);
});

test("accepts a Standard contract with only evidence that proves its changed boundary", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "verification-contract-standard-"));
  fs.writeFileSync(path.join(root, "api-contract.txt"), "evidence");
  const manifest = {
    contractVersion: 1,
    taskId: "STANDARD-FIXTURE",
    riskLevel: "standard",
    feature: "Endpoint status wording",
    route: "/api/example",
    flows: [{ name: "request", steps: ["send request"], expectedOutcome: "Actionable status is returned" }],
    requiredEvidence: ["negativePath"],
    claims: [{ id: "error", description: "Invalid input is actionable", evidence: [{ key: "negativePath", min: 1 }] }],
  };
  assert.deepEqual(validateResult({
    manifest,
    result: {
      status: "PASS",
      taskId: "STANDARD-FIXTURE",
      evidence: { negativePath: ["api-contract.txt"] },
      claims: { error: { negativePath: ["api-contract.txt"] } },
    },
    rootDir: root,
  }), []);
});

test("rejects PASS with unresolved findings or conflicting observed status", () => {
  const { root, files, claims } = evidenceFiles();
  const errors = validateResult({
    manifest: fixture(),
    result: { status: "PASS", taskId: "FIXTURE", observedStatus: "FAIL", findings: [{ severity: "High" }], evidence: files, claims, independentReview: { reviewer: "qa", decision: "APPROVED", reviewedAt: "2026-07-14", artifact: files.visualReview[0] } },
    rootDir: root,
  });
  assert.match(errors.join("\n"), /unresolved findings/);
  assert.match(errors.join("\n"), /conflicts with PASS/);
});

test("requires a reason for every non-PASS result", () => {
  const errors = validateResult({ manifest: fixture(), result: { status: "BLOCKED", taskId: "FIXTURE" } });
  assert.deepEqual(errors, ["reason: required when status is BLOCKED"]);
});

test("requires a result for every declared claim", () => {
  const { root, files, claims } = evidenceFiles();
  delete claims.reload;
  const errors = validateResult({ manifest: fixture(), result: { status: "PASS", taskId: "FIXTURE", evidence: files, claims, independentReview: { reviewer: "qa", decision: "APPROVED", reviewedAt: "2026-07-14", artifact: files.visualReview[0] } }, rootDir: root });
  assert.match(errors.join("\n"), /claims\.reload: missing result/);
});

test("requires an independent approved review for PASS", () => {
  const { root, files, claims } = evidenceFiles();
  const errors = validateResult({ manifest: fixture(), result: { status: "PASS", taskId: "FIXTURE", evidence: files, claims }, rootDir: root });
  assert.match(errors.join("\n"), /independentReview: required/);
});

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const script = path.join(repoRoot, "scripts/verification/schedule-preflight.mjs");

function run(args) {
  return spawnSync("node", [script, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, SCHEDULE_PREFLIGHT_DRY_RUN: "1" },
  });
}

test("schedule preflight requires a numeric project ID before it runs verification", () => {
  const result = run([]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--project-id is required/i);
});

test("schedule preflight composes focused tests and the shared canonical auth verifier", () => {
  const result = run(["--project-id", "43", "--session", "schedule-tdd"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /npm run test:schedule/i);
  assert.match(result.stdout, /npm run verify:browser-auth/i);
  assert.match(result.stdout, /https:\/\/projects\.alleatogroup\.com\/43\/schedule/);
  assert.match(result.stdout, /session=schedule-tdd/);
});

test("schedule preflight rejects an unsafe project ID", () => {
  const result = run(["--project-id", "43/../../auth/login"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /positive integer/i);
});

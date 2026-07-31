import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildJestArgs,
  containsUnexpectedReactActWarning,
  discoverScheduleTests,
  releaseTestTimeoutMs,
  scheduleTestTimeZone,
} from "../run-schedule-test-suite.mjs";
import {
  buildNpmInvocation,
  parseArgs as parsePreflightArgs,
} from "../schedule-preflight.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const frontendRoot = path.join(repoRoot, "frontend");

test("discovers the complete scheduling-owned release surface", () => {
  const tests = discoverScheduleTests(frontendRoot);

  for (const required of [
    "src/lib/scheduling/__tests__/schedule-auto-scheduler.test.ts",
    "src/lib/scheduling/__tests__/schedule-network-analysis.test.ts",
    "src/lib/scheduling/__tests__/schedule-import-atomic.test.ts",
    "src/lib/scheduling/__tests__/schedule-baselines.test.ts",
    "src/lib/scheduling/__tests__/schedule-calendar.test.ts",
    "src/lib/scheduling/__tests__/schedule-hourly-leveling.test.ts",
    "src/lib/scheduling/__tests__/schedule-phase4c-migration-contract.test.ts",
    "src/lib/services/__tests__/scheduling-service.auto-schedule.test.ts",
    "src/lib/services/__tests__/schedule-phase4c-service.test.ts",
    "src/components/scheduling/__tests__/gantt-chart-critical-path.test.tsx",
    "src/app/api/projects/[projectId]/scheduling/tasks/import/__tests__/route.test.ts",
    "src/hooks/__tests__/use-schedule-resources.test.tsx",
    "tests/helpers/__tests__/db-disposable-schedule-project.test.ts",
  ]) {
    assert.ok(tests.includes(required), `missing ${required}`);
  }
});

test("returns a deterministic, unique manifest without unrelated tests", () => {
  const tests = discoverScheduleTests(frontendRoot);

  assert.deepEqual(tests, [...tests].sort());
  assert.equal(new Set(tests).size, tests.length);
  assert.equal(
    tests.some((entry) => entry.includes("commitments")),
    false,
  );
  assert.ok(tests.length >= 50, `expected at least 50 tests, found ${tests.length}`);
});

test("builds one serial Jest invocation with an explicit release timeout", () => {
  assert.deepEqual(buildJestArgs(["a.test.ts", "b.test.tsx"]), [
    "exec",
    "jest",
    "--runInBand",
    `--testTimeout=${releaseTestTimeoutMs}`,
    "--roots",
    "src",
    "tests",
    "--runTestsByPath",
    "a.test.ts",
    "b.test.tsx",
  ]);
  assert.equal(releaseTestTimeoutMs, 15_000);
  assert.throws(() => buildJestArgs([]), /No scheduling-owned tests/);
});

test("fails loudly when a passing Jest run emits a React act warning", () => {
  assert.equal(
    containsUnexpectedReactActWarning(
      "Warning: An update to TaskEditModal inside a test was not wrapped in act(...).",
    ),
    true,
  );
  assert.equal(
    containsUnexpectedReactActWarning("Test Suites: 80 passed, 80 total"),
    false,
  );
});

test("pins scheduling date regressions to the production DST timezone", () => {
  assert.equal(scheduleTestTimeZone, "America/Indianapolis");
});

test("preflight defaults to the release gate and requires an explicit fast-test override", () => {
  assert.equal(
    parsePreflightArgs(["--project-id", "43"]).fastTests,
    false,
  );
  assert.equal(
    parsePreflightArgs(["--project-id", "43", "--fast-tests"]).fastTests,
    true,
  );
});

test("preflight invokes npm through Node on Windows without a command shell", () => {
  assert.deepEqual(
    buildNpmInvocation(
      ["run", "test:schedule:release"],
      {
        platform: "win32",
        npmExecPath: "C:\\node\\npm-cli.js",
        nodeExecPath: "C:\\node\\node.exe",
      },
    ),
    {
      command: "C:\\node\\node.exe",
      args: ["C:\\node\\npm-cli.js", "run", "test:schedule:release"],
    },
  );
  assert.throws(
    () => buildNpmInvocation([], { platform: "win32", npmExecPath: "" }),
    /launched through `npm run schedule:preflight`/,
  );
});

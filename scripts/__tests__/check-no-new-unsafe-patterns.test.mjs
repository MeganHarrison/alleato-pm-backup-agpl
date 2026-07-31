import test from "node:test";
import assert from "node:assert/strict";

import {
  buildUnsafePatternReport,
  findSilentCatchBlocks,
  findSyntheticDataFallbacks,
} from "../check-no-new-unsafe-patterns.mjs";

test("silent catch detector flags empty catch blocks", () => {
  const violations = findSilentCatchBlocks(`
    try {
      risky();
    } catch {
    }
  `);

  assert.equal(violations.length, 1);
});

test("silent catch detector flags comment-only catch blocks", () => {
  const violations = findSilentCatchBlocks(`
    try {
      risky();
    } catch (error) {
      // Non-critical
    }
  `);

  assert.equal(violations.length, 1);
});

test("silent catch detector allows structured reporting", () => {
  const violations = findSilentCatchBlocks(`
    try {
      risky();
    } catch (error) {
      reportNonCriticalFailure({
        area: "test",
        operation: "risky",
        error,
        userVisibleFallback: "The optional panel is unavailable.",
      });
    }
  `);

  assert.equal(violations.length, 0);
});

test("synthetic data fallback detector flags useFallback options", () => {
  const violations = findSyntheticDataFallbacks(`
    export function useCostCodes({ useFallback = true } = {}) {
      return [];
    }
  `);

  assert.equal(violations.length, 1);
});

test("synthetic data fallback detector flags mock data wording", () => {
  const violations = findSyntheticDataFallbacks(`
    // For now, return mock data until the endpoint exists.
    const rows = [];
  `);

  assert.equal(violations.length, 1);
});

test("synthetic data fallback detector allows normal fallback UI props", () => {
  const violations = findSyntheticDataFallbacks(`
    <Suspense fallback={null}>
      <RealDataTable />
    </Suspense>
  `);

  assert.equal(violations.length, 0);
});

test("changed-code guardrail blocks raw side panel primitives outside shared primitives", () => {
  const report = buildUnsafePatternReport(
    ["frontend/src/components/example/task-drawer.tsx"],
    new Map([
      [
        "frontend/src/components/example/task-drawer.tsx",
        ['<SheetContent className="p-0">'],
      ],
    ]),
  );

  assert.equal(report.violations.length, 1);
  assert.equal(report.violations[0].kind, "raw side panel primitive");
});

test("changed-code guardrail allows raw sheet composition in shared side panel primitive", () => {
  const report = buildUnsafePatternReport(
    ["frontend/src/components/ui/side-panel.tsx"],
    new Map([
      [
        "frontend/src/components/ui/side-panel.tsx",
        ["<SheetContent className={cn(\"gap-0 overflow-hidden p-0\", className)} />"],
      ],
    ]),
  );

  assert.equal(report.violations.length, 0);
});

test("changed-code guardrail blocks auth-user assignee pickers in meeting tasks", () => {
  const report = buildUnsafePatternReport(
    ["frontend/src/components/meetings/meeting-tasks-manager.tsx"],
    new Map([
      [
        "frontend/src/components/meetings/meeting-tasks-manager.tsx",
        ['const result = await apiFetch("/api/users");'],
      ],
    ]),
  );

  assert.equal(report.violations.length, 1);
  assert.equal(report.violations[0].kind, "task assignee auth-user picker");
});

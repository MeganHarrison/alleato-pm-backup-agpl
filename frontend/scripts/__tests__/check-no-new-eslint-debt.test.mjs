import test from "node:test";
import assert from "node:assert/strict";

import { normalizeFrontendChangedFiles } from "../check-no-new-eslint-debt.mjs";

test("normalizes frontend changed files from base, staged, and working diffs", () => {
  const files = normalizeFrontendChangedFiles([
    "frontend/src/hooks/use-change-event-detail.ts",
    "frontend/src/hooks/use-change-event-detail.ts",
    "frontend/scripts/check-no-new-eslint-debt.mjs",
    "frontend/tests/e2e/example.spec.ts",
    "frontend/public/logo.svg",
    "scripts/check-no-new-any.mjs",
  ]);

  assert.deepEqual(files, [
    "scripts/check-no-new-eslint-debt.mjs",
    "src/hooks/use-change-event-detail.ts",
    "tests/e2e/example.spec.ts",
  ]);
});

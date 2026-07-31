import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const runtimeConsumers = [
  "frontend/src/app/api/admin/source-sync/status/route.ts",
  "frontend/src/app/api/admin/source-sync/lifecycle-documents/route.ts",
  "frontend/src/lib/ai/source-health.ts",
  "frontend/src/lib/ai/services/source-sync-summary.ts",
];

test("runtime consumers do not read or describe the retired compiler", async () => {
  for (const path of runtimeConsumers) {
    const source = await readFile(new URL(`../../../${path}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /source_intelligence_jobs/);
    assert.doesNotMatch(source, /compiler_backlog/);
    assert.doesNotMatch(source, /intelligence compiler/i);
    assert.doesNotMatch(source, /uncompiled_count/);
  }
});

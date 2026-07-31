import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("operations readiness reads canonical Project Intelligence artifacts", async () => {
  const route = await readFile(
    new URL(
      "../../../frontend/src/app/api/admin/operations-readiness/status/route.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.doesNotMatch(route, /source_intelligence_jobs/);
  assert.doesNotMatch(route, /packet_refresh_jobs/);
  assert.doesNotMatch(route, /compiler_backlog/);
  assert.doesNotMatch(route, /loadCompilerFallbackStatus/);
  assert.match(route, /loadProjectIntelligenceStatus/);
  assert.match(route, /countCurrentPackets/);
});

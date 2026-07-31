import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const runtimeLabels = [
  "backend/src/services/health/source_rag_health.py",
  "backend/src/services/agents/alleato_ai_tools/intelligence.py",
  "frontend/src/app/(admin)/intelligence-packets/page.tsx",
];

test("operator-facing runtime labels name the canonical Project Intelligence owner", async () => {
  for (const path of runtimeLabels) {
    const source = await readFile(new URL(`../../../${path}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /intelligence compiler/i);
  }
});

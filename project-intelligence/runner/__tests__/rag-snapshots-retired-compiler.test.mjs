import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("RAG snapshots derive lifecycle proof without the retired compiler queue", async () => {
  const source = await readFile(
    new URL("../../../frontend/src/app/api/admin/rag-snapshots/route.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /source_intelligence_jobs/);
  assert.match(source, /source_processing_jobs/);
  assert.match(source, /insight_card_evidence/);
});

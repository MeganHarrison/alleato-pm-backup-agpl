import test from "node:test";
import assert from "node:assert/strict";
import { analyzeAddedLine, analyzePath } from "../audits/check-no-new-retired-artifacts.mjs";

test("rejects structural retirement paths but preserves timestamped migrations", () => {
  assert.equal(analyzePath("scripts/archive/replay.mjs")?.category, "banned new artifact path");
  assert.equal(analyzePath("frontend/lib/config.backup.ts")?.category, "banned new artifact path");
  assert.equal(analyzePath("supabase/migrations/20260722000000_archive_cleanup.sql"), null);
  assert.equal(analyzePath("scripts/seed-db/seed-database.ts")?.category, "banned new artifact path");
  assert.equal(analyzePath("docs/ops/evidence/run-proof.json")?.category, "banned new artifact path");
});

test("rejects executable path references without flagging domain prose", () => {
  assert.equal(analyzeAddedLine("frontend/src/lib/example.ts", "/** @depre" + "cated */")?.category, "banned retired-code marker");
  assert.equal(analyzeAddedLine("frontend/src/lib/read.mjs", 'const file = path.join(root, "docs/archive/input.json")')?.category, "banned runtime reference");
  assert.equal(analyzeAddedLine("frontend/src/lib/state.ts", 'const state = "legacy customer"'), null);
  assert.equal(analyzeAddedLine("docs/notes.md", 'Move legacy material outside the repository.'), null);
  assert.equal(analyzeAddedLine("frontend/src/app/api/admin/deep-research/history/route.ts", 'const endpoint = "/api/intelligence/deep-agent/llm-wiki/history"'), null);
  assert.equal(analyzeAddedLine("scripts/run.mjs", 'const file = path.join(root, "docs/ops/evidence/result.json")')?.category, "banned runtime reference");
  assert.equal(analyzeAddedLine("package.json", '"seed:db": "npx tsx scripts/seed-db/seed-database.ts",')?.category, "banned runtime reference");
});

test("ignores registry retirement metadata in package-manager lockfiles", () => {
  const registryNotice = '"depre' + 'cated": "This transitive package is no longer supported"';

  assert.equal(analyzeAddedLine("package-lock.json", registryNotice), null);
  assert.equal(analyzeAddedLine("tools/video/package-lock.json", registryNotice), null);
  assert.equal(analyzeAddedLine("tools/video/pnpm-lock.yaml", "depre" + "cated: This transitive package is no longer supported"), null);
  assert.equal(analyzeAddedLine("tools/video/config.json", registryNotice)?.category, "banned retired-code marker");
});

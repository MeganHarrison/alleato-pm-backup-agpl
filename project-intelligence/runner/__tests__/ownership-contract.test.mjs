import test from "node:test";
import assert from "node:assert/strict";

import {
  assertCanonicalRunnerPath,
  assertFormerProjectIntelligencePathsAbsent,
  assertMaintenanceIsManual,
  assertRetiredCompilerIngressAbsent,
  CANONICAL_SCHEDULED_RUNNER,
} from "../../core/ownership-contract.mjs";

test("accepts only the canonical scheduled runner", () => {
  assert.equal(assertCanonicalRunnerPath(CANONICAL_SCHEDULED_RUNNER), true);
  assert.throws(
    () => assertCanonicalRunnerPath("scripts/intelligence/run-scheduled-daily-executive-brief.mjs"),
    /ownership violation.*must enter through/,
  );
});

test("former Project Intelligence functional paths remain absent", () => {
  assert.equal(assertFormerProjectIntelligencePathsAbsent(), true);
  assert.throws(
    () => assertFormerProjectIntelligencePathsAbsent({
      root: "/repo",
      existsSync: (candidate) => candidate.endsWith("scripts/intelligence/daily-executive-brief.mjs"),
    }),
    /former functional paths were reintroduced/,
  );
});

test("fails loudly if maintenance is treated as runtime", () => {
  assert.throws(
    () => assertMaintenanceIsManual("project-intelligence/maintenance/daily-deep-read-backfill.mjs"),
    /maintenance tool.*cannot be a scheduled runtime target/,
  );
  assert.equal(assertMaintenanceIsManual("project-intelligence/runner/run-scheduled-daily-executive-brief.mjs"), true);
});

test("forbids the retired compiler across backend and frontend runtime code", () => {
  assert.equal(assertRetiredCompilerIngressAbsent(), true);
  assert.throws(
    () => assertRetiredCompilerIngressAbsent({
      root: "/repo",
      files: ["backend/src/services/integrations/microsoft_graph/teams_projection.py"],
      readFileSync: () => "from ...intelligence.compiler import process_source_document_to_packet",
    }),
    /retired compiler runtime was reintroduced.*teams_projection\.py.*intelligence\.compiler/,
  );
  assert.throws(
    () => assertRetiredCompilerIngressAbsent({
      root: "/repo",
      files: ["frontend/src/app/api/admin/source-sync/status/route.ts"],
      readFileSync: () => 'serviceDb.from("source_intelligence_jobs")',
    }),
    /retired compiler runtime was reintroduced.*source-sync\/status\/route\.ts.*source_intelligence_jobs/,
  );
});

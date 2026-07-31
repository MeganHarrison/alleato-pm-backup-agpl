import fs from "node:fs";
import path from "node:path";

export const PROJECT_INTELLIGENCE_ROOT = path.resolve(import.meta.dirname, "..");
export const CANONICAL_SCHEDULED_RUNNER = "project-intelligence/runner/run-scheduled-daily-executive-brief.mjs";

export const PROJECT_INTELLIGENCE_OWNERS = Object.freeze({
  core: "project-intelligence/core",
  runner: "project-intelligence/runner",
  projections: "project-intelligence/projections",
  web: "project-intelligence/web",
  ingestion: "project-intelligence/ingestion",
  maintenance: "project-intelligence/maintenance",
});

export const FORMER_PROJECT_INTELLIGENCE_PATHS = Object.freeze([
  "scripts/intelligence/daily-executive-brief.mjs",
  "scripts/intelligence/daily-executive-brief-schedule.mjs",
  "scripts/intelligence/executive-intelligence-recovery.mjs",
  "scripts/intelligence/daily-deep-read-consumers.mjs",
  "scripts/intelligence/daily-deep-read-backfill.mjs",
  "scripts/intelligence/backfill-operating-read.py",
  "scripts/intelligence/repair-raw-source-current-state.py",
  "scripts/intelligence/operational-loss-baseline.mjs",
  "scripts/intelligence/lib/brief-v3.mjs",
  "scripts/intelligence/lib/daily-source-corpus.mjs",
  "scripts/intelligence/lib/executive-intelligence-run.mjs",
  "scripts/intelligence/lib/rag-database-connection.mjs",
  "backend/src/services/intelligence/prompts.py",
]);

export const RETIRED_COMPILER_INGRESS_ROOTS = Object.freeze([
  "backend/src",
  "frontend/src",
]);

const RUNTIME_SOURCE_EXTENSIONS = new Set([".py", ".js", ".mjs", ".ts", ".tsx"]);

export const RETIRED_COMPILER_INGRESS_TERMS = Object.freeze([
  "intelligence.compiler",
  "process_source_document_to_packet",
  "_run_source_intelligence_compiler",
  "enqueue_source_intelligence_job",
  "run_intelligence_compiler_batch",
  "ai_intelligence_compiler_v0_1",
  '.from("source_intelligence_jobs")',
  '.from("packet_refresh_jobs")',
  '.table("source_intelligence_jobs")',
  '.table("packet_refresh_jobs")',
]);

function listRuntimeSourceFiles(absolutePath) {
  if (!fs.existsSync(absolutePath)) return [];
  const stat = fs.statSync(absolutePath);
  if (stat.isFile()) {
    return RUNTIME_SOURCE_EXTENSIONS.has(path.extname(absolutePath))
      ? [absolutePath]
      : [];
  }
  return fs.readdirSync(absolutePath, { withFileTypes: true })
    .filter((entry) => entry.name !== "__pycache__")
    .flatMap((entry) => listRuntimeSourceFiles(path.join(absolutePath, entry.name)));
}

export function assertFormerProjectIntelligencePathsAbsent({ root = path.resolve(PROJECT_INTELLIGENCE_ROOT, ".."), existsSync = fs.existsSync } = {}) {
  const present = FORMER_PROJECT_INTELLIGENCE_PATHS.filter((relativePath) => existsSync(path.join(root, relativePath)));
  if (present.length > 0) {
    throw new Error(
      `Project Intelligence ownership violation: former functional paths were reintroduced: ${present.join(", ")}. Move the implementation to its canonical project-intelligence module and delete the former path; Git history is the recovery record.`,
    );
  }
  return true;
}

export function assertRetiredCompilerIngressAbsent({
  root = path.resolve(PROJECT_INTELLIGENCE_ROOT, ".."),
  readFileSync = fs.readFileSync,
  files,
} = {}) {
  const violations = [];
  const candidates = files ?? RETIRED_COMPILER_INGRESS_ROOTS
    .flatMap((relativeRoot) => listRuntimeSourceFiles(path.join(root, relativeRoot)))
    .map((absolutePath) => path.relative(root, absolutePath));
  for (const relativePath of candidates) {
    const source = readFileSync(path.join(root, relativePath), "utf8");
    for (const term of RETIRED_COMPILER_INGRESS_TERMS) {
      if (source.includes(term)) {
        violations.push(`${relativePath}: ${term}`);
      }
    }
  }
  if (violations.length > 0) {
    throw new Error(
      `Project Intelligence ownership violation: retired compiler runtime was reintroduced: ${violations.join(", ")}. Ingestion may persist and embed sources, but no production service may import, enqueue, or invoke the retired compiler.`,
    );
  }
  return true;
}

export function assertCanonicalRunnerPath(value) {
  if (value !== CANONICAL_SCHEDULED_RUNNER) {
    throw new Error(
      `Project Intelligence ownership violation: scheduled Daily Brief must enter through ${CANONICAL_SCHEDULED_RUNNER}; received '${value}'.`,
    );
  }
  return true;
}

export function assertMaintenanceIsManual(relativePath) {
  if (relativePath.startsWith(`${PROJECT_INTELLIGENCE_OWNERS.maintenance}/`)) {
    throw new Error(
      `Project Intelligence ownership violation: maintenance tool '${relativePath}' cannot be a scheduled runtime target; invoke it manually with an explicit command.`,
    );
  }
  return true;
}

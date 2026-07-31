import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function read(relativePath) {
  return readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

function between(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing contract marker: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing contract marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("Vercel Workflow is the sole ordered five-stage owner", () => {
  const source = read(
    "frontend/src/lib/rag-pipeline/process-document-workflow.ts",
  );
  assert.match(source, /"use workflow";/);

  const stages = [
    ...source.matchAll(
      /await executeBackendStage\(input,\s*"(load|parse|vision|embed|extract)"\)/g,
    ),
  ].map((match) => match[1]);

  assert.deepEqual(stages, ["load", "parse", "vision", "embed", "extract"]);
  assert.match(source, /"use step";/);
  assert.match(source, /\/api\/pipeline\/stages\/\$\{stage\}/);
});

test("Workflow serialization packages are not server-externalized", () => {
  const config = read("frontend/next.config.ts");
  const externals = between(
    config,
    "serverExternalPackages: [",
    "outputFileTracingIncludes:",
  );

  assert.doesNotMatch(externals, /"@ai-sdk\/openai"/);
});

test("browser-safe attachment helpers cannot import the Workflow SDK boundary", () => {
  const shared = read(
    "frontend/src/lib/documents/pattern-c-attachments.ts",
  );
  const server = read(
    "frontend/src/lib/documents/pattern-c-attachments.server.ts",
  );
  const trigger = read("frontend/src/lib/documents/pipeline-trigger.ts");
  const enqueue = read("frontend/src/lib/rag-pipeline/enqueue.ts");

  assert.doesNotMatch(shared, /pipeline-trigger|workflow\/api/);
  assert.match(server, /^import "server-only";/);
  assert.match(server, /triggerDocumentPipeline/);
  assert.match(trigger, /^import "server-only";/);
  assert.match(enqueue, /^import "server-only";/);
  assert.match(enqueue, /from "workflow\/api"/);
});

test("Vercel cold builds do not serialize an unusable Webpack cache", () => {
  const config = read("frontend/next.config.ts");

  assert.match(
    config,
    /if \(process\.env\.VERCEL\) \{\s*config\.cache = false;\s*\}/,
  );
});

test("Workflow stage calls authenticate and classify permanent failures", () => {
  const source = read(
    "frontend/src/lib/rag-pipeline/process-document-workflow.ts",
  );

  assert.match(source, /process\.env\.ADMIN_API_KEY\?\.trim\(\)/);
  assert.match(source, /"x-admin-api-key": adminApiKey/);
  assert.match(source, /BACKEND_URL or PYTHON_BACKEND_URL is missing/);
  assert.match(source, /ADMIN_API_KEY is missing/);
  assert.match(
    source,
    /response\.status >= 400 && response\.status < 500[\s\S]*throw new FatalError\(message\)/,
  );
  assert.match(source, /throw new Error\(message\)/);
});

test("Next.js ingress authenticates and returns a durable run identifier", () => {
  const ingress = read("frontend/src/app/api/rag-pipeline/process/route.ts");
  const enqueue = read("frontend/src/lib/rag-pipeline/enqueue.ts");

  assert.match(ingress, /RAG_PIPELINE_WORKFLOW_SECRET/);
  assert.match(ingress, /process\.env\.ADMIN_API_KEY/);
  assert.match(ingress, /timingSafeEqual\(presented, expected\)/);
  assert.match(ingress, /credentials\.length === 0/);
  assert.match(ingress, /await enqueueDocumentPipeline\(/);
  assert.match(ingress, /\{ status: 202 \}/);
  assert.match(enqueue, /await start\(processDocumentWorkflow, \[input\]\)/);
  assert.match(enqueue, /runId: run\.runId/);
});

test("FastAPI compatibility ingress delegates instead of orchestrating", () => {
  const source = read("backend/src/api/main.py");
  const compatibilityRoute = between(
    source,
    '"/api/pipeline/process"',
    '"/api/pipeline/stages/{stage}"',
  );

  assert.match(compatibilityRoute, /Depends\(require_admin_api_key\)/);
  assert.match(
    compatibilityRoute,
    /enqueue_document_workflow\(payload\.metadataId\)/,
  );
  assert.doesNotMatch(compatibilityRoute, /run_pipeline_stage/);
  assert.doesNotMatch(
    compatibilityRoute,
    /run_(parser|document_parser|financial_parser|vision_analyzer|embedder|extractor)/,
  );
});

test("FastAPI stage adapter is authenticated and executes one named stage", () => {
  const source = read("backend/src/api/main.py");
  const stageRoute = between(
    source,
    '"/api/pipeline/stages/{stage}"',
    '"/api/ingest/fireflies/process"',
  );

  assert.match(stageRoute, /Depends\(require_admin_api_key\)/);
  assert.match(stageRoute, /\{"load", "parse", "vision", "embed", "extract"\}/);
  assert.match(stageRoute, /return run_pipeline_stage\(/);
  assert.doesNotMatch(stageRoute, /enqueue_document_workflow/);
});

test("Backend workflow client authenticates and rejects missing run IDs", () => {
  const source = read("backend/src/services/pipeline/workflow_client.py");

  assert.match(source, /RAG_PIPELINE_WORKFLOW_URL/);
  assert.match(source, /RAG_PIPELINE_WORKFLOW_SECRET/);
  assert.match(source, /ADMIN_API_KEY/);
  assert.match(
    source,
    /os\.getenv\("RAG_PIPELINE_WORKFLOW_SECRET"[\s\S]*or os\.getenv\("ADMIN_API_KEY"/,
  );
  assert.match(source, /"Authorization": f"Bearer \{secret\}"/);
  assert.match(source, /response\.raise_for_status\(\)/);
  assert.match(source, /if not result\.get\("runId"\)/);
});

test("Admin stale replay enqueues the durable workflow directly", () => {
  const source = read("backend/src/api/admin_endpoints.py");
  const replay = between(
    source,
    "async def replay_stale_raw_ingested_jobs(",
    "class ProjectBackfillRequest",
  );

  assert.match(
    replay,
    /enqueue_document_workflow\([\s\S]*source_type="fireflies"/,
  );
  assert.match(replay, /"run_id": workflow\["runId"\]/);
  assert.doesNotMatch(replay, /requests\.post/);
  assert.doesNotMatch(replay, /\/api\/pipeline\/process/);
  assert.doesNotMatch(replay, /\/api\/ingest\/fireflies\/process/);
});

test("Single-stage runner keeps vision explicit and never enqueues itself", () => {
  const source = read("backend/src/services/pipeline/stage_runner.py");
  const vision = between(source, 'if stage == "vision":', 'if stage == "embed":');

  assert.match(
    source,
    /PipelineStage = Literal\["load", "parse", "vision", "embed", "extract"\]/,
  );
  assert.match(
    source,
    /Microsoft Graph ingestion already materialized normalized content/,
  );
  assert.match(vision, /run_vision_analyzer\(metadata_id, client\)/);
  assert.doesNotMatch(
    vision,
    /Microsoft Graph source sync owns OCR before workflow enqueue/,
  );
  assert.match(
    source,
    /Graph communications intelligence is promoted by source projections/,
  );
  assert.match(source, /Graph embedding produced no chunks/);
  assert.doesNotMatch(source, /enqueue_document_workflow/);
});

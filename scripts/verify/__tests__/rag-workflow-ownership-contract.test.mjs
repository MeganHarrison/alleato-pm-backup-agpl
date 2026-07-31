import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
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

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(absolutePath);
    }
    return /\.(?:ts|tsx)$/.test(entry.name) ? [absolutePath] : [];
  });
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
  assert.match(
    source,
    /\/api\/pipeline\/stages\/\$\{stage\}/,
    "Workflow must call a single backend stage endpoint.",
  );
});

test("Workflow stage calls fail closed and classify retryable failures", () => {
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
    "Permanent 4xx responses must stop durable retry.",
  );
  assert.match(
    source,
    /throw new Error\(message\)/,
    "Transient backend failures must remain retryable by Workflow.",
  );
});

test("Next.js ingress authenticates and returns a durable run identifier", () => {
  const ingress = read(
    "frontend/src/app/api/rag-pipeline/process/route.ts",
  );
  const enqueue = read("frontend/src/lib/rag-pipeline/enqueue.ts");

  assert.match(ingress, /RAG_PIPELINE_WORKFLOW_SECRET/);
  assert.match(ingress, /authorization === `Bearer \$\{expected\}`/);
  assert.match(ingress, /await enqueueDocumentPipeline\(/);
  assert.match(ingress, /\{ status: 202 \}/);
  assert.match(enqueue, /await start\(processDocumentWorkflow, \[input\]\)/);
  assert.match(enqueue, /runId: run\.runId/);
});

test("Pattern C server implementation cannot enter client component bundles", () => {
  const clientFiles = sourceFiles(path.join(repositoryRoot, "frontend/src"))
    .map((absolutePath) => ({
      absolutePath,
      source: readFileSync(absolutePath, "utf8"),
    }))
    .filter(({ source }) => /^\s*["']use client["'];/m.test(source));

  const offenders = clientFiles
    .filter(({ source }) =>
      /from\s+["']@\/lib\/documents\/pattern-c-attachments["']/.test(source),
    )
    .map(({ absolutePath }) => path.relative(repositoryRoot, absolutePath));

  assert.deepEqual(
    offenders,
    [],
    "Client modules must import Pattern C types from pattern-c-attachment-types, not the server implementation.",
  );

  const sharedTypes = read(
    "frontend/src/lib/documents/pattern-c-attachment-types.ts",
  );
  assert.doesNotMatch(
    sharedTypes,
    /workflow|pipeline-trigger|supabase\/service/,
    "The client-safe Pattern C module must remain free of server-only dependencies.",
  );
});

test("FastAPI exposes no compatibility process ingress", () => {
  const source = read("backend/src/api/main.py");
  assert.doesNotMatch(source, /"\/api\/pipeline\/process"/);
});

test("operational callers use the canonical Vercel Workflow ingress", () => {
  for (const caller of [
    "scripts/ops/requeue-vision-analysis.mjs",
    "scripts/jobplanner/import-submittal-documents.mjs",
    "scripts/rag/detect-under-embedded-docs.mjs",
    "frontend/scripts/trigger-pipeline-batch.ts",
  ]) {
    const source = read(caller);
    assert.match(source, /\/api\/rag-pipeline\/process/);
    assert.match(source, /RAG_PIPELINE_WORKFLOW_SECRET/);
    assert.doesNotMatch(source, /\/api\/pipeline\/process/);
  }
});

test("FastAPI stage adapter is authenticated and executes exactly one stage", () => {
  const source = read("backend/src/api/main.py");
  const stageRoute = between(
    source,
    '"/api/pipeline/stages/{stage}"',
    '"/api/ingest/fireflies/process"',
  );

  assert.match(stageRoute, /Depends\(require_admin_api_key\)/);
  assert.match(
    stageRoute,
    /\{"load", "parse", "vision", "embed", "extract"\}/,
  );
  assert.match(stageRoute, /return run_pipeline_stage\(/);
  assert.doesNotMatch(stageRoute, /enqueue_document_workflow/);
});

test("Backend workflow client authenticates and rejects missing run IDs", () => {
  const source = read("backend/src/services/pipeline/workflow_client.py");

  assert.match(source, /RAG_PIPELINE_WORKFLOW_URL/);
  assert.match(source, /RAG_PIPELINE_WORKFLOW_SECRET/);
  assert.match(source, /"Authorization": f"Bearer \{secret\}"/);
  assert.match(source, /response\.raise_for_status\(\)/);
  assert.match(source, /if not result\.get\("runId"\)/);
});

test("Single-stage runner preserves source-specific ownership", () => {
  const source = read("backend/src/services/pipeline/stage_runner.py");
  const graphEmbed = read(
    "backend/src/services/integrations/microsoft_graph/embed.py",
  );

  assert.match(source, /PipelineStage = Literal\["load", "parse", "vision", "embed", "extract"\]/);
  assert.match(source, /Microsoft Graph ingestion already materialized normalized content/);
  assert.match(source, /Graph communications intelligence is promoted by source projections/);
  assert.match(source, /Graph embedding produced no chunks/);
  for (const persistedSource of [
    "outlook_email",
    "outlook_attachment",
    "teams_dm",
    "onedrive",
    "sharepoint",
  ]) {
    assert.match(
      source,
      new RegExp(`"${persistedSource}"`),
      `Persisted Graph source ${persistedSource} must retain Graph ownership.`,
    );
  }
  assert.doesNotMatch(source, /enqueue_document_workflow/);
  assert.doesNotMatch(
    graphEmbed,
    /run_vision_analyzer|_ensure_vision_page_intelligence/,
    "Embedding must consume vision results, never execute the vision stage.",
  );
});

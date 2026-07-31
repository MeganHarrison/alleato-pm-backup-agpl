#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const APP_SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const APP_SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
const RAG_SUPABASE_URL = process.env.RAG_SUPABASE_URL;
const RAG_SUPABASE_SERVICE_ROLE_KEY =
  process.env.RAG_SUPABASE_SERVICE_ROLE_KEY ??
  process.env.RAG_SUPABASE_SERVICE_KEY;

function printHelp() {
  console.log(`Usage:
  node scripts/verify/verify_submittal_ai_review_live.mjs [options]

Options:
  --project-id <number>         Restrict to one project.
  --submittal-id <uuid>         Restrict to one or more submittals. Repeatable.
  --sample-size <number>        Representative sample size. Default: 3.
  --limit <number>              Max submittals to inspect. Default: 250.
  --json                        Print machine-readable JSON.
  --run-review                  Run the canonical review service for selected submittals.
  --reviewer-email <email>      Reviewer auth email for --run-review. Default: TEST_USER_1 or test1@mail.com
  --reviewer-user-id <uuid>     Explicit auth user ID for --run-review.
`);
}

function parseArgs(argv) {
  const args = {
    projectId: null,
    submittalIds: [],
    sampleSize: 3,
    limit: 250,
    json: false,
    runReview: false,
    reviewerEmail: process.env.TEST_USER_1 ?? "test1@mail.com",
    reviewerUserId: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--project-id") {
      args.projectId = Number.parseInt(argv[++index] ?? "", 10);
    } else if (arg === "--submittal-id") {
      args.submittalIds.push(argv[++index] ?? "");
    } else if (arg === "--sample-size") {
      args.sampleSize = Number.parseInt(argv[++index] ?? "", 10);
    } else if (arg === "--limit") {
      args.limit = Number.parseInt(argv[++index] ?? "", 10);
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--run-review") {
      args.runReview = true;
    } else if (arg === "--reviewer-email") {
      args.reviewerEmail = argv[++index] ?? null;
    } else if (arg === "--reviewer-user-id") {
      args.reviewerUserId = argv[++index] ?? null;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (args.projectId !== null && !Number.isFinite(args.projectId)) {
    throw new Error("--project-id must be a number.");
  }
  if (!Number.isFinite(args.sampleSize) || args.sampleSize < 1) {
    throw new Error("--sample-size must be a positive number.");
  }
  if (!Number.isFinite(args.limit) || args.limit < 1) {
    throw new Error("--limit must be a positive number.");
  }
  if (args.runReview && args.projectId === null && args.submittalIds.length === 0) {
    throw new Error("--run-review requires either --project-id or explicit --submittal-id values.");
  }

  return args;
}

function requireEnv() {
  const missing = [];
  if (!APP_SUPABASE_URL) missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  if (!APP_SUPABASE_SERVICE_ROLE_KEY) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY");
  }
  if (!RAG_SUPABASE_URL) missing.push("RAG_SUPABASE_URL");
  if (!RAG_SUPABASE_SERVICE_ROLE_KEY) {
    missing.push("RAG_SUPABASE_SERVICE_ROLE_KEY or RAG_SUPABASE_SERVICE_KEY");
  }
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

function restHeaders(serviceRoleKey) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };
}

function buildUrl(baseUrl, table, searchParams = {}) {
  const url = new URL(`/rest/v1/${table}`, baseUrl);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function select(baseUrl, key, table, searchParams = {}) {
  const response = await fetch(buildUrl(baseUrl, table, searchParams), {
    headers: {
      ...restHeaders(key),
      Prefer: "count=exact",
    },
  });
  if (!response.ok) {
    throw new Error(`GET ${table} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

function chunk(values, size = 100) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function inFilter(values) {
  return `in.(${values.map((value) => `"${String(value).replaceAll('"', '\\"')}"`).join(",")})`;
}

function compactText(value, maxLength = 350) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function textLength(row) {
  return Math.max(
    String(row?.content ?? "").trim().length,
    String(row?.raw_text ?? "").trim().length,
  );
}

async function loadRowsByIds({ baseUrl, key, table, selectColumns, ids, idColumn = "id" }) {
  const rows = [];
  for (const idChunk of chunk(ids, 100)) {
    if (idChunk.length === 0) continue;
    rows.push(
      ...(await select(baseUrl, key, table, {
        select: selectColumns,
        [idColumn]: inFilter(idChunk),
      })),
    );
  }
  return rows;
}

async function loadSubmittals(args) {
  if (args.submittalIds.length > 0) {
    return select(APP_SUPABASE_URL, APP_SUPABASE_SERVICE_ROLE_KEY, "submittals", {
      select:
        "id,project_id,submittal_number,title,status,specification_section,description",
      id: inFilter(args.submittalIds),
      limit: String(args.limit),
    });
  }

  const searchParams = {
    select:
      "id,project_id,submittal_number,title,status,specification_section,description",
    order: "created_at.desc",
    limit: String(args.limit),
  };
  if (args.projectId !== null) {
    searchParams.project_id = `eq.${args.projectId}`;
  }
  return select(APP_SUPABASE_URL, APP_SUPABASE_SERVICE_ROLE_KEY, "submittals", searchParams);
}

async function loadProjectNames(projectIds) {
  const rows = await loadRowsByIds({
    baseUrl: APP_SUPABASE_URL,
    key: APP_SUPABASE_SERVICE_ROLE_KEY,
    table: "projects",
    selectColumns: "id,name,project_number",
    ids: projectIds,
  });
  return new Map(rows.map((row) => [row.id, row]));
}

async function loadSubmittalDocs(submittalIds) {
  const rows = [];
  for (const ids of chunk(submittalIds, 100)) {
    rows.push(
      ...(await select(APP_SUPABASE_URL, APP_SUPABASE_SERVICE_ROLE_KEY, "submittal_doc_links", {
        select: "submittal_id,document_metadata_id,document_type,attached_at",
        submittal_id: inFilter(ids),
      })),
    );
  }
  return rows;
}

async function loadLinkedDrawings(submittalIds) {
  const rows = [];
  for (const ids of chunk(submittalIds, 100)) {
    rows.push(
      ...(await select(
        APP_SUPABASE_URL,
        APP_SUPABASE_SERVICE_ROLE_KEY,
        "submittal_linked_drawings",
        {
          select: "id,submittal_id,drawing_id",
          submittal_id: inFilter(ids),
        },
      )),
    );
  }
  return rows;
}

function summarizeReadiness(submittal, docs, drawings) {
  const searchableDocCount = docs.filter((doc) => doc.hasSearchableText).length;
  const drawingOcrReadyCount = drawings.filter((drawing) => drawing.ocrTextReady).length;
  const drawingVisionReadyCount = drawings.filter((drawing) => drawing.visionReady).length;
  const drawingEmbeddedReadyCount = drawings.filter((drawing) => drawing.embeddedReady).length;
  const drawingReadyCount = drawings.filter(
    (drawing) => drawing.ocrTextReady && drawing.visionReady && drawing.embeddedReady,
  ).length;

  const docGap = docs.length > 0 && searchableDocCount < docs.length;
  const drawingGap =
    drawings.length > 0 &&
    (drawingOcrReadyCount < drawings.length ||
      drawingVisionReadyCount < drawings.length ||
      drawingEmbeddedReadyCount < drawings.length);
  const fullyReady =
    docs.length > 0 &&
    drawings.length > 0 &&
    searchableDocCount === docs.length &&
    drawingReadyCount === drawings.length;

  let cohort = "minimal_context";
  if (fullyReady) cohort = "ready";
  else if (docGap) cohort = "text_gap";
  else if (drawingGap) cohort = "drawing_gap";
  else if (docs.length > 0 || drawings.length > 0) cohort = "partial_context";

  const rankingScore =
    docs.length * 20 +
    searchableDocCount * 15 +
    drawings.length * 10 +
    drawingReadyCount * 10;

  return {
    cohort,
    rankingScore,
    linkedDocumentCount: docs.length,
    searchableDocumentCount: searchableDocCount,
    linkedDrawingCount: drawings.length,
    drawingOcrReadyCount,
    drawingVisionReadyCount,
    drawingEmbeddedReadyCount,
    drawingFullyReadyCount: drawingReadyCount,
    fullyReady,
  };
}

function pickRepresentativeSamples(rows, sampleSize) {
  const preferredOrder = ["ready", "text_gap", "drawing_gap", "partial_context", "minimal_context"];
  const selected = [];
  const seen = new Set();

  for (const cohort of preferredOrder) {
    const match = rows
      .filter((row) => row.readiness.cohort === cohort)
      .sort((left, right) => right.readiness.rankingScore - left.readiness.rankingScore)[0];
    if (!match || seen.has(match.submittalId)) continue;
    selected.push(match);
    seen.add(match.submittalId);
    if (selected.length >= sampleSize) return selected;
  }

  const remaining = rows
    .filter((row) => !seen.has(row.submittalId))
    .sort((left, right) => right.readiness.rankingScore - left.readiness.rankingScore);
  for (const row of remaining) {
    selected.push(row);
    if (selected.length >= sampleSize) break;
  }
  return selected;
}

function printHumanSummary(result) {
  console.log("Representative submittal AI review candidates");
  console.log("");
  for (const row of result.recommendedSamples) {
    console.log(
      `- [${row.readiness.cohort}] project ${row.projectId} ${row.projectName ?? ""} | submittal ${row.submittalNumber ?? row.submittalId} | ${row.title}`,
    );
    console.log(
      `  docs ${row.readiness.searchableDocumentCount}/${row.readiness.linkedDocumentCount} searchable, drawings ${row.readiness.drawingFullyReadyCount}/${row.readiness.linkedDrawingCount} fully ready, stored review ${row.storedReviewStatus ?? "none"}`,
    );
    if (row.notes.length > 0) {
      console.log(`  notes: ${row.notes.join("; ")}`);
    }
  }
}

function runReviewRunner({ projectId, submittalIds, reviewerEmail, reviewerUserId }) {
  const args = [
    "../node_modules/.bin/tsx",
    "--tsconfig",
    "tsconfig.json",
    "scripts/verify-submittal-ai-review.ts",
    "--project-id",
    String(projectId),
  ];
  for (const submittalId of submittalIds) {
    args.push("--submittal-id", submittalId);
  }
  if (reviewerUserId) {
    args.push("--reviewer-user-id", reviewerUserId);
  } else if (reviewerEmail) {
    args.push("--reviewer-email", reviewerEmail);
  }

  const result = spawnSync(args[0], args.slice(1), {
    cwd: path.join(repoRoot, "frontend"),
    env: process.env,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `Review runner failed with exit ${result.status}: ${result.stderr || result.stdout}`.trim(),
    );
  }
  return JSON.parse(result.stdout);
}

async function main() {
  requireEnv();
  const args = parseArgs(process.argv.slice(2));
  const submittals = await loadSubmittals(args);
  const submittalIds = submittals.map((row) => row.id);
  const projectIds = [...new Set(submittals.map((row) => row.project_id).filter(Boolean))];
  const projectById = await loadProjectNames(projectIds);

  const [docLinks, linkedDrawings] = await Promise.all([
    loadSubmittalDocs(submittalIds),
    loadLinkedDrawings(submittalIds),
  ]);

  const docMetadataIds = [
    ...new Set(docLinks.map((row) => row.document_metadata_id).filter(Boolean)),
  ];
  const drawingIds = [...new Set(linkedDrawings.map((row) => row.drawing_id).filter(Boolean))];

  const [appDocs, ragDocs, drawingRows, drawingRevisionRows] = await Promise.all([
    loadRowsByIds({
      baseUrl: APP_SUPABASE_URL,
      key: APP_SUPABASE_SERVICE_ROLE_KEY,
      table: "document_metadata",
      selectColumns: "id,title,file_name,status,project_id,storage_bucket,file_path,document_type,content,raw_text",
      ids: docMetadataIds,
    }),
    loadRowsByIds({
      baseUrl: RAG_SUPABASE_URL,
      key: RAG_SUPABASE_SERVICE_ROLE_KEY,
      table: "rag_document_metadata",
      selectColumns: "id,title,content,raw_text,parsing_status,embedding_status",
      ids: docMetadataIds,
    }),
    loadRowsByIds({
      baseUrl: APP_SUPABASE_URL,
      key: APP_SUPABASE_SERVICE_ROLE_KEY,
      table: "drawings",
      selectColumns: "id,drawing_number,title,discipline,project_id,current_revision_id,document_metadata_id",
      ids: drawingIds,
    }),
    loadRowsByIds({
      baseUrl: APP_SUPABASE_URL,
      key: APP_SUPABASE_SERVICE_ROLE_KEY,
      table: "drawing_revisions",
      selectColumns: "id,drawing_id,revision_number,document_metadata_id",
      ids: drawingIds,
      idColumn: "drawing_id",
    }),
  ]);

  const drawingMetaIds = [
    ...new Set(
      [
        ...drawingRows.map((row) => row.document_metadata_id),
        ...drawingRevisionRows.map((row) => row.document_metadata_id),
      ].filter(Boolean),
    ),
  ];

  const [drawingMetadataRows, drawingPageRows, drawingChunkRows] = await Promise.all([
    loadRowsByIds({
      baseUrl: APP_SUPABASE_URL,
      key: APP_SUPABASE_SERVICE_ROLE_KEY,
      table: "document_metadata",
      selectColumns: "id,status,content,raw_text",
      ids: drawingMetaIds,
    }),
    loadRowsByIds({
      baseUrl: APP_SUPABASE_URL,
      key: APP_SUPABASE_SERVICE_ROLE_KEY,
      table: "document_page_intelligence",
      selectColumns: "document_metadata_id,page_number,ai_summary",
      ids: drawingMetaIds,
      idColumn: "document_metadata_id",
    }),
    loadRowsByIds({
      baseUrl: RAG_SUPABASE_URL,
      key: RAG_SUPABASE_SERVICE_ROLE_KEY,
      table: "document_chunks",
      selectColumns: "document_id,text,chunk_index",
      ids: drawingMetaIds,
      idColumn: "document_id",
    }),
  ]);

  const appDocById = new Map(appDocs.map((row) => [row.id, row]));
  const ragDocById = new Map(ragDocs.map((row) => [row.id, row]));
  const drawingById = new Map(drawingRows.map((row) => [row.id, row]));
  const revisionsByDrawingId = new Map();
  for (const row of drawingRevisionRows) {
    if (!revisionsByDrawingId.has(row.drawing_id)) {
      revisionsByDrawingId.set(row.drawing_id, row);
    }
  }
  const drawingMetadataById = new Map(drawingMetadataRows.map((row) => [row.id, row]));
  const drawingPageCountById = new Map();
  for (const row of drawingPageRows) {
    drawingPageCountById.set(
      row.document_metadata_id,
      (drawingPageCountById.get(row.document_metadata_id) ?? 0) + 1,
    );
  }
  const drawingChunkCountById = new Map();
  for (const row of drawingChunkRows) {
    drawingChunkCountById.set(
      row.document_id,
      (drawingChunkCountById.get(row.document_id) ?? 0) + 1,
    );
  }

  const docsBySubmittalId = new Map();
  for (const link of docLinks) {
    const appDoc = appDocById.get(link.document_metadata_id) ?? null;
    const ragDoc = ragDocById.get(link.document_metadata_id) ?? null;
    const document = {
      documentMetadataId: link.document_metadata_id,
      documentType: link.document_type ?? appDoc?.document_type ?? null,
      title: appDoc?.title ?? appDoc?.file_name ?? ragDoc?.title ?? null,
      appStatus: appDoc?.status ?? null,
      ragParsingStatus: ragDoc?.parsing_status ?? null,
      ragEmbeddingStatus: ragDoc?.embedding_status ?? null,
      appTextLength: textLength(appDoc),
      ragTextLength: textLength(ragDoc),
      searchableTextLength: Math.max(textLength(appDoc), textLength(ragDoc)),
      hasSearchableText: Math.max(textLength(appDoc), textLength(ragDoc)) > 0,
      excerpt:
        compactText(ragDoc?.content) ??
        compactText(ragDoc?.raw_text) ??
        compactText(appDoc?.content) ??
        compactText(appDoc?.raw_text),
    };
    if (!docsBySubmittalId.has(link.submittal_id)) docsBySubmittalId.set(link.submittal_id, []);
    docsBySubmittalId.get(link.submittal_id).push(document);
  }

  const drawingsBySubmittalId = new Map();
  for (const link of linkedDrawings) {
    const drawing = drawingById.get(link.drawing_id) ?? {};
    const revision = revisionsByDrawingId.get(link.drawing_id) ?? null;
    const documentMetadataId = revision?.document_metadata_id ?? drawing.document_metadata_id ?? null;
    const metadata = documentMetadataId ? drawingMetadataById.get(documentMetadataId) : null;
    const ocrTextReady = textLength(metadata) > 0;
    const visionReady = (drawingPageCountById.get(documentMetadataId) ?? 0) > 0;
    const embeddedReady = (drawingChunkCountById.get(documentMetadataId) ?? 0) > 0;
    const record = {
      drawingId: link.drawing_id,
      documentMetadataId,
      drawingNumber: drawing.drawing_number ?? null,
      title: drawing.title ?? null,
      revision: revision?.revision_number ?? null,
      ocrTextReady,
      visionReady,
      embeddedReady,
      state:
        !documentMetadataId
          ? "not_ready"
          : metadata?.status === "ocr_failed" || metadata?.status === "error"
            ? "failed"
            : ocrTextReady && visionReady && embeddedReady
              ? "ready"
              : ocrTextReady || visionReady || embeddedReady
                ? "partial"
                : "not_ready",
    };
    if (!drawingsBySubmittalId.has(link.submittal_id)) {
      drawingsBySubmittalId.set(link.submittal_id, []);
    }
    drawingsBySubmittalId.get(link.submittal_id).push(record);
  }

  const rows = submittals.map((submittal) => {
    const docs = docsBySubmittalId.get(submittal.id) ?? [];
    const drawings = drawingsBySubmittalId.get(submittal.id) ?? [];
    const readiness = summarizeReadiness(submittal, docs, drawings);
    const project = projectById.get(submittal.project_id) ?? null;
    const notes = [];
    if (docs.length === 0) notes.push("No linked submittal documents.");
    if (drawings.length === 0) notes.push("No linked drawings.");
    if (readiness.cohort === "text_gap") {
      notes.push("At least one linked submittal document has no searchable text.");
    }
    if (readiness.cohort === "drawing_gap") {
      notes.push("At least one linked drawing is missing OCR, vision, or retrieval readiness.");
    }
    return {
      submittalId: submittal.id,
      projectId: submittal.project_id,
      projectName: project?.name ?? null,
      projectNumber: project?.project_number ?? null,
      submittalNumber: submittal.submittal_number ?? null,
      title: submittal.title ?? null,
      specificationSection: submittal.specification_section ?? null,
      docs,
      drawings,
      readiness,
      notes,
    };
  });

  const recommendedSamples = pickRepresentativeSamples(rows, args.sampleSize);
  let reviewRun = null;
  if (args.runReview && recommendedSamples.length > 0) {
    const projectIdsInSample = [...new Set(recommendedSamples.map((row) => row.projectId))];
    if (projectIdsInSample.length !== 1) {
      throw new Error(
        `--run-review currently requires the selected sample to be from one project; found ${projectIdsInSample.join(", ")}`,
      );
    }
    reviewRun = runReviewRunner({
      projectId: projectIdsInSample[0],
      submittalIds: recommendedSamples.map((row) => row.submittalId),
      reviewerEmail: args.reviewerEmail,
      reviewerUserId: args.reviewerUserId,
    });
  }

  const result = {
    ok: true,
    summary: {
      scannedSubmittalCount: rows.length,
      cohorts: rows.reduce((accumulator, row) => {
        accumulator[row.readiness.cohort] =
          (accumulator[row.readiness.cohort] ?? 0) + 1;
        return accumulator;
      }, {}),
    },
    recommendedSamples,
    reviewRun,
  };

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printHumanSummary(result);
  if (reviewRun) {
    console.log("");
    console.log("Review rerun results");
    for (const row of reviewRun.results ?? []) {
      console.log(
        `- ${row.submittalId}: status ${row.status}, submittal_text ${row.readiness.layers.find((layer) => layer.key === "submittal_text")?.availableCount}/${row.readiness.layers.find((layer) => layer.key === "submittal_text")?.totalCount}`,
      );
    }
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});

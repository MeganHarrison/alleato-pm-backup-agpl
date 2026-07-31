#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
};

function buildUrl(path, searchParams = {}) {
  const url = new URL(`/rest/v1/${path}`, SUPABASE_URL);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function select(path, searchParams) {
  const response = await fetch(buildUrl(path, searchParams), {
    headers: {
      ...headers,
      Prefer: "count=exact",
    },
  });
  if (!response.ok) {
    throw new Error(`GET ${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

const syntheticSubmittalId = "7dfbccac-6ccf-4d69-8129-7de7918c5248";
const drawingId = "4a041968-6862-41de-95da-f104a39d1172";
const drawingMetadataId = "drawing-revision:4d3acc68-890a-4bfc-bb02-63616d13a0c9";
const productDocumentId = "synthetic-submittal:goodwill-storefront-product-data";

const [submittals, linkedDrawings, drawings, docs, pages, productDocs, specifications, reviewRuns] = await Promise.all([
  select("submittals", {
    select: "id,submittal_number,title,specification_section_id",
    id: `eq.${syntheticSubmittalId}`,
  }),
  select("submittal_linked_drawings", {
    select: "submittal_id,drawing_id",
    submittal_id: `eq.${syntheticSubmittalId}`,
  }),
  select("drawings", {
    select: "id,drawing_number,document_metadata_id",
    id: `eq.${drawingId}`,
  }),
  select("document_metadata", {
    select: "id,status,content",
    id: `eq.${drawingMetadataId}`,
  }),
  select("document_page_intelligence", {
    select: "document_metadata_id,page_number",
    document_metadata_id: `eq.${drawingMetadataId}`,
  }),
  select("document_metadata", {
    select: "id,title,content",
    id: `eq.${productDocumentId}`,
  }),
  select("specification_sections", {
    select: "id,section_number,content",
    project_id: "eq.25125",
    section_number: "eq.08-43-13",
  }),
  select("submittal_ai_review_runs", {
    select: "status,readiness,source_coverage,validated_output,summary,created_at",
    submittal_id: `eq.${syntheticSubmittalId}`,
    order: "created_at.desc",
    limit: "1",
  }),
]);

const submittal = submittals[0];
if (!submittal) fail("Synthetic submittal row is missing.");

const drawing = drawings[0];
if (!drawing) fail("Target drawing row is missing.");
if (drawing.document_metadata_id !== drawingMetadataId) {
  fail(
    `Drawing ${drawingId} does not point at expected document_metadata_id ${drawingMetadataId}.`,
  );
}

if (!linkedDrawings.some((row) => row.submittal_id === syntheticSubmittalId && row.drawing_id === drawingId)) {
  fail("Synthetic submittal is not linked to the target drawing.");
}

const doc = docs[0];
if (!doc) fail("Backfilled drawing document_metadata row is missing.");
if (!doc.content || doc.content.trim().length === 0) {
  fail("Backfilled drawing document_metadata row has no OCR/content text.");
}

if ((pages ?? []).length === 0) {
  fail("Backfilled drawing has no document_page_intelligence rows.");
}

const productDoc = productDocs[0];
if (!productDoc?.content?.includes("Submitted finish: dark bronze")) {
  fail("Synthetic product data document is missing the submitted finish evidence.");
}

const specification = specifications[0];
if (!specification?.content?.includes("Dark bronze finish is not acceptable")) {
  fail("Synthetic specification is missing the finish conflict requirement.");
}

if (submittal.specification_section_id !== specification.id) {
  fail(`Synthetic submittal does not point at canonical specification section ${specification.id}.`);
}

const reviewRun = reviewRuns[0];
if (!reviewRun || typeof reviewRun.validated_output !== "object") {
  fail("Synthetic submittal has no canonical completed AI review run.");
}

const aiReview = reviewRun.validated_output;

const layers = reviewRun.readiness?.layers ?? [];
const linkedLayer = layers.find((layer) => layer.key === "linked_drawings");
const ocrLayer = layers.find((layer) => layer.key === "drawing_ocr");
const visionLayer = layers.find((layer) => layer.key === "drawing_vision");
const retrievalLayer = layers.find((layer) => layer.key === "retrieval");

for (const [name, layer] of [
  ["linked_drawings", linkedLayer],
  ["drawing_ocr", ocrLayer],
  ["drawing_vision", visionLayer],
  ["retrieval", retrievalLayer],
]) {
  if (!layer || layer.state !== "ready") {
    fail(`Synthetic submittal readiness layer ${name} is not ready.`);
  }
}

const specLayer = layers.find((layer) => layer.key === "spec_context");
if (!specLayer || specLayer.state !== "ready") {
  fail("Synthetic submittal readiness layer spec_context is not ready.");
}

const checks = Array.isArray(aiReview.checks) ? aiReview.checks : [];
const finishConflict = checks.find((check) =>
  String(check.title ?? "").toLowerCase().includes("finish") &&
  check.status === "fail"
);

if (!finishConflict) {
  fail("Synthetic review did not produce the expected failing finish conflict.");
}

if ((reviewRun.source_coverage?.submittalDocumentCount ?? 0) < 2) {
  fail("Synthetic review did not include both submittal source documents.");
}

if ((reviewRun.source_coverage?.specSourceCount ?? 0) < 1) {
  fail("Synthetic review did not include specification source context.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      syntheticSubmittalId,
      drawingId,
      drawingMetadataId,
      drawingStatus: doc.status,
      drawingContentLength: doc.content.length,
      pageCount: pages.length,
      aiReviewStatus: reviewRun.status,
      sourceCoverage: reviewRun.source_coverage,
      finishConflict: {
        title: finishConflict.title,
        status: finishConflict.status,
        severity: finishConflict.severity,
      },
      summary: reviewRun.summary,
    },
    null,
    2,
  ),
);

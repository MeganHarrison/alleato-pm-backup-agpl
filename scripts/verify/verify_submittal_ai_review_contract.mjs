import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const aiReviewRoutePath = path.join(
  repoRoot,
  "frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/ai-review/route.ts",
);
const linkedDrawingsRoutePath = path.join(
  repoRoot,
  "frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/linked-drawings/route.ts",
);
const linkedDrawingDeleteRoutePath = path.join(
  repoRoot,
  "frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/linked-drawings/[drawingId]/route.ts",
);
const reviewRunServicePath = path.join(
  repoRoot,
  "frontend/src/lib/submittals/ai-review/review-run-service.ts",
);
const schemasPath = path.join(
  repoRoot,
  "frontend/src/lib/submittals/ai-review/schemas.ts",
);
const sourceReferencesPath = path.join(
  repoRoot,
  "frontend/src/lib/submittals/ai-review/source-references.ts",
);

function read(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing required file: ${path.relative(repoRoot, filePath)}`,
    );
  }
  return fs.readFileSync(filePath, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const aiReviewRoute = read(aiReviewRoutePath);
const linkedDrawingsRoute = read(linkedDrawingsRoutePath);
const linkedDrawingDeleteRoute = read(linkedDrawingDeleteRoutePath);
const reviewRunService = read(reviewRunServicePath);
const schemas = read(schemasPath);
const sourceReferences = read(sourceReferencesPath);

assert(
  !aiReviewRoute.includes("chat.completions.create"),
  "AI review route still calls raw chat completions.",
);
assert(
  !aiReviewRoute.includes("JSON.parse"),
  "AI review route still parses raw model JSON manually.",
);
assert(
  aiReviewRoute.includes("createSubmittalAIReviewService"),
  "AI review route must delegate to the shared review service.",
);
assert(
  linkedDrawingsRoute.includes("createSubmittalAIReviewService"),
  "Linked drawings route must use the shared review service.",
);
assert(
  linkedDrawingDeleteRoute.includes("createSubmittalAIReviewService"),
  "Linked drawing delete route must use the shared review service.",
);
assert(
  linkedDrawingDeleteRoute.includes("getScopedSubmittal") &&
    linkedDrawingDeleteRoute.includes("getDrawingByScope"),
  "Linked drawing delete route must validate submittal and drawing project scope before delete.",
);
assert(
  !linkedDrawingsRoute.includes("return new Set()"),
  "Linked drawings route still contains the silent readiness fallback pattern.",
);
assert(
  reviewRunService.includes("submittal_ai_review_runs"),
  "Review service does not persist normalized review runs.",
);
assert(
  reviewRunService.includes("submittal_ai_review_checks"),
  "Review service does not persist normalized review checks.",
);
assert(
  reviewRunService.includes("rag_document_metadata"),
  "Review service does not read split-RAG submittal source text.",
);
assert(
  schemas.includes("SubmittalAIReviewModelOutputSchema"),
  "Structured output schema is missing.",
);
assert(
  sourceReferences.includes("buildPromptSourceCatalog"),
  "Source reference catalog builder is missing.",
);

console.log("PASS: submittal AI review contract verified");

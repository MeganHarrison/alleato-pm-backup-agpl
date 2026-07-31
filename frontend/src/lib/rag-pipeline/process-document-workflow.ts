import { FatalError } from "workflow";

export type ProcessDocumentInput = {
  documentId: string;
  sourceType?: string | null;
  projectHint?: number | null;
};

type PipelineStage = "load" | "parse" | "vision" | "embed" | "extract";

type StageResult = {
  metadataId: string;
  stage?: PipelineStage;
  status?: string | null;
  skipped?: boolean;
  reason?: string;
  result?: unknown;
};

export async function processDocumentWorkflow(input: ProcessDocumentInput) {
  "use workflow";

  const loaded = await executeBackendStage(input, "load");
  const parsed = await executeBackendStage(input, "parse");
  const vision = await executeBackendStage(input, "vision");
  const embedded = await executeBackendStage(input, "embed");
  const extracted = await executeBackendStage(input, "extract");

  return {
    documentId: input.documentId,
    status: "complete",
    stages: { loaded, parsed, vision, embedded, extracted },
  };
}

async function executeBackendStage(
  input: ProcessDocumentInput,
  stage: PipelineStage,
): Promise<StageResult> {
  "use step";

  const backendUrl = (
    process.env.BACKEND_URL ||
    process.env.PYTHON_BACKEND_URL ||
    (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "")
  )
    .trim()
    .replace(/\/+$/, "");
  const adminApiKey = process.env.ADMIN_API_KEY?.trim();

  if (!backendUrl) {
    throw new FatalError(
      "RAG workflow cannot run because BACKEND_URL or PYTHON_BACKEND_URL is missing.",
    );
  }
  if (!adminApiKey) {
    throw new FatalError(
      "RAG workflow cannot run because ADMIN_API_KEY is missing.",
    );
  }

  const response = await fetch(`${backendUrl}/api/pipeline/stages/${stage}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-api-key": adminApiKey,
    },
    body: JSON.stringify({
      metadataId: input.documentId,
      sourceType: input.sourceType ?? null,
      projectHint: input.projectHint ?? null,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1_000);
    const message =
      `RAG stage ${stage} failed for ${input.documentId}: ` +
      `${response.status} ${detail || response.statusText}`;
    if (response.status >= 400 && response.status < 500) {
      throw new FatalError(message);
    }
    throw new Error(message);
  }

  return (await response.json()) as StageResult;
}

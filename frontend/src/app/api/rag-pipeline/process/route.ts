import { timingSafeEqual } from "node:crypto";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { enqueueDocumentPipeline } from "@/lib/rag-pipeline/enqueue";

export const runtime = "nodejs";
const WHERE = "rag-pipeline/process#POST";

type RequestBody = {
  documentId?: unknown;
  metadataId?: unknown;
  sourceType?: unknown;
  projectHint?: unknown;
};

function workflowCredentials(): string[] {
  return [
    process.env.RAG_PIPELINE_WORKFLOW_SECRET?.trim(),
    process.env.ADMIN_API_KEY?.trim(),
  ].filter((value): value is string => Boolean(value));
}

function isAuthorized(request: Request, credentials: string[]): boolean {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return false;
  }
  const presented = Buffer.from(authorization.slice("Bearer ".length));
  return credentials.some((credential) => {
    const expected = Buffer.from(credential);
    return (
      presented.length === expected.length &&
      timingSafeEqual(presented, expected)
    );
  });
}

export const POST = withApiGuardrails(WHERE, async ({ request }) => {
  const credentials = workflowCredentials();
  if (credentials.length === 0) {
    throw new GuardrailError({
      code: "CONFIGURATION_ERROR",
      where: WHERE,
      status: 503,
      message:
        "RAG Workflow authentication is not configured. Set " +
        "RAG_PIPELINE_WORKFLOW_SECRET or ADMIN_API_KEY.",
    });
  }
  if (!isAuthorized(request, credentials)) {
    throw new GuardrailError({
      code: "UNAUTHORIZED",
      where: WHERE,
      status: 401,
      message: "RAG Workflow authorization failed.",
    });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch (error) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE,
      status: 400,
      message: "Request body must be valid JSON.",
      cause: error,
    });
  }

  const documentId =
    typeof body.documentId === "string"
      ? body.documentId.trim()
      : typeof body.metadataId === "string"
        ? body.metadataId.trim()
        : "";
  if (!documentId) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE,
      status: 400,
      message: "documentId is required.",
    });
  }

  try {
    const result = await enqueueDocumentPipeline({
      documentId,
      sourceType:
        typeof body.sourceType === "string" ? body.sourceType : undefined,
      projectHint:
        typeof body.projectHint === "number" ? body.projectHint : undefined,
    });
    return Response.json(result, { status: 202 });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown workflow start failure.";
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: WHERE,
      status: 503,
      message: `RAG workflow enqueue failed for ${documentId}: ${detail}`,
      cause: error,
    });
  }
});

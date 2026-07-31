import { NextResponse } from "next/server";

import { enqueueDocumentPipeline } from "@/lib/rag-pipeline/enqueue";

export const runtime = "nodejs";

type RequestBody = {
  documentId?: unknown;
  metadataId?: unknown;
  sourceType?: unknown;
  projectHint?: unknown;
};

function isAuthorized(request: Request): boolean {
  const expected = process.env.RAG_PIPELINE_WORKFLOW_SECRET?.trim();
  if (!expected) {
    return false;
  }
  const authorization = request.headers.get("authorization") ?? "";
  return authorization === `Bearer ${expected}`;
}

export async function POST(request: Request) {
  if (!process.env.RAG_PIPELINE_WORKFLOW_SECRET?.trim()) {
    return NextResponse.json(
      { error: "RAG_PIPELINE_WORKFLOW_SECRET is not configured." },
      { status: 503 },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const documentId =
    typeof body.documentId === "string"
      ? body.documentId.trim()
      : typeof body.metadataId === "string"
        ? body.metadataId.trim()
        : "";
  if (!documentId) {
    return NextResponse.json(
      { error: "documentId is required." },
      { status: 400 },
    );
  }

  try {
    const result = await enqueueDocumentPipeline({
      documentId,
      sourceType:
        typeof body.sourceType === "string" ? body.sourceType : undefined,
      projectHint:
        typeof body.projectHint === "number" ? body.projectHint : undefined,
    });
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown workflow start failure.";
    return NextResponse.json(
      { error: `RAG workflow enqueue failed for ${documentId}: ${detail}` },
      { status: 503 },
    );
  }
}

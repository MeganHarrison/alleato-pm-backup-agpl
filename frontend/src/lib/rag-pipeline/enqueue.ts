import { start } from "workflow/api";

import {
  processDocumentWorkflow,
  type ProcessDocumentInput,
} from "./process-document-workflow";

export async function enqueueDocumentPipeline(input: ProcessDocumentInput) {
  if (!input.documentId.trim()) {
    throw new Error("documentId is required to enqueue the RAG workflow.");
  }

  const run = await start(processDocumentWorkflow, [input]);
  return { runId: run.runId, documentId: input.documentId, status: "queued" };
}

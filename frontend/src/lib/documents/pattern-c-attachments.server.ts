import "server-only";

import { triggerDocumentPipeline } from "@/lib/documents/pipeline-trigger";
import {
  registerUploadedPatternCDocumentRecord,
  uploadAndLinkPatternCDocumentRecord,
} from "@/lib/documents/pattern-c-attachments";

export * from "@/lib/documents/pattern-c-attachments";

async function withPipelineEnqueue<
  T extends {
    documentMetadataId: string;
    pipelineQueued: boolean;
    pipelineMessage: string | null;
  },
>(document: T): Promise<T> {
  const pipeline = await triggerDocumentPipeline(document.documentMetadataId);
  return {
    ...document,
    pipelineQueued: pipeline.queued,
    pipelineMessage: pipeline.message,
  };
}

export async function registerUploadedPatternCDocument(
  input: Parameters<typeof registerUploadedPatternCDocumentRecord>[0],
) {
  return withPipelineEnqueue(
    await registerUploadedPatternCDocumentRecord(input),
  );
}

export async function uploadAndLinkPatternCDocument(
  input: Parameters<typeof uploadAndLinkPatternCDocumentRecord>[0],
) {
  return withPipelineEnqueue(await uploadAndLinkPatternCDocumentRecord(input));
}

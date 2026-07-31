const LANGFUSE_TRACE_ID_PATTERN = /^[a-f0-9]{32}$/i;

export type LangfuseTraceMetadata = {
  response_message_id?: unknown;
  langfuse_trace_id?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeLangfuseTraceId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!LANGFUSE_TRACE_ID_PATTERN.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function extractLangfuseTraceIdFromMetadata(
  metadata: unknown,
): string | null {
  if (!isRecord(metadata)) return null;
  return normalizeLangfuseTraceId(metadata.langfuse_trace_id);
}

export function metadataMessageIds(params: {
  id: string;
  metadata?: LangfuseTraceMetadata | null;
}): string[] {
  const ids = new Set<string>([params.id]);
  const responseMessageId = params.metadata?.response_message_id;
  if (typeof responseMessageId === "string" && responseMessageId.trim()) {
    ids.add(responseMessageId);
  }
  return Array.from(ids);
}

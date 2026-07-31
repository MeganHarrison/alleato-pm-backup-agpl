export interface DocumentContentResponse {
  id: string;
  content: string | null;
  contentSource: string | null;
  checkedSources: string[];
  unavailableReason: string | null;
}

export function normalizeDocumentText(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : null;
}

export function joinChunkText(chunks: Array<{ text: string | null; chunk_index?: number | null }>) {
  return normalizeDocumentText(
    [...chunks]
      .sort((a, b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0))
      .map((chunk) => normalizeDocumentText(chunk.text))
      .filter(Boolean)
      .join("\n\n"),
  );
}

export function buildDocumentContentResponse({
  id,
  content,
  contentSource,
  checkedSources,
}: {
  id: string;
  content: string | null | undefined;
  contentSource: string | null;
  checkedSources: string[];
}): DocumentContentResponse {
  const normalizedContent = normalizeDocumentText(content);
  return {
    id,
    content: normalizedContent,
    contentSource: normalizedContent ? contentSource : null,
    checkedSources,
    unavailableReason: normalizedContent
      ? null
      : `No readable content was found after checking ${checkedSources.join(", ")}.`,
  };
}

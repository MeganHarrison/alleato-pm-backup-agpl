import type { RagRow } from "@/lib/ai/retrieval/retrieve-chunks";

export const TRAINING_SOURCE_TYPES = [
  "training_guide",
  "training_resource",
] as const;

export const TRAINING_NOTEBOOK_FALLBACK_URL =
  "https://notebooklm.google.com/notebook/a9a8ea68-d5d1-4cc5-822e-f283feb45817";

export type TrainingLibrarySource = {
  id: string;
  title: string;
  url: string;
  sourceType: (typeof TRAINING_SOURCE_TYPES)[number];
  excerpt: string;
  similarity: number | null;
};

function metadataString(
  metadata: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function normalizeTrainingSources(
  rows: RagRow[],
): TrainingLibrarySource[] {
  const sources = new Map<string, TrainingLibrarySource>();

  for (const row of rows) {
    if (
      row.source_type !== "training_guide" &&
      row.source_type !== "training_resource"
    ) {
      continue;
    }
    const metadata =
      row.doc_metadata &&
      typeof row.doc_metadata === "object" &&
      !Array.isArray(row.doc_metadata)
        ? row.doc_metadata
        : {};
    const id =
      row.document_id ??
      metadataString(metadata, "metadata_id", "document_id", "id");
    const title = row.doc_title ?? metadataString(metadata, "title");
    const url = metadataString(metadata, "source_web_url", "url", "source_url");
    const excerpt = row.chunk_text?.trim();
    if (!id || !title || !url || !excerpt || sources.has(id)) continue;

    sources.set(id, {
      id,
      title,
      url,
      sourceType: row.source_type,
      excerpt,
      similarity: typeof row.similarity === "number" ? row.similarity : null,
    });
  }

  return [...sources.values()];
}

export function buildTrainingContext(sources: TrainingLibrarySource[]): string {
  return sources
    .map((source, index) =>
      [
        `[Source ${index + 1}]`,
        `Title: ${source.title}`,
        `URL: ${source.url}`,
        `Type: ${source.sourceType}`,
        `Content: ${source.excerpt}`,
      ].join("\n"),
    )
    .join("\n\n---\n\n");
}

export function appendTrainingSourceLinks(
  answer: string,
  sources: TrainingLibrarySource[],
): string {
  const links = sources
    .slice(0, 5)
    .map((source, index) => `${index + 1}. [${source.title}](${source.url})`)
    .join("\n");
  return `${answer.trim()}\n\n### Sources\n${links}`;
}

export function trainingLibraryRecoveryMessage(
  reason: "empty" | "unavailable",
) {
  const explanation =
    reason === "empty"
      ? "I couldn’t find indexed Alleato training content that matches that question."
      : "The Alleato training index is temporarily unavailable.";
  return `${explanation} Try a more specific role or workflow, or use the [NotebookLM backup](${TRAINING_NOTEBOOK_FALLBACK_URL}) while the library index is repaired.`;
}

import type { FmdsEvidenceSearchResult } from "./fmds-chat";

export function renderFmdsEvidencePrompt(
  evidence: FmdsEvidenceSearchResult,
): string {
  const chunks = evidence.chunks
    .map(
      (chunk, index) =>
        `[Evidence ${index + 1}] ${chunk.citationLabel}\n` +
        `Source type: ${chunk.sourceType}\n` +
        `Review identity: ${chunk.sourceIdentifier ?? "native PDF text"}\n` +
        `Content: ${chunk.content}`,
    )
    .join("\n\n");
  const tables = evidence.tables
    .map(
      (table) =>
        `${table.identifier}: ${table.title ?? "Untitled table"} ` +
        `(PDF page ${table.pageStart}, ${table.reviewStatus}, ${table.matchSource})`,
    )
    .join("\n");
  const figures = evidence.figures
    .map(
      (figure) =>
        `${figure.identifier}: ${figure.title ?? "Untitled figure"} ` +
        `(PDF page ${figure.pageNumber}, ${figure.reviewStatus}, ${figure.matchSource})`,
    )
    .join("\n");

  return `You are the dedicated ASRS engineering assistant. Answer only from the revision-scoped FMDS evidence below.

Corpus: ${evidence.corpus.documentCode}, ${evidence.corpus.revisionLabel}, ${evidence.corpus.revisionStatus}

Rules:
- Never combine this revision with another FMDS file or revision.
- Cite claims inline using the exact [Evidence N] labels below.
- State the PDF page and identify every relevant table or figure.
- Treat needs_review evidence as Pending Review; do not present it as verified.
- Calculations and applicability decisions must use the deterministic evaluator tool. Never invent a head count or configuration.
- If required design inputs are missing, list them as clear questions.
- If the evidence does not support an answer, say exactly what is missing.

Retrieved evidence:
${chunks}

Relevant tables:
${tables || "None identified"}

Relevant figures:
${figures || "None identified"}`;
}

export function buildFmdsSourceRecords(
  evidence: FmdsEvidenceSearchResult,
  basePath = "/asrs",
) {
  return [
    ...evidence.tables.map((table) => ({
      document_id: table.id,
      snippet:
        table.caption ??
        `PDF page ${table.pageStart}; review status ${table.reviewStatus}.`,
      metadata: {
        type: "fmds_table",
        title: `${table.identifier}: ${table.title ?? "Untitled table"}`,
        url: `${basePath}/tables/${table.id}`,
        page: table.pageStart,
        source_id: table.id,
        review_status: table.reviewStatus,
        match_source: table.matchSource,
        corpus_revision_id: evidence.corpus.revisionId,
      },
    })),
    ...evidence.figures.map((figure) => ({
      document_id: figure.id,
      snippet:
        figure.caption ??
        `PDF page ${figure.pageNumber}; review status ${figure.reviewStatus}.`,
      metadata: {
        type: "fmds_figure",
        title: `${figure.identifier}: ${figure.title ?? "Untitled figure"}`,
        url: `${basePath}/figures/${figure.id}`,
        page: figure.pageNumber,
        source_id: figure.id,
        review_status: figure.reviewStatus,
        match_source: figure.matchSource,
        corpus_revision_id: evidence.corpus.revisionId,
      },
    })),
    ...evidence.chunks.map((chunk) => ({
      document_id: chunk.id,
      snippet: chunk.content,
      metadata: {
        type: `fmds_${chunk.sourceType}`,
        title: chunk.citationLabel,
        page: chunk.pageNumber,
        source_id: chunk.sourceId,
        review_event_id: chunk.reviewEventId,
        corpus_revision_id: evidence.corpus.revisionId,
      },
    })),
  ];
}

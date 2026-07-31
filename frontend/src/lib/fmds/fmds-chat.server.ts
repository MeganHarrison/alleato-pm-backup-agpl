import "server-only";

import { z } from "zod";
import { embed } from "@/lib/ai/services/ai-memory-service";
import {
  fmdsEvidenceSearchRequestSchema,
  type FmdsEvidenceChunk,
  type FmdsEvidenceSearchRequest,
  type FmdsEvidenceSearchResult,
} from "./fmds-chat";
import { getFmdsFiguresPageData } from "./fmds-figures.server";
import { getFmdsTablesPageData } from "./fmds-tables.server";
import { requestAsrsJson } from "./asrs-rest.server";

const OWNER = "FMDS chat evidence";
const EXPECTED_EMBEDDING_DIMENSIONS = 3072;
const MIN_STRUCTURED_MATCHES = 4;
const MAX_OVERSAMPLED_MATCHES = 72;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requiredString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || !value) {
    throw new Error(
      `${OWNER} is unavailable: ASRS response is missing ${key}.`,
    );
  }
  return value;
}

function requiredNumber(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(
      `${OWNER} is unavailable: ASRS response is missing ${key}.`,
    );
  }
  return value;
}

function optionalString(
  row: Record<string, unknown>,
  key: string,
): string | null {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseChunks(value: unknown, revisionId: string): FmdsEvidenceChunk[] {
  if (!Array.isArray(value)) {
    throw new Error(`${OWNER} is unavailable: ASRS returned invalid matches.`);
  }

  return value.map((item) => {
    if (!isRecord(item)) {
      throw new Error(
        `${OWNER} is unavailable: ASRS returned an invalid match.`,
      );
    }
    const matchedRevisionId = requiredString(item, "revision_id");
    if (matchedRevisionId !== revisionId) {
      throw new Error(
        `${OWNER} is unavailable: retrieval mixed corpus revisions.`,
      );
    }
    const sourceType = optionalString(item, "source_type") ?? "native_text";
    if (!["native_text", "table", "figure"].includes(sourceType)) {
      throw new Error(
        `${OWNER} is unavailable: ASRS returned an invalid source type.`,
      );
    }
    const sourceId = optionalString(item, "source_id");
    const sourceIdentifier = optionalString(item, "source_identifier");
    if (sourceType !== "native_text" && (!sourceId || !sourceIdentifier)) {
      throw new Error(
        `${OWNER} is unavailable: structured evidence is missing exact source identity.`,
      );
    }
    return {
      id: requiredString(item, "chunk_id"),
      pageNumber: requiredNumber(item, "page_number"),
      citationLabel: requiredString(item, "citation_label"),
      sectionPath:
        typeof item.section_path === "string" ? item.section_path : null,
      clauseReference:
        typeof item.clause_reference === "string"
          ? item.clause_reference
          : null,
      content: requiredString(item, "content"),
      similarity: requiredNumber(item, "similarity"),
      sourceType: sourceType as "native_text" | "table" | "figure",
      sourceId,
      sourceIdentifier,
      reviewEventId: optionalString(item, "review_event_id"),
      candidateId: optionalString(item, "candidate_id"),
    };
  });
}

/**
 * Keep reviewed structures from being crowded out by overlapping native PDF
 * text while retaining native context. The database union remains similarity
 * ordered; this selector first diversifies exact table/figure sources, then
 * fills the remaining request budget by similarity.
 */
function selectBalancedChunks(
  candidates: FmdsEvidenceChunk[],
  matchCount: number,
): FmdsEvidenceChunk[] {
  const structured = candidates.filter(
    (candidate) => candidate.sourceType !== "native_text",
  );
  const native = candidates.filter(
    (candidate) => candidate.sourceType === "native_text",
  );
  const structuredTarget = Math.min(
    structured.length,
    matchCount === 1
      ? 1
      : Math.min(
          matchCount - 1,
          Math.max(MIN_STRUCTURED_MATCHES, Math.ceil(matchCount / 2)),
        ),
  );
  const selected: FmdsEvidenceChunk[] = [];
  const selectedChunkIds = new Set<string>();
  const selectedSourceIds = new Set<string>();

  for (const candidate of structured) {
    if (selected.length >= structuredTarget) break;
    if (!candidate.sourceId || selectedSourceIds.has(candidate.sourceId))
      continue;
    selected.push(candidate);
    selectedChunkIds.add(candidate.id);
    selectedSourceIds.add(candidate.sourceId);
  }
  for (const candidate of structured) {
    if (selected.length >= structuredTarget) break;
    if (selectedChunkIds.has(candidate.id)) continue;
    selected.push(candidate);
    selectedChunkIds.add(candidate.id);
  }
  for (const candidate of native) {
    if (selected.length >= matchCount) break;
    selected.push(candidate);
    selectedChunkIds.add(candidate.id);
  }
  for (const candidate of candidates) {
    if (selected.length >= matchCount) break;
    if (selectedChunkIds.has(candidate.id)) continue;
    selected.push(candidate);
    selectedChunkIds.add(candidate.id);
  }
  return selected.sort((left, right) => right.similarity - left.similarity);
}

export async function searchFmdsEvidence(
  request: FmdsEvidenceSearchRequest,
  options: { revisionId?: string } = {},
): Promise<FmdsEvidenceSearchResult> {
  const input = fmdsEvidenceSearchRequestSchema.parse(request);
  const requestedRevisionId = options.revisionId
    ? z.string().uuid().parse(options.revisionId)
    : null;
  const revisions = await requestAsrsJson(
    requestedRevisionId
      ? `fmds_corpus_revisions?select=id,document_code,revision_label,status,publication_date&id=eq.${requestedRevisionId}&document_code=eq.FMDS0834&status=in.(staging,active)&limit=1`
      : "fmds_corpus_revisions?select=id,document_code,revision_label,status,publication_date&document_code=eq.FMDS0834&status=in.(staging,active)&order=publication_date.desc,created_at.desc&limit=1",
    OWNER,
  );
  const revision = Array.isArray(revisions) ? revisions[0] : null;
  if (!isRecord(revision)) {
    throw new Error(
      `${OWNER} is unavailable: no staging or active FMDS0834 revision was found.`,
    );
  }

  const revisionId = requiredString(revision, "id");
  const documentCode = requiredString(revision, "document_code");
  const revisionLabel = requiredString(revision, "revision_label");
  const revisionStatus = requiredString(revision, "status");
  if (documentCode !== "FMDS0834") {
    throw new Error(`${OWNER} is unavailable: unexpected document code.`);
  }
  if (requestedRevisionId && revisionId !== requestedRevisionId) {
    throw new Error(
      `${OWNER} is unavailable: the requested corpus revision could not be pinned.`,
    );
  }
  if (revisionStatus !== "staging" && revisionStatus !== "active") {
    throw new Error(
      `${OWNER} is unavailable: revision ${revisionLabel} is ${revisionStatus}.`,
    );
  }

  const embedding = await embed(input.query);
  if (embedding.length !== EXPECTED_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `${OWNER} is unavailable: query embedding returned ${embedding.length} dimensions; expected ${EXPECTED_EMBEDDING_DIMENSIONS}.`,
    );
  }

  const rpc =
    revisionStatus === "active"
      ? "match_active_fmds_chunks"
      : "match_staging_fmds_chunks";
  const rawMatches = await requestAsrsJson(`rpc/${rpc}`, OWNER, {
    method: "POST",
    body: {
      ...(revisionStatus === "staging"
        ? { requested_revision_id: revisionId }
        : {}),
      query_embedding: JSON.stringify(embedding),
      match_count: Math.min(
        MAX_OVERSAMPLED_MATCHES,
        Math.max(48, input.matchCount * 6),
      ),
      match_threshold: 0.2,
    },
  });
  const chunks = selectBalancedChunks(
    parseChunks(rawMatches, revisionId),
    input.matchCount,
  );
  if (chunks.length === 0) {
    throw new Error(
      `${OWNER} is unavailable: revision ${revisionLabel} returned no matching evidence for this question.`,
    );
  }

  const [tableData, figureData] = await Promise.all([
    getFmdsTablesPageData({ revisionId }),
    getFmdsFiguresPageData({ revisionId }),
  ]);
  if (
    tableData.revision.id !== revisionId ||
    figureData.revision.id !== revisionId
  ) {
    throw new Error(
      `${OWNER} is unavailable: table or figure candidates came from a different revision.`,
    );
  }

  const matchedPages = new Set(chunks.map((chunk) => chunk.pageNumber));
  const directTableIds = new Set(
    chunks
      .filter((chunk) => chunk.sourceType === "table" && chunk.sourceId)
      .map((chunk) => chunk.sourceId as string),
  );
  const directFigureIds = new Set(
    chunks
      .filter((chunk) => chunk.sourceType === "figure" && chunk.sourceId)
      .map((chunk) => chunk.sourceId as string),
  );
  const tables = tableData.tables
    .filter((table) => {
      if (directTableIds.has(table.id)) return true;
      for (const page of matchedPages) {
        if (page >= table.page_start && page <= table.page_end) return true;
      }
      return false;
    })
    .sort(
      (left, right) =>
        Number(directTableIds.has(right.id)) -
        Number(directTableIds.has(left.id)),
    )
    .slice(0, 12)
    .map((table) => ({
      id: table.id,
      identifier: table.table_identifier,
      title: table.title,
      pageStart: table.page_start,
      pageEnd: table.page_end,
      caption: table.caption_text,
      reviewStatus: table.review_status,
      reviewReason: table.review_reason,
      matchSource: directTableIds.has(table.id)
        ? ("structured_reviewed" as const)
        : ("page_context" as const),
    }));
  const figures = figureData.figures
    .filter(
      (figure) =>
        directFigureIds.has(figure.id) || matchedPages.has(figure.page_number),
    )
    .sort(
      (left, right) =>
        Number(directFigureIds.has(right.id)) -
        Number(directFigureIds.has(left.id)),
    )
    .slice(0, 12)
    .map((figure) => ({
      id: figure.id,
      identifier: figure.figure_identifier,
      title: figure.title,
      pageNumber: figure.page_number,
      caption: figure.caption_text,
      reviewStatus: figure.review_status,
      reviewReason: figure.review_reason,
      matchSource: directFigureIds.has(figure.id)
        ? ("structured_reviewed" as const)
        : ("page_context" as const),
    }));

  return {
    corpus: {
      documentCode: "FMDS0834",
      revisionId,
      revisionLabel,
      revisionStatus,
    },
    coverage: {
      matchedChunks: chunks.length,
      structuredMatches: chunks.filter(
        (chunk) => chunk.sourceType !== "native_text",
      ).length,
      tables: tables.length,
      figures: figures.length,
    },
    chunks,
    tables,
    figures,
    answerPolicy: {
      calculationAuthority: "reviewed_evaluator_only",
      unreviewedEvidenceStatus: "pending_review",
    },
  };
}

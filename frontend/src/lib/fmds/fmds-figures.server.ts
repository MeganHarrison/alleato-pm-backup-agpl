import "server-only";

import type { FmdsCorpusRevision } from "./fmds-tables";
import {
  type FmdsFigure,
  fmdsFigureSelect,
  selectFmdsFigureReviewCorpus,
} from "./fmds-figures";
import {
  createAsrsSignedStorageUrl,
  requestAsrsJson,
} from "./asrs-rest.server";

export interface FmdsFiguresPageData {
  revision: FmdsCorpusRevision;
  figures: FmdsFigure[];
}
export interface FmdsFigureDetailData {
  revision: FmdsCorpusRevision;
  figure: FmdsFigure & { signed_evidence_url: string | null };
  latestReview: {
    decision: string;
    reviewer_id: string;
    reviewer_role: string;
    notes: string;
    created_at: string;
  } | null;
  latestCandidate: {
    id: string;
    provider: string;
    model: string;
    output: Record<string, unknown>;
    confidence: number | null;
    status: string;
    extraction_error: string | null;
    created_at: string;
  } | null;
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
function requiredString(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  if (typeof value !== "string" || !value)
    throw new Error(
      `FMDS figures are unavailable: ASRS response is missing ${field}.`,
    );
  return value;
}
function parseRevision(value: unknown): FmdsCorpusRevision | null {
  if (value === null) return null;
  if (!isRecord(value))
    throw new Error(
      "FMDS figures are unavailable: ASRS returned an invalid corpus revision.",
    );
  const status = requiredString(value, "status");
  if (!["staging", "active", "superseded", "rejected"].includes(status))
    throw new Error(
      `FMDS figures are unavailable: ASRS returned unsupported revision status ${status}.`,
    );
  if (typeof value.source_page_count !== "number")
    throw new Error(
      "FMDS figures are unavailable: ASRS response is missing source_page_count.",
    );
  return {
    id: requiredString(value, "id"),
    document_code: requiredString(value, "document_code"),
    revision_label: requiredString(value, "revision_label"),
    publication_date: requiredString(value, "publication_date"),
    status: status as FmdsCorpusRevision["status"],
    source_file_name: requiredString(value, "source_file_name"),
    source_storage_path:
      typeof value.source_storage_path === "string"
        ? value.source_storage_path
        : null,
    source_page_count: value.source_page_count,
  };
}
function parseRevisions(value: unknown): FmdsCorpusRevision[] {
  if (!Array.isArray(value)) {
    throw new Error(
      "FMDS figures are unavailable: ASRS returned invalid corpus revisions.",
    );
  }
  return value.flatMap((item) => {
    const revision = parseRevision(item);
    return revision ? [revision] : [];
  });
}
function parseFigures(value: unknown): FmdsFigure[] {
  if (!Array.isArray(value))
    throw new Error(
      "FMDS figures are unavailable: ASRS returned invalid figure data.",
    );
  return value.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.page_number !== "number" ||
      typeof item.review_priority !== "number" ||
      !isRecord(item.extracted_description)
    )
      throw new Error(
        "FMDS figures are unavailable: ASRS returned an invalid figure row.",
      );
    return {
      id: requiredString(item, "id"),
      revision_id: requiredString(item, "revision_id"),
      figure_identifier: requiredString(item, "figure_identifier"),
      title: typeof item.title === "string" ? item.title : null,
      page_number: item.page_number,
      caption_text:
        typeof item.caption_text === "string" ? item.caption_text : null,
      bounding_box: isRecord(item.bounding_box) ? item.bounding_box : null,
      extracted_description: item.extracted_description,
      extraction_method: requiredString(item, "extraction_method"),
      extraction_confidence:
        typeof item.extraction_confidence === "number"
          ? item.extraction_confidence
          : null,
      review_status: requiredString(
        item,
        "review_status",
      ) as FmdsFigure["review_status"],
      review_priority: item.review_priority as FmdsFigure["review_priority"],
      review_reason: requiredString(item, "review_reason"),
      evidence_image_path:
        typeof item.evidence_image_path === "string"
          ? item.evidence_image_path
          : null,
      created_at: requiredString(item, "created_at"),
      updated_at: requiredString(item, "updated_at"),
    };
  });
}
export async function getFmdsFiguresPageData(
  options: { revisionId?: string } = {},
): Promise<FmdsFiguresPageData> {
  const revisionSelect =
    "id,document_code,revision_label,publication_date,status,source_file_name,source_storage_path,source_page_count";
  const revisionFilter = options.revisionId
    ? `&id=eq.${encodeURIComponent(options.revisionId)}`
    : "";
  const revisions = parseRevisions(
    await requestAsrsJson(
      `fmds_corpus_revisions?select=${revisionSelect}&status=in.(staging,active)${revisionFilter}&order=created_at.desc`,
      "FMDS figure review corpora",
    ),
  );
  const candidates = await Promise.all(
    revisions.map(async (revision) => ({
      revision,
      figures: parseFigures(
        await requestAsrsJson(
          `fmds_figures?select=${encodeURIComponent(fmdsFigureSelect)}&revision_id=eq.${encodeURIComponent(revision.id)}&order=page_number.asc,figure_identifier.asc`,
          `FMDS figures for ${revision.document_code} ${revision.revision_label}`,
        ),
      ),
    })),
  );
  const selected = selectFmdsFigureReviewCorpus(candidates);
  if (!selected) {
    throw new Error(
      "FMDS figures are unavailable: the dedicated ASRS project has no staging or active corpus with extracted figures.",
    );
  }
  const { revision, figures } = selected;
  let sourcePdfUrl: string | null = null;
  if (revision.source_storage_path) {
    sourcePdfUrl = await createAsrsSignedStorageUrl(
      revision.source_storage_path,
      "FMDS figure source PDF",
    );
  }
  return {
    revision,
    figures: sourcePdfUrl
      ? figures.map((figure) => ({ ...figure, source_pdf_url: sourcePdfUrl }))
      : figures,
  };
}

export async function getFmdsFigureEvidenceUrl(
  figureId: string,
): Promise<string | null> {
  const response = await requestAsrsJson(
      `fmds_figures?select=id,page_number,evidence_image_path,fmds_corpus_revisions!inner(document_code,revision_label,status,source_storage_path)&id=eq.${encodeURIComponent(figureId)}&fmds_corpus_revisions.status=in.(staging,active)&limit=1`,
    "FMDS figure evidence",
  );
  const row = Array.isArray(response) ? response[0] : null;
  if (!isRecord(row)) return null;

  const revision = row.fmds_corpus_revisions;
  if (
    !isRecord(revision) ||
    typeof revision.document_code !== "string" ||
    typeof revision.revision_label !== "string" ||
    !["staging", "active"].includes(String(revision.status))
  )
    return null;

  const evidencePath =
    typeof row.evidence_image_path === "string" && row.evidence_image_path
      ? row.evidence_image_path
      : typeof revision.source_storage_path === "string" &&
          revision.source_storage_path
        ? revision.source_storage_path
        : null;
  if (!evidencePath) {
    throw new Error(
      "FMDS figure evidence is unavailable: the exact figure has no evidence image or source PDF.",
    );
  }

  const signedUrl = await createAsrsSignedStorageUrl(
    evidencePath,
    "FMDS figure evidence",
  );
  const usingSourcePdf = evidencePath === revision.source_storage_path;
  return usingSourcePdf && typeof row.page_number === "number"
    ? `${signedUrl}#page=${row.page_number}`
    : signedUrl;
}

export async function getFmdsFigureDetailData(
  figureId: string,
): Promise<FmdsFigureDetailData | null> {
  const pageData = await getFmdsFiguresPageData();
  const figure = pageData.figures.find((item) => item.id === figureId);
  if (!figure) return null;

  const [signedEvidenceUrl, reviewRows, candidateRows] = await Promise.all([
    getFmdsFigureEvidenceUrl(figureId),
    requestAsrsJson(
      `fmds_visual_review_events?select=decision,reviewer_id,reviewer_role,notes,created_at&source_type=eq.figure&source_id=eq.${encodeURIComponent(figureId)}&order=created_at.desc&limit=1`,
      "FMDS figure review history",
    ),
    requestAsrsJson(
      `fmds_visual_review_candidates?select=id,provider,model,output,confidence,status,extraction_error,created_at&source_type=eq.figure&source_id=eq.${encodeURIComponent(figureId)}&status=eq.candidate&order=created_at.desc&limit=1`,
      "FMDS figure extraction candidate",
    ),
  ]);

  const review = Array.isArray(reviewRows) ? reviewRows[0] : null;
  const candidate = Array.isArray(candidateRows) ? candidateRows[0] : null;
  return {
    revision: pageData.revision,
    figure: { ...figure, signed_evidence_url: signedEvidenceUrl },
    latestReview: isRecord(review)
      ? {
          decision: requiredString(review, "decision"),
          reviewer_id: requiredString(review, "reviewer_id"),
          reviewer_role: requiredString(review, "reviewer_role"),
          notes: requiredString(review, "notes"),
          created_at: requiredString(review, "created_at"),
        }
      : null,
    latestCandidate:
      isRecord(candidate) && isRecord(candidate.output)
        ? {
            id: requiredString(candidate, "id"),
            provider: requiredString(candidate, "provider"),
            model: requiredString(candidate, "model"),
            output: candidate.output,
            confidence:
              typeof candidate.confidence === "number"
                ? candidate.confidence
                : null,
            status: requiredString(candidate, "status"),
            extraction_error:
              typeof candidate.extraction_error === "string"
                ? candidate.extraction_error
                : null,
            created_at: requiredString(candidate, "created_at"),
          }
        : null,
  };
}

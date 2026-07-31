import type { GenericTableConfig } from "@/components/tables/generic-table-factory";
import type { FmdsCorpusRevision } from "./fmds-tables";

export interface FmdsFigure extends Record<string, unknown> {
  id: string;
  revision_id: string;
  figure_identifier: string;
  title: string | null;
  page_number: number;
  caption_text: string | null;
  bounding_box: Record<string, unknown> | null;
  extracted_description: Record<string, unknown>;
  extraction_method: string;
  extraction_confidence: number | null;
  review_status: "needs_review" | "reviewed" | "rejected";
  review_priority: 1 | 2 | 3;
  review_reason: string;
  evidence_image_path: string | null;
  created_at: string;
  updated_at: string;
  source_pdf_url?: string | null;
}

export const fmdsFigureSelect =
  "id,revision_id,figure_identifier,title,page_number,caption_text,bounding_box,extracted_description,extraction_method,extraction_confidence,review_status,review_priority,review_reason,evidence_image_path,created_at,updated_at";

export interface FmdsFigureReviewCorpusCandidate {
  revision: FmdsCorpusRevision;
  figures: FmdsFigure[];
}

/**
 * Keeps review work revision-scoped without making a newer staging import
 * invisible merely because an older FMDS document still exists. Staging work
 * with pending figures is the queue; a non-empty staging/active corpus is a
 * deliberate fallback for audit history.
 */
export function selectFmdsFigureReviewCorpus(
  candidates: FmdsFigureReviewCorpusCandidate[],
): FmdsFigureReviewCorpusCandidate | null {
  return (
    candidates.find(
      ({ revision, figures }) =>
        revision.status === "staging" &&
        figures.some((figure) => figure.review_status === "needs_review"),
    ) ??
    candidates.find(
      ({ revision, figures }) =>
        revision.status === "staging" && figures.length > 0,
    ) ??
    candidates.find(
      ({ revision, figures }) =>
        revision.status === "active" && figures.length > 0,
    ) ??
    null
  );
}

export const fmdsFiguresConfig: GenericTableConfig = {
  title: "FM Global Figures",
  description:
    "Extracted figures from the selected FM Data Sheet 8-34 revision",
  searchFields: [
    "figure_identifier",
    "title",
    "caption_text",
    "review_reason",
    "extraction_method",
  ],
  exportFilename: "fmds-8-34-figures-export.csv",
  columns: [
    {
      id: "figure_identifier",
      label: "Figure",
      defaultVisible: true,
      type: "text",
      isPrimary: true,
    },
    {
      id: "title",
      label: "Title",
      defaultVisible: true,
      type: "text",
      isSecondary: true,
    },
    {
      id: "page_number",
      label: "Page",
      defaultVisible: true,
      type: "number",
      renderConfig: { type: "pdf-page", urlField: "source_pdf_url" },
    },
    {
      id: "review_status",
      label: "Review",
      defaultVisible: true,
      renderConfig: {
        type: "badge",
        variantMap: {
          needs_review: "outline",
          reviewed: "default",
          rejected: "destructive",
        },
        defaultVariant: "outline",
      },
    },
    {
      id: "review_priority",
      label: "Priority",
      defaultVisible: true,
      type: "number",
    },
    {
      id: "extraction_confidence",
      label: "Confidence",
      defaultVisible: true,
      type: "number",
    },
    {
      id: "caption_text",
      label: "Caption",
      defaultVisible: false,
      type: "text",
    },
    {
      id: "review_reason",
      label: "Review Reason",
      defaultVisible: false,
      type: "text",
    },
    {
      id: "extraction_method",
      label: "Extraction Method",
      defaultVisible: false,
      type: "text",
    },
    {
      id: "evidence_image_path",
      label: "Evidence Image",
      defaultVisible: false,
      type: "text",
    },
    { id: "created_at", label: "Created", defaultVisible: false, type: "date" },
    { id: "updated_at", label: "Updated", defaultVisible: false, type: "date" },
  ],
  filters: [
    {
      id: "review_status",
      label: "Review",
      field: "review_status",
      options: [
        { value: "needs_review", label: "Needs review" },
        { value: "reviewed", label: "Reviewed" },
        { value: "rejected", label: "Rejected" },
      ],
    },
    {
      id: "review_priority",
      label: "Priority",
      field: "review_priority",
      options: [
        { value: "1", label: "1 — high" },
        { value: "2", label: "2 — normal" },
        { value: "3", label: "3 — low" },
      ],
    },
  ],
  enableSorting: true,
  enableViewSwitcher: true,
  defaultSortColumn: "page_number",
  defaultSortDirection: "asc",
};

export function fmdsFiguresDescription(revision: FmdsCorpusRevision): string {
  const state =
    revision.status === "active" ? "active" : `${revision.status} review`;
  return `${revision.document_code} · ${revision.revision_label} · ${state} figure corpus`;
}

import type { GenericTableConfig } from "@/components/tables/generic-table-factory";

export interface FmdsCorpusRevision {
  id: string;
  document_code: string;
  revision_label: string;
  publication_date: string;
  status: "staging" | "active" | "superseded" | "rejected";
  source_file_name: string;
  source_storage_path?: string | null;
  source_page_count: number;
}

export interface FmdsTable extends Record<string, unknown> {
  id: string;
  revision_id: string;
  table_identifier: string;
  title: string | null;
  page_start: number;
  page_end: number;
  caption_text: string | null;
  bounding_box?: Record<string, unknown> | null;
  extracted_structure?: Record<string, unknown> | null;
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

export const fmdsTableSelect =
  "id,revision_id,table_identifier,title,page_start,page_end,caption_text,bounding_box,extracted_structure,extraction_method,extraction_confidence,review_status,review_priority,review_reason,evidence_image_path,created_at,updated_at";

export const fmdsTablesConfig: GenericTableConfig = {
  title: "FM Global Tables",
  description: "Extracted tables from the selected FM Data Sheet 8-34 revision",
  searchFields: [
    "table_identifier",
    "title",
    "caption_text",
    "review_reason",
    "extraction_method",
  ],
  exportFilename: "fmds-8-34-tables-export.csv",
  columns: [
    {
      id: "table_identifier",
      label: "Table",
      defaultVisible: true,
      type: "text",
      isPrimary: true,
      defaultWidth: 92,
    },
    {
      id: "title",
      label: "Title",
      defaultVisible: true,
      type: "text",
      isSecondary: true,
    },
    {
      id: "page_start",
      label: "Page",
      defaultVisible: true,
      type: "number",
      renderConfig: { type: "pdf-page", urlField: "source_pdf_url" },
    },
    {
      id: "page_end",
      label: "End Page",
      defaultVisible: false,
      type: "number",
    },
    {
      id: "review_status",
      label: "Review",
      defaultVisible: true,
      renderConfig: {
        type: "badge",
        variantMap: {
          needs_review: "outline",
          reviewed: "success",
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
    { id: "id", label: "ID", defaultVisible: false, type: "text" },
  ],
  rowClickPath: "/fm-global/fm_global_tables/{id}",
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
  defaultSortColumn: "page_start",
  defaultSortDirection: "asc",
};

export function fmdsTablesDescription(revision: FmdsCorpusRevision): string {
  const state =
    revision.status === "active" ? "active" : `${revision.status} review`;
  return `${revision.document_code} · ${revision.revision_label} · ${state} corpus`;
}

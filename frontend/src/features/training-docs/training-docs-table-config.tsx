"use client";

import {
  CellNumber,
  CellLink,
  CellStatus,
  CellText,
  editableSelectColumn,
  editableTextColumn,
  type ColumnConfig,
  type FilterConfig,
  type TableColumn,
} from "@/components/tables/unified";
import {
  getPublishedTrainingDocUrl,
  TRAINING_DOC_AUDIENCES,
  TRAINING_DOC_QA_STATUSES,
  TRAINING_DOC_STATUSES,
} from "@/lib/training-docs/constants";
import type { TrainingDocWithAssets } from "@/lib/training-docs/types";

export const trainingDocColumns: ColumnConfig[] = [
  { id: "title", label: "Title", alwaysVisible: true },
  { id: "training_page", label: "Training Page", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "audience", label: "Audience", defaultVisible: true },
  { id: "source_route", label: "Source Route", defaultVisible: true },
  { id: "summary", label: "Summary", defaultVisible: true },
  { id: "body_markdown", label: "Article Markdown" },
  { id: "assets", label: "Screenshots", defaultVisible: true },
  { id: "steps", label: "Steps", defaultVisible: true },
  { id: "published", label: "Published", defaultVisible: true },
  { id: "qa", label: "QA", defaultVisible: true },
];

export const trainingDocDefaultVisibleColumns = trainingDocColumns
  .filter((column) => column.defaultVisible || column.alwaysVisible)
  .map((column) => column.id);

export const trainingDocFilters: FilterConfig[] = [
  {
    id: "status",
    label: "Status",
    type: "select",
    options: TRAINING_DOC_STATUSES.map((status) => ({
      value: status,
      label: formatTrainingDocValue(status),
    })),
  },
  {
    id: "audience",
    label: "Audience",
    type: "select",
    options: TRAINING_DOC_AUDIENCES.map((audience) => ({
      value: audience,
      label: formatTrainingDocValue(audience),
    })),
  },
  {
    id: "qa_status",
    label: "QA",
    type: "select",
    options: TRAINING_DOC_QA_STATUSES.map((status) => ({
      value: status,
      label: formatTrainingDocValue(status),
    })),
  },
];

export type TrainingDocEditableField =
  | "summary"
  | "body_markdown"
  | "status"
  | "audience"
  | "source_route";

export function buildTrainingDocTableColumns(
  onInlineEdit: (
    doc: TrainingDocWithAssets,
    field: TrainingDocEditableField,
    value: string,
  ) => Promise<void>,
): TableColumn<TrainingDocWithAssets>[] {
  return [
    {
      ...trainingDocColumns[0],
      render: (doc) => (
        <CellLink
          value={doc.title}
          href={`/training-docs/${doc.id}`}
          className="font-medium"
        />
      ),
      sortable: true,
      sortValue: (doc) => doc.title,
      csvValue: (doc) => doc.title,
    },
    {
      ...trainingDocColumns[1],
      render: (doc) => (
        <CellLink
          value={doc.published_doc_path ? "Open" : null}
          href={getPublishedTrainingDocUrl(doc.published_doc_path)}
          emptyLabel="-"
        />
      ),
      sortable: true,
      sortValue: (doc) => doc.published_doc_path ?? "",
      csvValue: (doc) => getPublishedTrainingDocUrl(doc.published_doc_path) ?? "",
    },
    editableSelectColumn(
      {
        ...trainingDocColumns[2],
        render: (doc) => (
          <CellStatus value={formatTrainingDocValue(doc.status)} />
        ),
        sortable: true,
        sortValue: (doc) => doc.status,
        csvValue: (doc) => doc.status,
      },
      {
        getValue: (doc) => doc.status,
        onEdit: (doc, value) => onInlineEdit(doc, "status", value),
        options: TRAINING_DOC_STATUSES.map((status) => ({
          value: status,
          label: formatTrainingDocValue(status),
        })),
      },
    ),
    editableSelectColumn(
      {
        ...trainingDocColumns[3],
        render: (doc) => (
          <CellText value={formatTrainingDocValue(doc.audience)} />
        ),
        sortable: true,
        sortValue: (doc) => doc.audience,
        csvValue: (doc) => doc.audience,
      },
      {
        getValue: (doc) => doc.audience,
        onEdit: (doc, value) => onInlineEdit(doc, "audience", value),
        options: TRAINING_DOC_AUDIENCES.map((audience) => ({
          value: audience,
          label: formatTrainingDocValue(audience),
        })),
      },
    ),
    editableTextColumn(
      {
        ...trainingDocColumns[4],
        render: (doc) => <CellText value={doc.source_route} emptyLabel="-" />,
        sortable: true,
        sortValue: (doc) => doc.source_route ?? "",
        csvValue: (doc) => doc.source_route ?? "",
      },
      {
        getValue: (doc) => doc.source_route,
        onEdit: (doc, value) => onInlineEdit(doc, "source_route", value),
        emptyLabel: "Add route",
      },
    ),
    editableTextColumn(
      {
        ...trainingDocColumns[5],
        render: (doc) => (
          <CellText value={doc.summary} emptyLabel="-" className="max-w-md" />
        ),
        sortable: true,
        sortValue: (doc) => doc.summary ?? "",
        csvValue: (doc) => doc.summary ?? "",
      },
      {
        getValue: (doc) => doc.summary,
        onEdit: (doc, value) => onInlineEdit(doc, "summary", value),
        emptyLabel: "Add summary",
      },
    ),
    editableTextColumn(
      {
        ...trainingDocColumns[6],
        render: (doc) => (
          <CellText
            value={doc.body_markdown}
            emptyLabel="-"
            className="max-w-lg"
          />
        ),
        sortable: true,
        sortValue: (doc) => doc.body_markdown,
        csvValue: (doc) => doc.body_markdown,
      },
      {
        getValue: (doc) => doc.body_markdown,
        onEdit: (doc, value) => onInlineEdit(doc, "body_markdown", value),
        emptyLabel: "Add markdown",
      },
    ),
    {
      ...trainingDocColumns[7],
      render: (doc) => <CellNumber value={doc.assets.length} />,
      sortable: true,
      sortValue: (doc) => doc.assets.length,
      csvValue: (doc) => String(doc.assets.length),
      align: "right",
    },
    {
      ...trainingDocColumns[8],
      render: (doc) => <CellNumber value={doc.steps.length} />,
      sortable: true,
      sortValue: (doc) => doc.steps.length,
      csvValue: (doc) => String(doc.steps.length),
      align: "right",
    },
    {
      ...trainingDocColumns[9],
      render: (doc) => (
        <CellText value={formatDate(doc.last_published_at)} emptyLabel="-" />
      ),
      sortable: true,
      sortValue: (doc) => doc.last_published_at ?? "",
      csvValue: (doc) => doc.last_published_at ?? "",
    },
    {
      ...trainingDocColumns[10],
      render: (doc) => (
        <span title={doc.qa_notes ?? undefined}>
          <CellStatus value={formatTrainingDocValue(doc.qa_status)} />
        </span>
      ),
      sortable: true,
      sortValue: (doc) => doc.qa_status,
      csvValue: (doc) => doc.qa_status,
    },
  ];
}

export function formatTrainingDocValue(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

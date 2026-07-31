import { createElement } from "react";

import type { FilterConfig, TableColumn } from "@/components/tables/unified";
import type { SchemaExplorerTable } from "./schema-explorer.types";
import { SchemaExplorerDescriptionCell } from "./schema-explorer-description-cell";
import {
  SchemaExplorerOwnerCell,
  SchemaExplorerReviewCell,
} from "./schema-explorer-stewardship-cells";

export const dbInventoryDefaultVisibleColumns = [
  "name",
  "database",
  "owner",
  "description",
  "lastReviewed",
  "primaryKey",
  "foreignKeys",
  "columns",
  "codeReferences",
];

export const dbInventoryFilters: FilterConfig[] = [
  {
    id: "database",
    label: "Database",
    type: "select",
    options: [
      { value: "PM_APP", label: "PM App" },
      { value: "RAG", label: "AI / RAG" },
    ],
  },
  {
    id: "ownership",
    label: "Owner",
    type: "select",
    options: [
      { value: "assigned", label: "Assigned" },
      { value: "unassigned", label: "Unassigned" },
    ],
  },
  {
    id: "review",
    label: "Review",
    type: "select",
    options: [
      { value: "current", label: "Current (90 days)" },
      { value: "needs-review", label: "Needs review" },
    ],
  },
];

export function buildDbInventoryTableColumns({
  onDescriptionSave,
  onDescriptionEditingChange,
  onOwnerSave,
  onOwnerEditingChange,
  onReview,
}: {
  onDescriptionSave: (
    table: SchemaExplorerTable,
    description: string,
  ) => Promise<string>;
  onDescriptionEditingChange: (
    table: SchemaExplorerTable,
    isEditing: boolean,
  ) => void;
  onOwnerSave: (table: SchemaExplorerTable, ownerName: string) => Promise<void>;
  onOwnerEditingChange: (
    table: SchemaExplorerTable,
    isEditing: boolean,
  ) => void;
  onReview: (table: SchemaExplorerTable) => Promise<void>;
}): TableColumn<SchemaExplorerTable>[] {
  return [
    {
      id: "name",
      label: "Table",
      alwaysVisible: true,
      sortable: true,
      sortValue: (item) => item.name,
      csvValue: (item) => item.name,
      render: (item) => item.name,
    },
    {
      id: "database",
      label: "Database",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.database,
      csvValue: (item) => item.database,
      render: (item) => (item.database === "PM_APP" ? "PM App" : "AI / RAG"),
    },
    {
      id: "owner",
      label: "Owner",
      defaultVisible: true,
      sortable: true,
      width: 180,
      sortValue: (item) => item.ownerName ?? "",
      csvValue: (item) => item.ownerName ?? "Unassigned",
      render: (item) =>
        createElement(SchemaExplorerOwnerCell, {
          ownerName: item.ownerName,
          tableName: item.name,
          onSave: (ownerName) => onOwnerSave(item, ownerName),
          onEditingChange: (isEditing) => onOwnerEditingChange(item, isEditing),
        }),
    },
    {
      id: "description",
      label: "Description",
      defaultVisible: true,
      sortable: true,
      width: 420,
      sortValue: (item) => item.description,
      csvValue: (item) => item.description,
      render: (item) =>
        createElement(SchemaExplorerDescriptionCell, {
          description: item.description,
          tableName: item.name,
          onSave: (description) => onDescriptionSave(item, description),
          onEditingChange: (isEditing) =>
            onDescriptionEditingChange(item, isEditing),
        }),
    },
    {
      id: "lastReviewed",
      label: "Reviewed",
      defaultVisible: true,
      sortable: true,
      width: 150,
      sortValue: (item) => item.lastReviewedAt,
      csvValue: (item) => item.lastReviewedAt ?? "Not reviewed",
      render: (item) =>
        createElement(SchemaExplorerReviewCell, {
          lastReviewedAt: item.lastReviewedAt,
          tableName: item.name,
          onReview: () => onReview(item),
        }),
    },
    {
      id: "primaryKey",
      label: "Primary key",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.primaryKeyColumns.join(","),
      csvValue: (item) => item.primaryKeyColumns.join(", "),
      render: (item) => item.primaryKeyColumns.join(", ") || "—",
    },
    {
      id: "foreignKeys",
      label: "Relations",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.foreignKeys.length,
      csvValue: (item) => String(item.foreignKeys.length),
      render: (item) => item.foreignKeys.length,
    },
    {
      id: "columns",
      label: "Columns",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.columns.length,
      csvValue: (item) => String(item.columns.length),
      render: (item) => item.columns.length,
    },
    {
      id: "codeReferences",
      label: "Code refs",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) =>
        item.references.reads.length + item.references.writes.length,
      csvValue: (item) =>
        String(item.references.reads.length + item.references.writes.length),
      render: (item) =>
        item.references.reads.length + item.references.writes.length,
    },
  ];
}

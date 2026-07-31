import * as React from "react";
import { MoreVertical, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ds";
import type { ColumnConfig, FilterConfig, TableColumn } from "@/components/tables/unified";
import type { KnowledgeDocument } from "@/hooks/use-knowledge-documents";

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

export const knowledgeColumns: ColumnConfig[] = [
  { id: "title", label: "Title", alwaysVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "tags", label: "Tags", defaultVisible: true },
  { id: "file_name", label: "File", defaultVisible: true },
  { id: "date", label: "Date", defaultVisible: true },
  { id: "created_at", label: "Created", defaultVisible: false },
];

export const knowledgeDefaultVisibleColumns = knowledgeColumns
  .filter((c) => c.alwaysVisible || c.defaultVisible)
  .map((c) => c.id);

// ---------------------------------------------------------------------------
// Filter definitions
// ---------------------------------------------------------------------------

export const knowledgeFilters: FilterConfig[] = [
  {
    id: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "uploaded", label: "Uploaded" },
      { value: "extracted", label: "Extracted" },
      { value: "embedded", label: "Embedded" },
      { value: "complete", label: "Complete" },
      { value: "failed", label: "Failed" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Table column builders
// ---------------------------------------------------------------------------

export function buildKnowledgeTableColumns(options: {
  onDelete: (item: KnowledgeDocument) => void;
}): TableColumn<KnowledgeDocument>[] {
  return [
    {
      id: "title",
      label: "Title",
      alwaysVisible: true,
      sortable: true,
      sortValue: (item) => item.title ?? item.file_name ?? "",
      render: (item) => (
        <span className="block max-w-72 truncate font-medium text-foreground">
          {item.title ?? item.file_name ?? "Untitled"}
        </span>
      ),
      csvValue: (item) => item.title ?? item.file_name ?? "",
    },
    {
      id: "status",
      label: "Status",
      defaultVisible: true,
      sortable: true,
      // Ingestion status is system-derived, not user-editable.
      editable: false,
      sortValue: (item) => item.status ?? "uploaded",
      render: (item) => (
        <StatusBadge status={item.status ?? "uploaded"} />
      ),
      csvValue: (item) => item.status ?? "uploaded",
    },
    {
      id: "tags",
      label: "Tags",
      defaultVisible: true,
      render: (item) => {
        const tagList = item.tags ?? [];
        if (tagList.length === 0) return null;
        return (
          <div className="flex max-w-48 flex-wrap gap-1">
            {tagList.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs font-normal">
                {tag}
              </Badge>
            ))}
            {tagList.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{tagList.length - 3}
              </span>
            )}
          </div>
        );
      },
      csvValue: (item) => item.tags?.join(", ") ?? "",
    },
    {
      id: "file_name",
      label: "File",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.file_name ?? "",
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.file_name ?? "—"}
        </span>
      ),
      csvValue: (item) => item.file_name ?? "",
    },
    {
      id: "date",
      label: "Date",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.date ?? item.created_at ?? "",
      render: (item) => {
        const dateStr = item.date ?? item.created_at;
        if (!dateStr) return <span className="text-sm text-muted-foreground">—</span>;
        return (
          <span className="text-sm text-muted-foreground">
            {new Date(dateStr).toLocaleDateString()}
          </span>
        );
      },
      csvValue: (item) => {
        const dateStr = item.date ?? item.created_at;
        return dateStr ? new Date(dateStr).toLocaleDateString() : "";
      },
    },
    {
      id: "created_at",
      label: "Created",
      defaultVisible: false,
      sortable: true,
      sortValue: (item) => item.created_at ?? "",
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}
        </span>
      ),
      csvValue: (item) =>
        item.created_at ? new Date(item.created_at).toLocaleDateString() : "",
    },
    {
      id: "actions",
      label: "",
      defaultVisible: true,
      render: (item) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => options.onDelete(item)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
}

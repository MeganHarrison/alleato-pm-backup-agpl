"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight, FolderOpen, Lock } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { StatusBadge } from "@/components/ds";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
  type TableColumn,
} from "@/components/tables/unified";
import { Button } from "@/components/ui/button";
import {
  buildDocumentTableColumns,
  projectDocumentColumns,
  projectDocumentDefaultVisibleColumns,
  projectDocumentFilters,
} from "@/features/documents/project-documents-table-config";
import {
  useGlobalDocuments,
  type GlobalProjectDocument,
  type ProjectDocument,
} from "@/hooks/use-documents";
import { documentTypeLabel } from "@/features/documents/document-types";
import { formatDate } from "@/lib/format";

type FilterState = Record<string, FilterValue>;

const EMPTY_FILTERS: FilterState = {
  document_type: undefined,
  status: undefined,
  folder: undefined,
  category: undefined,
};

function sortValueForDate(value: string | null | undefined): number {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "-";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function buildGlobalColumns(): TableColumn<GlobalProjectDocument>[] {
  const baseColumns = buildDocumentTableColumns() as TableColumn<GlobalProjectDocument>[];
  const projectColumn: TableColumn<GlobalProjectDocument> = {
    id: "project_name",
    label: "Project",
    defaultVisible: true,
    render: (item) => (
      <Link
        href={`/${item.project_id}/documents`}
        className="text-primary underline decoration-primary/40 underline-offset-4"
        onClick={(event) => event.stopPropagation()}
      >
        {item.project_number ? `${item.project_number} · ` : ""}
        {item.project_name ?? `Project #${item.project_id}`}
      </Link>
    ),
    csvValue: (item) =>
      [item.project_number, item.project_name ?? `Project #${item.project_id}`]
        .filter(Boolean)
        .join(" · "),
    sortValue: (item) =>
      `${item.project_number ?? ""} ${item.project_name ?? `Project #${item.project_id}`}`,
    sortable: true,
  };

  return [projectColumn, ...baseColumns];
}

function renderGlobalCard(
  item: GlobalProjectDocument,
  onClick: (doc: GlobalProjectDocument) => void,
) {
  return (
    <div
      className="cursor-pointer rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
      onClick={() => onClick(item)}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[item.project_number, item.project_name ?? `Project #${item.project_id}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <StatusBadge status={item.status} />
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <FolderOpen className="h-3 w-3" />
          {item.folder ?? "Root"}
        </span>
        <span>{formatFileSize(item.file_size)}</span>
        <span>{formatDate(item.created_at)}</span>
      </div>
    </div>
  );
}

function renderGlobalList(
  item: GlobalProjectDocument,
  onClick: (doc: GlobalProjectDocument) => void,
) {
  return (
    <div
      className="flex cursor-pointer items-center justify-between px-4 py-2.5 transition-colors hover:bg-muted/50"
      onClick={() => onClick(item)}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[
            item.project_number,
            item.project_name ?? `Project #${item.project_id}`,
            item.file_name,
            item.folder ?? "Root",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="ml-3 flex shrink-0 items-center gap-2">
        {item.is_private && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
        <StatusBadge status={item.status} />
      </div>
    </div>
  );
}

export default function GlobalProjectDocumentsPage() {
  const router = useRouter();
  const pathname = usePathname()!;
  const searchParams = useSearchParams()!;

  const { data: documents = [], isLoading } = useGlobalDocuments();

  const tableState = useUnifiedTableState({
    entityKey: "global-project-documents",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table", "card", "list"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "created_at",
      sortDirection: "desc",
      visibleColumns: ["project_name", ...projectDocumentDefaultVisibleColumns],
      filters: EMPTY_FILTERS,
    },
  });

  const activeFilters = tableState.activeFilters as FilterState;

  const filteredDocuments = React.useMemo(() => {
    const searchTerm = tableState.debouncedSearch.trim().toLowerCase();

    return documents.filter((doc) => {
      if (
        activeFilters.document_type &&
        doc.document_type !== activeFilters.document_type
      )
        return false;
      if (activeFilters.status && doc.status !== activeFilters.status) return false;
      if (activeFilters.folder && doc.folder !== activeFilters.folder) return false;
      if (activeFilters.category && doc.category !== activeFilters.category) return false;

      if (!searchTerm) return true;

      const fields = [
        doc.title,
        doc.file_name,
        doc.folder ?? "",
        documentTypeLabel(doc.document_type),
        doc.category ?? "",
        doc.description ?? "",
        doc.uploaded_by ?? "",
        doc.project_name ?? "",
        doc.project_number ?? "",
      ];

      return fields.some((field) => field.toLowerCase().includes(searchTerm));
    });
  }, [documents, activeFilters, tableState.debouncedSearch]);

  const tableColumns = React.useMemo(() => buildGlobalColumns(), []);

  const sortedDocuments = React.useMemo(() => {
    if (!tableState.sortBy) return filteredDocuments;
    const sortColumn = tableColumns.find((col) => col.id === tableState.sortBy);
    const getSortValue = sortColumn?.sortValue;
    if (!getSortValue) return filteredDocuments;

    return [...filteredDocuments].sort((a, b) => {
      const valueA = getSortValue(a);
      const valueB = getSortValue(b);

      if (valueA == null && valueB == null) return 0;
      if (valueA == null) return tableState.sortDirection === "asc" ? -1 : 1;
      if (valueB == null) return tableState.sortDirection === "asc" ? 1 : -1;

      if (typeof valueA === "number" && typeof valueB === "number") {
        return tableState.sortDirection === "asc" ? valueA - valueB : valueB - valueA;
      }

      const comparison = String(valueA).localeCompare(String(valueB));
      return tableState.sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredDocuments, tableColumns, tableState.sortBy, tableState.sortDirection]);

  const totalItems = documents.length;
  const filteredItems = filteredDocuments.length;
  const isFiltered =
    tableState.debouncedSearch.trim().length > 0 ||
    Object.values(activeFilters).some((v) => v !== undefined);

  const handleFilterChange = (filters: FilterState) => {
    tableState.setActiveFilters(filters);
    tableState.setPage(1);
  };

  const handleOpen = (item: GlobalProjectDocument) => {
    if (!item.storage_path && !item.file_url) {
      toast.error("This document does not have a file attached");
      return;
    }

    window.open(
      `/api/projects/${item.project_id}/documents/${item.id}/download`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleExport = () => {
    const headers = ["Project", "Title", "File Name", "Folder", "Type", "Status", "Category", "Created"];
    const rows = sortedDocuments.map((d) => [
      [d.project_number, d.project_name ?? `Project #${d.project_id}`].filter(Boolean).join(" · "),
      d.title,
      d.file_name,
      d.folder ?? "Root",
      documentTypeLabel(d.document_type),
      d.status,
      d.category ?? "",
      d.created_at ? format(new Date(d.created_at), "yyyy-MM-dd") : "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project-documents-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <UnifiedTablePage
      header={{
        title: "All Project Documents",
        description: "Documents synced or uploaded across all projects.",
      }}
      toolbar={{
        totalItems,
        filteredItems,
        selectedCount: 0,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search project documents...",
        currentView: tableState.currentView,
        onViewChange: (view) => {
          tableState.setCurrentView(view);
          tableState.setSearchParams({ view });
        },
        enabledViews: ["table", "card", "list"],
        filters: projectDocumentFilters,
        activeFilters,
        onFilterChange: handleFilterChange,
        onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
        columns: [{ id: "project_name", label: "Project", defaultVisible: true }, ...projectDocumentColumns],
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
        onExport: handleExport,
      }}
      data={{
        items: sortedDocuments,
        isLoading,
        isFetching: false,
      }}
      table={{
        columns: tableColumns,
        getRowId: (item) => String(item.id),
        onRowClick: handleOpen,
      }}
      sorting={{
        sortBy: tableState.sortBy,
        sortDirection: tableState.sortDirection,
        onSortChange: (sortBy, direction) => {
          tableState.setSortBy(sortBy);
          tableState.setSortDirection(direction);
          tableState.setSearchParams({
            sort: sortBy,
            sort_dir: direction,
          });
        },
      }}
      views={{
        card: (item) => renderGlobalCard(item, handleOpen),
        list: (item) => renderGlobalList(item, handleOpen),
      }}
      emptyState={{
        title: "No project documents found",
        description: "Synced and uploaded project documents will appear here.",
        filteredDescription: "Try adjusting your search or filters.",
        isFiltered,
        action: (
          <Button asChild size="sm" variant="outline">
            <Link href="/documents">
              Open Pipeline Documents
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        ),
      }}
      features={{
        enableInlineEditing: false,
      }}
    />
  );
}

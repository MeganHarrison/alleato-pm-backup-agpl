"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  EmbeddedUnifiedTablePage,
  type ColumnConfig,
  type TableColumn,
  useUnifiedTableState,
} from "@/components/tables/unified";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { appToast as toast } from "@/lib/toast/app-toast";
import {
  BRAIN_RESOURCE_LABELS,
  getBrainPageSearchParams,
  getBrainPerPageSearchParams,
  getSafeBrainSourceHref,
  getBrainSortSearchParams,
  type BrainResourcePage,
  type BrainResourceRow,
  type BrainResourceTab,
  type BusinessArea,
} from "./brain-contract";

const COLUMNS: ColumnConfig[] = [
  { id: "title", label: "Title", alwaysVisible: true },
  { id: "detail", label: "Details", defaultVisible: false },
  { id: "source", label: "Source", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "date", label: "Date", defaultVisible: true },
  { id: "owner", label: "Assignee", defaultVisible: true },
];

const DEFAULT_VISIBLE_COLUMNS = COLUMNS.filter(
  (column) => column.alwaysVisible || column.defaultVisible,
).map((column) => column.id);

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

async function openResource(row: BrainResourceRow): Promise<void> {
  try {
    const sourceHref = getSafeBrainSourceHref(row.href);
    if (sourceHref) {
      window.open(sourceHref, "_blank", "noopener,noreferrer");
      return;
    }
    if (row.signedDocumentId) {
      const response = await apiFetch<{ url?: string }>(
        `/api/knowledge/signed-url?id=${encodeURIComponent(row.signedDocumentId)}`,
      );
      if (!response.url) {
        throw new Error("The source service returned no document URL.");
      }
      window.open(response.url, "_blank", "noopener,noreferrer");
      return;
    }
    throw new Error("No source link is stored for this record.");
  } catch (error) {
    toast.error("Source could not be opened", {
      description:
        error instanceof Error
          ? error.message
          : "The source link is unavailable. Ask an administrator to verify the record.",
    });
  }
}

function buildColumns(tab: BrainResourceTab): TableColumn<BrainResourceRow>[] {
  const supportsSourceSort = tab === "knowledge" || tab === "files";
  const supportsOwnerSort = tab === "tasks";

  return [
    {
      ...COLUMNS[0],
      sortable: true,
      render: (row) => (
        <Button
          type="button"
          variant="link"
          className="h-auto max-w-80 justify-start truncate p-0 text-left font-medium text-foreground"
          onClick={() => void openResource(row)}
        >
          {row.title}
        </Button>
      ),
      csvValue: (row) => row.title,
    },
    {
      ...COLUMNS[1],
      render: (row) => (
        <span className="block max-w-md line-clamp-2 text-sm text-muted-foreground">
          {row.detail ?? "—"}
        </span>
      ),
      csvValue: (row) => row.detail ?? "",
    },
    {
      ...COLUMNS[2],
      sortable: supportsSourceSort,
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.source ?? "—"}
        </span>
      ),
      csvValue: (row) => row.source ?? "",
    },
    {
      ...COLUMNS[3],
      sortable: true,
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.status ?? "—"}
        </span>
      ),
      csvValue: (row) => row.status ?? "",
    },
    {
      ...COLUMNS[4],
      sortable: true,
      render: (row) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {formatDate(row.date)}
        </span>
      ),
      csvValue: (row) => formatDate(row.date),
    },
    {
      ...COLUMNS[5],
      sortable: supportsOwnerSort,
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.owner ?? "—"}
        </span>
      ),
      csvValue: (row) => row.owner ?? "",
    },
  ];
}

export function BrainResourceTable({
  pathname,
  area,
  resource,
  tab,
}: {
  pathname: string;
  area: BusinessArea;
  resource: BrainResourcePage;
  tab: BrainResourceTab;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const columns = React.useMemo(() => buildColumns(tab), [tab]);
  const tableState = useUnifiedTableState({
    entityKey: `brain-${area.id}-${tab}`,
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: resource.page,
      perPage: resource.perPage,
      search: resource.search,
      sortBy: resource.sortBy,
      sortDirection: resource.sortDirection,
      visibleColumns: DEFAULT_VISIBLE_COLUMNS,
      filters: {},
    },
  });

  const title = BRAIN_RESOURCE_LABELS[tab];

  return (
    <EmbeddedUnifiedTablePage<BrainResourceRow>
      title={`${area.name} ${title}`}
      description={`${title} assigned to ${area.name}.`}
      toolbar={{
        totalItems: resource.total,
        filteredItems: resource.total,
        selectedCount: 0,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: `Search ${title.toLowerCase()}…`,
        currentView: "table",
        onViewChange: () => undefined,
        enabledViews: ["table"],
        columns: COLUMNS,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
        savedViewsScope: `brain-${tab}`,
      }}
      data={{ items: resource.rows, isLoading: false }}
      table={{ columns, getRowId: (row) => row.id }}
      sorting={{
        sortBy: tableState.sortBy,
        sortDirection: tableState.sortDirection,
        onSortChange: (sortBy, direction) => {
          tableState.setSortBy(sortBy);
          tableState.setSortDirection(direction);
          tableState.setSearchParams(
            getBrainSortSearchParams(sortBy, direction),
          );
          tableState.setPage(1);
        },
      }}
      pagination={{
        page: resource.page,
        totalPages: resource.totalPages,
        perPage: resource.perPage,
        onPageChange: (nextPage) => {
          tableState.setPage(nextPage);
          tableState.setSearchParams(getBrainPageSearchParams(nextPage));
        },
        onPerPageChange: (value) => {
          const nextPerPage = Number(value);
          if (!Number.isFinite(nextPerPage) || nextPerPage <= 0) return;
          tableState.setPerPage(nextPerPage);
          tableState.setPage(1);
          tableState.setSearchParams(getBrainPerPageSearchParams(nextPerPage));
        },
        clientSide: false,
      }}
      emptyState={{
        title: `No ${title.toLowerCase()} assigned`,
        description: `${area.name} has no ${title.toLowerCase()} records yet.`,
        filteredDescription: `No ${title.toLowerCase()} match this search.`,
        isFiltered: Boolean(resource.search),
      }}
      features={{
        enableSearch: true,
        enableFilters: false,
        enableColumnToggle: true,
        enableExport: true,
        enableViews: false,
        enableRowSelection: false,
      }}
      layout={{ minWidth: 760 }}
      reportContext={{
        extra: { "Business Area": area.name, Resource: title },
      }}
    />
  );
}

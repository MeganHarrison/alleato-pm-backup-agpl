"use client";

import * as React from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
  type TableColumn,
} from "@/components/tables/unified";
import { KpiRow } from "@/components/ds";
import { StatusBadge } from "@/components/ds";
import { useProjectPCOs } from "@/hooks/use-pcos";
import type { PCO } from "@/hooks/use-pcos";
import { formatCurrency } from "@/lib/utils";

// =============================================================================
// Labels
// =============================================================================

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  REVISION_REQUESTED: "Revision Requested",
  VOID: "Void",
};

const TYPE_LABELS: Record<string, string> = {
  CLIENT_REQUESTED: "Client Requested",
  INTERNAL: "Internal",
  MIXED: "Mixed",
};

// =============================================================================
// Column Config
// =============================================================================

const pcoDefaultVisibleColumns = [
  "number",
  "title",
  "type",
  "status",
  "estimated_value",
  "schedule_impact_days",
  "current_version",
  "created_at",
];

function buildPCOTableColumns(projectId: string): TableColumn<PCO>[] {
  return [
    {
      id: "number",
      label: "PCO #",
      sortable: true,
      sortValue: (item) => item.number,
      render: (item) => (
        <span className="font-medium tabular-nums text-foreground">
          {item.number}
        </span>
      ),
      width: 90,
    },
    {
      id: "title",
      label: "Title",
      sortable: true,
      sortValue: (item) => item.title,
      render: (item) => (
        <span className="text-foreground">{item.title}</span>
      ),
      width: 240,
    },
    {
      id: "type",
      label: "Type",
      sortable: true,
      sortValue: (item) => item.type,
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {TYPE_LABELS[item.type] ?? item.type}
        </span>
      ),
      width: 130,
    },
    {
      id: "status",
      label: "Status",
      sortable: true,
      sortValue: (item) => item.status,
      render: (item) => (
        <StatusBadge status={STATUS_LABELS[item.status] ?? item.status} />
      ),
      width: 150,
    },
    {
      id: "estimated_value",
      label: "Est. Value",
      sortable: true,
      sortValue: (item) => item.estimated_value ?? 0,
      render: (item) => (
        <span className="tabular-nums text-foreground text-right block">
          {formatCurrency(item.estimated_value ?? 0)}
        </span>
      ),
      width: 120,
    },
    {
      id: "schedule_impact_days",
      label: "Schedule Impact",
      sortable: true,
      sortValue: (item) => item.schedule_impact_days ?? 0,
      render: (item) => (
        <span className="tabular-nums text-foreground text-right block">
          {item.schedule_impact_days != null
            ? `${item.schedule_impact_days} day${item.schedule_impact_days === 1 ? "" : "s"}`
            : "--"}
        </span>
      ),
      width: 120,
    },
    {
      id: "current_version",
      label: "Version",
      sortable: true,
      sortValue: (item) => item.current_version,
      render: (item) => (
        <span className="tabular-nums text-muted-foreground text-center block">
          v{item.current_version}
        </span>
      ),
      width: 80,
    },
    {
      id: "created_at",
      label: "Created",
      sortable: true,
      sortValue: (item) => item.created_at,
      render: (item) => (
        <span className="text-muted-foreground">
          {new Date(item.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
      ),
      width: 100,
    },
  ];
}

function formatCardDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function renderPCOCard(
  item: PCO,
  onClick: (item: PCO) => void,
): React.ReactElement {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => onClick(item)}
      className="h-auto w-full flex-col items-stretch gap-0 whitespace-normal rounded-lg border p-4 text-left hover:bg-muted/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {item.number}
          </p>
          {/* eslint-disable-next-line design-system/no-raw-heading */}
          <h3 className="mt-0.5 line-clamp-2 font-medium text-foreground">
            {item.title || "Untitled"}
          </h3>
        </div>
        <StatusBadge status={STATUS_LABELS[item.status] ?? item.status} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <div>
          <dt className="text-xs text-muted-foreground">Est. Value</dt>
          <dd className="tabular-nums font-medium text-foreground">
            {formatCurrency(item.estimated_value ?? 0)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Type</dt>
          <dd className="text-sm text-foreground">
            {TYPE_LABELS[item.type] ?? item.type}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Schedule Impact</dt>
          <dd className="tabular-nums text-sm text-foreground">
            {item.schedule_impact_days != null
              ? `${item.schedule_impact_days} day${item.schedule_impact_days === 1 ? "" : "s"}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Created</dt>
          <dd className="text-sm text-foreground">
            {formatCardDate(item.created_at)}
            <span className="text-muted-foreground"> · v{item.current_version}</span>
          </dd>
        </div>
      </dl>
    </Button>
  );
}

const pcoFilters = [
  {
    id: "status",
    label: "Status",
    type: "select" as const,
    options: [
      { label: "Draft", value: "DRAFT" },
      { label: "Submitted", value: "SUBMITTED" },
      { label: "Under Review", value: "UNDER_REVIEW" },
      { label: "Approved", value: "APPROVED" },
      { label: "Revision Requested", value: "REVISION_REQUESTED" },
      { label: "Void", value: "VOID" },
    ],
  },
  {
    id: "type",
    label: "Type",
    type: "select" as const,
    options: [
      { label: "Client Requested", value: "CLIENT_REQUESTED" },
      { label: "Internal", value: "INTERNAL" },
      { label: "Mixed", value: "MIXED" },
    ],
  },
];

const pcoColumnConfigs = [
  { id: "number", label: "PCO #" },
  { id: "title", label: "Title" },
  { id: "type", label: "Type" },
  { id: "status", label: "Status" },
  { id: "estimated_value", label: "Est. Value" },
  { id: "schedule_impact_days", label: "Schedule Impact" },
  { id: "current_version", label: "Version" },
  { id: "created_at", label: "Created" },
];

const EMPTY_FILTERS: Record<string, FilterValue> = {
  status: undefined,
  type: undefined,
};

type FilterState = Record<string, FilterValue>;

// =============================================================================
// Page Component
// =============================================================================

export default function PCOListPage() {
  const params = useParams<{ projectId: string }>()! ?? { projectId: "" };
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = (useSearchParams() ?? new URLSearchParams()) as NonNullable<ReturnType<typeof useSearchParams>>;
  const projectId = params.projectId ?? "";

  const initialFilters: FilterState = {
    status: searchParams.get("status") || undefined,
    type: searchParams.get("type") || undefined,
  };

  const tableState = useUnifiedTableState({
    entityKey: "pcos",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "card",
      allowedViews: ["card", "table"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "number",
      sortDirection: "asc",
      visibleColumns: pcoDefaultVisibleColumns,
      filters: initialFilters,
    },
  });

  const { data: pcos = [], isLoading, error } = useProjectPCOs(projectId);
  const resolvedError =
    error instanceof Error
      ? error
      : error
        ? new Error("Failed to load PCOs")
        : undefined;

  const activeFilters = tableState.activeFilters as FilterState;

  // Client-side filtering
  const filteredPcos = React.useMemo(() => {
    const term = (tableState.debouncedSearch ?? "").toLowerCase().trim();
    return pcos.filter((pco) => {
      if (activeFilters.status && pco.status !== activeFilters.status) return false;
      if (activeFilters.type && pco.type !== activeFilters.type) return false;
      if (term) {
        const matchesNumber = (pco.number ?? "").toLowerCase().includes(term);
        const matchesTitle = (pco.title ?? "").toLowerCase().includes(term);
        if (!matchesNumber && !matchesTitle) return false;
      }
      return true;
    });
  }, [pcos, activeFilters, tableState.debouncedSearch]);

  // Client-side sorting
  const tableColumns = React.useMemo(
    () => buildPCOTableColumns(projectId),
    [projectId],
  );

  const sortedPcos = React.useMemo(() => {
    if (!tableState.sortBy) return filteredPcos;
    const sortColumn = tableColumns.find((col) => col.id === tableState.sortBy);
    const getSortValue = sortColumn?.sortValue;
    if (!getSortValue) return filteredPcos;

    return [...filteredPcos].sort((a, b) => {
      const valA = getSortValue(a);
      const valB = getSortValue(b);
      if (valA == null && valB == null) return 0;
      if (valA == null) return tableState.sortDirection === "asc" ? -1 : 1;
      if (valB == null) return tableState.sortDirection === "asc" ? 1 : -1;
      if (typeof valA === "number" && typeof valB === "number") {
        return tableState.sortDirection === "asc" ? valA - valB : valB - valA;
      }
      const cmp = String(valA).localeCompare(String(valB));
      return tableState.sortDirection === "asc" ? cmp : -cmp;
    });
  }, [filteredPcos, tableColumns, tableState.sortBy, tableState.sortDirection]);

  // KPI metrics (compact size)
  const kpiMetrics = React.useMemo(() => {
    const fmt = (n: number) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(n);

    const totalValue = pcos.reduce((sum, p) => sum + (p.estimated_value ?? 0), 0);
    const approvedCount = pcos.filter((p) => p.status === "APPROVED").length;
    const pendingCount = pcos.filter(
      (p) => p.status === "SUBMITTED" || p.status === "UNDER_REVIEW",
    ).length;
    const draftCount = pcos.filter((p) => p.status === "DRAFT").length;

    return [
      { label: "Total PCOs", value: String(pcos.length), context: `${fmt(totalValue)} est. value`, size: "compact" as const },
      { label: "Approved", value: String(approvedCount), context: "Ready to convert", size: "compact" as const },
      { label: "Pending", value: String(pendingCount), context: "Awaiting decision", size: "compact" as const },
      { label: "Drafts", value: String(draftCount), context: "In preparation", size: "compact" as const },
    ];
  }, [pcos]);

  const handleFilterChange = (nextFilters: FilterState) => {
    tableState.setActiveFilters(nextFilters);
    tableState.setSearchParams({
      status: typeof nextFilters.status === "string" ? nextFilters.status : null,
      type: typeof nextFilters.type === "string" ? nextFilters.type : null,
      page: "1",
    });
    tableState.setPage(1);
  };

  const handleRowClick = (pco: PCO) => {
    router.push(`/${projectId}/pcos/${pco.id}`);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      tableState.setSelectedIds(sortedPcos.map((p) => String(p.id)));
    } else {
      tableState.setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      tableState.setSelectedIds((prev) => [...prev, id]);
    } else {
      tableState.setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const isFiltered =
    Boolean(tableState.searchInput) ||
    Boolean(activeFilters.status) ||
    Boolean(activeFilters.type);

  return (
    <UnifiedTablePage
      header={{
        title: "Potential Change Orders",
        actions: (
          <Button
            size="sm"
            onClick={() => router.push(`/${projectId}/pcos/new`)}
          >
            <Plus />
            New PCO
          </Button>
        ),
      }}
      topContent={
        pcos.length > 0 ? (
          <div className="px-6 pb-4">
            <KpiRow metrics={kpiMetrics} />
          </div>
        ) : undefined
      }
      toolbar={{
        totalItems: pcos.length,
        filteredItems: filteredPcos.length,
        selectedCount: tableState.selectedIds.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search PCOs...",
        currentView: tableState.currentView,
        onViewChange: (view) => {
          tableState.setCurrentView(view);
          tableState.setSearchParams({ view });
        },
        enabledViews: ["card", "table"],
        filters: pcoFilters,
        activeFilters,
        onFilterChange: handleFilterChange,
        onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
        columns: pcoColumnConfigs,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
      }}
      data={{
        items: sortedPcos,
        isLoading,
        error: resolvedError,
      }}
      table={{
        columns: tableColumns,
        getRowId: (item) => String(item.id),
        onRowClick: handleRowClick,
      }}
      views={{
        card: (item) => renderPCOCard(item, handleRowClick),
      }}
      layout={{
        cardGridClassName: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4",
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
            page: "1",
          });
          tableState.setPage(1);
        },
      }}
      selection={{
        selectedIds: tableState.selectedIds,
        onSelectAll: handleSelectAll,
        onSelectRow: handleSelectRow,
      }}
      emptyState={{
        title: "No potential change orders yet",
        description: "Create your first PCO to start organizing change events.",
        filteredDescription: "Try adjusting your search or filters.",
        isFiltered,
      }}
      pagination={{
        page: tableState.page,
        totalPages: Math.ceil(filteredPcos.length / tableState.perPage),
        perPage: tableState.perPage,
        onPageChange: (nextPage) => {
          tableState.setPage(nextPage);
          tableState.setSearchParams({ page: String(nextPage) });
        },
        onPerPageChange: (nextPerPage) => {
          const parsed = Number(nextPerPage);
          if (!Number.isFinite(parsed) || parsed <= 0) return;
          tableState.setPerPage(parsed);
          tableState.setSearchParams({ per_page: String(parsed), page: "1" });
          tableState.setPage(1);
        },
        clientSide: true,
      }}
    />
  );
}

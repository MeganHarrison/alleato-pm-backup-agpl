"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";

import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
  type TableColumn,
} from "@/components/tables/unified";
import { StatusBadge } from "@/components/ds";
import { buildAcumaticaProjectHref } from "@/lib/acumatica/project-url";
import { apiFetch } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AcumaticaProject {
  id: string;
  external_key: string | null;
  project_id: string | null;
  description: string | null;
  status: string | null;
  customer: string | null;
  hold: boolean | null;
  income: number | null;
  expenses: number | null;
  assets: number | null;
  liabilities: number | null;
  template_id: string | null;
  external_ref_nbr: string | null;
  last_modified_at: string | null;
  acumatica_sync_at: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function calculateProjectProfit(project: AcumaticaProject): number {
  return (project.income ?? 0) - (project.expenses ?? 0);
}

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

const DEFAULT_VISIBLE_COLUMNS = [
  "project_id",
  "description",
  "status",
  "customer",
  "income",
  "expenses",
  "project_profit",
  "assets",
  "liabilities",
  "hold",
  "template_id",
  "external_ref_nbr",
  "last_modified_at",
];

const COLUMNS: TableColumn<AcumaticaProject>[] = [
  {
    id: "project_id",
    label: "Project ID",
    defaultVisible: true,
    render: (item) =>
      item.project_id ? (
        <a
          href={buildAcumaticaProjectHref(item.project_id)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium tabular-nums text-primary hover:underline"
        >
          {item.project_id}
          <ArrowRight className="h-3 w-3" />
        </a>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    csvValue: (item) => item.project_id ?? "",
    sortable: true,
    sortValue: (item) => item.project_id ?? "",
  },
  {
    id: "description",
    label: "Description",
    defaultVisible: true,
    render: (item) => (
      <span className="text-foreground">{item.description ?? "—"}</span>
    ),
    csvValue: (item) => item.description ?? "",
    sortable: true,
    sortValue: (item) => item.description ?? "",
  },
  {
    id: "status",
    label: "Status",
    defaultVisible: true,
    render: (item) =>
      item.status ? <StatusBadge status={item.status} /> : <span className="text-muted-foreground">—</span>,
    csvValue: (item) => item.status ?? "",
    sortable: true,
    sortValue: (item) => item.status ?? "",
  },
  {
    id: "customer",
    label: "Customer",
    defaultVisible: true,
    render: (item) => (
      <span className="text-foreground">{item.customer ?? "—"}</span>
    ),
    csvValue: (item) => item.customer ?? "",
    sortable: true,
    sortValue: (item) => item.customer ?? "",
  },
  {
    id: "income",
    label: "Income",
    defaultVisible: true,
    render: (item) => (
      <span className="tabular-nums text-foreground">
        {formatCurrency(item.income)}
      </span>
    ),
    csvValue: (item) => String(item.income ?? ""),
    sortable: true,
    sortValue: (item) => item.income ?? 0,
  },
  {
    id: "expenses",
    label: "Expenses",
    defaultVisible: true,
    render: (item) => (
      <span className="tabular-nums text-foreground">
        {formatCurrency(item.expenses)}
      </span>
    ),
    csvValue: (item) => String(item.expenses ?? ""),
    sortable: true,
    sortValue: (item) => item.expenses ?? 0,
  },
  {
    id: "project_profit",
    label: "Project Profit",
    defaultVisible: true,
    render: (item) => (
      <span className="tabular-nums text-foreground">
        {formatCurrency(calculateProjectProfit(item))}
      </span>
    ),
    csvValue: (item) => String(calculateProjectProfit(item)),
    sortable: true,
    sortValue: (item) => calculateProjectProfit(item),
  },
  {
    id: "assets",
    label: "Assets",
    defaultVisible: true,
    render: (item) => (
      <span className="tabular-nums text-foreground">
        {formatCurrency(item.assets)}
      </span>
    ),
    csvValue: (item) => String(item.assets ?? ""),
    sortable: true,
    sortValue: (item) => item.assets ?? 0,
  },
  {
    id: "liabilities",
    label: "Liabilities",
    defaultVisible: true,
    render: (item) => (
      <span className="tabular-nums text-foreground">
        {formatCurrency(item.liabilities)}
      </span>
    ),
    csvValue: (item) => String(item.liabilities ?? ""),
    sortable: true,
    sortValue: (item) => item.liabilities ?? 0,
  },
  {
    id: "hold",
    label: "On Hold",
    defaultVisible: true,
    render: (item) => (
      <span className="text-foreground">
        {item.hold == null ? "—" : item.hold ? "Yes" : "No"}
      </span>
    ),
    csvValue: (item) => (item.hold == null ? "" : item.hold ? "Yes" : "No"),
  },
  {
    id: "template_id",
    label: "Template",
    defaultVisible: true,
    render: (item) => (
      <span className="text-muted-foreground">{item.template_id ?? "—"}</span>
    ),
    csvValue: (item) => item.template_id ?? "",
  },
  {
    id: "external_ref_nbr",
    label: "External Ref",
    defaultVisible: true,
    render: (item) => (
      <span className="font-mono text-xs text-muted-foreground">
        {item.external_ref_nbr ?? "—"}
      </span>
    ),
    csvValue: (item) => item.external_ref_nbr ?? "",
  },
  {
    id: "last_modified_at",
    label: "Last Modified",
    defaultVisible: true,
    render: (item) => (
      <span className="text-muted-foreground text-sm">
        {formatDateTime(item.last_modified_at)}
      </span>
    ),
    csvValue: (item) => item.last_modified_at ?? "",
    sortable: true,
    sortValue: (item) => item.last_modified_at ?? "",
  },
];

const COLUMN_CONFIGS = COLUMNS.map(({ id, label, defaultVisible }) => ({
  id,
  label,
  defaultVisible,
}));

// ---------------------------------------------------------------------------
// Filter config
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = [
  { label: "Active", value: "Active" },
  { label: "Completed", value: "Completed" },
  { label: "On Hold", value: "On Hold" },
  { label: "Planned", value: "Planned" },
  { label: "Suspended", value: "Suspended" },
  { label: "In Planning", value: "In Planning" },
];

const FILTERS = [
  {
    id: "status",
    label: "Status",
    type: "select" as const,
    options: STATUS_OPTIONS,
  },
  {
    id: "financials",
    label: "Financials",
    type: "select" as const,
    options: [
      { label: "Has Income", value: "has_income" },
      { label: "Has Expenses", value: "has_expenses" },
      { label: "Has Liabilities", value: "has_liabilities" },
    ],
  },
];

const EMPTY_FILTERS: Record<string, FilterValue> = {
  status: undefined,
  financials: undefined,
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AccountingProjectsPage() {
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = useSearchParams()!;

  const [allProjects, setAllProjects] = useState<AcumaticaProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<AcumaticaProject[]>("/api/accounting/projects");
      setAllProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load projects"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const tableState = useUnifiedTableState({
    entityKey: "accounting-projects-v2",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 50,
      search: "",
      sortBy: "project_id",
      sortDirection: "asc",
      visibleColumns: DEFAULT_VISIBLE_COLUMNS,
      filters: EMPTY_FILTERS,
    },
  });

  const activeFilters = tableState.activeFilters;

  // Client-side filtering
  const filteredProjects = useMemo(() => {
    const searchTerm = tableState.debouncedSearch.trim().toLowerCase();
    const af = activeFilters;
    const statusFilter = typeof af.status === "string" ? af.status : "";

    return allProjects.filter((project) => {
      if (statusFilter && project.status !== statusFilter) return false;

      if (af.financials === "has_income" && !(project.income && project.income > 0)) return false;
      if (af.financials === "has_expenses" && !(project.expenses && project.expenses > 0)) return false;
      if (af.financials === "has_liabilities" && !(project.liabilities && project.liabilities > 0)) return false;

      if (!searchTerm) return true;

      return (
        (project.project_id ?? "").toLowerCase().includes(searchTerm) ||
        (project.description ?? "").toLowerCase().includes(searchTerm) ||
        (project.customer ?? "").toLowerCase().includes(searchTerm) ||
        (project.external_ref_nbr ?? "").toLowerCase().includes(searchTerm)
      );
    });
  }, [allProjects, activeFilters, tableState.debouncedSearch]);

  // Client-side sorting
  const sortedProjects = useMemo(() => {
    const { sortBy, sortDirection } = tableState;
    if (!sortBy) return filteredProjects;

    const col = COLUMNS.find((c) => c.id === sortBy);
    if (!col?.sortValue) return filteredProjects;

    return [...filteredProjects].sort((a, b) => {
      const aVal = col.sortValue!(a) ?? "";
      const bVal = col.sortValue!(b) ?? "";
      const cmp =
        typeof aVal === "number" && typeof bVal === "number"
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));
      return sortDirection === "desc" ? -cmp : cmp;
    });
  }, [filteredProjects, tableState.sortBy, tableState.sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedProjects.length / tableState.perPage));

  // Totals for footer
  const totals = useMemo(() => {
    let income = 0, expenses = 0, projectProfit = 0, assets = 0, liabilities = 0;
    for (const p of sortedProjects) {
      income += p.income ?? 0;
      expenses += p.expenses ?? 0;
      projectProfit += calculateProjectProfit(p);
      assets += p.assets ?? 0;
      liabilities += p.liabilities ?? 0;
    }
    return { income, expenses, projectProfit, assets, liabilities };
  }, [sortedProjects]);

  // Export to CSV
  const handleExport = useCallback(() => {
    const headers = ["Project ID", "Description", "Status", "Customer", "Income", "Expenses", "Project Profit", "Assets", "Liabilities", "On Hold", "Template", "External Ref", "Last Modified"];
    const rows = sortedProjects.map((p) => [
      p.project_id ?? "",
      p.description ?? "",
      p.status ?? "",
      p.customer ?? "",
      String(p.income ?? ""),
      String(p.expenses ?? ""),
      String(calculateProjectProfit(p)),
      String(p.assets ?? ""),
      String(p.liabilities ?? ""),
      p.hold == null ? "" : p.hold ? "Yes" : "No",
      p.template_id ?? "",
      p.external_ref_nbr ?? "",
      p.last_modified_at ?? "",
    ].map(escapeCsvField).join(","));

    const csv = [headers.map(escapeCsvField).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "acumatica-projects.csv";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [sortedProjects]);

  const handleFilterChange = useCallback(
    (nextFilters: Record<string, FilterValue>) => {
      tableState.setActiveFilters(nextFilters);
      tableState.setSearchParams({
        status: typeof nextFilters.status === "string" ? nextFilters.status : null,
        page: "1",
      });
      tableState.setPage(1);
    },
    [tableState],
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      tableState.setSelectedIds(
        checked ? sortedProjects.map((p) => p.id) : [],
      );
    },
    [sortedProjects, tableState],
  );

  const handleSelectRow = useCallback(
    (id: string, checked: boolean) => {
      tableState.setSelectedIds((prev) =>
        checked ? [...prev, id] : prev.filter((existingId) => existingId !== id),
      );
    },
    [tableState],
  );

  const isFiltered = Boolean(tableState.debouncedSearch) ||
    Object.values(activeFilters).some((v) => v !== undefined && v !== null && v !== "");

  return (
    <UnifiedTablePage
      header={{
        title: "Projects",
        variant: "compact",
      }}
      toolbar={{
        totalItems: allProjects.length,
        filteredItems: sortedProjects.length,
        selectedCount: tableState.selectedIds.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search projects...",
        currentView: tableState.currentView,
        onViewChange: (view) => {
          tableState.setCurrentView(view);
          tableState.setSearchParams({ view });
        },
        filters: FILTERS,
        activeFilters,
        onFilterChange: handleFilterChange,
        onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
        columns: COLUMN_CONFIGS,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
        onExport: handleExport,
      }}
      data={{
        items: sortedProjects,
        isLoading,
        error,
      }}
      table={{
        columns: COLUMNS,
        getRowId: (item) => item.id,
        density: "compact",
      }}
      sorting={{
        sortBy: tableState.sortBy,
        sortDirection: tableState.sortDirection,
        onSortChange: (sortBy, direction) => {
          tableState.setSortBy(sortBy);
          tableState.setSortDirection(direction);
          tableState.setSearchParams({ sort: sortBy, sort_dir: direction });
        },
      }}
      selection={{
        selectedIds: tableState.selectedIds,
        onSelectAll: handleSelectAll,
        onSelectRow: handleSelectRow,
      }}
      emptyState={{
        title: "No projects found",
        description: "Acumatica project data will appear here once synced.",
        filteredDescription: "Try adjusting your search or filters.",
        isFiltered,
      }}
      footerTotals={{
        label: `Totals (${sortedProjects.length})`,
        values: {
          income: (
            <span className="tabular-nums">{formatCurrency(totals.income)}</span>
          ),
          expenses: (
            <span className="tabular-nums">{formatCurrency(totals.expenses)}</span>
          ),
          project_profit: (
            <span className="tabular-nums">{formatCurrency(totals.projectProfit)}</span>
          ),
          assets: (
            <span className="tabular-nums">{formatCurrency(totals.assets)}</span>
          ),
          liabilities: (
            <span className="tabular-nums">{formatCurrency(totals.liabilities)}</span>
          ),
        },
      }}
      pagination={{
        page: tableState.page,
        totalPages,
        perPage: tableState.perPage,
        onPageChange: (newPage) => {
          tableState.setPage(newPage);
          tableState.setSearchParams({ page: String(newPage) });
        },
        onPerPageChange: (newPerPage) => {
          tableState.setPerPage(Number(newPerPage));
          tableState.setPage(1);
          tableState.setSearchParams({ perPage: newPerPage, page: "1" });
        },
        clientSide: true,
      }}
      features={{
        enableExport: true,
        enableRowSelection: true,
        enableViews: false,
      }}
      layout={{
        fullBleedTable: true,
        removeTableFrame: true,
        toolbarInlineWithHeader: true,
      }}
    />
  );
}

"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { StatusBadge } from "@/components/ds";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api-client";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
  type TableColumn,
} from "@/components/tables/unified";

interface WipRow {
  projectCode: string;
  projectDescription: string | null;
  customer: string | null;
  projectStatus: string | null;
  contractValue: number;
  revisedCostBudget: number;
  costsToDate: number;
  committedCosts: number;
  openCommitments: number;
  costToComplete: number;
  estimatedFinalCost: number;
  costVariance: number;
  percentComplete: number;
  earnedRevenue: number;
  billedToDate: number;
  overUnderBilling: number;
  forecastGrossProfit: number;
  forecastGrossMarginPct: number;
  wipPosition: "overbilled" | "underbilled" | "balanced";
  budgetLineCount: number;
  latestSyncAt: string | null;
}

interface WipResponse {
  rows: WipRow[];
  generatedAt: string;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function formatSignedCurrency(value: number): string {
  const formatted = formatCurrency(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

function formatDateTime(value: string | null): string {
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

function getWipPositionVariant(position: WipRow["wipPosition"]): "default" | "secondary" | "destructive" {
  if (position === "underbilled") return "secondary";
  if (position === "overbilled") return "default";
  return "secondary";
}

const COLUMNS: TableColumn<WipRow>[] = [
  {
    id: "projectCode",
    label: "Project",
    defaultVisible: true,
    alwaysVisible: true,
    sortable: true,
    sortValue: (item) => item.projectCode,
    render: (item) => (
      <a
        href={`/accounting/projects?search=${encodeURIComponent(item.projectCode)}`}
        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
      >
        {item.projectCode}
        <ArrowRight className="h-3 w-3" />
      </a>
    ),
    csvValue: (item) => item.projectCode,
  },
  {
    id: "projectDescription",
    label: "Description",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.projectDescription ?? "",
    render: (item) => (
      <span className="text-foreground">{item.projectDescription ?? "—"}</span>
    ),
    csvValue: (item) => item.projectDescription ?? "",
  },
  {
    id: "customer",
    label: "Customer",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.customer ?? "",
    render: (item) => (
      <span className="text-foreground">{item.customer ?? "—"}</span>
    ),
    csvValue: (item) => item.customer ?? "",
  },
  {
    id: "projectStatus",
    label: "Status",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.projectStatus ?? "",
    render: (item) =>
      item.projectStatus ? (
        <StatusBadge status={item.projectStatus} />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    csvValue: (item) => item.projectStatus ?? "",
  },
  {
    id: "contractValue",
    label: "Contract Value",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.contractValue,
    render: (item) => (
      <span className="tabular-nums">{formatCurrency(item.contractValue)}</span>
    ),
    csvValue: (item) => String(item.contractValue),
  },
  {
    id: "revisedCostBudget",
    label: "Revised Cost Budget",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.revisedCostBudget,
    render: (item) => (
      <span className="tabular-nums">{formatCurrency(item.revisedCostBudget)}</span>
    ),
    csvValue: (item) => String(item.revisedCostBudget),
  },
  {
    id: "costsToDate",
    label: "Costs To Date",
    align: "right" as const,
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.costsToDate,
    render: (item) => (
      <span className="tabular-nums">{formatCurrency(item.costsToDate)}</span>
    ),
    csvValue: (item) => String(item.costsToDate),
  },
  {
    id: "committedCosts",
    label: "Committed Costs",
    defaultVisible: false,
    sortable: true,
    sortValue: (item) => item.committedCosts,
    render: (item) => (
      <span className="tabular-nums">{formatCurrency(item.committedCosts)}</span>
    ),
    csvValue: (item) => String(item.committedCosts),
  },
  {
    id: "openCommitments",
    label: "Open Commitments",
    defaultVisible: false,
    sortable: true,
    sortValue: (item) => item.openCommitments,
    render: (item) => (
      <span className="tabular-nums">{formatCurrency(item.openCommitments)}</span>
    ),
    csvValue: (item) => String(item.openCommitments),
  },
  {
    id: "costToComplete",
    label: "Cost To Complete",
    defaultVisible: false,
    sortable: true,
    sortValue: (item) => item.costToComplete,
    render: (item) => (
      <span className="tabular-nums">{formatCurrency(item.costToComplete)}</span>
    ),
    csvValue: (item) => String(item.costToComplete),
  },
  {
    id: "estimatedFinalCost",
    label: "EAC",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.estimatedFinalCost,
    render: (item) => (
      <span className="tabular-nums">{formatCurrency(item.estimatedFinalCost)}</span>
    ),
    csvValue: (item) => String(item.estimatedFinalCost),
  },
  {
    id: "costVariance",
    label: "Cost Variance",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.costVariance,
    render: (item) => (
      <span
        className={`tabular-nums ${item.costVariance >= 0 ? "text-emerald-600" : "text-destructive"}`}
      >
        {formatSignedCurrency(item.costVariance)}
      </span>
    ),
    csvValue: (item) => String(item.costVariance),
  },
  {
    id: "percentComplete",
    label: "% Complete",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.percentComplete,
    render: (item) => (
      <span className="tabular-nums">{formatPercent(item.percentComplete)}</span>
    ),
    csvValue: (item) => String(item.percentComplete),
  },
  {
    id: "earnedRevenue",
    label: "Earned Revenue",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.earnedRevenue,
    render: (item) => (
      <span className="tabular-nums">{formatCurrency(item.earnedRevenue)}</span>
    ),
    csvValue: (item) => String(item.earnedRevenue),
  },
  {
    id: "billedToDate",
    label: "Billed To Date",
    align: "right" as const,
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.billedToDate,
    render: (item) => (
      <span className="tabular-nums">{formatCurrency(item.billedToDate)}</span>
    ),
    csvValue: (item) => String(item.billedToDate),
  },
  {
    id: "overUnderBilling",
    label: "Over/Under Billing",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.overUnderBilling,
    render: (item) => (
      <span
        className={`tabular-nums ${item.overUnderBilling >= 0 ? "text-amber-600" : "text-blue-600"}`}
      >
        {formatSignedCurrency(item.overUnderBilling)}
      </span>
    ),
    csvValue: (item) => String(item.overUnderBilling),
  },
  {
    id: "wipPosition",
    label: "WIP Position",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.wipPosition,
    render: (item) => (
      <Badge variant={getWipPositionVariant(item.wipPosition)} className="capitalize">
        {item.wipPosition}
      </Badge>
    ),
    csvValue: (item) => item.wipPosition,
  },
  {
    id: "forecastGrossProfit",
    label: "Forecast Gross Profit",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.forecastGrossProfit,
    render: (item) => (
      <span
        className={`tabular-nums ${item.forecastGrossProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}
      >
        {formatSignedCurrency(item.forecastGrossProfit)}
      </span>
    ),
    csvValue: (item) => String(item.forecastGrossProfit),
  },
  {
    id: "forecastGrossMarginPct",
    label: "Gross Margin %",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.forecastGrossMarginPct,
    render: (item) => (
      <span className="tabular-nums">
        {item.forecastGrossMarginPct.toFixed(1)}%
      </span>
    ),
    csvValue: (item) => String(item.forecastGrossMarginPct),
  },
  {
    id: "latestSyncAt",
    label: "Last Sync",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.latestSyncAt ?? "",
    render: (item) => (
      <span className="text-muted-foreground">{formatDateTime(item.latestSyncAt)}</span>
    ),
    csvValue: (item) => item.latestSyncAt ?? "",
  },
  {
    id: "budgetLineCount",
    label: "Budget Lines",
    defaultVisible: false,
    sortable: true,
    sortValue: (item) => item.budgetLineCount,
    render: (item) => (
      <span className="tabular-nums">{item.budgetLineCount}</span>
    ),
    csvValue: (item) => String(item.budgetLineCount),
  },
];

const FILTERS = [
  {
    id: "status",
    label: "Status",
    type: "select" as const,
    options: [
      { label: "Active", value: "Active" },
      { label: "Completed", value: "Completed" },
      { label: "On Hold", value: "On Hold" },
      { label: "In Planning", value: "In Planning" },
    ],
  },
  {
    id: "wipPosition",
    label: "WIP Position",
    type: "select" as const,
    options: [
      { label: "Overbilled", value: "overbilled" },
      { label: "Underbilled", value: "underbilled" },
      { label: "Balanced", value: "balanced" },
    ],
  },
  {
    id: "profitability",
    label: "Profitability",
    type: "select" as const,
    options: [
      { label: "Profitable", value: "profit" },
      { label: "Loss", value: "loss" },
    ],
  },
];

const EMPTY_FILTERS: Record<string, FilterValue> = {
  status: undefined,
  wipPosition: undefined,
  profitability: undefined,
};

const DEFAULT_VISIBLE_COLUMNS = [
  "projectCode",
  "projectDescription",
  "projectStatus",
  "contractValue",
  "revisedCostBudget",
  "costsToDate",
  "estimatedFinalCost",
  "costVariance",
  "percentComplete",
  "earnedRevenue",
  "billedToDate",
  "overUnderBilling",
  "wipPosition",
  "forecastGrossProfit",
  "forecastGrossMarginPct",
  "latestSyncAt",
];

export default function AccountingWipPage() {
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = useSearchParams()!;

  const [rows, setRows] = React.useState<WipRow[]>([]);
  const [generatedAt, setGeneratedAt] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiFetch<WipResponse>("/api/accounting/wip")
      .then((result) => {
        if (cancelled) return;
        setRows(result.rows ?? []);
        setGeneratedAt(result.generatedAt ?? null);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err
            : new Error("Failed to load WIP report data."),
        );
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const tableState = useUnifiedTableState({
    entityKey: "accounting-wip-v1",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 50,
      search: "",
      sortBy: "contractValue",
      sortDirection: "desc",
      visibleColumns: DEFAULT_VISIBLE_COLUMNS,
      filters: EMPTY_FILTERS,
    },
  });

  const filteredRows = React.useMemo(() => {
    const q = tableState.debouncedSearch.trim().toLowerCase();
    const { status, wipPosition, profitability } = tableState.activeFilters;

    return rows.filter((row) => {
      if (typeof status === "string" && status && row.projectStatus !== status) return false;
      if (typeof wipPosition === "string" && wipPosition && row.wipPosition !== wipPosition) return false;
      if (profitability === "profit" && !(row.forecastGrossProfit >= 0)) return false;
      if (profitability === "loss" && !(row.forecastGrossProfit < 0)) return false;

      if (!q) return true;

      return (
        row.projectCode.toLowerCase().includes(q) ||
        (row.projectDescription ?? "").toLowerCase().includes(q) ||
        (row.customer ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, tableState.debouncedSearch, tableState.activeFilters]);

  const sortedRows = React.useMemo(() => {
    const { sortBy, sortDirection } = tableState;
    if (!sortBy) return filteredRows;

    const column = COLUMNS.find((c) => c.id === sortBy);
    if (!column?.sortValue) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const av = column.sortValue!(a) ?? "";
      const bv = column.sortValue!(b) ?? "";
      const comparison =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortDirection === "desc" ? -comparison : comparison;
    });
  }, [filteredRows, tableState.sortBy, tableState.sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / tableState.perPage));

  const totals = React.useMemo(() => {
    return sortedRows.reduce(
      (acc, row) => {
        acc.contractValue += row.contractValue;
        acc.revisedCostBudget += row.revisedCostBudget;
        acc.costsToDate += row.costsToDate;
        acc.estimatedFinalCost += row.estimatedFinalCost;
        acc.earnedRevenue += row.earnedRevenue;
        acc.billedToDate += row.billedToDate;
        acc.overUnderBilling += row.overUnderBilling;
        acc.forecastGrossProfit += row.forecastGrossProfit;
        return acc;
      },
      {
        contractValue: 0,
        revisedCostBudget: 0,
        costsToDate: 0,
        estimatedFinalCost: 0,
        earnedRevenue: 0,
        billedToDate: 0,
        overUnderBilling: 0,
        forecastGrossProfit: 0,
      },
    );
  }, [sortedRows]);

  const handleExport = React.useCallback(() => {
    const visibleColumns = COLUMNS.filter((column) => tableState.visibleColumns.includes(column.id));
    const header = visibleColumns.map((column) => column.label).join(",");
    const csvRows = sortedRows.map((row) =>
      visibleColumns
        .map((column) => {
          const value = column.csvValue ? column.csvValue(row) : "";
          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(","),
    );
    const csv = [header, ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "accounting-wip-report.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [sortedRows, tableState.visibleColumns]);

  const isFiltered =
    !!tableState.debouncedSearch ||
    Object.values(tableState.activeFilters).some((value) => value !== undefined && value !== null && value !== "");

  return (
    <UnifiedTablePage
      header={{
        title: "WIP Report",
        description: generatedAt
          ? `Generated ${formatDateTime(generatedAt)}`
          : "Work-in-progress accounting view",
        variant: "compact",
      }}
      toolbar={{
        totalItems: rows.length,
        filteredItems: sortedRows.length,
        selectedCount: tableState.selectedIds.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search project, description, customer...",
        currentView: tableState.currentView,
        onViewChange: tableState.setCurrentView,
        filters: FILTERS,
        activeFilters: tableState.activeFilters,
        onFilterChange: (nextFilters) =>
          tableState.setActiveFilters((prev) => ({ ...prev, ...nextFilters })),
        onClearFilters: () => tableState.setActiveFilters(EMPTY_FILTERS),
        columns: COLUMNS.map(({ id, label, defaultVisible }) => ({
          id,
          label,
          defaultVisible,
        })),
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
        onExport: handleExport,
      }}
      data={{
        items: sortedRows,
        isLoading,
        error,
      }}
      table={{
        columns: COLUMNS,
        getRowId: (item) => item.projectCode,
        defaultPinnedLeftColumns: ["projectCode"],
        stickyHeader: true,
        density: "compact",
      }}
      sorting={{
        sortBy: tableState.sortBy,
        sortDirection: tableState.sortDirection,
        onSortChange: (sortBy, direction) => {
          tableState.setSortBy(sortBy);
          tableState.setSortDirection(direction);
        },
      }}
      selection={{
        selectedIds: tableState.selectedIds,
        onSelectAll: (checked) =>
          tableState.setSelectedIds(checked ? sortedRows.map((row) => row.projectCode) : []),
        onSelectRow: (id, checked) =>
          tableState.setSelectedIds((prev) =>
            checked ? [...prev, id] : prev.filter((existingId) => existingId !== id),
          ),
      }}
      emptyState={{
        title: "No WIP rows found",
        description: "WIP rows appear after Acumatica budget/project sync completes.",
        filteredDescription: "No projects match your filters.",
        isFiltered,
      }}
      footerTotals={{
        label: `Totals (${sortedRows.length})`,
        values: {
          contractValue: (
            <span className="block text-right tabular-nums">{formatCurrency(totals.contractValue)}</span>
          ),
          revisedCostBudget: (
            <span className="block text-right tabular-nums">{formatCurrency(totals.revisedCostBudget)}</span>
          ),
          costsToDate: (
            <span className="block text-right tabular-nums">{formatCurrency(totals.costsToDate)}</span>
          ),
          estimatedFinalCost: (
            <span className="block text-right tabular-nums">{formatCurrency(totals.estimatedFinalCost)}</span>
          ),
          earnedRevenue: (
            <span className="block text-right tabular-nums">{formatCurrency(totals.earnedRevenue)}</span>
          ),
          billedToDate: (
            <span className="block text-right tabular-nums">{formatCurrency(totals.billedToDate)}</span>
          ),
          overUnderBilling: (
            <span className="block text-right tabular-nums">{formatSignedCurrency(totals.overUnderBilling)}</span>
          ),
          forecastGrossProfit: (
            <span className="block text-right tabular-nums">{formatSignedCurrency(totals.forecastGrossProfit)}</span>
          ),
        },
      }}
      pagination={{
        page: tableState.page,
        totalPages,
        perPage: tableState.perPage,
        onPageChange: tableState.setPage,
        onPerPageChange: (value) => {
          tableState.setPerPage(Number(value));
          tableState.setPage(1);
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

"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { StatusBadge } from "@/components/ds";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
  type TableColumn,
} from "@/components/tables/unified";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApCheck {
  id: string;
  external_key: string | null;
  reference_nbr: string | null;
  document_type: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  payment_ref: string | null;
  application_date: string | null;
  status: string | null;
  description: string | null;
  payment_method: string | null;
  cash_account: string | null;
  currency_id: string | null;
  payment_amount: number | null;
  applied_to_documents: number | null;
  projects: Array<{ name: string; number: string | null }> | null;
  last_modified_at: string | null;
  acumatica_sync_at: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number | null): string {
  if (amount == null) return "—";
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function truncate(str: string | null, max: number): string {
  if (!str) return "—";
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

const COLUMNS: TableColumn<ApCheck>[] = [
  {
    id: "reference_nbr",
    label: "Ref #",
    defaultVisible: true,
    alwaysVisible: true,
    sortable: true,
    sortValue: (item) => item.reference_nbr ?? "",
    render: (item) =>
      item.reference_nbr ? (
        <a
          href={`https://alleatogroup.acumatica.com/Main?ScreenId=AP302000&DocType=${encodeURIComponent(item.document_type ?? "Check")}&RefNbr=${encodeURIComponent(item.reference_nbr)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
        >
          {item.reference_nbr}
          <ArrowRight className="h-3 w-3" />
        </a>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    csvValue: (item) => item.reference_nbr ?? "",
  },
  {
    id: "document_type",
    label: "Type",
    defaultVisible: true,

    sortable: true,
    sortValue: (item) => item.document_type ?? "",
    render: (item) => (
      <span className="text-sm text-foreground">{item.document_type ?? "—"}</span>
    ),
    csvValue: (item) => item.document_type ?? "",
  },
  {
    id: "status",
    label: "Status",
    defaultVisible: true,

    sortable: true,
    sortValue: (item) => item.status ?? "",
    render: (item) =>
      item.status ? <StatusBadge status={item.status} /> : <span className="text-muted-foreground">—</span>,
    csvValue: (item) => item.status ?? "",
  },
  {
    id: "application_date",
    label: "Date",
    defaultVisible: true,

    sortable: true,
    sortValue: (item) => item.application_date ?? "",
    render: (item) => (
      <span className="text-sm text-foreground">{formatDate(item.application_date)}</span>
    ),
    csvValue: (item) => formatDate(item.application_date),
  },
  {
    id: "vendor_id",
    label: "Vendor ID",
    defaultVisible: true,

    sortable: true,
    sortValue: (item) => item.vendor_id ?? "",
    render: (item) => (
      <span className="font-mono text-xs text-muted-foreground">
        {item.vendor_id ?? "—"}
      </span>
    ),
    csvValue: (item) => item.vendor_id ?? "",
  },
  {
    id: "vendor_name",
    label: "Vendor",
    defaultVisible: true,

    sortable: true,
    sortValue: (item) => item.vendor_name ?? "",
    render: (item) => (
      <span className="text-sm text-foreground">{item.vendor_name ?? "—"}</span>
    ),
    csvValue: (item) => item.vendor_name ?? "",
  },
  {
    id: "projects",
    label: "Project(s)",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => (item.projects ?? []).map((p) => p.name).join(", "),
    render: (item) => {
      const projs = item.projects;
      if (!projs || projs.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {projs.map((p) => (
            <span
              key={p.name}
              className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-muted text-foreground"
              title={p.number ?? undefined}
            >
              {p.name}
            </span>
          ))}
        </div>
      );
    },
    csvValue: (item) => (item.projects ?? []).map((p) => p.name).join("; "),
  },
  {
    id: "applied_to_documents",
    label: "Bills Paid",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.applied_to_documents ?? 0,
    render: (item) => (
      <span className="text-sm tabular-nums text-center block text-muted-foreground">
        {item.applied_to_documents ?? "—"}
      </span>
    ),
    csvValue: (item) => String(item.applied_to_documents ?? ""),
  },
  {
    id: "payment_amount",
    label: "Amount",
    defaultVisible: true,

    sortable: true,
    sortValue: (item) => item.payment_amount ?? 0,
    render: (item) => (
      <span className="block text-right tabular-nums text-sm text-foreground">
        {formatCurrency(item.payment_amount)}
      </span>
    ),
    csvValue: (item) => String(item.payment_amount ?? 0),
  },
  {
    id: "description",
    label: "Description",
    defaultVisible: true,

    render: (item) => (
      <span className="text-sm text-muted-foreground" title={item.description ?? undefined}>
        {truncate(item.description, 40)}
      </span>
    ),
    csvValue: (item) => item.description ?? "",
  },
  {
    id: "payment_method",
    label: "Payment Method",
    defaultVisible: true,

    render: (item) => (
      <span className="text-sm text-foreground">{item.payment_method ?? "—"}</span>
    ),
    csvValue: (item) => item.payment_method ?? "",
  },
  {
    id: "payment_ref",
    label: "Payment Ref",
    defaultVisible: true,

    render: (item) => (
      <span className="text-sm text-foreground">{item.payment_ref ?? "—"}</span>
    ),
    csvValue: (item) => item.payment_ref ?? "",
  },
  {
    id: "cash_account",
    label: "Cash Account",
    defaultVisible: true,

    render: (item) => (
      <span className="text-sm text-foreground">{item.cash_account ?? "—"}</span>
    ),
    csvValue: (item) => item.cash_account ?? "",
  },
  {
    id: "currency_id",
    label: "Currency",
    defaultVisible: true,

    render: (item) => (
      <span className="text-sm text-foreground">{item.currency_id ?? "—"}</span>
    ),
    csvValue: (item) => item.currency_id ?? "",
  },
];

const DEFAULT_VISIBLE = COLUMNS.filter((c) => c.defaultVisible !== false).map((c) => c.id);

const STATUS_OPTIONS = ["Open", "Closed", "Hold", "Voided", "Printed", "Released"];

const FILTERS = [
  {
    id: "status",
    label: "Status",
    type: "select" as const,
    options: STATUS_OPTIONS.map((s) => ({ label: s, value: s })),
  },
  { id: "date_from", label: "Date From", type: "date" as const },
  { id: "date_to", label: "Date To", type: "date" as const },
  { id: "project", label: "Project", type: "text" as const },
  {
    id: "has_project",
    label: "Has Project",
    type: "select" as const,
    options: [
      { label: "With project", value: "yes" },
      { label: "No project assigned", value: "no" },
    ],
  },
];

const EMPTY_FILTERS: Record<string, FilterValue> = {
  status: undefined,
  date_from: undefined,
  date_to: undefined,
  project: undefined,
  has_project: undefined,
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ApChecksPage() {
  const router = useRouter();
  const pathname = usePathname()!;
  const searchParams = useSearchParams()!;

  const [checks, setChecks] = React.useState<ApCheck[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiFetch<ApCheck[]>("/api/accounting/checks")
      .then((data) => {
        if (!cancelled) {
          setChecks(data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Failed to load checks"));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const tableState = useUnifiedTableState({
    entityKey: "ap-checks-v2",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "application_date",
      sortDirection: "desc",
      visibleColumns: DEFAULT_VISIBLE,
      filters: EMPTY_FILTERS,
    },
  });

  const activeFilters = tableState.activeFilters as Record<string, FilterValue>;

  const handleFilterChange = (nextFilters: Record<string, FilterValue>) => {
    tableState.setActiveFilters(nextFilters);
    tableState.setSearchParams({
      status: typeof nextFilters.status === "string" ? nextFilters.status : null,
      page: "1",
    });
    tableState.setPage(1);
  };

  // Client-side filtering + search
  const filtered = React.useMemo(() => {
    let result = checks;
    const af = activeFilters;

    if (typeof af.status === "string" && af.status) {
      result = result.filter((c) => c.status === af.status);
    }

    if (typeof af.date_from === "string" && af.date_from) {
      result = result.filter((c) => (c.application_date ?? "") >= af.date_from!);
    }
    if (typeof af.date_to === "string" && af.date_to) {
      result = result.filter((c) => (c.application_date ?? "") <= af.date_to!);
    }

    if (typeof af.project === "string" && af.project) {
      const pq = af.project.toLowerCase();
      result = result.filter((c) =>
        (c.projects ?? []).some(
          (p) => p.name.toLowerCase().includes(pq) || (p.number ?? "").toLowerCase().includes(pq),
        ),
      );
    }

    if (typeof af.has_project === "string" && af.has_project) {
      if (af.has_project === "yes") {
        result = result.filter((c) => c.projects && c.projects.length > 0);
      } else if (af.has_project === "no") {
        result = result.filter((c) => !c.projects || c.projects.length === 0);
      }
    }

    const q = tableState.debouncedSearch.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (c) =>
          (c.reference_nbr ?? "").toLowerCase().includes(q) ||
          (c.vendor_name ?? "").toLowerCase().includes(q) ||
          (c.vendor_id ?? "").toLowerCase().includes(q) ||
          (c.description ?? "").toLowerCase().includes(q) ||
          (c.document_type ?? "").toLowerCase().includes(q) ||
          (c.projects ?? []).some((p) => p.name.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [checks, activeFilters, tableState.debouncedSearch]);

  // Client-side sorting
  const sorted = React.useMemo(() => {
    if (!tableState.sortBy) return filtered;
    const col = COLUMNS.find((c) => c.id === tableState.sortBy);
    if (!col?.sortValue) return filtered;
    return [...filtered].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av == null && bv == null) return 0;
      if (av == null) return tableState.sortDirection === "asc" ? -1 : 1;
      if (bv == null) return tableState.sortDirection === "asc" ? 1 : -1;
      if (typeof av === "number" && typeof bv === "number") {
        return tableState.sortDirection === "asc" ? av - bv : bv - av;
      }
      const cmp = String(av).localeCompare(String(bv));
      return tableState.sortDirection === "asc" ? cmp : -cmp;
    });
  }, [filtered, tableState.sortBy, tableState.sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / tableState.perPage));

  const totals = React.useMemo(() => {
    let totalAmount = 0;
    for (const c of sorted) totalAmount += c.payment_amount ?? 0;
    return { totalAmount };
  }, [sorted]);

  const isFiltered =
    Boolean(tableState.searchInput) ||
    Boolean(activeFilters.status) ||
    Boolean(activeFilters.project) ||
    Boolean(activeFilters.has_project);

  const handleSelectAll = (checked: boolean) => {
    tableState.setSelectedIds(checked ? sorted.map((c) => c.id) : []);
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    tableState.setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id),
    );
  };

  return (
    <UnifiedTablePage
      header={{
        title: "AP Checks",
        variant: "compact",
      }}
      toolbar={{
        totalItems: sorted.length,
        filteredItems: sorted.length,
        selectedCount: tableState.selectedIds.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search checks...",
        currentView: tableState.currentView,
        onViewChange: (view) => {
          tableState.setCurrentView(view);
          tableState.setSearchParams({ view });
        },
        filters: FILTERS,
        activeFilters,
        onFilterChange: handleFilterChange,
        onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
        columns: COLUMNS,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
      }}
      data={{
        items: sorted,
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
          tableState.setSearchParams({ sort: sortBy, sort_dir: direction, page: "1" });
          tableState.setPage(1);
        },
      }}
      selection={{
        selectedIds: tableState.selectedIds,
        onSelectAll: handleSelectAll,
        onSelectRow: handleSelectRow,
      }}
      emptyState={{
        title: "No checks found",
        description: "No AP checks have been synced from Acumatica yet.",
        filteredDescription: "Try adjusting your search or filters",
        isFiltered,
      }}
      footerTotals={{
        label: `Totals (${sorted.length})`,
        values: {
          payment_amount: (
            <span className="block text-right tabular-nums">
              {formatCurrency(totals.totalAmount)}
            </span>
          ),
        },
      }}
      pagination={{
        page: tableState.page,
        totalPages,
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
      features={{
        enableViews: false,
      }}
      layout={{
        toolbarInlineWithHeader: true,
      }}
    />
  );
}

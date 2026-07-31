"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Landmark } from "lucide-react";
import { StatusBadge } from "@/components/ds";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
  type TableColumn,
} from "@/components/tables/unified";
import { apiFetch } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApPayment {
  id: number;
  external_key: string;
  acumatica_check_id: number | null;
  payment_number: string | null;
  payment_ref: string | null;
  payment_method: string | null;
  payment_date: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  project_id: number | null;
  project_name: string | null;
  amount: number;
  status: string | null;
  source: string;
  acumatica_sync_at: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

const COLUMNS: TableColumn<ApPayment>[] = [
  {
    id: "payment_number",
    label: "Check #",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.payment_number ?? "",
    render: (item) =>
      item.payment_number ? (
        <span className="font-mono text-xs font-medium text-foreground">
          {item.payment_number}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    csvValue: (item) => item.payment_number ?? "",
  },
  {
    id: "vendor_name",
    label: "Vendor",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.vendor_name ?? item.vendor_id ?? "",
    render: (item) => (
      <span className="text-sm text-foreground">
        {item.vendor_name ?? item.vendor_id ?? "—"}
      </span>
    ),
    csvValue: (item) => item.vendor_name ?? item.vendor_id ?? "",
  },
  {
    id: "project_name",
    label: "Project",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.project_name ?? "",
    render: (item) => (
      <span className="text-sm text-foreground">
        {item.project_name ?? "—"}
      </span>
    ),
    csvValue: (item) => item.project_name ?? "",
  },
  {
    id: "payment_date",
    label: "Date",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.payment_date ?? "",
    render: (item) => (
      <span className="text-sm text-foreground">
        {formatDate(item.payment_date)}
      </span>
    ),
    csvValue: (item) => item.payment_date ?? "",
  },
  {
    id: "payment_method",
    label: "Method",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.payment_method ?? "",
    render: (item) => (
      <span className="text-sm text-muted-foreground">
        {item.payment_method ?? "—"}
      </span>
    ),
    csvValue: (item) => item.payment_method ?? "",
  },
  {
    id: "amount",
    label: "Amount",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.amount,
    render: (item) => (
      <span className="block text-right tabular-nums text-sm font-medium text-foreground">
        {formatCurrency(item.amount)}
      </span>
    ),
    csvValue: (item) => String(item.amount),
  },
  {
    id: "status",
    label: "Status",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.status ?? "",
    render: (item) =>
      item.status ? (
        <StatusBadge status={item.status} />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    csvValue: (item) => item.status ?? "",
  },
  {
    id: "payment_ref",
    label: "Ref",
    defaultVisible: false,
    sortable: true,
    sortValue: (item) => item.payment_ref ?? "",
    render: (item) => (
      <span className="text-sm text-muted-foreground">
        {item.payment_ref ?? "—"}
      </span>
    ),
    csvValue: (item) => item.payment_ref ?? "",
  },
  {
    id: "source",
    label: "Source",
    defaultVisible: false,
    sortable: true,
    sortValue: (item) => item.source,
    render: (item) => (
      <span className="text-sm text-muted-foreground">{item.source}</span>
    ),
    csvValue: (item) => item.source,
  },
];

const DEFAULT_VISIBLE = COLUMNS.filter((c) => c.defaultVisible !== false).map(
  (c) => c.id,
);

const FILTERS = [
  {
    id: "status",
    label: "Status",
    type: "select" as const,
    options: [
      { label: "Open", value: "Open" },
      { label: "Closed", value: "Closed" },
      { label: "Voided", value: "Voided" },
      { label: "Balanced", value: "Balanced" },
    ],
  },
  {
    id: "payment_method",
    label: "Method",
    type: "select" as const,
    options: [
      { label: "Check", value: "CHECK" },
      { label: "ACH", value: "ACH" },
      { label: "Wire", value: "WIRE" },
    ],
  },
  { id: "date_from", label: "Date From", type: "date" as const },
  { id: "date_to", label: "Date To", type: "date" as const },
];

const EMPTY_FILTERS: Record<string, FilterValue> = {
  status: undefined,
  payment_method: undefined,
  date_from: undefined,
  date_to: undefined,
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ApPaymentsPage() {
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = useSearchParams()!;

  const [payments, setPayments] = React.useState<ApPayment[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setFetchError(null);

    apiFetch<ApPayment[]>("/api/accounting/ap-payments")
      .then((data) => {
        if (!cancelled) {
          setPayments(data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFetchError(
            err instanceof Error
              ? err
              : new Error("Failed to load AP payments"),
          );
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const tableState = useUnifiedTableState({
    entityKey: "ap-payments-v1",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 50,
      search: "",
      sortBy: "payment_date",
      sortDirection: "desc",
      visibleColumns: DEFAULT_VISIBLE,
      filters: EMPTY_FILTERS,
    },
  });

  // Client-side search + filter
  const filteredPayments = React.useMemo(() => {
    let result = payments;
    const af = tableState.activeFilters;
    const search = tableState.debouncedSearch.toLowerCase();

    if (search) {
      result = result.filter(
        (p) =>
          (p.payment_number ?? "").toLowerCase().includes(search) ||
          (p.vendor_name ?? "").toLowerCase().includes(search) ||
          (p.vendor_id ?? "").toLowerCase().includes(search) ||
          (p.project_name ?? "").toLowerCase().includes(search) ||
          (p.payment_ref ?? "").toLowerCase().includes(search),
      );
    }

    if (typeof af.status === "string" && af.status) {
      result = result.filter(
        (p) => p.status?.toLowerCase() === (af.status as string).toLowerCase(),
      );
    }

    if (typeof af.payment_method === "string" && af.payment_method) {
      result = result.filter(
        (p) =>
          p.payment_method?.toLowerCase() ===
          (af.payment_method as string).toLowerCase(),
      );
    }

    if (typeof af.date_from === "string" && af.date_from) {
      result = result.filter(
        (p) => (p.payment_date ?? "") >= (af.date_from as string),
      );
    }
    if (typeof af.date_to === "string" && af.date_to) {
      result = result.filter(
        (p) => (p.payment_date ?? "") <= (af.date_to as string),
      );
    }

    return result;
  }, [payments, tableState.debouncedSearch, tableState.activeFilters]);

  // Client-side sort
  const sortedPayments = React.useMemo(() => {
    if (!tableState.sortBy) return filteredPayments;
    const col = COLUMNS.find((c) => c.id === tableState.sortBy);
    const getSortValue = col?.sortValue;
    if (!getSortValue) return filteredPayments;

    return [...filteredPayments].sort((a, b) => {
      const va = getSortValue(a);
      const vb = getSortValue(b);
      if (va == null && vb == null) return 0;
      if (va == null) return tableState.sortDirection === "asc" ? -1 : 1;
      if (vb == null) return tableState.sortDirection === "asc" ? 1 : -1;
      if (typeof va === "number" && typeof vb === "number") {
        return tableState.sortDirection === "asc" ? va - vb : vb - va;
      }
      const cmp = String(va).localeCompare(String(vb));
      return tableState.sortDirection === "asc" ? cmp : -cmp;
    });
  }, [filteredPayments, tableState.sortBy, tableState.sortDirection]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedPayments.length / tableState.perPage),
  );

  const isFiltered =
    Boolean(tableState.debouncedSearch) ||
    Boolean(tableState.activeFilters.status) ||
    Boolean(tableState.activeFilters.payment_method);

  const handleSelectAll = (checked: boolean) => {
    tableState.setSelectedIds(
      checked ? sortedPayments.map((p) => String(p.id)) : [],
    );
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    tableState.setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id),
    );
  };

  const handleFilterChange = (next: Record<string, FilterValue>) => {
    tableState.setActiveFilters(next);
    tableState.setPage(1);
  };

  const handleExport = () => {
    const headers = COLUMNS.filter((c) =>
      tableState.visibleColumns.includes(c.id),
    ).map((c) => c.label);

    const rows = sortedPayments.map((payment) =>
      COLUMNS.filter((c) => tableState.visibleColumns.includes(c.id)).map(
        (c) => c.csvValue?.(payment) ?? "",
      ),
    );

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ap-payments.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Footer total for amount
  const totalAmount = React.useMemo(
    () => sortedPayments.reduce((acc, p) => acc + p.amount, 0),
    [sortedPayments],
  );

  return (
    <UnifiedTablePage<ApPayment>
      header={{
        title: "AP Payments",
        variant: "compact",
      }}
      layout={{ fullBleedTable: false, toolbarInlineWithHeader: true }}
      toolbar={{
        totalItems: sortedPayments.length,
        filteredItems: sortedPayments.length,
        selectedCount: tableState.selectedIds.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search payments…",
        currentView: tableState.currentView,
        onViewChange: (view) => {
          tableState.setCurrentView(view);
          tableState.setSearchParams({ view });
        },
        filters: FILTERS,
        activeFilters: tableState.activeFilters,
        onFilterChange: handleFilterChange,
        onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
        columns: COLUMNS,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
        onExport: handleExport,
        onBulkDelete:
          tableState.selectedIds.length > 0 ? () => undefined : undefined,
      }}
      data={{
        items: sortedPayments,
        isLoading,
        error: fetchError,
      }}
      table={{
        columns: COLUMNS,
        getRowId: (item) => String(item.id),
        stickyHeader: true,
        density: "compact",
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
        title: "No AP payments found",
        description:
          "Acumatica AP checks imported as commitment payments will appear here.",
        filteredDescription: "Try adjusting your search or filters.",
        isFiltered,
        icon: <Landmark className="h-8 w-8 text-muted-foreground" />,
      }}
      pagination={{
        page: tableState.page,
        totalPages,
        perPage: tableState.perPage,
        clientSide: true,
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
      }}
      footerTotals={{
        label: `Totals (${sortedPayments.length})`,
        values: {
          amount: (
            <span className="block text-right font-semibold tabular-nums">
              {formatCurrency(totalAmount)}
            </span>
          ),
        },
      }}
      features={{
        enableViews: false,
      }}
    />
  );
}

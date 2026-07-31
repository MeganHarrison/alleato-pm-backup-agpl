"use client";

import * as React from "react";
import Link from "next/link";
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

interface ArPayment {
  id: string;
  external_key: string | null;
  reference_nbr: string | null;
  document_type: string | null;
  customer_id: string | null;
  customer_name: string | null;
  status: string | null;
  description: string | null;
  payment_method: string | null;
  payment_ref: string | null;
  external_ref: string | null;
  cash_account: string | null;
  currency_id: string | null;
  application_date: string | null;
  payment_amount: number | null;
  available_balance: number | null;
  last_modified_at: string | null;
  acumatica_sync_at: string | null;
  linked_invoices: Array<{ invoiceRef: string; amount: number }>;
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

const COLUMNS: TableColumn<ArPayment>[] = [
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
          href={`https://alleatogroup.acumatica.com/Main?ScreenId=AR302000&DocType=${encodeURIComponent(item.document_type ?? "Payment")}&RefNbr=${encodeURIComponent(item.reference_nbr)}`}
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
    id: "customer_id",
    label: "Customer ID",
    defaultVisible: true,

    sortable: true,
    sortValue: (item) => item.customer_id ?? "",
    render: (item) => (
      <span className="font-mono text-xs text-muted-foreground">
        {item.customer_id ?? "—"}
      </span>
    ),
    csvValue: (item) => item.customer_id ?? "",
  },
  {
    id: "customer_name",
    label: "Customer",
    defaultVisible: true,

    sortable: true,
    sortValue: (item) => item.customer_name ?? "",
    render: (item) => (
      <span className="text-sm text-foreground">{item.customer_name ?? "—"}</span>
    ),
    csvValue: (item) => item.customer_name ?? "",
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
    id: "available_balance",
    label: "Balance",
    defaultVisible: true,

    sortable: true,
    sortValue: (item) => item.available_balance ?? 0,
    render: (item) => (
      <span className="block text-right tabular-nums text-sm text-foreground">
        {formatCurrency(item.available_balance)}
      </span>
    ),
    csvValue: (item) => String(item.available_balance ?? 0),
  },
  {
    id: "linked_invoices",
    label: "Invoices",
    defaultVisible: true,
    render: (item) => {
      if (!item.linked_invoices?.length) return <span className="text-muted-foreground">—</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {item.linked_invoices.map((li) => (
            <Link
              key={li.invoiceRef}
              href={`/accounting/invoices?search=${li.invoiceRef}`}
              className="text-xs text-primary hover:underline"
            >
              #{li.invoiceRef}
            </Link>
          ))}
        </div>
      );
    },
    csvValue: (item) => item.linked_invoices?.map((li) => li.invoiceRef).join(", ") ?? "",
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

const STATUS_OPTIONS = ["Open", "Closed", "Hold", "Voided", "Balanced", "Released"];

const FILTERS = [
  {
    id: "status",
    label: "Status",
    type: "select" as const,
    options: STATUS_OPTIONS.map((s) => ({ label: s, value: s })),
  },
  {
    id: "balance",
    label: "Balance",
    type: "select" as const,
    options: [
      { label: "Has Balance", value: "positive" },
      { label: "Fully Applied", value: "zero" },
    ],
  },
  { id: "date_from", label: "Date From", type: "date" as const },
  { id: "date_to", label: "Date To", type: "date" as const },
];

const EMPTY_FILTERS: Record<string, FilterValue> = {
  status: undefined,
  balance: undefined,
  date_from: undefined,
  date_to: undefined,
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ArPaymentsPage() {
  const router = useRouter();
  const pathname = usePathname()!;
  const searchParams = useSearchParams()!;

  const [payments, setPayments] = React.useState<ArPayment[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiFetch<ArPayment[]>("/api/accounting/payments")
      .then((data) => {
        if (!cancelled) {
          setPayments(data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Failed to load payments"));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const tableState = useUnifiedTableState({
    entityKey: "ar-payments-v2",
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
    let result = payments;
    const af = activeFilters;

    if (typeof af.status === "string" && af.status) {
      result = result.filter((p) => p.status === af.status);
    }

    if (af.balance === "positive") {
      result = result.filter((p) => (p.available_balance ?? 0) > 0);
    } else if (af.balance === "zero") {
      result = result.filter((p) => (p.available_balance ?? 0) === 0);
    }

    if (typeof af.date_from === "string" && af.date_from) {
      result = result.filter((p) => (p.application_date ?? "") >= af.date_from!);
    }
    if (typeof af.date_to === "string" && af.date_to) {
      result = result.filter((p) => (p.application_date ?? "") <= af.date_to!);
    }

    const q = tableState.debouncedSearch.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (p) =>
          (p.reference_nbr ?? "").toLowerCase().includes(q) ||
          (p.customer_name ?? "").toLowerCase().includes(q) ||
          (p.customer_id ?? "").toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q) ||
          (p.document_type ?? "").toLowerCase().includes(q),
      );
    }

    return result;
  }, [payments, activeFilters, tableState.debouncedSearch]);

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

  // Totals for footer
  const totals = React.useMemo(() => {
    let totalAmount = 0;
    let totalBalance = 0;
    for (const p of sorted) {
      totalAmount += p.payment_amount ?? 0;
      totalBalance += p.available_balance ?? 0;
    }
    return { totalAmount, totalBalance };
  }, [sorted]);

  const isFiltered =
    Boolean(tableState.searchInput) || Boolean(activeFilters.status);

  const handleSelectAll = (checked: boolean) => {
    tableState.setSelectedIds(checked ? sorted.map((p) => p.id) : []);
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    tableState.setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id),
    );
  };

  return (
    <UnifiedTablePage
      header={{
        title: "AR Payments",
        variant: "compact",
      }}
      toolbar={{
        totalItems: sorted.length,
        filteredItems: sorted.length,
        selectedCount: tableState.selectedIds.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search payments...",
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
        title: "No payments found",
        description: "No AR payments have been synced from Acumatica yet.",
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
          available_balance: (
            <span className="block text-right tabular-nums">
              {formatCurrency(totals.totalBalance)}
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

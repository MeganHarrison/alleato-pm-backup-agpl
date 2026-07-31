"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowRight, FileText } from "lucide-react";
import { StatusBadge } from "@/components/ds";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
  type TableColumn,
} from "@/components/tables/unified";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ArInvoice {
  id: number;
  external_key: string;
  reference_nbr: string;
  type: string | null;
  status: string | null;
  date: string | null;
  due_date: string | null;
  customer: string | null;
  customer_name: string | null;
  project: string | null;
  project_description: string | null;
  description: string | null;
  amount: number | null;
  balance: number | null;
  linked_payments: Array<{ paymentRef: string; amount: number }>;
  currency_id: string | null;
  last_modified_at: string | null;
  acumatica_sync_at: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function truncate(value: string | null, max: number): string {
  if (!value) return "—";
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMPTY_FILTERS: Record<string, FilterValue> = {
  status: undefined,
  type: undefined,
  balance: undefined,
  date_from: undefined,
  date_to: undefined,
};

const DEFAULT_VISIBLE_COLUMNS = [
  "reference_nbr",
  "type",
  "status",
  "date",
  "due_date",
  "customer",
  "customer_name",
  "project",
  "description",
  "amount",
  "balance",
  "linked_payments",
  "currency_id",
  "last_modified_at",
];

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

const COLUMNS: TableColumn<ArInvoice>[] = [
  {
    id: "reference_nbr",
    label: "Ref #",
    defaultVisible: true,
    render: (item) => (
      <a
        href={`https://alleatogroup.acumatica.com/Main?ScreenId=AR301000&DocType=${encodeURIComponent(item.type ?? "Invoice")}&RefNbr=${encodeURIComponent(item.reference_nbr)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
      >
        {item.reference_nbr}
        <ArrowRight className="h-3 w-3" />
      </a>
    ),
    csvValue: (item) => item.reference_nbr,
    sortable: true,
    sortValue: (item) => item.reference_nbr,
  },
  {
    id: "type",
    label: "Type",
    defaultVisible: true,
    render: (item) => (
      <span className="text-foreground">{item.type ?? "—"}</span>
    ),
    csvValue: (item) => item.type ?? "",
    sortable: true,
    sortValue: (item) => item.type ?? "",
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
    id: "date",
    label: "Date",
    defaultVisible: true,
    render: (item) => (
      <span className="text-foreground">{formatDate(item.date)}</span>
    ),
    csvValue: (item) => item.date ?? "",
    sortable: true,
    sortValue: (item) => item.date ?? "",
  },
  {
    id: "due_date",
    label: "Due Date",
    defaultVisible: true,
    render: (item) => (
      <span className="text-foreground">{formatDate(item.due_date)}</span>
    ),
    csvValue: (item) => item.due_date ?? "",
    sortable: true,
    sortValue: (item) => item.due_date ?? "",
  },
  {
    id: "customer",
    label: "Customer ID",
    defaultVisible: true,
    render: (item) => (
      <span className="text-foreground">{item.customer ?? "—"}</span>
    ),
    csvValue: (item) => item.customer ?? "",
    sortable: true,
    sortValue: (item) => item.customer ?? "",
  },
  {
    id: "customer_name",
    label: "Customer Name",
    defaultVisible: true,
    render: (item) => (
      <span className="text-foreground">{item.customer_name ?? "—"}</span>
    ),
    csvValue: (item) => item.customer_name ?? "",
    sortable: true,
    sortValue: (item) => item.customer_name ?? "",
  },
  {
    id: "project",
    label: "Project",
    defaultVisible: true,
    render: (item) => (
      <span className="text-foreground truncate max-w-56 block">
        {item.project_description ?? item.project ?? "—"}
      </span>
    ),
    csvValue: (item) => item.project_description ? `${item.project} - ${item.project_description}` : (item.project ?? ""),
    sortable: true,
    sortValue: (item) => item.project ?? "",
  },
  {
    id: "description",
    label: "Description",
    defaultVisible: true,
    render: (item) => (
      <span className="text-muted-foreground" title={item.description ?? undefined}>
        {truncate(item.description, 40)}
      </span>
    ),
    csvValue: (item) => item.description ?? "",
  },
  {
    id: "amount",
    label: "Amount",
    defaultVisible: true,
    render: (item) => {
      const isCreditMemo = item.type === "Credit Memo";
      return (
        <span className={`text-right block tabular-nums ${isCreditMemo ? "text-destructive" : "text-foreground"}`}>
          {isCreditMemo && item.amount ? `(${formatCurrency(item.amount)})` : formatCurrency(item.amount)}
        </span>
      );
    },
    csvValue: (item) => String(item.amount ?? ""),
    sortable: true,
    sortValue: (item) => item.amount ?? 0,
  },
  {
    id: "balance",
    label: "Balance",
    defaultVisible: true,
    render: (item) => {
      const isCreditMemo = item.type === "Credit Memo";
      return (
        <span className={`text-right block tabular-nums ${isCreditMemo ? "text-destructive" : "text-foreground"}`}>
          {isCreditMemo && item.balance ? `(${formatCurrency(item.balance)})` : formatCurrency(item.balance)}
        </span>
      );
    },
    csvValue: (item) => String(item.balance ?? ""),
    sortable: true,
    sortValue: (item) => item.balance ?? 0,
  },
  {
    id: "linked_payments",
    label: "Payments",
    defaultVisible: true,
    render: (item) => {
      if (!item.linked_payments?.length) return <span className="text-muted-foreground">—</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {item.linked_payments.map((lp) => (
            <Link
              key={lp.paymentRef}
              href={`/accounting/payments?search=${lp.paymentRef}`}
              className="text-xs text-primary hover:underline"
            >
              #{lp.paymentRef}
            </Link>
          ))}
        </div>
      );
    },
    csvValue: (item) => item.linked_payments?.map((lp) => lp.paymentRef).join(", ") ?? "",
  },
  {
    id: "currency_id",
    label: "Currency",
    defaultVisible: true,
    render: (item) => (
      <span className="text-foreground">{item.currency_id ?? "—"}</span>
    ),
    csvValue: (item) => item.currency_id ?? "",
  },
  {
    id: "last_modified_at",
    label: "Last Modified",
    defaultVisible: true,
    render: (item) => (
      <span className="text-muted-foreground">{formatDateTime(item.last_modified_at)}</span>
    ),
    csvValue: (item) => item.last_modified_at ?? "",
    sortable: true,
    sortValue: (item) => item.last_modified_at ?? "",
  },
];

// ---------------------------------------------------------------------------
// Filter configs
// ---------------------------------------------------------------------------

const FILTERS = [
  {
    id: "status",
    label: "Status",
    type: "select" as const,
    options: [
      { label: "Open", value: "Open" },
      { label: "Closed", value: "Closed" },
      { label: "Hold", value: "Hold" },
      { label: "Voided", value: "Voided" },
      { label: "Credit Hold", value: "Credit Hold" },
    ],
  },
  {
    id: "type",
    label: "Type",
    type: "select" as const,
    options: [
      { label: "Invoice", value: "Invoice" },
      { label: "Credit Memo", value: "Credit Memo" },
      { label: "Debit Memo", value: "Debit Memo" },
    ],
  },
  {
    id: "balance",
    label: "Balance",
    type: "select" as const,
    options: [
      { label: "Has Balance", value: "positive" },
      { label: "Fully Paid", value: "zero" },
    ],
  },
  { id: "date_from", label: "Date From", type: "date" as const },
  { id: "date_to", label: "Date To", type: "date" as const },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ArInvoicesPage() {
  const router = useRouter();
  const searchParams = useSearchParams()!;
  const pathname = usePathname()!;

  const [invoices, setInvoices] = React.useState<ArInvoice[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiFetch("/api/accounting/invoices")
      .then((data: unknown) => {
        if (!cancelled) {
          setInvoices(Array.isArray(data) ? (data as ArInvoice[]) : []);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Failed to load invoices"));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const tableState = useUnifiedTableState({
    entityKey: "ar-invoices-v3",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 50,
      sortBy: "date",
      sortDirection: "desc",
      visibleColumns: DEFAULT_VISIBLE_COLUMNS,
      filters: EMPTY_FILTERS,
    },
  });

  // Client-side filtering
  const filtered = React.useMemo(() => {
    let result = invoices;
    const af = tableState.activeFilters;

    if (tableState.debouncedSearch) {
      const q = tableState.debouncedSearch.toLowerCase();
      result = result.filter(
        (inv) =>
          inv.reference_nbr.toLowerCase().includes(q) ||
          (inv.customer_name ?? "").toLowerCase().includes(q) ||
          (inv.customer ?? "").toLowerCase().includes(q) ||
          (inv.project ?? "").toLowerCase().includes(q) ||
          (inv.project_description ?? "").toLowerCase().includes(q) ||
          (inv.description ?? "").toLowerCase().includes(q),
      );
    }

    if (af.status) result = result.filter((inv) => inv.status === af.status);
    if (af.type) result = result.filter((inv) => inv.type === af.type);

    if (af.balance === "positive") {
      result = result.filter((inv) => (inv.balance ?? 0) > 0);
    } else if (af.balance === "zero") {
      result = result.filter((inv) => (inv.balance ?? 0) === 0);
    }

    if (typeof af.date_from === "string" && af.date_from) {
      result = result.filter((inv) => (inv.date ?? "") >= af.date_from!);
    }
    if (typeof af.date_to === "string" && af.date_to) {
      result = result.filter((inv) => (inv.date ?? "") <= af.date_to!);
    }

    return result;
  }, [invoices, tableState.debouncedSearch, tableState.activeFilters]);

  // Client-side sorting
  const sorted = React.useMemo(() => {
    if (!tableState.sortBy) return filtered;
    const col = COLUMNS.find((c) => c.id === tableState.sortBy);
    if (!col?.sortValue) return filtered;
    return [...filtered].sort((a, b) => {
      const av = col.sortValue!(a) ?? "";
      const bv = col.sortValue!(b) ?? "";
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return tableState.sortDirection === "desc" ? -cmp : cmp;
    });
  }, [filtered, tableState.sortBy, tableState.sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / tableState.perPage));

  // Totals for footer
  const totals = React.useMemo(() => {
    let totalAmount = 0;
    let totalBalance = 0;
    for (const inv of sorted) {
      if (inv.type === "Credit Memo") {
        totalAmount -= inv.amount ?? 0;
        totalBalance -= inv.balance ?? 0;
      } else {
        totalAmount += inv.amount ?? 0;
        totalBalance += inv.balance ?? 0;
      }
    }
    return { totalAmount, totalBalance };
  }, [sorted]);

  // CSV export
  const handleExport = React.useCallback(() => {
    const visibleCols = COLUMNS.filter((c) =>
      tableState.visibleColumns.includes(c.id),
    );
    const header = visibleCols.map((c) => c.label).join(",");
    const rows = sorted.map((item) =>
      visibleCols
        .map((c) => {
          const val = c.csvValue ? c.csvValue(item) : "";
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(","),
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ar-invoices.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [sorted, tableState.visibleColumns]);

  const isFiltered =
    !!tableState.debouncedSearch ||
    Object.values(tableState.activeFilters).some((v) => v !== undefined && v !== null && v !== "");

  return (
    <UnifiedTablePage
      header={{
        title: "AR Invoices",
        variant: "compact",
      }}
      toolbar={{
        totalItems: invoices.length,
        filteredItems: sorted.length,
        selectedCount: tableState.selectedIds.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search by ref, customer, project…",
        currentView: tableState.currentView,
        onViewChange: tableState.setCurrentView,
        filters: FILTERS,
        activeFilters: tableState.activeFilters as Record<string, string | number | boolean | string[] | null | undefined>,
        onFilterChange: (updates) =>
          tableState.setActiveFilters((prev) => ({ ...prev, ...updates })),
        onClearFilters: () => tableState.setActiveFilters(EMPTY_FILTERS),
        columns: COLUMNS,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: (cols) => tableState.setVisibleColumns(cols),
        onExport: handleExport,
      }}
      data={{
        items: sorted,
        isLoading,
        error,
      }}
      table={{
        columns: COLUMNS,
        getRowId: (item) => String(item.id),
        defaultPinnedLeftColumns: ["reference_nbr"],
        stickyHeader: true,
        density: "compact",
      }}
      sorting={{
        sortBy: tableState.sortBy,
        sortDirection: tableState.sortDirection,
        onSortChange: (col, dir) => {
          tableState.setSortBy(col);
          tableState.setSortDirection(dir);
        },
      }}
      selection={{
        selectedIds: tableState.selectedIds,
        onSelectAll: (checked) =>
          tableState.setSelectedIds(checked ? sorted.map((i) => String(i.id)) : []),
        onSelectRow: (id, checked) =>
          tableState.setSelectedIds((prev) =>
            checked ? [...prev, id] : prev.filter((s) => s !== id),
          ),
      }}
      emptyState={{
        title: "No invoices found",
        description: "AR invoices synced from Acumatica will appear here.",
        filteredDescription: "No invoices match your current search or filters.",
        isFiltered,
        icon: <FileText className="h-8 w-8 text-muted-foreground" />,
      }}
      footerTotals={{
        label: `Totals (${sorted.length})`,
        values: {
          amount: (
            <span className="block text-right tabular-nums">
              {formatCurrency(totals.totalAmount)}
            </span>
          ),
          balance: (
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
        onPageChange: tableState.setPage,
        onPerPageChange: (val) => tableState.setPerPage(Number(val)),
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

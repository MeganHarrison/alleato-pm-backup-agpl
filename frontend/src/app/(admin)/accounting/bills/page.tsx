"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, FileText } from "lucide-react";
import { StatusBadge } from "@/components/ds";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
  type TableColumn,
} from "@/components/tables/unified";
import { buildAcumaticaApBillHref } from "@/lib/acumatica/ap-bill-url";
import { apiFetch } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApBill {
  id: string;
  external_key: string | null;
  reference_nbr: string | null;
  document_type: string | null;
  vendor_id: string | null;
  vendor_ref: string | null;
  project_code: string | null;
  date: string | null;
  due_date: string | null;
  status: string | null;
  description: string | null;
  amount: number | null;
  balance: number | null;
  currency_id: string | null;
  terms: string | null;
  hold: boolean | null;
  approved_for_payment: boolean | null;
  last_modified_at: string | null;
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

function truncate(str: string | null | undefined, max: number): string {
  if (!str) return "—";
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

const COLUMNS: TableColumn<ApBill>[] = [
  {
    id: "reference_nbr",
    label: "Ref #",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.reference_nbr ?? "",
    render: (item) =>
      item.reference_nbr ? (
        <a
          href={buildAcumaticaApBillHref(
            item.document_type,
            item.reference_nbr,
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-mono text-xs font-medium text-primary hover:underline"
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
      <span className="text-sm text-muted-foreground">
        {item.document_type ?? "—"}
      </span>
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
      item.status ? (
        <StatusBadge status={item.status} />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    csvValue: (item) => item.status ?? "",
  },
  {
    id: "date",
    label: "Date",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.date ?? "",
    render: (item) => (
      <span className="text-sm text-foreground">{formatDate(item.date)}</span>
    ),
    csvValue: (item) => item.date ?? "",
  },
  {
    id: "due_date",
    label: "Due Date",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.due_date ?? "",
    render: (item) => (
      <span className="text-sm text-foreground">
        {formatDate(item.due_date)}
      </span>
    ),
    csvValue: (item) => item.due_date ?? "",
  },
  {
    id: "vendor_id",
    label: "Vendor",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.vendor_id ?? "",
    render: (item) => (
      <span className="text-sm text-foreground">{item.vendor_id ?? "—"}</span>
    ),
    csvValue: (item) => item.vendor_id ?? "",
  },
  {
    id: "project_code",
    label: "Project",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.project_code ?? "",
    render: (item) => (
      <span className="font-mono text-xs text-foreground">
        {item.project_code ?? "—"}
      </span>
    ),
    csvValue: (item) => item.project_code ?? "",
  },
  {
    id: "description",
    label: "Description",
    defaultVisible: true,
    render: (item) => (
      <span
        className="text-sm text-muted-foreground"
        title={item.description ?? undefined}
      >
        {truncate(item.description, 40)}
      </span>
    ),
    csvValue: (item) => item.description ?? "",
  },
  {
    id: "amount",
    label: "Amount",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.amount ?? 0,
    render: (item) => (
      <span className="block text-right tabular-nums text-sm font-medium text-foreground">
        {formatCurrency(item.amount)}
      </span>
    ),
    csvValue: (item) => String(item.amount ?? ""),
  },
  {
    id: "balance",
    label: "Balance",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.balance ?? 0,
    render: (item) => (
      <span className="block text-right tabular-nums text-sm text-foreground">
        {formatCurrency(item.balance)}
      </span>
    ),
    csvValue: (item) => String(item.balance ?? ""),
  },
  {
    id: "hold",
    label: "Hold",
    defaultVisible: true,
    render: (item) => (
      <span className="text-sm text-foreground">
        {item.hold == null ? "—" : item.hold ? "Yes" : "No"}
      </span>
    ),
    csvValue: (item) => (item.hold == null ? "" : item.hold ? "Yes" : "No"),
  },
  {
    id: "approved_for_payment",
    label: "Approved",
    defaultVisible: true,
    render: (item) => (
      <span className="text-sm text-foreground">
        {item.approved_for_payment == null
          ? "—"
          : item.approved_for_payment
            ? "Yes"
            : "No"}
      </span>
    ),
    csvValue: (item) =>
      item.approved_for_payment == null
        ? ""
        : item.approved_for_payment
          ? "Yes"
          : "No",
  },
  {
    id: "terms",
    label: "Terms",
    defaultVisible: true,
    render: (item) => (
      <span className="text-sm text-muted-foreground">{item.terms ?? "—"}</span>
    ),
    csvValue: (item) => item.terms ?? "",
  },
  {
    id: "currency_id",
    label: "Currency",
    defaultVisible: true,
    render: (item) => (
      <span className="text-sm text-muted-foreground">
        {item.currency_id ?? "—"}
      </span>
    ),
    csvValue: (item) => item.currency_id ?? "",
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
      { label: "Hold", value: "Hold" },
      { label: "Voided", value: "Voided" },
      { label: "Balanced", value: "Balanced" },
    ],
  },
  {
    id: "hold",
    label: "Hold",
    type: "select" as const,
    options: [
      { label: "On Hold", value: "true" },
      { label: "Not On Hold", value: "false" },
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

const EMPTY_FILTERS: Record<string, FilterValue> = {
  status: undefined,
  hold: undefined,
  balance: undefined,
  date_from: undefined,
  date_to: undefined,
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ApBillsPage() {
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = useSearchParams()!;

  const [bills, setBills] = React.useState<ApBill[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setFetchError(null);

    apiFetch<ApBill[]>("/api/accounting/bills")
      .then((data) => {
        if (!cancelled) {
          setBills(data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFetchError(
            err instanceof Error ? err : new Error("Failed to load AP bills"),
          );
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const tableState = useUnifiedTableState({
    entityKey: "ap-bills-v2",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 50,
      search: "",
      sortBy: "date",
      sortDirection: "desc",
      visibleColumns: DEFAULT_VISIBLE,
      filters: EMPTY_FILTERS,
    },
  });

  // Apply search + filters client-side (data is fully loaded in one request)
  const filteredBills = React.useMemo(() => {
    let result = bills;
    const af = tableState.activeFilters;

    const search = tableState.debouncedSearch.toLowerCase();
    if (search) {
      result = result.filter(
        (b) =>
          (b.reference_nbr ?? "").toLowerCase().includes(search) ||
          (b.vendor_id ?? "").toLowerCase().includes(search) ||
          (b.project_code ?? "").toLowerCase().includes(search) ||
          (b.description ?? "").toLowerCase().includes(search) ||
          (b.document_type ?? "").toLowerCase().includes(search),
      );
    }

    if (typeof af.status === "string" && af.status) {
      result = result.filter(
        (b) => b.status?.toLowerCase() === (af.status as string).toLowerCase(),
      );
    }

    if (typeof af.hold === "string" && af.hold) {
      const holdBool = af.hold === "true";
      result = result.filter((b) => b.hold === holdBool);
    }

    if (af.balance === "positive") {
      result = result.filter((b) => (b.balance ?? 0) > 0);
    } else if (af.balance === "zero") {
      result = result.filter((b) => (b.balance ?? 0) === 0);
    }

    if (typeof af.date_from === "string" && af.date_from) {
      result = result.filter((b) => (b.date ?? "") >= af.date_from!);
    }
    if (typeof af.date_to === "string" && af.date_to) {
      result = result.filter((b) => (b.date ?? "") <= af.date_to!);
    }

    return result;
  }, [bills, tableState.debouncedSearch, tableState.activeFilters]);

  // Client-side sort
  const sortedBills = React.useMemo(() => {
    if (!tableState.sortBy) return filteredBills;
    const col = COLUMNS.find((c) => c.id === tableState.sortBy);
    const getSortValue = col?.sortValue;
    if (!getSortValue) return filteredBills;

    return [...filteredBills].sort((a, b) => {
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
  }, [filteredBills, tableState.sortBy, tableState.sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedBills.length / tableState.perPage));

  const isFiltered =
    Boolean(tableState.debouncedSearch) ||
    Boolean(tableState.activeFilters.status) ||
    Boolean(tableState.activeFilters.hold);

  const handleSelectAll = (checked: boolean) => {
    tableState.setSelectedIds(
      checked ? sortedBills.map((b) => b.id) : [],
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

    const rows = sortedBills.map((bill) =>
      COLUMNS.filter((c) => tableState.visibleColumns.includes(c.id)).map(
        (c) => c.csvValue?.(bill) ?? "",
      ),
    );

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ap-bills.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Footer totals for amount + balance
  const totals = React.useMemo(
    () =>
      sortedBills.reduce(
        (acc, b) => ({
          amount: acc.amount + (b.amount ?? 0),
          balance: acc.balance + (b.balance ?? 0),
        }),
        { amount: 0, balance: 0 },
      ),
    [sortedBills],
  );

  return (
    <UnifiedTablePage<ApBill>
      header={{
        title: "AP Bills",
        variant: "compact",
      }}
      layout={{ fullBleedTable: false, toolbarInlineWithHeader: true }}
      toolbar={{
        totalItems: sortedBills.length,
        filteredItems: sortedBills.length,
        selectedCount: tableState.selectedIds.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search bills…",
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
        items: sortedBills,
        isLoading,
        error: fetchError,
      }}
      table={{
        columns: COLUMNS,
        getRowId: (item) => item.id,
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
        title: "No AP bills found",
        description: "No accounts payable bills have been synced from Acumatica yet.",
        filteredDescription: "Try adjusting your search or filters.",
        isFiltered,
        icon: <FileText className="h-8 w-8 text-muted-foreground" />,
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
        label: `Totals (${sortedBills.length})`,
        values: {
          amount: (
            <span className="block text-right font-semibold tabular-nums">
              {formatCurrency(totals.amount)}
            </span>
          ),
          balance: (
            <span className="block text-right font-semibold tabular-nums">
              {formatCurrency(totals.balance)}
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

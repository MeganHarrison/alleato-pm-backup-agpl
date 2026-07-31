"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileStack } from "lucide-react";
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

interface ApInvoice {
  id: number;
  acumatica_ap_bill_id: number | null;
  acumatica_ref_nbr: string | null;
  acumatica_doc_type: string | null;
  invoice_number: string | null;
  vendor_id: string | null;
  project_id: number | null;
  project_name: string | null;
  billing_date: string | null;
  status: string;
  amount: number | null;
  notes: string | null;
  subcontract_id: string | null;
  purchase_order_id: string | null;
  acumatica_sync_at: string | null;
  created_at: string;
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

const COLUMNS: TableColumn<ApInvoice>[] = [
  {
    id: "acumatica_ref_nbr",
    label: "Ref #",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.acumatica_ref_nbr ?? "",
    render: (item) =>
      item.acumatica_ref_nbr ? (
        <span className="font-mono text-xs font-medium text-foreground">
          {item.acumatica_ref_nbr}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    csvValue: (item) => item.acumatica_ref_nbr ?? "",
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
    id: "project_name",
    label: "Project",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.project_name ?? "",
    render: (item) => (
      <span className="text-sm text-foreground">{item.project_name ?? "—"}</span>
    ),
    csvValue: (item) => item.project_name ?? "",
  },
  {
    id: "billing_date",
    label: "Bill Date",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.billing_date ?? "",
    render: (item) => (
      <span className="text-sm text-foreground">{formatDate(item.billing_date)}</span>
    ),
    csvValue: (item) => item.billing_date ?? "",
  },
  {
    id: "status",
    label: "Status",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.status,
    render: (item) => <StatusBadge status={item.status} />,
    csvValue: (item) => item.status,
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
    id: "invoice_number",
    label: "Invoice #",
    defaultVisible: true,
    sortable: true,
    sortValue: (item) => item.invoice_number ?? "",
    render: (item) => (
      <span className="text-sm text-muted-foreground">
        {item.invoice_number ?? "—"}
      </span>
    ),
    csvValue: (item) => item.invoice_number ?? "",
  },
  {
    id: "notes",
    label: "Notes",
    defaultVisible: true,
    render: (item) => (
      <span
        className="text-sm text-muted-foreground"
        title={item.notes ?? undefined}
      >
        {truncate(item.notes, 60)}
      </span>
    ),
    csvValue: (item) => item.notes ?? "",
  },
  {
    id: "acumatica_doc_type",
    label: "Doc Type",
    defaultVisible: false,
    sortable: true,
    sortValue: (item) => item.acumatica_doc_type ?? "",
    render: (item) => (
      <span className="text-sm text-muted-foreground">
        {item.acumatica_doc_type ?? "—"}
      </span>
    ),
    csvValue: (item) => item.acumatica_doc_type ?? "",
  },
  {
    id: "subcontract_id",
    label: "Subcontract",
    defaultVisible: false,
    render: (item) => (
      <span className="font-mono text-xs text-muted-foreground">
        {truncate(item.subcontract_id, 20)}
      </span>
    ),
    csvValue: (item) => item.subcontract_id ?? "",
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
      { label: "Draft", value: "draft" },
      { label: "Pending", value: "pending" },
      { label: "Approved", value: "approved" },
      { label: "Paid", value: "paid" },
      { label: "Void", value: "void" },
    ],
  },
  { id: "date_from", label: "Date From", type: "date" as const },
  { id: "date_to", label: "Date To", type: "date" as const },
];

const EMPTY_FILTERS: Record<string, FilterValue> = {
  status: undefined,
  date_from: undefined,
  date_to: undefined,
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ApInvoicesPage() {
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = useSearchParams()!;

  const [invoices, setInvoices] = React.useState<ApInvoice[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setFetchError(null);

    apiFetch<ApInvoice[]>("/api/accounting/ap-invoices")
      .then((data) => {
        if (!cancelled) {
          setInvoices(data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFetchError(
            err instanceof Error
              ? err
              : new Error("Failed to load AP invoices"),
          );
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const tableState = useUnifiedTableState({
    entityKey: "ap-invoices-v1",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 50,
      search: "",
      sortBy: "billing_date",
      sortDirection: "desc",
      visibleColumns: DEFAULT_VISIBLE,
      filters: EMPTY_FILTERS,
    },
  });

  // Client-side search + filter
  const filteredInvoices = React.useMemo(() => {
    let result = invoices;
    const af = tableState.activeFilters;
    const search = tableState.debouncedSearch.toLowerCase();

    if (search) {
      result = result.filter(
        (inv) =>
          (inv.acumatica_ref_nbr ?? "").toLowerCase().includes(search) ||
          (inv.vendor_id ?? "").toLowerCase().includes(search) ||
          (inv.project_name ?? "").toLowerCase().includes(search) ||
          (inv.invoice_number ?? "").toLowerCase().includes(search) ||
          (inv.notes ?? "").toLowerCase().includes(search),
      );
    }

    if (typeof af.status === "string" && af.status) {
      result = result.filter((inv) => inv.status === af.status);
    }

    if (typeof af.date_from === "string" && af.date_from) {
      result = result.filter(
        (inv) => (inv.billing_date ?? "") >= (af.date_from as string),
      );
    }
    if (typeof af.date_to === "string" && af.date_to) {
      result = result.filter(
        (inv) => (inv.billing_date ?? "") <= (af.date_to as string),
      );
    }

    return result;
  }, [invoices, tableState.debouncedSearch, tableState.activeFilters]);

  // Client-side sort
  const sortedInvoices = React.useMemo(() => {
    if (!tableState.sortBy) return filteredInvoices;
    const col = COLUMNS.find((c) => c.id === tableState.sortBy);
    const getSortValue = col?.sortValue;
    if (!getSortValue) return filteredInvoices;

    return [...filteredInvoices].sort((a, b) => {
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
  }, [filteredInvoices, tableState.sortBy, tableState.sortDirection]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedInvoices.length / tableState.perPage),
  );

  const isFiltered =
    Boolean(tableState.debouncedSearch) ||
    Boolean(tableState.activeFilters.status);

  const handleSelectAll = (checked: boolean) => {
    tableState.setSelectedIds(
      checked ? sortedInvoices.map((inv) => String(inv.id)) : [],
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

    const rows = sortedInvoices.map((inv) =>
      COLUMNS.filter((c) => tableState.visibleColumns.includes(c.id)).map(
        (c) => c.csvValue?.(inv) ?? "",
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
    a.download = "ap-invoices.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Footer total for amount
  const totalAmount = React.useMemo(
    () => sortedInvoices.reduce((acc, inv) => acc + (inv.amount ?? 0), 0),
    [sortedInvoices],
  );

  return (
    <UnifiedTablePage<ApInvoice>
      header={{
        title: "AP Invoices",
        variant: "compact",
      }}
      layout={{ fullBleedTable: false, toolbarInlineWithHeader: true }}
      toolbar={{
        totalItems: sortedInvoices.length,
        filteredItems: sortedInvoices.length,
        selectedCount: tableState.selectedIds.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search invoices…",
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
        items: sortedInvoices,
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
        title: "No AP invoices found",
        description:
          "Acumatica AP bills projected to subcontractor invoices will appear here.",
        filteredDescription: "Try adjusting your search or filters.",
        isFiltered,
        icon: <FileStack className="h-8 w-8 text-muted-foreground" />,
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
        label: `Totals (${sortedInvoices.length})`,
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

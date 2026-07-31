"use client";

import * as React from "react";
import type { ReactElement } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
} from "@/components/tables/unified";
import {
  buildCommitmentFilters,
  buildCommitmentTableColumns,
  buildPrimeFilters,
  buildPrimeTableColumns,
  commitmentColumns,
  commitmentDefaultVisibleColumns,
  primeColumns,
  primeDefaultVisibleColumns,
  renderCommitmentCard,
  renderCommitmentList,
  renderPrimeCard,
  renderPrimeList,
  renderRowActions,
  type CommitmentCO,
  type PrimeContractCO,
} from "@/features/change-orders/change-orders-table-config";

import { PageActions } from "./page-actions";
import { formatCurrency } from "@/lib/format";
import { apiFetch } from "@/lib/api-client";
import { useConfirmationDialog } from "@/components/common/ConfirmationDialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActiveTab = "prime" | "commitment";

interface ChangeOrdersClientProps {
  projectId: string;
  primeCOs: PrimeContractCO[];
  commitmentCOs: CommitmentCO[];
}

type COFilterState = Record<string, FilterValue>;

const EMPTY_FILTERS: COFilterState = { status: undefined };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function matchesStatus(itemStatus: string | null, filter: string): boolean {
  const normalized = (itemStatus ?? "").toLowerCase();
  if (filter === "pending")
    return normalized === "pending" || normalized === "submitted";
  return normalized === filter;
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function openPdfExportWindow({
  title,
  rows,
}: {
  title: string;
  rows: Array<Record<string, string | number | null | undefined>>;
}) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    toast.error("Could not open PDF export window", {
      description: "Allow pop-ups for this site, then try exporting again.",
    });
    return;
  }

  const headers = Object.keys(rows[0] ?? { Notice: "No change orders found" });
  const safeRows =
    rows.length > 0 ? rows : [{ Notice: "No change orders found" }];

  printWindow.document.write(`<!doctype html>
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; margin: 32px; }
          h1 { font-size: 22px; margin: 0 0 8px; }
          p { color: #4b5563; font-size: 12px; margin: 0 0 20px; }
          table { border-collapse: collapse; width: 100%; font-size: 11px; }
          th, td { border-bottom: 1px solid #e5e7eb; padding: 8px; text-align: left; vertical-align: top; }
          th { background: #f9fafb; color: #374151; font-weight: 600; }
          td.amount { text-align: right; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p>Generated from the Change Orders view.</p>
        <table>
          <thead>
            <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${safeRows
              .map(
                (row) =>
                  `<tr>${headers
                    .map((header) => {
                      const isAmount = header.toLowerCase().includes("amount");
                      return `<td class="${isAmount ? "amount" : ""}">${escapeHtml(row[header])}</td>`;
                    })
                    .join("")}</tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </body>
    </html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChangeOrdersClient({
  projectId,
  primeCOs,
  commitmentCOs,
}: ChangeOrdersClientProps): ReactElement {
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = useSearchParams()!;

  const activeTab: ActiveTab =
    searchParams.get("tab") === "commitment" ? "commitment" : "prime";

  // --- Prime tab state -------------------------------------------------------
  const primeTableState = useUnifiedTableState({
    entityKey: "prime-cos",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table", "card", "list"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "created_at",
      sortDirection: "desc",
      visibleColumns: primeDefaultVisibleColumns,
      filters: EMPTY_FILTERS,
    },
  });

  // --- Commitment tab state --------------------------------------------------
  const commitmentTableState = useUnifiedTableState({
    entityKey: "commitment-cos",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table", "card", "list"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "created_at",
      sortDirection: "desc",
      visibleColumns: commitmentDefaultVisibleColumns,
      filters: EMPTY_FILTERS,
    },
  });

  // --- Delete confirmation dialogs -------------------------------------------
  const primeDeleteDialog = useConfirmationDialog({
    title: "Delete Change Order",
    description:
      "Are you sure you want to delete this prime contract change order? This action cannot be undone.",
    confirmLabel: "Delete",
    variant: "destructive",
  });

  const commitmentDeleteDialog = useConfirmationDialog({
    title: "Delete Change Order",
    description:
      "Are you sure you want to delete this commitment change order? This action cannot be undone.",
    confirmLabel: "Delete",
    variant: "destructive",
  });

  // Mobile viewport detection
  const [isMobileViewport, setIsMobileViewport] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsMobileViewport(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Force list view on mobile
  const ts = activeTab === "prime" ? primeTableState : commitmentTableState;
  React.useEffect(() => {
    if (!isMobileViewport || ts.currentView !== "table") return;
    ts.setCurrentView("list");
    ts.setSearchParams({ view: "list" });
  }, [isMobileViewport, ts]);

  // --- Tabs ------------------------------------------------------------------
  const buildTabHref = (tab: ActiveTab): string => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    return `/${projectId}/change-orders?${params.toString()}`;
  };

  const tabs = [
    {
      label: "Prime Contract",
      href: buildTabHref("prime"),
      count: primeCOs.length,
      isActive: activeTab === "prime",
    },
    {
      label: "Commitments",
      href: buildTabHref("commitment"),
      count: commitmentCOs.length,
      isActive: activeTab === "commitment",
    },
  ];

  // --- Table columns (memoized) ----------------------------------------------
  const primeTableColumns = React.useMemo(() => buildPrimeTableColumns(), []);
  const commitmentTableColumns = React.useMemo(
    () => buildCommitmentTableColumns(),
    [],
  );
  const primeFilters = React.useMemo(() => buildPrimeFilters(), []);
  const commitmentFilters = React.useMemo(() => buildCommitmentFilters(), []);

  // --- Filtering: Prime ------------------------------------------------------
  const primeActiveFilters = primeTableState.activeFilters as COFilterState;

  const filteredPrime = React.useMemo(() => {
    const statusFilter =
      typeof primeActiveFilters.status === "string"
        ? primeActiveFilters.status.toLowerCase()
        : "";
    const executedFilter =
      typeof primeActiveFilters.executed === "string"
        ? primeActiveFilters.executed
        : "";
    const search = primeTableState.debouncedSearch.trim().toLowerCase();

    return primeCOs.filter((co) => {
      if (statusFilter && !matchesStatus(co.status, statusFilter)) return false;
      if (executedFilter === "yes" && !co.executed) return false;
      if (executedFilter === "no" && co.executed) return false;
      if (
        search &&
        !(co.pcco_number ?? "").toLowerCase().includes(search) &&
        !(co.title ?? "").toLowerCase().includes(search)
      )
        return false;
      return true;
    });
  }, [primeCOs, primeActiveFilters, primeTableState.debouncedSearch]);

  // --- Filtering: Commitment -------------------------------------------------
  const commitmentActiveFilters =
    commitmentTableState.activeFilters as COFilterState;

  const filteredCommitment = React.useMemo(() => {
    const statusFilter =
      typeof commitmentActiveFilters.status === "string"
        ? commitmentActiveFilters.status.toLowerCase()
        : "";
    const search = commitmentTableState.debouncedSearch.trim().toLowerCase();

    return commitmentCOs.filter((co) => {
      if (statusFilter && !matchesStatus(co.status, statusFilter)) return false;
      if (
        search &&
        !(co.change_order_number ?? "").toLowerCase().includes(search) &&
        !(co.description ?? "").toLowerCase().includes(search)
      )
        return false;
      return true;
    });
  }, [
    commitmentCOs,
    commitmentActiveFilters,
    commitmentTableState.debouncedSearch,
  ]);

  // --- Totals ----------------------------------------------------------------
  const primeTotalAmount = React.useMemo(
    () => filteredPrime.reduce((sum, co) => sum + (co.total_amount ?? 0), 0),
    [filteredPrime],
  );
  const commitmentTotalAmount = React.useMemo(
    () => filteredCommitment.reduce((sum, co) => sum + (co.amount ?? 0), 0),
    [filteredCommitment],
  );

  // --- Navigation handlers ---------------------------------------------------
  const handleViewPrime = (co: PrimeContractCO) => {
    router.push(`/${projectId}/change-orders/prime/${co.id}`);
  };
  const handleEditPrime = (co: PrimeContractCO) => {
    router.push(`/${projectId}/change-orders/prime/${co.id}?edit=1`);
  };
  const handleDeletePrime = (co: PrimeContractCO) => {
    primeDeleteDialog.confirm(async () => {
      try {
        await apiFetch(
          `/api/projects/${projectId}/prime-contract-change-orders/${co.id}`,
          { method: "DELETE" },
        );
        toast.success("Change order deleted");
        router.refresh();
      } catch (err) {
        toast.error("Could not delete change order", {
          description:
            err instanceof Error ? err.message : "an unexpected error occurred",
        });
      }
    });
  };

  const handleViewCommitment = (co: CommitmentCO) => {
    router.push(`/${projectId}/change-orders/commitment/${co.id}`);
  };
  const handleEditCommitment = (co: CommitmentCO) => {
    router.push(`/${projectId}/change-orders/commitment/${co.id}?edit=1`);
  };
  const handleDeleteCommitment = (co: CommitmentCO) => {
    if (!co.contract_id) {
      toast.error("Missing contract reference");
      return;
    }
    commitmentDeleteDialog.confirm(async () => {
      try {
        await apiFetch(
          `/api/commitments/${co.contract_id}/change-orders/${co.id}`,
          { method: "DELETE" },
        );
        toast.success("Change order deleted");
        router.refresh();
      } catch (err) {
        toast.error("Could not delete change order", {
          description:
            err instanceof Error ? err.message : "an unexpected error occurred",
        });
      }
    });
  };

  // --- Export handlers --------------------------------------------------------
  const handleExportPrime = React.useCallback(() => {
    const headers = [
      "PCCO #",
      "Title",
      "Status",
      "Amount",
      "Executed",
      "Due Date",
      "Submitted",
      "Approved",
      "Created",
    ];
    const rows = filteredPrime.map((co) => [
      co.pcco_number ?? "",
      co.title ?? "",
      co.status ?? "",
      String(co.total_amount ?? 0),
      co.executed ? "Yes" : "No",
      co.due_date ?? "",
      co.submitted_at ?? "",
      co.approved_at ?? "",
      co.created_at ?? "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prime-contract-change-orders.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(
      `Exported ${filteredPrime.length} prime contract CO${filteredPrime.length === 1 ? "" : "s"}`,
    );
  }, [filteredPrime]);

  const handleExportPrimePdf = React.useCallback(() => {
    openPdfExportWindow({
      title: "Prime Contract Change Orders",
      rows: filteredPrime.map((co) => ({
        "PCCO #": co.pcco_number ?? "",
        Title: co.title ?? "",
        Status: co.status ?? "",
        Amount: formatCurrency(co.total_amount ?? 0),
        Executed: co.executed ? "Yes" : "No",
        "Due Date": co.due_date ?? "",
        Submitted: co.submitted_at ?? "",
        Approved: co.approved_at ?? "",
        Created: co.created_at ?? "",
      })),
    });
  }, [filteredPrime]);

  const handleExportCommitment = React.useCallback(() => {
    const headers = [
      "CO #",
      "Title",
      "Status",
      "Amount",
      "Contract",
      "Due Date",
      "Requested",
      "Approved",
      "Created",
    ];
    const rows = filteredCommitment.map((co) => [
      co.change_order_number ?? "",
      co.title ?? co.description ?? "",
      co.status ?? "",
      String(co.amount ?? 0),
      co.contract_id ?? "",
      co.due_date ?? "",
      co.requested_date ?? "",
      co.approved_date ?? "",
      co.created_at ?? "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "commitment-change-orders.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(
      `Exported ${filteredCommitment.length} commitment CO${filteredCommitment.length === 1 ? "" : "s"}`,
    );
  }, [filteredCommitment]);

  const handleExportCommitmentPdf = React.useCallback(() => {
    openPdfExportWindow({
      title: "Commitment Change Orders",
      rows: filteredCommitment.map((co) => ({
        "CO #": co.change_order_number ?? "",
        Title: co.title ?? co.description ?? "",
        Status: co.status ?? "",
        Amount: formatCurrency(co.amount ?? 0),
        Contract: co.contract_id ?? "",
        "Due Date": co.due_date ?? "",
        Requested: co.requested_date ?? "",
        Approved: co.approved_date ?? "",
        Created: co.created_at ?? "",
      })),
    });
  }, [filteredCommitment]);

  // --- Filter change handler -------------------------------------------------
  const handleFilterChange = (
    tableState: ReturnType<typeof useUnifiedTableState>,
    nextFilters: COFilterState,
  ) => {
    tableState.setActiveFilters(nextFilters);
    tableState.setSearchParams({
      status:
        typeof nextFilters.status === "string" ? nextFilters.status : null,
      executed:
        typeof nextFilters.executed === "string" ? nextFilters.executed : null,
      page: "1",
    });
    tableState.setPage(1);
  };

  // --- Render ----------------------------------------------------------------

  if (activeTab === "prime") {
    const isPrimeFiltered =
      Boolean(primeTableState.searchInput) ||
      Boolean(primeActiveFilters.status) ||
      Boolean(primeActiveFilters.executed);

    return (
      <>
        {primeDeleteDialog.dialog}
        {commitmentDeleteDialog.dialog}
        <UnifiedTablePage
          header={{
            title: "Change Orders",
            description: (
              <>
                This view shows potential change orders and related Prime
                contract change orders. Manage all change orders directly from
                the{" "}
                <Link
                  href={`/${projectId}/prime-contracts`}
                  className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
                >
                  Prime contract tool
                </Link>
                .
              </>
            ),
            actions: (
              <PageActions
                onExportCsv={handleExportPrime}
                onExportPdf={handleExportPrimePdf}
              />
            ),
          }}
          tabs={tabs}
          toolbar={{
            totalItems: primeCOs.length,
            filteredItems: filteredPrime.length,
            searchValue: primeTableState.searchInput,
            onSearchChange: primeTableState.setSearchInput,
            searchPlaceholder: "Search prime contract COs...",
            currentView: isMobileViewport
              ? "list"
              : primeTableState.currentView,
            onViewChange: (view) => {
              if (isMobileViewport) return;
              primeTableState.setCurrentView(view);
              primeTableState.setSearchParams({ view });
            },
            enabledViews: ["table", "card", "list"],
            filters: primeFilters,
            activeFilters: primeActiveFilters,
            onFilterChange: (f) =>
              handleFilterChange(primeTableState, f as COFilterState),
            onClearFilters: () =>
              handleFilterChange(primeTableState, EMPTY_FILTERS),
            columns: primeColumns,
            visibleColumns: primeTableState.visibleColumns,
            onColumnVisibilityChange: primeTableState.setVisibleColumns,
            onExport: undefined,
          }}
          data={{ items: filteredPrime, isLoading: false, isFetching: false }}
          table={{
            columns: primeTableColumns,
            getRowId: (item) => String(item.id),
            onRowClick: handleViewPrime,
            rowActions: (item) =>
              renderRowActions(
                item,
                handleViewPrime,
                handleEditPrime,
                handleDeletePrime,
              ),
          }}
          sorting={{
            sortBy: primeTableState.sortBy,
            sortDirection: primeTableState.sortDirection,
            onSortChange: (sortBy, direction) => {
              primeTableState.setSortBy(sortBy);
              primeTableState.setSortDirection(direction);
              primeTableState.setSearchParams({
                sort: sortBy,
                sort_dir: direction,
              });
            },
          }}
          views={{
            card: (item) => renderPrimeCard(item, handleViewPrime),
            list: (item) => renderPrimeList(item, handleViewPrime),
          }}
          layout={{
            cardGridClassName: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 justify-items-center",
          }}
          footerTotals={{
            label: "Totals",
            values: {
              amount: (
                <span className="font-semibold">
                  {formatCurrency(primeTotalAmount)}
                </span>
              ),
            },
          }}
          emptyState={{
            title: "No prime contract change orders",
            description:
              "No prime contract change orders found for this project.",
            filteredDescription: "Try adjusting your search or filters.",
            isFiltered: isPrimeFiltered,
          }}
          features={{
            enableExport: false,
            enableBulkDelete: false,
            enableRowSelection: false,
          }}
        />
      </>
    );
  }

  // Commitment tab
  const isCommitmentFiltered =
    Boolean(commitmentTableState.searchInput) ||
    Boolean(commitmentActiveFilters.status);

  return (
    <>
      {primeDeleteDialog.dialog}
      {commitmentDeleteDialog.dialog}
      <UnifiedTablePage
        header={{
          title: "Change Orders",
          description: (
            <>
              This view shows all potential change orders related to the prime
              contract and commitment. Manage all change orders directly from
              the{" "}
              <Link
                href={`/${projectId}/prime-contracts`}
                className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
              >
                prime contract tool
              </Link>{" "}
              or{" "}
              <Link
                href={`/${projectId}/commitments`}
                className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
              >
                commitment tool
              </Link>
              .
            </>
          ),
          actions: (
            <PageActions
              onExportCsv={handleExportCommitment}
              onExportPdf={handleExportCommitmentPdf}
            />
          ),
        }}
        tabs={tabs}
        toolbar={{
          totalItems: commitmentCOs.length,
          filteredItems: filteredCommitment.length,
          searchValue: commitmentTableState.searchInput,
          onSearchChange: commitmentTableState.setSearchInput,
          searchPlaceholder: "Search commitment COs...",
          currentView: isMobileViewport
            ? "list"
            : commitmentTableState.currentView,
          onViewChange: (view) => {
            if (isMobileViewport) return;
            commitmentTableState.setCurrentView(view);
            commitmentTableState.setSearchParams({ view });
          },
          enabledViews: ["table", "card", "list"],
          filters: commitmentFilters,
          activeFilters: commitmentActiveFilters,
          onFilterChange: (f) =>
            handleFilterChange(commitmentTableState, f as COFilterState),
          onClearFilters: () =>
            handleFilterChange(commitmentTableState, EMPTY_FILTERS),
          columns: commitmentColumns,
          visibleColumns: commitmentTableState.visibleColumns,
          onColumnVisibilityChange: commitmentTableState.setVisibleColumns,
          onExport: undefined,
        }}
        data={{
          items: filteredCommitment,
          isLoading: false,
          isFetching: false,
        }}
        table={{
          columns: commitmentTableColumns,
          getRowId: (item) => String(item.id),
          onRowClick: handleViewCommitment,
          rowActions: (item) =>
            renderRowActions(
              item,
              handleViewCommitment,
              handleEditCommitment,
              handleDeleteCommitment,
            ),
        }}
        sorting={{
          sortBy: commitmentTableState.sortBy,
          sortDirection: commitmentTableState.sortDirection,
          onSortChange: (sortBy, direction) => {
            commitmentTableState.setSortBy(sortBy);
            commitmentTableState.setSortDirection(direction);
            commitmentTableState.setSearchParams({
              sort: sortBy,
              sort_dir: direction,
            });
          },
        }}
          views={{
            card: (item) => renderCommitmentCard(item, handleViewCommitment),
            list: (item) => renderCommitmentList(item, handleViewCommitment),
          }}
          layout={{
            cardGridClassName: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 justify-items-center",
          }}
        footerTotals={{
          label: "Totals",
          values: {
            amount: (
              <span className="font-semibold">
                {formatCurrency(commitmentTotalAmount)}
              </span>
            ),
          },
        }}
        emptyState={{
          title: "No commitment change orders",
          description: "No commitment change orders found for this project.",
          filteredDescription: "Try adjusting your search or filters.",
          isFiltered: isCommitmentFiltered,
        }}
        features={{
          enableExport: false,
          enableBulkDelete: false,
          enableRowSelection: false,
        }}
      />
    </>
  );
}

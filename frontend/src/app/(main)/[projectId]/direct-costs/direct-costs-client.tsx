"use client";

import * as React from "react";
import type { ReactElement } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MoreVertical } from "lucide-react";
import { UnifiedTablePage, useUnifiedTableState, type FilterValue } from "@/components/tables/unified";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  type CostCodeDetailRow,
  DEFAULT_COST_CODE_VISIBLE_COLUMNS,
  DEFAULT_VISIBLE_COLUMNS,
  DIRECT_COST_FILTERS,
  SUMMARY_COLUMNS,
  formatAmount,
  formatDate,
} from "./direct-costs-table-utils";
import { CostCodeHierarchyView } from "./cost-code-hierarchy-view";
import { DirectCostPreviewPane } from "./direct-cost-preview-pane";

import { ExportDialog } from "@/components/direct-costs/ExportDialog";
import { buildAcumaticaApBillHref } from "@/lib/acumatica/ap-bill-url";

export type DirectCostRow = {
  id: string;
  date: string;
  invoice_number: string | null;
  cost_type: string;
  status: string;
  description: string | null;
  total_amount: number;
  received_date: string | null;
  paid_date: string | null;
  created_at: string;
  updated_at: string;
  vendor: { name: string } | null;
  acumatica_ref_nbr: string | null;
  acumatica_doc_type: string | null;
  acumatica_sync_at: string | null;
};

type DirectCostFilterState = Record<string, FilterValue>;
type SummaryTab = "summary" | "cost-code";

interface DirectCostsClientProps {
  projectId: string;
  projectName: string;
  directCosts: DirectCostRow[];
  costCodeDetails: CostCodeDetailRow[];
}

const EMPTY_FILTERS: DirectCostFilterState = {
  status: undefined,
  costType: undefined,
  dateFrom: undefined,
  dateTo: undefined,
  minAmount: undefined,
  maxAmount: undefined,
};

function hasAllVisibleColumns(current: string[], required: string[]): boolean {
  return required.every((column) => current.includes(column));
}

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function statusDotColor(status: string): string {
  switch (status) {
    case "Approved":
      return "bg-emerald-500";
    case "Revise and Resubmit":
      return "bg-rose-500";
    case "Pending":
      return "bg-amber-500";
    default:
      return "bg-muted-foreground";
  }
}

export function DirectCostsClient({
  projectId,
  projectName,
  directCosts,
  costCodeDetails,
}: DirectCostsClientProps): ReactElement {
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = useSearchParams()!;
  const summaryTab: SummaryTab = searchParams.get("summary_view") === "cost-code" ? "cost-code" : "summary";

  const tableState = useUnifiedTableState({
    entityKey: "direct-costs",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table", "list"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: summaryTab === "summary" ? "date" : null,
      sortDirection: summaryTab === "summary" ? "desc" : "asc",
      visibleColumns: summaryTab === "summary" ? DEFAULT_VISIBLE_COLUMNS : DEFAULT_COST_CODE_VISIBLE_COLUMNS,
      filters: {
        status: searchParams.get("status") || undefined,
        costType: searchParams.get("costType") || undefined,
        dateFrom: searchParams.get("date_from") || undefined,
        dateTo: searchParams.get("date_to") || undefined,
        minAmount: searchParams.get("amount_min") || undefined,
        maxAmount: searchParams.get("amount_max") || undefined,
      },
    },
  });

  const [isExportDialogOpen, setIsExportDialogOpen] = React.useState(false);
  // Start as null = "not yet detected". Treated as mobile until first measurement to
  // prevent the desktop fallback (auto-selecting first row) from briefly firing on mobile.
  const [isMobileViewport, setIsMobileViewport] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (summaryTab !== "summary") return;

    const nextFilters: DirectCostFilterState = {
      status: searchParams.get("status") || undefined,
      costType: searchParams.get("costType") || undefined,
      dateFrom: searchParams.get("date_from") || undefined,
      dateTo: searchParams.get("date_to") || undefined,
      minAmount: searchParams.get("amount_min") || undefined,
      maxAmount: searchParams.get("amount_max") || undefined,
    };

    tableState.setActiveFilters((prev) => {
      if (
        prev.status === nextFilters.status &&
        prev.costType === nextFilters.costType &&
        prev.dateFrom === nextFilters.dateFrom &&
        prev.dateTo === nextFilters.dateTo &&
        prev.minAmount === nextFilters.minAmount &&
        prev.maxAmount === nextFilters.maxAmount
      ) {
        return prev;
      }
      return nextFilters;
    });
  }, [searchParams, summaryTab, tableState.setActiveFilters]);

  React.useEffect(() => {
    const requiredColumns = summaryTab === "summary" ? DEFAULT_VISIBLE_COLUMNS : DEFAULT_COST_CODE_VISIBLE_COLUMNS;
    if (!hasAllVisibleColumns(tableState.visibleColumns, requiredColumns)) {
      tableState.setVisibleColumns(requiredColumns);
    }
  }, [summaryTab, tableState.visibleColumns, tableState.setVisibleColumns]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const applyViewport = (): void => setIsMobileViewport(mediaQuery.matches);

    applyViewport();
    mediaQuery.addEventListener("change", applyViewport);
    return () => mediaQuery.removeEventListener("change", applyViewport);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (summaryTab !== "summary") return;
    if (!isMobileViewport) return;
    if (tableState.currentView !== "table") return;

    tableState.setCurrentView("list");
    tableState.setSearchParams({ view: "list" });
  }, [
    isMobileViewport,
    summaryTab,
    tableState.currentView,
    tableState.setCurrentView,
    tableState.setSearchParams,
  ]);

  const buildTabHref = (tab: SummaryTab): string => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "cost-code") params.set("summary_view", "cost-code");
    if (tab === "summary") params.delete("summary_view");
    return params.toString() ? `/${projectId}/direct-costs?${params.toString()}` : `/${projectId}/direct-costs`;
  };

  const tabs = [
    { label: "Summary", href: buildTabHref("summary"), isActive: summaryTab === "summary" },
    { label: "Summary by Cost Code", href: buildTabHref("cost-code"), isActive: summaryTab === "cost-code" },
  ];

  const activeFilters = tableState.activeFilters as DirectCostFilterState;

  const filteredSummaryItems = React.useMemo(() => {
    const searchValue = tableState.debouncedSearch.trim().toLowerCase();
    const statusFilter = normalize(activeFilters.status);
    const typeFilter = normalize(activeFilters.costType);
    const dateFromFilter = typeof activeFilters.dateFrom === "string" ? activeFilters.dateFrom : "";
    const dateToFilter = typeof activeFilters.dateTo === "string" ? activeFilters.dateTo : "";
    const minAmount = activeFilters.minAmount !== undefined && activeFilters.minAmount !== "" ? Number(activeFilters.minAmount) : null;
    const maxAmount = activeFilters.maxAmount !== undefined && activeFilters.maxAmount !== "" ? Number(activeFilters.maxAmount) : null;

    return directCosts.filter((item) => {
      const normalizedItemStatus = normalize(item.status);
      const normalizedItemCostType = normalize(item.cost_type);

      if (statusFilter && statusFilter !== "all" && normalizedItemStatus !== statusFilter) return false;
      if (typeFilter && typeFilter !== "all" && normalizedItemCostType !== typeFilter) return false;

      if (dateFromFilter && item.date < dateFromFilter) return false;
      if (dateToFilter && item.date > dateToFilter) return false;
      if (Number.isFinite(minAmount) && item.total_amount < (minAmount as number)) return false;
      if (Number.isFinite(maxAmount) && item.total_amount > (maxAmount as number)) return false;

      if (!searchValue) return true;

      const dateDisplay = formatDate(item.date).toLowerCase();
      const receivedDisplay = formatDate(item.received_date).toLowerCase();
      const paidDisplay = formatDate(item.paid_date).toLowerCase();
      const amountDisplay = formatAmount(item.total_amount).toLowerCase();
      const searchable = [
        item.vendor?.name ?? "",
        item.description ?? "",
        item.invoice_number ?? "",
        item.status,
        item.cost_type,
        item.date,
        dateDisplay,
        receivedDisplay,
        paidDisplay,
        amountDisplay,
        String(item.total_amount),
      ].join(" ").toLowerCase();

      return searchable.includes(searchValue);
    });
  }, [
    activeFilters.costType,
    activeFilters.dateFrom,
    activeFilters.dateTo,
    activeFilters.maxAmount,
    activeFilters.minAmount,
    activeFilters.status,
    directCosts,
    tableState.debouncedSearch,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredSummaryItems.length / tableState.perPage));

  React.useEffect(() => {
    if (tableState.page > totalPages) {
      tableState.setPage(totalPages);
      tableState.setSearchParams({ page: String(totalPages) });
    }
  }, [tableState.page, tableState.setPage, tableState.setSearchParams, totalPages]);

  const selectedSet = React.useMemo(() => new Set(tableState.selectedIds), [tableState.selectedIds]);
  const detailParam = tableState.detailParam;
  const selectedDirectCost = detailParam
    ? filteredSummaryItems.find((item) => item.id === detailParam) ?? null
    : null;
  // On mobile (or before viewport detection), never auto-select the first row — only
  // highlight an explicitly chosen record. This prevents the mobile detail overlay from
  // covering the list on initial page load.
  const isDesktop = isMobileViewport === false;
  const activeDirectCostId = isDesktop
    ? (selectedDirectCost?.id ?? filteredSummaryItems[0]?.id ?? null)
    : (selectedDirectCost?.id ?? null);

  const applyFilters = (nextFilters: DirectCostFilterState): void => {
    tableState.setActiveFilters(nextFilters);
    tableState.setSearchParams({
      status: typeof nextFilters.status === "string" ? nextFilters.status : null,
      costType: typeof nextFilters.costType === "string" ? nextFilters.costType : null,
      date_from: typeof nextFilters.dateFrom === "string" ? nextFilters.dateFrom : null,
      date_to: typeof nextFilters.dateTo === "string" ? nextFilters.dateTo : null,
      amount_min: typeof nextFilters.minAmount === "string" ? nextFilters.minAmount : null,
      amount_max: typeof nextFilters.maxAmount === "string" ? nextFilters.maxAmount : null,
      page: "1",
    });
    tableState.setPage(1);
  };

  const handleFilterChange = (nextFilters: DirectCostFilterState): void => {
    applyFilters(nextFilters);
  };

  const handleOpenDetailPage = React.useCallback(
    (item: DirectCostRow): void => {
      router.push(`/${projectId}/direct-costs/${item.id}`);
    },
    [projectId, router],
  );

  const handleSummaryRowClick = React.useCallback(
    (item: DirectCostRow): void => {
      if (isMobileViewport) {
        handleOpenDetailPage(item);
        return;
      }

      tableState.setSearchParams({ detail: item.id });
    },
    [handleOpenDetailPage, isMobileViewport, tableState],
  );

  const handleSummaryTableKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, visibleItems: DirectCostRow[]): void => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(target.tagName)) {
        return;
      }

      if (event.key !== "Enter") return;

      if (visibleItems.length === 0) {
        event.preventDefault();
        return;
      }

      const currentIndex = activeDirectCostId
        ? visibleItems.findIndex((item) => item.id === activeDirectCostId)
        : -1;
      const fallbackIndex = currentIndex >= 0 ? currentIndex : 0;
      const currentItem = visibleItems[fallbackIndex];
      if (!currentItem) return;

      event.preventDefault();
      handleOpenDetailPage(currentItem);
    },
    [activeDirectCostId, handleOpenDetailPage],
  );

  const summaryTableColumns = React.useMemo(
    () => [
      {
        id: "date",
        label: "Date",
        defaultVisible: true,
        render: (item: DirectCostRow) => <span className="font-medium text-foreground">{formatDate(item.date)}</span>,
        sortValue: (item: DirectCostRow) => item.date,
      },
      {
        id: "vendor",
        label: "Vendor",
        defaultVisible: true,
        render: (item: DirectCostRow) => item.vendor?.name ?? "Internal",
        sortValue: (item: DirectCostRow) => item.vendor?.name ?? "",
      },
      {
        id: "cost_type",
        label: "Type",
        defaultVisible: true,
        render: (item: DirectCostRow) => item.cost_type,
        sortValue: (item: DirectCostRow) => item.cost_type,
      },
      {
        id: "status",
        label: "Status",
        defaultVisible: true,
        render: (item: DirectCostRow) => (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`h-2 w-2 shrink-0 rounded-full ${statusDotColor(item.status)}`} />
            {item.status}
          </span>
        ),
        sortValue: (item: DirectCostRow) => item.status,
      },
      {
        id: "erp_status",
        label: "ERP Status",
        defaultVisible: false,
        render: (item: DirectCostRow) => {
          if (!item.acumatica_sync_at) {
            return <span className="text-xs text-muted-foreground">Not synced</span>;
          }
          const refLabel = item.acumatica_ref_nbr
            ? `${item.acumatica_doc_type ? `${item.acumatica_doc_type} ` : ""}${item.acumatica_ref_nbr}`
            : "Synced";
          const acumaticaUrl = item.acumatica_ref_nbr
            ? buildAcumaticaApBillHref(item.acumatica_doc_type, item.acumatica_ref_nbr)
            : null;
          return acumaticaUrl ? (
            <a
              href={acumaticaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline-offset-4 hover:underline"
            >
              {refLabel}
            </a>
          ) : (
            <Badge variant="outline">{refLabel}</Badge>
          );
        },
        sortValue: (item: DirectCostRow) => item.acumatica_sync_at ?? "",
      },
      {
        id: "total_amount",
        label: "Amount",
        defaultVisible: true,
        render: (item: DirectCostRow) => <span className="tabular-nums text-muted-foreground">{formatAmount(item.total_amount)}</span>,
        sortValue: (item: DirectCostRow) => item.total_amount,
      },
      {
        id: "received_date",
        label: "Received",
        defaultVisible: false,
        render: (item: DirectCostRow) => formatDate(item.received_date),
        sortValue: (item: DirectCostRow) => item.received_date,
      },
      {
        id: "paid_date",
        label: "Paid",
        defaultVisible: false,
        render: (item: DirectCostRow) => formatDate(item.paid_date),
        sortValue: (item: DirectCostRow) => item.paid_date,
      },
      {
        id: "description",
        label: "Description",
        defaultVisible: false,
        render: (item: DirectCostRow) => <span className="max-w-48 truncate block">{item.description ?? "-"}</span>,
        sortValue: (item: DirectCostRow) => item.description ?? "",
      },
      {
        id: "invoice_number",
        label: "Invoice #",
        defaultVisible: true,
        render: (item: DirectCostRow) => item.invoice_number ?? "-",
        sortValue: (item: DirectCostRow) => item.invoice_number ?? "",
      },
    ],
    [],
  );

  const renderSummaryListItem = React.useCallback(
    (item: DirectCostRow): ReactElement => (
      <Button
        type="button"
        variant="outline"
        onClick={() => handleSummaryRowClick(item)}
        className="w-full rounded-lg bg-background p-3 text-left transition-colors hover:bg-muted/30 h-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm font-medium text-foreground">
              {item.vendor?.name ?? "Internal"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {item.invoice_number ?? "No invoice"} · {item.cost_type}
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
            {formatAmount(item.total_amount)}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`h-2 w-2 shrink-0 rounded-full ${statusDotColor(item.status)}`} />
            {item.status}
          </span>
          <span className="text-xs text-muted-foreground">{formatDate(item.date)}</span>
        </div>
      </Button>
    ),
    [handleSummaryRowClick],
  );


  const summaryTotal = React.useMemo(
    () => filteredSummaryItems.reduce((sum, item) => sum + (item.total_amount ?? 0), 0),
    [filteredSummaryItems],
  );

  const summaryIsFiltered =
    Boolean(tableState.searchInput) ||
    Boolean(activeFilters.status) ||
    Boolean(activeFilters.costType) ||
    Boolean(activeFilters.dateFrom) ||
    Boolean(activeFilters.dateTo) ||
    Boolean(activeFilters.minAmount) ||
    Boolean(activeFilters.maxAmount);

  if (summaryTab === "cost-code") {
    return (
      <CostCodeHierarchyView
        projectName={projectName}
        tabs={tabs}
        costCodeDetails={costCodeDetails}
        searchValue={tableState.searchInput}
        onSearchChange={tableState.setSearchInput}
        currentView={tableState.currentView}
        onViewChange={tableState.setCurrentView}
        visibleColumns={tableState.visibleColumns}
        onColumnVisibilityChange={tableState.setVisibleColumns}
        onView={(costId) => router.push(`/${projectId}/direct-costs/${costId}`)}
      />
    );
  }

  return (
    <>
      <UnifiedTablePage
        header={{
          title: "Direct Costs",
        }}
        layout={{
          headerAlignment: "left",
        }}
        tabs={tabs}
        toolbar={{
          totalItems: directCosts.length,
          filteredItems: filteredSummaryItems.length,
          selectedCount: tableState.selectedIds.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search vendor, invoice, date, amount, status...",
          currentView: isMobileViewport ? "list" : tableState.currentView,
          onViewChange: (view) => {
            if (isMobileViewport) {
              tableState.setCurrentView("list");
              tableState.setSearchParams({ view: "list" });
              return;
            }
            tableState.setCurrentView(view);
            tableState.setSearchParams({ view });
          },
          enabledViews: ["table", "list"],
          filters: DIRECT_COST_FILTERS,
          activeFilters,
          onFilterChange: handleFilterChange,
          onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
          columns: SUMMARY_COLUMNS,
          visibleColumns: tableState.visibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
          onExport: () => setIsExportDialogOpen(true),
          mobilePanelActions: undefined,
          onBulkDelete: undefined,
        }}
        topContent={undefined}
        data={{ items: filteredSummaryItems, isLoading: false, isFetching: false }}
        table={{
          columns: summaryTableColumns,
          getRowId: (item) => item.id,
          activeRowId: activeDirectCostId,
          onTableKeyDown: handleSummaryTableKeyDown,
          stickyHeader: true,
          onRowClick: handleSummaryRowClick,
          rowActions: (item) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push(`/${projectId}/direct-costs/${item.id}`)}>
                  View
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ),
        }}
        views={{
          list: renderSummaryListItem,
        }}
        sidePanel={{
          content: (
            <DirectCostPreviewPane
              directCost={selectedDirectCost ?? filteredSummaryItems[0] ?? null}
              onOpenDirectCostPage={handleOpenDetailPage}
            />
          ),
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
          onSelectAll: (checked) => {
            if (checked) {
              tableState.setSelectedIds(filteredSummaryItems.map((item) => item.id));
              return;
            }
            tableState.setSelectedIds([]);
          },
          onSelectRow: (id, checked) => {
            if (checked) {
              if (selectedSet.has(id)) return;
              tableState.setSelectedIds((prev) => [...prev, id]);
              return;
            }
            tableState.setSelectedIds((prev) => prev.filter((itemId) => itemId !== id));
          },
        }}
        footerTotals={{
          label: "Totals",
          values: {
            total_amount: <span className="tabular-nums">{formatAmount(summaryTotal)}</span>,
          },
        }}
        emptyState={{
          title: "No direct costs found",
          description: "No synced direct costs found for this project.",
          filteredDescription: "Try adjusting your search or filters.",
          isFiltered: summaryIsFiltered,
          action: undefined,
        }}
        pagination={{
          page: tableState.page,
          totalPages,
          perPage: tableState.perPage,
          clientSide: true,
          onPageChange: (page) => {
            tableState.setPage(page);
            tableState.setSearchParams({ page: String(page) });
          },
          onPerPageChange: (nextPerPage) => {
            tableState.setPerPage(Number(nextPerPage));
            tableState.setPage(1);
            tableState.setSearchParams({ per_page: nextPerPage, page: "1" });
          },
        }}
      />

      <ExportDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        projectId={Number(projectId)}
        selectedCostIds={tableState.selectedIds.length > 0 ? tableState.selectedIds : undefined}
      />
    </>
  );
}

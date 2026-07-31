"use client";

import * as React from "react";
import type { ReactElement } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Plus, Settings } from "lucide-react";
import {
  StatusBadge,
  SplitButton,
  InlineTable,
  InlineTableHeader,
  InlineTableHeaderRow,
  InlineTableHeaderCell,
  InlineTableBody,
  InlineTableRow,
  InlineTableCell,
} from "@/components/ds";
import { CreatePrimeContractFromEstimateModal } from "@/components/domain/contracts/CreatePrimeContractFromEstimateModal";
import { TableCell, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
} from "@/components/tables/unified";
import { useProjectTitle } from "@/hooks/useProjectTitle";
import {
  buildPrimeContractTableColumns,
  formatCurrency,
  primeContractColumns,
  primeContractDefaultVisibleColumns,
  primeContractFilters,
  renderPrimeContractCard,
  renderPrimeContractList,
  renderPrimeContractRowActions,
  type PccoSummary,
  type PcoSummary,
} from "@/features/prime-contracts/prime-contracts-table-config";
import { type PrimeContract } from "@/lib/validation/prime-contracts";
import { fetchWithTransientRouteRetry } from "@/lib/fetch-with-transient-route-retry";
import { apiFetch, summarizeBulkResults } from "@/lib/api-client";
import { usePrimeContracts, primeContractKeys } from "@/hooks/use-prime-contracts";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

const EMPTY_FILTERS: Record<string, FilterValue> = {
  status: undefined,
  executed: undefined,
  client_name: undefined,
};

type FilterState = Record<string, FilterValue>;

type ContractStatus = NonNullable<PrimeContract["status"]>;

type PrimeContractChangeOrderRow = {
  id: number;
  contract_id: string | null;
  prime_contract_id: string | null;
  pcco_number: string | null;
  title: string | null;
  status: string | null;
  total_amount: number | null;
};

type PrimeContractChangeOrdersResponse =
  | PrimeContractChangeOrderRow[]
  | { data: PrimeContractChangeOrderRow[] };

/** Normalizes prime contract change order API payloads into a consistent array shape. */
function normalizePrimeContractChangeOrders(
  payload: PrimeContractChangeOrdersResponse,
): PrimeContractChangeOrderRow[] {
  return Array.isArray(payload) ? payload : payload.data;
}

export default function ProjectContractsPage(): ReactElement {
  const router = useRouter();
  const pathname = usePathname()!;
  const searchParams = (useSearchParams() ?? new URLSearchParams()) as NonNullable<ReturnType<typeof useSearchParams>>;
  const params = useParams<{ projectId: string }>()! ?? { projectId: "" };
  const projectId = params.projectId ?? "";
  const projectIdNumber = Number(projectId);
  const queryClient = useQueryClient();

  useProjectTitle("Prime Contracts");

  const [createFromEstimateOpen, setCreateFromEstimateOpen] = React.useState(false);

  const initialStatus = searchParams.get("status") ?? "";
  const initialExecuted = searchParams.get("executed") ?? "";
  const initialClientName = searchParams.get("client_name") ?? "";
  const initialFilters: FilterState = {
    status: initialStatus || undefined,
    executed: initialExecuted || undefined,
    client_name: initialClientName || undefined,
  };

  const tableState = useUnifiedTableState({
    entityKey: "prime-contracts",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "contract_number",
      sortDirection: "asc",
      filters: initialFilters,
    },
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [contractToDelete, setContractToDelete] = React.useState<PrimeContract | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = React.useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);

  // Expandable sub-rows (PCCOs + PCOs)
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  const [pccoCache, setPccoCache] = React.useState<
    Record<string, { loading: boolean; data: PccoSummary[]; pcos: PcoSummary[] }>
  >({});

  const toggleExpand = React.useCallback(
    async (contractId: string) => {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(contractId)) {
          next.delete(contractId);
        } else {
          next.add(contractId);
        }
        return next;
      });

      // Fetch PCCOs + PCOs if not cached
      if (!pccoCache[contractId]) {
        setPccoCache((prev) => ({ ...prev, [contractId]: { loading: true, data: [], pcos: [] } }));
        try {
          const [pccosResult, pcosResult] = await Promise.allSettled([
            apiFetch<PrimeContractChangeOrdersResponse>(
              `/api/projects/${projectId}/prime-contract-change-orders`,
            ),
            apiFetch<PcoSummary[]>(
              `/api/projects/${projectId}/prime-contract-pcos?prime_contract_id=${encodeURIComponent(contractId)}`,
            ),
          ]);

          const allPccos =
            pccosResult.status === "fulfilled"
              ? normalizePrimeContractChangeOrders(pccosResult.value)
              : [];
          const allPcos = pcosResult.status === "fulfilled" ? pcosResult.value : [];

          const filteredPccos = allPccos.filter((p) => {
            const linkedContractId = p.prime_contract_id ?? p.contract_id;
            return linkedContractId == null || String(linkedContractId) === String(contractId);
          });

          const filteredPcos = allPcos.filter(
            (p) => !p.prime_contract_id || String(p.prime_contract_id) === String(contractId),
          );

          setPccoCache((prev) => ({
            ...prev,
            [contractId]: { loading: false, data: filteredPccos, pcos: filteredPcos },
          }));
        } catch {
          setPccoCache((prev) => ({ ...prev, [contractId]: { loading: false, data: [], pcos: [] } }));
        }
      }
    },
    [pccoCache, projectId],
  );

  React.useEffect(() => {
    const nextStatus = searchParams.get("status") ?? "";
    const normalizedStatus = nextStatus || undefined;

    tableState.setActiveFilters((prev) => {
      if (prev.status === normalizedStatus) return prev;
      return { status: normalizedStatus };
    });
  }, [searchParams, tableState.setActiveFilters]);

  React.useEffect(() => {
    if (tableState.visibleColumns.length === 0) {
      tableState.setVisibleColumns(primeContractDefaultVisibleColumns);
    }
  }, [tableState.visibleColumns.length, tableState.setVisibleColumns]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth >= 768) return;
    if (tableState.currentView !== "table") return;

    tableState.setCurrentView("list");
    tableState.setSearchParams({ view: "list" });
  }, [tableState.currentView, tableState.setCurrentView, tableState.setSearchParams]);

  const activeFilters = tableState.activeFilters as FilterState;

  const statusFilter = activeFilters.status as ContractStatus | undefined;
  const executedFilter = activeFilters.executed as string | undefined;
  const clientNameFilter = activeFilters.client_name as string | undefined;
  const searchTerm = tableState.debouncedSearch.trim().toLowerCase();
  const {
    data: contracts = [],
    isLoading,
    error: contractsError,
  } = usePrimeContracts(projectIdNumber, {
    status: statusFilter,
    search: searchTerm || undefined,
  });

  React.useEffect(() => {
    if (!contractsError) return;
    toast.error("Failed to load contracts");
  }, [contractsError]);

  React.useEffect(() => {
    if (!projectId || contracts.length === 0) return;

    // Warm routes/endpoints once so first navigation doesn't race module compilation.
    const firstContractId = contracts[0]?.id;
    if (!firstContractId) return;

    router.prefetch(`/${projectId}/prime-contracts/${firstContractId}`);
    void Promise.allSettled([
      fetchWithTransientRouteRetry(
        `/api/projects/${projectId}/contracts/settings`,
      ),
      fetchWithTransientRouteRetry(
        `/api/projects/${projectId}/contracts/${firstContractId}`,
      ),
      fetchWithTransientRouteRetry(
        `/api/projects/${projectId}/contracts/${firstContractId}/line-items`,
      ),
    ]);
  }, [contracts, projectId, router]);

  // Build dynamic client_name filter options from loaded data
  const dynamicFilters = React.useMemo(() => {
    const uniqueClientNames = Array.from(
      new Set(contracts.map((c) => c.client?.name).filter((n): n is string => Boolean(n)))
    ).sort();

    return [
      ...primeContractFilters,
      {
        id: "client_name",
        label: "Owner/Client",
        type: "select" as const,
        options: uniqueClientNames.map((name) => ({ value: name, label: name })),
      },
    ];
  }, [contracts]);

  const filteredContracts = contracts.filter((contract) => {
    if (statusFilter && contract.status !== statusFilter) return false;
    if (executedFilter === "yes" && !contract.executed) return false;
    if (executedFilter === "no" && contract.executed) return false;
    if (clientNameFilter && contract.client?.name !== clientNameFilter) return false;
    if (!searchTerm) return true;

    const fields = [
      contract.contract_number ?? "",
      contract.title ?? "",
      contract.client?.name ?? "",
    ];

    return fields.some((field) => field.toLowerCase().includes(searchTerm));
  });

  // Inline cell edits (Title / Executed / Start Date / End Date / Private in
  // table view). Persists directly and refreshes the cache. No toast here —
  // UnifiedTablePage shows its own per-cell confirmation on commit.
  const handleInlineUpdate = React.useCallback(
    async (contractId: string, data: Record<string, unknown>) => {
      await apiFetch<void>(
        `/api/projects/${projectId}/contracts/${contractId}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        },
      );
      await queryClient.invalidateQueries({
        queryKey: primeContractKeys.all(projectIdNumber),
      });
    },
    [projectId, projectIdNumber, queryClient],
  );

  const tableColumns = React.useMemo(
    () => buildPrimeContractTableColumns({ onUpdate: handleInlineUpdate }),
    [handleInlineUpdate],
  );
  const sortedContracts = React.useMemo(() => {
    if (!tableState.sortBy) return filteredContracts;
    const sortColumn = tableColumns.find((column) => column.id === tableState.sortBy);
    const getSortValue = sortColumn?.sortValue;
    if (!getSortValue) return filteredContracts;

    const sorted = [...filteredContracts].sort((a, b) => {
      const valueA = getSortValue(a);
      const valueB = getSortValue(b);

      if (valueA == null && valueB == null) return 0;
      if (valueA == null) return tableState.sortDirection === "asc" ? -1 : 1;
      if (valueB == null) return tableState.sortDirection === "asc" ? 1 : -1;

      if (typeof valueA === "number" && typeof valueB === "number") {
        return tableState.sortDirection === "asc" ? valueA - valueB : valueB - valueA;
      }

      const comparison = String(valueA).localeCompare(String(valueB));
      return tableState.sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [filteredContracts, tableColumns, tableState.sortBy, tableState.sortDirection]);

  const contractTotals = React.useMemo(() => {
    const sum = (key: keyof PrimeContract) =>
      filteredContracts.reduce((acc, c) => acc + (Number(c[key]) || 0), 0);
    return {
      original_contract_value: sum("original_contract_value"),
      approved_change_orders: sum("approved_change_orders"),
      revised_contract_value: sum("revised_contract_value"),
      pending_change_orders: sum("pending_change_orders"),
      draft_change_orders: sum("draft_change_orders"),
      invoiced_amount: sum("invoiced_amount"),
      payments_received: sum("payments_received"),
      remaining_balance: sum("remaining_balance"),
    };
  }, [filteredContracts]);

  const totalItems = filteredContracts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / tableState.perPage));
  const pageStart = (tableState.page - 1) * tableState.perPage;
  const pageEnd = pageStart + tableState.perPage;
  const pagedContracts = sortedContracts.slice(pageStart, pageEnd);

  React.useEffect(() => {
    if (tableState.page > totalPages) {
      tableState.setPage(1);
      tableState.setSearchParams({ page: "1" });
    }
  }, [tableState.page, tableState.setPage, tableState.setSearchParams, totalPages]);

  const handleFilterChange = (nextFilters: FilterState) => {
    tableState.setActiveFilters(nextFilters);
    tableState.setSearchParams({
      status: typeof nextFilters.status === "string" ? nextFilters.status : null,
      executed: typeof nextFilters.executed === "string" ? nextFilters.executed : null,
      client_name: typeof nextFilters.client_name === "string" ? nextFilters.client_name : null,
      page: "1",
    });
    tableState.setPage(1);
  };

  const handleRowClick = (item: PrimeContract) => {
    router.push(`/${projectId}/prime-contracts/${item.id}`);
  };

  const handleEdit = (item: PrimeContract) => {
    router.push(`/${projectId}/prime-contracts/${item.id}?edit=1`);
  };

  const handleDeleteIntent = (item: PrimeContract) => {
    setContractToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!contractToDelete) return;

    setIsDeleting(true);
    const deletingId = contractToDelete.id;
    const deletingTitle = contractToDelete.title;
    try {
      await apiFetch<void>(
        `/api/projects/${projectId}/contracts/${deletingId}`,
        { method: "DELETE" },
      );
      await queryClient.invalidateQueries({
        queryKey: primeContractKeys.all(projectIdNumber),
      });
      toast.success(`Contract "${deletingTitle}" deleted successfully`);
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : "Failed to delete contract. Please try again.";
      toast.error(message);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setContractToDelete(null);
    }
  };

  const handleBulkDeleteConfirm = async () => {
    const ids = tableState.selectedIds;
    if (ids.length === 0) return;

    setIsBulkDeleting(true);
    try {
      const deletionResults = await Promise.allSettled(
        ids.map(async (id) => {
          await apiFetch<void>(`/api/projects/${projectId}/contracts/${id}`, {
            method: "DELETE",
          });
          return id;
        }),
      );
      const failedDeletes: string[] = [];
      deletionResults.forEach((result, index) => {
        if (result.status !== "rejected") return;
        const contractId = ids[index];
        const contractNumber = contracts.find((c) => c.id === contractId)
          ?.contract_number;
        const message =
          result.reason instanceof Error
            ? result.reason.message
            : "Failed to delete";
        failedDeletes.push(`${contractNumber ?? contractId}: ${message}`);
      });

      const summary = summarizeBulkResults(deletionResults);
      await queryClient.invalidateQueries({
        queryKey: primeContractKeys.all(projectIdNumber),
      });
      tableState.setSelectedIds([]);

      if (failedDeletes.length > 0) {
        toast.error(
          `${summary.succeeded} deleted, ${summary.failed} failed:\n${failedDeletes.join("\n")}`,
        );
      } else {
        toast.success(
          `${summary.succeeded} contract${summary.succeeded === 1 ? "" : "s"} deleted`,
        );
      }
    } finally {
      setIsBulkDeleting(false);
      setBulkDeleteDialogOpen(false);
    }
  };

  const handleExport = () => {
    if (filteredContracts.length === 0) {
      toast.info("No contracts to export");
      return;
    }

    const tableColumns = buildPrimeContractTableColumns();
    const visibleColumns = tableColumns.filter((column) =>
      tableState.visibleColumns.includes(column.id),
    );

    const headers = visibleColumns.map((column) => column.label);
    const rows = filteredContracts.map((contract) =>
      visibleColumns
        .map((column) =>
          column.csvValue ? column.csvValue(contract) : String(column.render(contract) ?? ""),
        )
        .join(","),
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `prime-contracts-${tableState.page}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      tableState.setSelectedIds(pagedContracts.map((item) => item.id));
    } else {
      tableState.setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      tableState.setSelectedIds((prev) => [...prev, id]);
    } else {
      tableState.setSelectedIds((prev) => prev.filter((itemId) => itemId !== id));
    }
  };

  const isFiltered = Boolean(tableState.searchInput) || Boolean(activeFilters.status) || Boolean(activeFilters.executed) || Boolean(activeFilters.client_name);

  return (
    <>
      <UnifiedTablePage
        header={{
          title: "Prime Contracts",
          actions: (
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-foreground hover:bg-muted hover:text-foreground"
                onClick={() => router.push(`/${projectId}/prime-contracts/configure`)}
                aria-label="Configure prime contracts"
              >
                <Settings />
              </Button>
              <SplitButton
                size="sm"
                label="Create"
                onClick={() => router.push(`/${projectId}/prime-contracts/new`)}
                actions={[
                  {
                    label: "Blank Contract",
                    onClick: () => router.push(`/${projectId}/prime-contracts/new`),
                  },
                  {
                    label: "From Estimate…",
                    onClick: () => setCreateFromEstimateOpen(true),
                  },
                ]}
              />
            </div>
          ),
        }}
        layout={{
          fullBleedTable: false,
        }}
        toolbar={{
          totalItems,
          filteredItems: totalItems,
          selectedCount: tableState.selectedIds.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search contracts...",
          currentView: tableState.currentView,
          onViewChange: (view) => {
            tableState.setCurrentView(view);
            tableState.setSearchParams({ view });
          },
          filters: dynamicFilters,
          activeFilters,
          onFilterChange: handleFilterChange,
          onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
          columns: [{ id: "expand", label: "", alwaysVisible: true }, ...primeContractColumns],
          visibleColumns: tableState.visibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
          onExport: handleExport,
          onBulkDelete: tableState.selectedIds.length > 0
            ? () => setBulkDeleteDialogOpen(true)
            : undefined,
          mobilePanelActions: (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => router.push(`/${projectId}/prime-contracts/configure`)}
            >
              <Settings />
              Configure
            </Button>
          ),
        }}
        data={{
          items: pagedContracts,
          isLoading,
          error: contractsError instanceof Error ? contractsError : undefined,
        }}
        table={{
          defaultPinnedLeftColumns: ["expand", "contract_number"],
          columns: [
            {
              id: "expand",
              label: "",
              alwaysVisible: true,
              width: 40,
              render: (item: PrimeContract) => (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(item.id);
                  }}
                  aria-label={expandedIds.has(item.id) ? "Collapse" : "Expand"}
                >
                  {expandedIds.has(item.id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              ),
              sortValue: () => 0,
            },
            ...tableColumns,
          ],
          getRowId: (item) => item.id,
          onRowClick: handleRowClick,
          rowActions: (item) =>
            renderPrimeContractRowActions(item, handleEdit, handleDeleteIntent),
          renderExpandedRow: (item, colSpan) => {
            if (!expandedIds.has(item.id)) return null;
            const cached = pccoCache[item.id];
            const formatCurrency = (v: number | null) =>
              v == null
                ? "—"
                : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

            return (
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableCell colSpan={colSpan} className="px-8 py-3">
                  {!cached || cached.loading ? (
                    <div className="space-y-1.5">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4">
                          <Skeleton className="h-3.5 w-8" />
                          <Skeleton className="h-3.5 w-40" />
                          <Skeleton className="h-3.5 w-16" />
                          <Skeleton className="h-3.5 w-20 ml-auto" />
                        </div>
                      ))}
                    </div>
                  ) : cached.data.length === 0 && cached.pcos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No change orders or potential change orders</p>
                  ) : (
                    <div className="space-y-4">
                      {cached.data.length > 0 && (
                        <div className="space-y-1">
                          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Change Orders ({cached.data.length})
                          </p>
                          <InlineTable variant="read">
                            <InlineTableHeader>
                              <InlineTableHeaderRow>
                                <InlineTableHeaderCell>Number</InlineTableHeaderCell>
                                <InlineTableHeaderCell>Title</InlineTableHeaderCell>
                                <InlineTableHeaderCell>Status</InlineTableHeaderCell>
                                <InlineTableHeaderCell align="right">Amount</InlineTableHeaderCell>
                              </InlineTableHeaderRow>
                            </InlineTableHeader>
                            <InlineTableBody>
                              {cached.data.map((co) => (
                                <InlineTableRow
                                  key={co.id}
                                  className="cursor-pointer hover:bg-muted/50"
                                  onClick={(e) => { e.stopPropagation(); router.push(`/${projectId}/change-orders/prime/${co.id}`); }}
                                >
                                  <InlineTableCell className="font-medium">{co.pcco_number || "—"}</InlineTableCell>
                                  <InlineTableCell className="max-w-md truncate">{co.title || "—"}</InlineTableCell>
                                  <InlineTableCell><StatusBadge status={co.status || "Unknown"} /></InlineTableCell>
                                  <InlineTableCell align="right" numeric>{formatCurrency(co.total_amount)}</InlineTableCell>
                                </InlineTableRow>
                              ))}
                            </InlineTableBody>
                          </InlineTable>
                        </div>
                      )}
                      {cached.pcos.length > 0 && (
                        <div className="space-y-1">
                          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Potential Change Orders ({cached.pcos.length})
                          </p>
                          <InlineTable variant="read">
                            <InlineTableHeader>
                              <InlineTableHeaderRow>
                                <InlineTableHeaderCell>Number</InlineTableHeaderCell>
                                <InlineTableHeaderCell>Title</InlineTableHeaderCell>
                                <InlineTableHeaderCell>Status</InlineTableHeaderCell>
                                <InlineTableHeaderCell align="right">Amount</InlineTableHeaderCell>
                              </InlineTableHeaderRow>
                            </InlineTableHeader>
                            <InlineTableBody>
                              {cached.pcos.map((pco) => (
                                <InlineTableRow
                                  key={pco.id}
                                  className="cursor-pointer hover:bg-muted/50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(
                                      `/${projectId}/prime-contracts/${item.id}/change-orders/pcos/${pco.id}`,
                                    );
                                  }}
                                >
                                  <InlineTableCell className="font-medium">{pco.pco_number || "—"}</InlineTableCell>
                                  <InlineTableCell className="max-w-md truncate">{pco.title || "—"}</InlineTableCell>
                                  <InlineTableCell><StatusBadge status={pco.status || "Unknown"} /></InlineTableCell>
                                  <InlineTableCell align="right" numeric>{formatCurrency(pco.total_amount)}</InlineTableCell>
                                </InlineTableRow>
                              ))}
                            </InlineTableBody>
                          </InlineTable>
                        </div>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          },
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
        views={{
          card: (item) => renderPrimeContractCard(item, handleRowClick),
          list: (item) =>
            renderPrimeContractList(item, handleRowClick, {
              isExpanded: expandedIds.has(item.id),
              onToggle: toggleExpand,
              loading: pccoCache[item.id]?.loading ?? false,
              data: pccoCache[item.id]?.data ?? [],
              pcos: pccoCache[item.id]?.pcos ?? [],
            }),
        }}
        emptyState={{
          title: "No contracts found",
          description: "You have not added any prime contracts yet.",
          filteredDescription: "Try adjusting your search or filters",
          isFiltered,
          action: (
            <Button size="sm" onClick={() => router.push(`/${projectId}/prime-contracts/new`)}>
              Create your first contract
            </Button>
          ),
        }}
        footerTotals={{
          label: "Totals",
          values: {
            original_contract_value: <span className="tabular-nums">{formatCurrency(contractTotals.original_contract_value)}</span>,
            approved_change_orders: <span className="tabular-nums">{formatCurrency(contractTotals.approved_change_orders)}</span>,
            revised_contract_value: <span className="tabular-nums">{formatCurrency(contractTotals.revised_contract_value)}</span>,
            pending_change_orders: <span className="tabular-nums">{formatCurrency(contractTotals.pending_change_orders)}</span>,
            draft_change_orders: <span className="tabular-nums">{formatCurrency(contractTotals.draft_change_orders)}</span>,
            invoiced_amount: <span className="tabular-nums">{formatCurrency(contractTotals.invoiced_amount)}</span>,
            payments_received: <span className="tabular-nums">{formatCurrency(contractTotals.payments_received)}</span>,
            remaining_balance: <span className="tabular-nums">{formatCurrency(contractTotals.remaining_balance)}</span>,
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
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contract</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete contract{" "}
              <strong>{contractToDelete?.contract_number}</strong> -{" "}
              <strong>{contractToDelete?.title}</strong>?
              <br />
              <br />
              This action cannot be undone. Any associated line items and change orders
              must be deleted first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Contract"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {tableState.selectedIds.length} Contract{tableState.selectedIds.length === 1 ? "" : "s"}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{tableState.selectedIds.length}</strong> selected contract
              {tableState.selectedIds.length === 1 ? "" : "s"}?
              <br />
              <br />
              This action cannot be undone. Contracts with associated line items or
              change orders will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteConfirm}
              disabled={isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting ? "Deleting..." : `Delete ${tableState.selectedIds.length} Contract${tableState.selectedIds.length === 1 ? "" : "s"}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreatePrimeContractFromEstimateModal
        open={createFromEstimateOpen}
        onOpenChange={setCreateFromEstimateOpen}
        projectId={projectId}
      />
    </>
  );
}

"use client";

import * as React from "react";
import type { ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";

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
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
} from "@/components/tables/unified";
import {
  useCommitmentsList,
  useDeleteCommitment,
} from "@/hooks/use-commitments-query";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import type { CommitmentListItem } from "@/lib/validation/commitments";
import { formatCurrency } from "@/lib/utils";
import {
  buildCommitmentTableColumns,
  commitmentColumns,
  commitmentDefaultVisibleColumns,
  commitmentFilters,
  renderCommitmentCard,
  renderCommitmentList,
  renderCommitmentRowActions,
} from "@/features/commitments/commitments-table-config";
import { apiFetch } from "@/lib/api-client";

interface PrimeContractCommitmentsTabProps {
  projectId: string;
  contractId: string;
}

// ── Expanded sub-row: commitment change orders ───────────────────────────────

interface CommitmentChangeOrder {
  id: string;
  number: string;
  title: string;
  status: string;
  amount: number;
  requested_date: string | null;
}

function CommitmentChangeOrdersRow({
  commitmentId,
  colSpan,
}: {
  commitmentId: string;
  colSpan: number;
}): ReactNode {
  const [changeOrders, setChangeOrders] = React.useState<CommitmentChangeOrder[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    apiFetch<{ data?: CommitmentChangeOrder[] } | CommitmentChangeOrder[]>(
      `/api/commitments/${commitmentId}/change-orders`,
    )
      .then((json) => {
        if (cancelled) return;
        const rows = Array.isArray(json) ? json : (json.data ?? []);
        setChangeOrders(rows);
        setIsLoading(false);
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [commitmentId]);

  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <div className="bg-muted/40 border-y border-border px-6 py-3">
          {isLoading ? (
            <div className="space-y-1.5 py-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-6">
                  <Skeleton className="h-3.5 w-8" />
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3.5 w-16" />
                  <Skeleton className="h-3.5 w-20 ml-auto" />
                  <Skeleton className="h-3.5 w-20" />
                </div>
              ))}
            </div>
          ) : changeOrders.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No change orders</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-1.5 pr-6 font-medium">#</th>
                  <th className="pb-1.5 pr-6 font-medium">Description</th>
                  <th className="pb-1.5 pr-6 font-medium">Status</th>
                  <th className="pb-1.5 pr-6 font-medium text-right">Amount</th>
                  <th className="pb-1.5 font-medium">Requested</th>
                </tr>
              </thead>
              <tbody>
                {changeOrders.map((co) => (
                  <tr key={co.id} className="border-t border-border/50">
                    <td className="py-1.5 pr-6 font-mono text-muted-foreground">{co.number}</td>
                    <td className="py-1.5 pr-6 max-w-xs truncate">{co.title}</td>
                    <td className="py-1.5 pr-6 capitalize">{co.status}</td>
                    <td className="py-1.5 pr-6 text-right tabular-nums">{fmt(co.amount)}</td>
                    <td className="py-1.5 text-muted-foreground">
                      {co.requested_date ? new Date(co.requested_date).toLocaleDateString() : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Main tab component ───────────────────────────────────────────────────────

const EMPTY_FILTERS: Record<string, FilterValue> = { status: undefined, type: undefined };

export function PrimeContractCommitmentsTab({
  projectId,
  contractId,
}: PrimeContractCommitmentsTabProps) {
  const router = useRouter();
  const pathname = usePathname()!;
  const searchParams = useSearchParams()!;

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);
  const [commitmentToDelete, setCommitmentToDelete] = React.useState<CommitmentListItem | null>(null);

  const tableState = useUnifiedTableState({
    entityKey: `commitments-tab-${contractId}`,
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table", "card", "list"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "number",
      sortDirection: "asc",
      visibleColumns: commitmentDefaultVisibleColumns,
      filters: EMPTY_FILTERS,
    },
  });

  const activeFilters = tableState.activeFilters as Record<string, FilterValue>;

  const {
    data: response,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useCommitmentsList(projectId, {
    page: tableState.page,
    limit: tableState.perPage,
    status: typeof activeFilters.status === "string" ? activeFilters.status : undefined,
    type: typeof activeFilters.type === "string" ? activeFilters.type : undefined,
    search: tableState.debouncedSearch || undefined,
    primeContractId: contractId,
  });

  const resolvedError =
    error instanceof Error ? error : error ? new Error("Failed to load commitments") : undefined;

  const deleteCommitment = useDeleteCommitment(projectId);

  const commitments = response?.data ?? [];
  const totalItems = response?.meta.total ?? commitments.length;
  const totalPages = response?.meta.totalPages ?? 1;

  // Row expansion
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  const handleToggleExpand = React.useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  const handleStatusChange = React.useCallback(
    async (id: string, status: string) => {
      try {
        await apiFetch(`/api/commitments/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        toast.success("Status updated");
        await refetch();
      } catch (err) {
        console.error("Failed to update commitment status:", err);
        toast.error("Failed to update status. Please try again.");
      }
    },
    [refetch],
  );

  const tableColumns = React.useMemo(
    () => buildCommitmentTableColumns(projectId, expandedIds, handleToggleExpand, handleStatusChange),
    [projectId, expandedIds, handleToggleExpand, handleStatusChange],
  );

  const sortedCommitments = React.useMemo(() => {
    if (!tableState.sortBy) return commitments;
    const sortColumn = tableColumns.find((c) => c.id === tableState.sortBy);
    const getSortValue = sortColumn?.sortValue;
    if (!getSortValue) return commitments;
    return [...commitments].sort((a, b) => {
      const va = getSortValue(a);
      const vb = getSortValue(b);
      if (va == null && vb == null) return 0;
      if (va == null) return tableState.sortDirection === "asc" ? -1 : 1;
      if (vb == null) return tableState.sortDirection === "asc" ? 1 : -1;
      if (typeof va === "number" && typeof vb === "number")
        return tableState.sortDirection === "asc" ? va - vb : vb - va;
      return tableState.sortDirection === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }, [commitments, tableColumns, tableState.sortBy, tableState.sortDirection]);

  const financialTotals = React.useMemo(
    () =>
      commitments.reduce(
        (acc, item) => ({
          original_amount: acc.original_amount + item.original_amount,
          approved_change_orders: acc.approved_change_orders + item.approved_change_orders,
          pending_change_orders: acc.pending_change_orders + item.pending_change_orders,
          draft_change_orders: acc.draft_change_orders + item.draft_change_orders,
          revised_contract_amount: acc.revised_contract_amount + item.revised_contract_amount,
          invoiced_amount: acc.invoiced_amount + item.invoiced_amount,
          billed_to_date: acc.billed_to_date + item.billed_to_date,
          payments_issued: acc.payments_issued + item.payments_issued,
          remaining_balance: acc.remaining_balance + item.remaining_balance,
          balance_to_finish: acc.balance_to_finish + item.balance_to_finish,
        }),
        {
          original_amount: 0, approved_change_orders: 0, pending_change_orders: 0,
          draft_change_orders: 0, revised_contract_amount: 0, invoiced_amount: 0,
          billed_to_date: 0, payments_issued: 0, remaining_balance: 0, balance_to_finish: 0,
        },
      ),
    [commitments],
  );

  const handleRowClick = (item: CommitmentListItem) =>
    router.push(`/${projectId}/commitments/${item.id}`);
  const handleEdit = (item: CommitmentListItem) =>
    router.push(`/${projectId}/commitments/${item.id}?edit=1`);
  const handleDeleteIntent = (item: CommitmentListItem) => {
    setCommitmentToDelete(item);
    setDeleteDialogOpen(true);
  };
  const handleDeleteConfirm = async () => {
    if (!commitmentToDelete) return;
    setIsDeleting(true);
    try {
      await deleteCommitment.mutateAsync(commitmentToDelete.id);
    } catch (error) {
      reportNonCriticalFailure({
        area: "prime-contract-commitments",
        operation: "delete-linked-commitment",
        error,
        userVisibleFallback:
          "Linked commitment deletion failed and the row remains visible.",
        metadata: { projectId, commitmentId: commitmentToDelete.id },
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setCommitmentToDelete(null);
    }
  };

  const handleBulkDeleteConfirm = async () => {
    const ids = tableState.selectedIds;
    if (ids.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const map = new Map(commitments.map((item) => [item.id, item]));
      const failures: string[] = [];
      for (const id of ids) {
        try {
          await apiFetch(`/api/commitments/${id}`, { method: "DELETE" });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Network error";
          failures.push(`${map.get(id)?.number ?? id}: ${message}`);
        }
      }
      const successCount = ids.length - failures.length;
      if (successCount > 0) { await refetch(); tableState.setSelectedIds([]); }
      if (failures.length > 0) {
        toast.error(`${successCount} deleted, ${failures.length} failed.\n${failures.slice(0, 3).join("\n")}`);
      } else {
        toast.success(`${successCount} commitment${successCount === 1 ? "" : "s"} deleted`);
      }
    } finally { setIsBulkDeleting(false); setBulkDeleteDialogOpen(false); }
  };

  const isFiltered =
    Boolean(tableState.searchInput) ||
    Boolean(activeFilters.status) ||
    Boolean(activeFilters.type);

  return (
    <>
      <UnifiedTablePage
        header={{ title: "" }}
        layout={{ fullBleedTable: false, containerPadding: false }}
        toolbar={{
          totalItems,
          filteredItems: totalItems,
          selectedCount: tableState.selectedIds.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search commitments...",
          currentView: tableState.currentView,
          onViewChange: (view) => tableState.setCurrentView(view),
          filters: commitmentFilters,
          activeFilters,
          onFilterChange: (next) => tableState.setActiveFilters(next),
          onClearFilters: () => tableState.setActiveFilters(EMPTY_FILTERS),
          columns: commitmentColumns,
          visibleColumns: tableState.visibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
          onBulkDelete:
            tableState.selectedIds.length > 0 ? () => setBulkDeleteDialogOpen(true) : undefined,
        }}
        data={{
          items: sortedCommitments,
          isLoading,
          isFetching,
          error: resolvedError,
        }}
        table={{
          columns: tableColumns,
          getRowId: (item) => item.id,
          onRowClick: handleRowClick,
          rowActions: (item) => renderCommitmentRowActions(item, handleEdit, handleDeleteIntent),
          renderExpandedRow: (item, colSpan) => {
            if (!expandedIds.has(item.id)) return null;
            return <CommitmentChangeOrdersRow commitmentId={item.id} colSpan={colSpan} />;
          },
        }}
        sorting={{
          sortBy: tableState.sortBy,
          sortDirection: tableState.sortDirection,
          onSortChange: (sortBy, direction) => {
            tableState.setSortBy(sortBy);
            tableState.setSortDirection(direction);
            tableState.setPage(1);
          },
        }}
        selection={{
          selectedIds: tableState.selectedIds,
          onSelectAll: (checked) =>
            tableState.setSelectedIds(checked ? sortedCommitments.map((c) => c.id) : []),
          onSelectRow: (id, checked) =>
            tableState.setSelectedIds((prev) =>
              checked ? [...prev, id] : prev.filter((x) => x !== id),
            ),
        }}
        views={{
          card: (item) => renderCommitmentCard(item, handleRowClick),
          list: (item) => renderCommitmentList(item, handleRowClick),
        }}
        emptyState={{
          title: "No commitments found",
          description: "Create a subcontract or purchase order to get started.",
          filteredDescription: "Try adjusting your search or filters",
          isFiltered,
        }}
        footerTotals={{
          label: "Totals",
          values: {
            original_amount: <span className="font-semibold">{formatCurrency(financialTotals.original_amount)}</span>,
            approved_change_orders: <span className="font-semibold">{formatCurrency(financialTotals.approved_change_orders)}</span>,
            pending_change_orders: <span className="font-semibold">{formatCurrency(financialTotals.pending_change_orders)}</span>,
            draft_change_orders: <span className="font-semibold">{formatCurrency(financialTotals.draft_change_orders)}</span>,
            revised_contract_amount: <span className="font-semibold">{formatCurrency(financialTotals.revised_contract_amount)}</span>,
            invoiced_amount: <span className="font-semibold">{formatCurrency(financialTotals.invoiced_amount)}</span>,
            billed_to_date: <span className="font-semibold">{formatCurrency(financialTotals.billed_to_date)}</span>,
            payments_issued: <span className="font-semibold">{formatCurrency(financialTotals.payments_issued)}</span>,
            remaining_balance: <span className="font-semibold">{formatCurrency(financialTotals.remaining_balance)}</span>,
            balance_to_finish: <span className="font-semibold">{formatCurrency(financialTotals.balance_to_finish)}</span>,
          },
        }}
        pagination={{
          page: tableState.page,
          totalPages,
          perPage: tableState.perPage,
          onPageChange: (p) => tableState.setPage(p),
          onPerPageChange: (pp) => {
            const n = Number(pp);
            if (!Number.isFinite(n) || n <= 0) return;
            tableState.setPerPage(n);
            tableState.setPage(1);
          },
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Commitment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete commitment{" "}
              <strong>{commitmentToDelete?.number}</strong> –{" "}
              <strong>{commitmentToDelete?.title}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting…" : "Delete Commitment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {tableState.selectedIds.length} Commitment
              {tableState.selectedIds.length === 1 ? "" : "s"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{tableState.selectedIds.length}</strong> selected commitment
              {tableState.selectedIds.length === 1 ? "" : "s"}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteConfirm}
              disabled={isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting
                ? "Deleting…"
                : `Delete ${tableState.selectedIds.length} Commitment${tableState.selectedIds.length === 1 ? "" : "s"}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

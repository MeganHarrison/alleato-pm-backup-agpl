"use client";

import * as React from "react";
import type { ReactElement } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  TablePageActions,
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
} from "@/components/tables/unified";
import {
  buildPrimeContractTableColumns,
  formatCurrency,
  primeContractColumns,
  primeContractDefaultVisibleColumns,
  primeContractFilters,
  renderPrimeContractRowActions,
} from "@/features/prime-contracts/prime-contracts-table-config";
import { type PrimeContract } from "@/lib/validation/prime-contracts";
import { apiFetch, summarizeBulkResults } from "@/lib/api-client";
import { GlobalProjectPickerDialog } from "@/components/domain/global-project-picker-dialog";

// ── Extended type ─────────────────────────────────────────────────────────────

export type PrimeContractWithProject = PrimeContract & {
  projects: { id: number; name: string | null } | null;
};

// ── Column configs ────────────────────────────────────────────────────────────

const PROJECT_COLUMN_CONFIG = {
  id: "project_name",
  label: "Project",
  defaultVisible: true,
} as const;

const GLOBAL_COLUMNS = [PROJECT_COLUMN_CONFIG, ...primeContractColumns];

const GLOBAL_DEFAULT_VISIBLE = [
  PROJECT_COLUMN_CONFIG.id,
  ...primeContractDefaultVisibleColumns,
];

// ── Filter state ──────────────────────────────────────────────────────────────

const EMPTY_FILTERS: Record<string, FilterValue> = {
  status: undefined,
  executed: undefined,
  client_name: undefined,
  erp_status: undefined,
};

type FilterState = Record<string, FilterValue>;

type ContractStatus = NonNullable<PrimeContract["status"]>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface PrimeContractsGlobalClientProps {
  contracts: PrimeContractWithProject[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PrimeContractsGlobalClient({
  contracts: initialContracts,
}: PrimeContractsGlobalClientProps): ReactElement {
  const router = useRouter();
  const pathname = usePathname()!;
  const searchParams = (useSearchParams() ??
    new URLSearchParams()) as NonNullable<ReturnType<typeof useSearchParams>>;

  // Local copy of contracts so we can optimistically remove deleted rows
  const [contracts, setContracts] =
    React.useState<PrimeContractWithProject[]>(initialContracts);

  // ── Project picker dialog ──────────────────────────────────────────────────
  const [pickerOpen, setPickerOpen] = React.useState(false);

  // ── Delete dialogs ─────────────────────────────────────────────────────────
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [contractToDelete, setContractToDelete] =
    React.useState<PrimeContractWithProject | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = React.useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);

  // ── Table state ────────────────────────────────────────────────────────────
  const initialFilters: FilterState = {
    status: searchParams.get("status") ?? undefined,
    executed: searchParams.get("executed") ?? undefined,
    client_name: searchParams.get("client_name") ?? undefined,
    erp_status: searchParams.get("erp_status") ?? undefined,
  };

  const tableState = useUnifiedTableState({
    entityKey: "global-prime-contracts",
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

  // Initialise visible columns once
  React.useEffect(() => {
    if (tableState.visibleColumns.length === 0) {
      tableState.setVisibleColumns(GLOBAL_DEFAULT_VISIBLE);
    }
  }, [tableState.visibleColumns.length, tableState.setVisibleColumns]);

  // Collapse to list view on mobile
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth >= 768) return;
    if (tableState.currentView !== "table") return;
    tableState.setCurrentView("list");
    tableState.setSearchParams({ view: "list" });
  }, [tableState.currentView, tableState.setCurrentView, tableState.setSearchParams]);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const activeFilters = tableState.activeFilters as FilterState;
  const statusFilter = activeFilters.status as ContractStatus | undefined;
  const executedFilter = activeFilters.executed as string | undefined;
  const clientNameFilter = activeFilters.client_name as string | undefined;
  const erpStatusFilter = activeFilters.erp_status as string | undefined;
  const searchTerm = tableState.debouncedSearch.trim().toLowerCase();

  // Build dynamic client_name filter options from loaded data
  const dynamicFilters = React.useMemo(() => {
    const uniqueClientNames = Array.from(
      new Set(
        contracts
          .map((c) => c.client?.name)
          .filter((n): n is string => Boolean(n)),
      ),
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
    if (
      erpStatusFilter &&
      (contract as { erp_status?: string }).erp_status !== erpStatusFilter
    )
      return false;
    if (!searchTerm) return true;

    const fields = [
      contract.contract_number ?? "",
      contract.title ?? "",
      contract.client?.name ?? "",
      contract.projects?.name ?? "",
    ];

    return fields.some((field) => field.toLowerCase().includes(searchTerm));
  });

  // ── Sorting ────────────────────────────────────────────────────────────────
  const baseColumns = buildPrimeContractTableColumns();

  const projectColumn = {
    ...PROJECT_COLUMN_CONFIG,
    render: (item: PrimeContractWithProject) => (
      <Link
        href={`/${item.project_id}/prime-contracts`}
        className="text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
        onClick={(e) => e.stopPropagation()}
      >
        {item.projects?.name ?? "Unknown"}
      </Link>
    ),
    csvValue: (item: PrimeContractWithProject) => item.projects?.name ?? "",
    sortValue: (item: PrimeContractWithProject) => item.projects?.name ?? "",
  };

  const tableColumns = [projectColumn, ...baseColumns] as typeof baseColumns;

  const sortedContracts = React.useMemo(() => {
    if (!tableState.sortBy) return filteredContracts;
    const sortColumn = tableColumns.find((col) => col.id === tableState.sortBy);
    const getSortValue = sortColumn?.sortValue as
      | ((item: PrimeContractWithProject) => string | number)
      | undefined;
    if (!getSortValue) return filteredContracts;

    return [...filteredContracts].sort((a, b) => {
      const valueA = getSortValue(a);
      const valueB = getSortValue(b);

      if (valueA == null && valueB == null) return 0;
      if (valueA == null) return tableState.sortDirection === "asc" ? -1 : 1;
      if (valueB == null) return tableState.sortDirection === "asc" ? 1 : -1;

      if (typeof valueA === "number" && typeof valueB === "number") {
        return tableState.sortDirection === "asc"
          ? valueA - valueB
          : valueB - valueA;
      }

      const comparison = String(valueA).localeCompare(String(valueB));
      return tableState.sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredContracts, tableColumns, tableState.sortBy, tableState.sortDirection]);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalItems = filteredContracts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / tableState.perPage));
  const pageStart = (tableState.page - 1) * tableState.perPage;
  const pagedContracts = sortedContracts.slice(pageStart, pageStart + tableState.perPage);

  React.useEffect(() => {
    if (tableState.page > totalPages) {
      tableState.setPage(1);
      tableState.setSearchParams({ page: "1" });
    }
  }, [tableState.page, tableState.setPage, tableState.setSearchParams, totalPages]);

  // ── Footer totals ──────────────────────────────────────────────────────────
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

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleFilterChange = (nextFilters: FilterState) => {
    tableState.setActiveFilters(nextFilters);
    tableState.setSearchParams({
      status:
        typeof nextFilters.status === "string" ? nextFilters.status : null,
      executed:
        typeof nextFilters.executed === "string" ? nextFilters.executed : null,
      client_name:
        typeof nextFilters.client_name === "string"
          ? nextFilters.client_name
          : null,
      erp_status:
        typeof nextFilters.erp_status === "string"
          ? nextFilters.erp_status
          : null,
      page: "1",
    });
    tableState.setPage(1);
  };

  const handleRowClick = (item: PrimeContractWithProject) => {
    router.push(`/${item.project_id}/prime-contracts/${item.id}`);
  };

  const handleEdit = (item: PrimeContract) => {
    const withProject = item as PrimeContractWithProject;
    router.push(`/${withProject.project_id}/prime-contracts/${item.id}?edit=1`);
  };

  const handleDeleteIntent = (item: PrimeContract) => {
    setContractToDelete(item as PrimeContractWithProject);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!contractToDelete) return;
    setIsDeleting(true);
    const { id, project_id, title, contract_number } = contractToDelete;
    try {
      await apiFetch<void>(
        `/api/projects/${project_id}/contracts/${id}`,
        { method: "DELETE" },
      );
      setContracts((prev) => prev.filter((c) => c.id !== id));
      toast.success(`Contract "${title ?? contract_number}" deleted successfully`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to delete contract: ${message}`);
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
          const contract = contracts.find((c) => c.id === id);
          if (!contract) throw new Error("Contract not found");
          await apiFetch<void>(
            `/api/projects/${contract.project_id}/contracts/${id}`,
            { method: "DELETE" },
          );
          return id;
        }),
      );

      const failedDeletes: string[] = [];
      deletionResults.forEach((result, index) => {
        if (result.status !== "rejected") return;
        const contractId = ids[index];
        const contract = contracts.find((c) => c.id === contractId);
        const label = contract?.contract_number ?? contractId;
        const message =
          result.reason instanceof Error
            ? result.reason.message
            : "Failed to delete";
        failedDeletes.push(`${label}: ${message}`);
      });

      const succeededIds = new Set(
        deletionResults
          .map((r, i) => (r.status === "fulfilled" ? ids[i] : null))
          .filter((id): id is string => id !== null),
      );
      setContracts((prev) => prev.filter((c) => !succeededIds.has(c.id)));

      const summary = summarizeBulkResults(deletionResults);
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

    const visibleCols = tableColumns.filter((col) =>
      tableState.visibleColumns.includes(col.id),
    );

    const headers = visibleCols.map((col) => col.label);
    const rows = filteredContracts.map((contract) =>
      visibleCols
        .map((col) =>
          col.csvValue
            ? (col.csvValue as (item: PrimeContractWithProject) => string)(contract)
            : String(
                (col.render as (item: PrimeContractWithProject) => React.ReactNode)(
                  contract,
                ) ?? "",
              ),
        )
        .join(","),
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `prime-contracts-all-projects.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSelectAll = (checked: boolean) => {
    tableState.setSelectedIds(
      checked ? pagedContracts.map((item) => item.id) : [],
    );
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    tableState.setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((itemId) => itemId !== id),
    );
  };

  const isFiltered =
    Boolean(tableState.searchInput) ||
    Boolean(activeFilters.status) ||
    Boolean(activeFilters.executed) ||
    Boolean(activeFilters.client_name) ||
    Boolean(activeFilters.erp_status);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <UnifiedTablePage
        header={{
          title: "Prime Contracts",
          actions: (
            <TablePageActions
              addLabel="Create prime contract"
              addOptions={[
                {
                  label: "Create prime contract",
                  onClick: () => setPickerOpen(true),
                },
              ]}
            />
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
          columns: GLOBAL_COLUMNS,
          visibleColumns: tableState.visibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
          onExport: handleExport,
          onBulkDelete:
            tableState.selectedIds.length > 0
              ? () => setBulkDeleteDialogOpen(true)
              : undefined,
        }}
        data={{
          items: pagedContracts,
          isLoading: false,
        }}
        table={{
          defaultPinnedLeftColumns: ["project_name", "contract_number"],
          columns: tableColumns as Parameters<
            typeof UnifiedTablePage
          >[0]["table"]["columns"],
          getRowId: (item) => (item as PrimeContractWithProject).id,
          onRowClick: (item) =>
            handleRowClick(item as PrimeContractWithProject),
          rowActions: (item) =>
            renderPrimeContractRowActions(
              item as PrimeContract,
              handleEdit,
              handleDeleteIntent,
            ),
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
          title: "No prime contracts found",
          description: "No prime contracts have been created across any project yet.",
          filteredDescription: "Try adjusting your search or filters",
          isFiltered,
          action: (
            <Button size="sm" onClick={() => setPickerOpen(true)}>
              Create your first contract
            </Button>
          ),
        }}
        footerTotals={{
          label: "Totals",
          values: {
            original_contract_value: (
              <span className="tabular-nums">
                {formatCurrency(contractTotals.original_contract_value)}
              </span>
            ),
            approved_change_orders: (
              <span className="tabular-nums">
                {formatCurrency(contractTotals.approved_change_orders)}
              </span>
            ),
            revised_contract_value: (
              <span className="tabular-nums">
                {formatCurrency(contractTotals.revised_contract_value)}
              </span>
            ),
            pending_change_orders: (
              <span className="tabular-nums">
                {formatCurrency(contractTotals.pending_change_orders)}
              </span>
            ),
            draft_change_orders: (
              <span className="tabular-nums">
                {formatCurrency(contractTotals.draft_change_orders)}
              </span>
            ),
            invoiced_amount: (
              <span className="tabular-nums">
                {formatCurrency(contractTotals.invoiced_amount)}
              </span>
            ),
            payments_received: (
              <span className="tabular-nums">
                {formatCurrency(contractTotals.payments_received)}
              </span>
            ),
            remaining_balance: (
              <span className="tabular-nums">
                {formatCurrency(contractTotals.remaining_balance)}
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
            tableState.setSearchParams({
              per_page: String(parsed),
              page: "1",
            });
            tableState.setPage(1);
          },
        }}
      />

      {/* Project picker — opens when user clicks Create */}
      <GlobalProjectPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        toolPath="prime-contracts"
        toolLabel="Prime Contract"
      />

      {/* Single delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contract</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete contract{" "}
              <strong>{contractToDelete?.contract_number}</strong>
              {contractToDelete?.title ? (
                <>
                  {" "}
                  — <strong>{contractToDelete.title}</strong>
                </>
              ) : null}
              ?
              <br />
              <br />
              This action cannot be undone. Any associated line items and change
              orders must be deleted first.
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

      {/* Bulk delete confirmation */}
      <AlertDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {tableState.selectedIds.length} Contract
              {tableState.selectedIds.length === 1 ? "" : "s"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{tableState.selectedIds.length}</strong> selected
              contract{tableState.selectedIds.length === 1 ? "" : "s"}?
              <br />
              <br />
              This action cannot be undone. Contracts with associated line
              items or change orders will not be deleted.
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
                ? "Deleting..."
                : `Delete ${tableState.selectedIds.length} Contract${
                    tableState.selectedIds.length === 1 ? "" : "s"
                  }`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

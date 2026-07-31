"use client";

import * as React from "react";
import type { ReactElement } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, ArrowUpRight, Eye, SquarePen, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { useConfirmationDialog } from "@/components/common/ConfirmationDialog";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
  type TableColumn,
  TableRowActionsMenu,
  type TableRowActionItem,
} from "@/components/tables/unified";
import { ErrorState, StatusBadge } from "@/components/ds";
import { PageShell } from "@/components/layout";

/* ── Types ──────────────────────────────────────────────────────── */

interface PrimeContractPco {
  id: string;
  project_id: number;
  prime_contract_id: string;
  pco_number: string;
  title: string;
  status: "draft" | "pending" | "approved" | "void";
  description: string | null;
  total_amount: number;
  calculated_amount: number;
  schedule_impact: number | null;
  created_at: string;
  line_items_count: number;
  promoted_to_co_id: number | null;
  prime_contract?: {
    id: string;
    contract_number: string;
    title: string;
  };
}

type PcoFilterState = Record<string, FilterValue>;

/* ── Helpers ────────────────────────────────────────────────────── */

const EMPTY_FILTERS: PcoFilterState = {
  status: undefined,
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDateValue(dateValue: string | null | undefined): string {
  if (!dateValue) return "";
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString();
}

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/* ── Columns ────────────────────────────────────────────────────── */

const pcoColumns: Array<{ id: string; label: string }> = [
  { id: "pco_number", label: "PCO #" },
  { id: "title", label: "Title" },
  { id: "status", label: "Status" },
  { id: "prime_contract", label: "Prime Contract" },
  { id: "amount", label: "Amount" },
  { id: "line_items_count", label: "Line Items" },
  { id: "created_at", label: "Created" },
];

const pcoDefaultVisibleColumns = [
  "pco_number",
  "title",
  "status",
  "prime_contract",
  "amount",
  "line_items_count",
  "created_at",
];

const pcoFilters = [
  {
    id: "status",
    label: "Status",
    type: "select" as const,
    options: [
      { value: "draft", label: "Draft" },
      { value: "pending", label: "Pending" },
      { value: "approved", label: "Approved" },
      { value: "void", label: "Void" },
    ],
  },
];

function buildPcoTableColumns(): TableColumn<PrimeContractPco>[] {
  return [
    {
      id: "pco_number",
      label: "PCO #",
      width: 100,
      render: (item: PrimeContractPco) => (
        <span className="font-medium text-foreground">{item.pco_number}</span>
      ),
    },
    {
      id: "title",
      label: "Title",
      width: 280,
      render: (item: PrimeContractPco) => (
        <span className="text-foreground truncate block">
          {item.title}
        </span>
      ),
    },
    {
      id: "status",
      label: "Status",
      width: 120,
      render: (item: PrimeContractPco) => <StatusBadge status={item.status} />,
    },
    {
      id: "prime_contract",
      label: "Prime Contract",
      width: 200,
      render: (item: PrimeContractPco) => (
        <span className="text-muted-foreground truncate block">
          {item.prime_contract
            ? `${item.prime_contract.contract_number} - ${item.prime_contract.title}`
            : "--"}
        </span>
      ),
    },
    {
      id: "amount",
      label: "Amount",
      width: 130,
      render: (item: PrimeContractPco) => (
        <span className="tabular-nums text-foreground">
          {formatMoney(item.calculated_amount || item.total_amount || 0)}
        </span>
      ),
    },
    {
      id: "line_items_count",
      label: "Line Items",
      width: 100,
      render: (item: PrimeContractPco) => (
        <span className="tabular-nums text-muted-foreground">
          {item.line_items_count ?? 0}
        </span>
      ),
    },
    {
      id: "created_at",
      label: "Created",
      width: 120,
      render: (item: PrimeContractPco) => (
        <span className="text-muted-foreground">
          {formatDateValue(item.created_at)}
        </span>
      ),
    },
  ];
}

/* ── Page Component ─────────────────────────────────────────────── */

export default function PrimeContractPcosPage(): ReactElement {
  const params = useParams<{ projectId: string }>()!;
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = useSearchParams()!;

  const projectIdParamRaw = params.projectId;
  const parsedProjectId = projectIdParamRaw ? parseInt(projectIdParamRaw, 10) : NaN;
  const hasValidProjectId = Number.isFinite(parsedProjectId) && parsedProjectId > 0;
  const projectId = hasValidProjectId ? parsedProjectId : 0;

  const initialStatus = searchParams.get("status") ?? "";
  const initialFilters: PcoFilterState = {
    status: initialStatus || undefined,
  };

  const tableState = useUnifiedTableState({
    entityKey: "prime-contract-pcos",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "pco_number",
      sortDirection: "desc",
      visibleColumns: pcoDefaultVisibleColumns,
      filters: initialFilters,
    },
  });

  React.useEffect(() => {
    const nextStatus = searchParams.get("status") ?? "";
    tableState.setActiveFilters((prev) => {
      const normalizedStatus = nextStatus || undefined;
      if (prev.status === normalizedStatus) return prev;
      return { status: normalizedStatus };
    });
  }, [searchParams, tableState.setActiveFilters]);

  const activeFilters = tableState.activeFilters as PcoFilterState;
  const statusParam =
    searchParams.get("status") ??
    (typeof activeFilters.status === "string" ? activeFilters.status : "");

  /* ── Data fetching ──────────────────────────────────────────────── */

  const [pcos, setPcos] = React.useState<PrimeContractPco[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchPcos = React.useCallback(async () => {
    if (!hasValidProjectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (statusParam) queryParams.set("status", statusParam);
      const url = `/api/projects/${projectId}/prime-contract-pcos${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
      const data = await apiFetch<PrimeContractPco[]>(url);
      setPcos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load PCOs");
    } finally {
      setIsLoading(false);
    }
  }, [hasValidProjectId, projectId, statusParam]);

  React.useEffect(() => {
    fetchPcos();
  }, [fetchPcos]);

  /* ── Dialogs ────────────────────────────────────────────────────── */

  const deleteDialog = useConfirmationDialog({
    title: "Delete PCO",
    description:
      "Are you sure you want to delete this potential change order? This action cannot be undone.",
    confirmLabel: "Delete",
    variant: "destructive",
  });

  const bulkDeleteDialog = useConfirmationDialog({
    title: "Delete PCOs",
    description:
      "Are you sure you want to delete the selected potential change orders? This action cannot be undone.",
    confirmLabel: "Delete All",
    variant: "destructive",
  });

  const promoteDialog = useConfirmationDialog({
    title: "Promote to Change Order",
    description:
      "This will create an official Prime Contract Change Order (PCCO) from this PCO. Continue?",
    confirmLabel: "Promote",
    variant: "default",
  });

  const bulkPromoteDialog = useConfirmationDialog({
    title: "Promote Selected to Single PCCO",
    description:
      "This will combine selected eligible PCOs into one Prime Contract Change Order (PCCO). All selected PCOs must belong to the same prime contract.",
    confirmLabel: "Promote Selected",
    variant: "default",
  });

  /* ── Handlers ───────────────────────────────────────────────────── */

  const getPcoPath = React.useCallback(
    (item: PrimeContractPco) =>
      `/${projectId}/prime-contracts/${item.prime_contract_id}/change-orders/pcos/${item.id}`,
    [projectId],
  );

  const handleView = React.useCallback(
    (item: PrimeContractPco) => {
      router.push(getPcoPath(item));
    },
    [router, getPcoPath],
  );

  const handleEdit = React.useCallback(
    (item: PrimeContractPco) => {
      router.push(`${getPcoPath(item)}?edit=1`);
    },
    [router, getPcoPath],
  );

  const handleDelete = React.useCallback(
    (item: PrimeContractPco) => {
      deleteDialog.confirm(async () => {
        try {
          await apiFetch(
            `/api/projects/${projectId}/prime-contract-pcos/${item.id}`,
            { method: "DELETE" },
          );
          toast.success("PCO deleted");
          fetchPcos();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to delete PCO");
        }
      });
    },
    [projectId, fetchPcos, deleteDialog],
  );

  const handlePromote = React.useCallback(
    (item: PrimeContractPco) => {
      promoteDialog.confirm(async () => {
        try {
          const result = await apiFetch<{ message?: string }>(
            `/api/projects/${projectId}/prime-contract-pcos/${item.id}/promote`,
            { method: "POST" },
          );
          toast.success(result?.message || "PCO promoted to change order");
          fetchPcos();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to promote PCO");
        }
      });
    },
    [projectId, fetchPcos, promoteDialog],
  );

  const handleBulkDelete = React.useCallback(() => {
    const selectedIds = tableState.selectedIds;
    if (selectedIds.length === 0) {
      toast.info("Select at least one PCO to delete.");
      return;
    }

    bulkDeleteDialog.confirm(async () => {
      try {
        const results = await Promise.allSettled(
          selectedIds.map(async (id) => {
            await apiFetch(
              `/api/projects/${projectId}/prime-contract-pcos/${id}`,
              { method: "DELETE" },
            );
          }),
        );

        const failed = results.filter(
          (r): r is PromiseRejectedResult => r.status === "rejected",
        );
        const successCount = results.length - failed.length;

        if (successCount > 0) {
          toast.success(
            `${successCount} PCO${successCount === 1 ? "" : "s"} deleted`,
          );
        }
        if (failed.length > 0) {
          const reason = failed[0].reason?.message || "Unknown error";
          toast.error(
            failed.length === 1
              ? reason
              : `Failed to delete ${failed.length} PCO${failed.length === 1 ? "" : "s"}: ${reason}`,
          );
        }

        tableState.setSelectedIds([]);
        fetchPcos();
      } catch (err) {
        toast.error("Failed to bulk delete PCOs");
      }
    });
  }, [projectId, fetchPcos, tableState, bulkDeleteDialog]);

  const handleBulkPromote = React.useCallback(() => {
    const selectedIds = tableState.selectedIds;
    if (selectedIds.length === 0) {
      toast.info("Select at least one PCO to promote.");
      return;
    }

    bulkPromoteDialog.confirm(async () => {
      try {
        const payload = await apiFetch<{ message?: string }>(
          `/api/projects/${projectId}/prime-contract-pcos/promote-bulk`,
          {
            method: "POST",
            body: JSON.stringify({ pco_ids: selectedIds }),
          },
        );

        toast.success(payload?.message || "Selected PCOs promoted");
        tableState.setSelectedIds([]);
        fetchPcos();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to promote selected PCOs");
      }
    });
  }, [bulkPromoteDialog, fetchPcos, projectId, tableState]);

  /* ── Filter handling ────────────────────────────────────────────── */

  const handleFilterChange = React.useCallback(
    (nextFilters: PcoFilterState) => {
      tableState.setActiveFilters(nextFilters);
      tableState.setSearchParams({
        status: typeof nextFilters.status === "string" ? nextFilters.status : null,
        page: "1",
      });
      tableState.setPage(1);
    },
    [tableState],
  );

  /* ── Search + filter ────────────────────────────────────────────── */

  const filteredPcos = React.useMemo(() => {
    const searchTerm = tableState.debouncedSearch.trim().toLowerCase();
    if (!searchTerm) return pcos;

    return pcos.filter((pco) => {
      return (
        pco.pco_number.toLowerCase().includes(searchTerm) ||
        pco.title.toLowerCase().includes(searchTerm) ||
        (pco.description ?? "").toLowerCase().includes(searchTerm) ||
        (pco.prime_contract?.contract_number ?? "").toLowerCase().includes(searchTerm) ||
        (pco.prime_contract?.title ?? "").toLowerCase().includes(searchTerm)
      );
    });
  }, [pcos, tableState.debouncedSearch]);

  /* ── Export ──────────────────────────────────────────────────────── */

  const handleExport = React.useCallback(() => {
    const headers = ["PCO #", "Title", "Status", "Prime Contract", "Amount", "Line Items", "Created"];

    const rows = filteredPcos.map((pco) => {
      const contract = pco.prime_contract
        ? `${pco.prime_contract.contract_number} - ${pco.prime_contract.title}`
        : "";
      return [
        pco.pco_number,
        pco.title,
        pco.status,
        contract,
        String(pco.calculated_amount || pco.total_amount || 0),
        String(pco.line_items_count ?? 0),
        formatDateValue(pco.created_at),
      ]
        .map(escapeCsvField)
        .join(",");
    });

    const csvContent = [headers.map(escapeCsvField).join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "prime-contract-pcos-export.csv";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(
      `Exported ${filteredPcos.length} PCO${filteredPcos.length === 1 ? "" : "s"} to CSV`,
    );
  }, [filteredPcos]);

  /* ── Row actions ────────────────────────────────────────────────── */

  const renderRowActions = React.useCallback(
    (item: PrimeContractPco): React.ReactNode => {
      const actions: TableRowActionItem[] = [
        { key: "view", label: "View", icon: Eye, onSelect: () => handleView(item) },
      ];

      if (item.status === "draft" || item.status === "pending") {
        actions.push({
          key: "edit",
          label: "Edit",
          icon: SquarePen,
          onSelect: () => handleEdit(item),
        });
      }

      if (
        (item.status === "pending" || item.status === "approved") &&
        !item.promoted_to_co_id
      ) {
        actions.push({
          key: "promote",
          label: "Promote to PCCO",
          icon: ArrowUpRight,
          onSelect: () => handlePromote(item),
        });
      }

      if (item.status === "draft") {
        actions.push({
          key: "delete",
          label: "Delete",
          icon: Trash2,
          onSelect: () => handleDelete(item),
          destructive: true,
        });
      }

      return <TableRowActionsMenu items={actions} />;
    },
    [handleView, handleEdit, handleDelete, handlePromote],
  );

  /* ── Selection ──────────────────────────────────────────────────── */

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      tableState.setSelectedIds(filteredPcos.map((item) => String(item.id)));
      return;
    }
    tableState.setSelectedIds([]);
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      tableState.setSelectedIds((prev) => [...prev, id]);
      return;
    }
    tableState.setSelectedIds((prev) => prev.filter((itemId) => itemId !== id));
  };

  /* ── Grand totals ───────────────────────────────────────────────── */

  const grandTotals = React.useMemo(() => {
    let totalAmount = 0;
    for (const pco of filteredPcos) {
      totalAmount += pco.calculated_amount || pco.total_amount || 0;
    }
    return { amount: formatMoney(totalAmount) };
  }, [filteredPcos]);

  const tableColumns = React.useMemo(() => buildPcoTableColumns(), []);

  const isFiltered = Boolean(tableState.searchInput) || Boolean(activeFilters.status);

  /* ── Invalid project guard ──────────────────────────────────────── */

  if (!hasValidProjectId) {
    return (
      <PageShell
        variant="table"
        title="Prime Contract PCOs"
        description="Provide a valid project identifier to access PCOs."
      >
        <ErrorState
          title="Invalid Project"
          error="PCOs require a numeric project identifier. Navigate through the project workspace to continue."
        />
      </PageShell>
    );
  }

  /* ── Main render ────────────────────────────────────────────────── */

  return (
    <>
      <UnifiedTablePage
        header={{
          title: "Prime Contract PCOs",
          description:
            "Potential change orders are priced from linked change events. Start with a change event, then price the owner impact here.",
          actions: (
            <Button
              size="sm"
              onClick={() => router.push(`/${projectId}/change-events/new`)}
              className="gap-2"
              data-testid="pco-new-button"
            >
              <Plus />
              New Change Event
            </Button>
          ),
        }}
        toolbar={{
          totalItems: pcos.length,
          filteredItems: filteredPcos.length,
          selectedCount: tableState.selectedIds.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search PCOs...",
          currentView: tableState.currentView,
          onViewChange: (view) => {
            tableState.setCurrentView(view);
            tableState.setSearchParams({ view });
          },
          enabledViews: ["table"],
          filters: pcoFilters,
          activeFilters,
          onFilterChange: handleFilterChange,
          onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
          columns: pcoColumns,
          visibleColumns: tableState.visibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
          onExport: handleExport,
          onBulkDelete: handleBulkDelete,
          customActions: (
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkPromote}
              disabled={tableState.selectedIds.length === 0}
              className="gap-2"
            >
              <ArrowUpRight className="h-4 w-4" />
              Promote Selected
            </Button>
          ),
        }}
        data={{
          items: filteredPcos,
          isLoading,
          isFetching: false,
          error: error ? new Error(error) : null,
        }}
        table={{
          columns: tableColumns,
          getRowId: (item) => String(item.id),
          onRowClick: handleView,
          rowActions: renderRowActions,
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
            });
          },
        }}
        selection={{
          selectedIds: tableState.selectedIds,
          onSelectAll: handleSelectAll,
          onSelectRow: handleSelectRow,
        }}
        emptyState={{
          title: "No PCOs found",
          description:
            "Create a change event first, then price it into a potential change order.",
          filteredDescription: "Try adjusting your search or filters.",
          isFiltered,
          action: (
            <Button
              size="sm"
              onClick={() => router.push(`/${projectId}/change-events/new`)}
            >
              New Change Event
            </Button>
          ),
        }}
        footerTotals={{
          label: "Grand Totals",
          values: {
            amount: <span className="tabular-nums">{grandTotals.amount}</span>,
            status: <span>--</span>,
            prime_contract: <span>--</span>,
            line_items_count: <span>--</span>,
            created_at: <span>--</span>,
          },
        }}
        features={{
          enableExport: true,
          enableBulkDelete: true,
        }}
        layout={{
          fullBleedTable: true,
          removeTableFrame: true,
          plainFooterTotals: true,
        }}
      />
      {deleteDialog.dialog}
      {bulkDeleteDialog.dialog}
      {promoteDialog.dialog}
      {bulkPromoteDialog.dialog}
    </>
  );
}

"use client";

import * as React from "react";
import type { ReactElement } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, Plus } from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { useConfirmationDialog } from "@/components/common/ConfirmationDialog";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
} from "@/components/tables/unified";
import { PageShell } from "@/components/layout";
import { ErrorState } from "@/components/ds";
import {
  buildPcoTableColumns,
  pcoColumns,
  pcoDefaultVisibleColumns,
  pcoFilters,
  formatMoney,
  renderPcoCard,
  renderPcoList,
  renderPcoRowActions,
  type CommitmentPco,
} from "@/features/commitment-pcos/commitment-pcos-table-config";

type PcoFilterState = Record<string, FilterValue>;

const EMPTY_FILTERS: PcoFilterState = {
  status: undefined,
  commitment_type: undefined,
};

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

export default function CommitmentPcosPage(): ReactElement {
  const params = useParams<{ projectId: string }>()!;
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = useSearchParams()!;

  const projectIdParamRaw = params.projectId;
  const parsedProjectId = projectIdParamRaw ? parseInt(projectIdParamRaw, 10) : NaN;
  const hasValidProjectId = Number.isFinite(parsedProjectId) && parsedProjectId > 0;
  const projectId = hasValidProjectId ? parsedProjectId : 0;

  const initialStatus = searchParams.get("status") ?? "";
  const initialType = searchParams.get("commitment_type") ?? "";
  const initialFilters: PcoFilterState = {
    status: initialStatus || undefined,
    commitment_type: initialType || undefined,
  };

  const tableState = useUnifiedTableState({
    entityKey: "commitment-pcos",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table", "card", "list"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "pco_number",
      sortDirection: "asc",
      visibleColumns: pcoDefaultVisibleColumns,
      filters: initialFilters,
    },
  });

  React.useEffect(() => {
    const nextStatus = searchParams.get("status") ?? "";
    const nextType = searchParams.get("commitment_type") ?? "";

    tableState.setActiveFilters((prev) => {
      const normalizedStatus = nextStatus || undefined;
      const normalizedType = nextType || undefined;
      if (prev.status === normalizedStatus && prev.commitment_type === normalizedType) {
        return prev;
      }
      return {
        status: normalizedStatus,
        commitment_type: normalizedType,
      };
    });
  }, [searchParams, tableState.setActiveFilters]);

  const activeFilters = tableState.activeFilters as PcoFilterState;

  // Fetch PCOs
  const [pcos, setPcos] = React.useState<CommitmentPco[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchPcos = React.useCallback(async () => {
    if (!hasValidProjectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const statusParam =
        typeof activeFilters.status === "string" ? activeFilters.status : "";
      const url = new URL(
        `/api/projects/${projectId}/commitment-pcos`,
        window.location.origin,
      );
      if (statusParam) url.searchParams.set("status", statusParam);

      const data = await apiFetch<unknown>(url.toString());
      setPcos(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load PCOs");
    } finally {
      setIsLoading(false);
    }
  }, [hasValidProjectId, projectId, activeFilters.status]);

  React.useEffect(() => {
    fetchPcos();
  }, [fetchPcos]);

  // Client-side filtering
  const filteredPcos = React.useMemo(() => {
    const searchTerm = tableState.debouncedSearch.trim().toLowerCase();
    const typeFilter =
      typeof activeFilters.commitment_type === "string"
        ? activeFilters.commitment_type
        : "";

    return pcos.filter((pco) => {
      if (typeFilter && pco.commitment_type !== typeFilter) return false;

      if (!searchTerm) return true;

      return (
        pco.pco_number.toLowerCase().includes(searchTerm) ||
        (pco.title ?? "").toLowerCase().includes(searchTerm) ||
        (pco.commitment?.title ?? "").toLowerCase().includes(searchTerm) ||
        (pco.commitment?.contract_number ?? "").toLowerCase().includes(searchTerm)
      );
    });
  }, [pcos, tableState.debouncedSearch, activeFilters.commitment_type]);

  // Dialogs
  const deleteDialog = useConfirmationDialog({
    title: "Delete PCO",
    description:
      "Are you sure you want to delete this PCO? This action cannot be undone.",
    confirmLabel: "Delete",
    variant: "destructive",
  });

  const bulkDeleteDialog = useConfirmationDialog({
    title: "Delete PCOs",
    description:
      "Are you sure you want to delete the selected PCOs? This action cannot be undone.",
    confirmLabel: "Delete All",
    variant: "destructive",
  });

  const promoteDialog = useConfirmationDialog({
    title: "Promote to Change Order",
    description:
      "This will create an official Commitment Change Order (CCO) from this PCO. Continue?",
    confirmLabel: "Promote",
    variant: "default",
  });

  const bulkPromoteDialog = useConfirmationDialog({
    title: "Promote Selected to Single CCO",
    description:
      "This will combine selected eligible PCOs into one Commitment Change Order (CCO). All selected PCOs must belong to the same commitment.",
    confirmLabel: "Promote Selected",
    variant: "default",
  });

  // Handlers
  const handleView = React.useCallback(
    (item: CommitmentPco) => {
      router.push(`/${projectId}/commitment-pcos/${item.id}`);
    },
    [projectId, router],
  );

  const handleEdit = React.useCallback(
    (item: CommitmentPco) => {
      router.push(`/${projectId}/commitment-pcos/${item.id}?edit=1`);
    },
    [projectId, router],
  );

  const handleDelete = React.useCallback(
    (item: CommitmentPco) => {
      deleteDialog.confirm(async () => {
        try {
          await apiFetch(
            `/api/projects/${projectId}/commitment-pcos/${item.id}`,
            { method: "DELETE" },
          );
          toast.success("PCO deleted");
          fetchPcos();
        } catch (err) {
          toast.error("Failed to delete PCO");
        }
      });
    },
    [projectId, fetchPcos, deleteDialog],
  );

  const handlePromote = React.useCallback(
    (item: CommitmentPco) => {
      promoteDialog.confirm(async () => {
        try {
          await apiFetch(
            `/api/projects/${projectId}/commitment-pcos/${item.id}/promote`,
            { method: "POST" },
          );
          toast.success("PCO promoted to Change Order");
          fetchPcos();
        } catch (err) {
          toast.error("Failed to promote PCO");
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
          selectedIds.map((id) =>
            apiFetch(
              `/api/projects/${projectId}/commitment-pcos/${id}`,
              { method: "DELETE" },
            ),
          ),
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
        const body = await apiFetch(
          `/api/projects/${projectId}/commitment-pcos/promote-bulk`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pco_ids: selectedIds }),
          },
        ) as { message?: string };

        toast.success((body as { message?: string }).message || "Selected PCOs promoted");
        tableState.setSelectedIds([]);
        fetchPcos();
      } catch (err) {
        toast.error("Failed to promote selected PCOs");
      }
    });
  }, [bulkPromoteDialog, fetchPcos, projectId, tableState]);

  const handleFilterChange = React.useCallback(
    (nextFilters: PcoFilterState) => {
      tableState.setActiveFilters(nextFilters);
      tableState.setSearchParams({
        status: typeof nextFilters.status === "string" ? nextFilters.status : null,
        commitment_type:
          typeof nextFilters.commitment_type === "string"
            ? nextFilters.commitment_type
            : null,
        page: "1",
      });
      tableState.setPage(1);
    },
    [tableState],
  );

  const handleExport = React.useCallback(() => {
    const headers = [
      "PCO #",
      "Title",
      "Status",
      "Commitment",
      "Type",
      "Amount",
      "Source CEs",
      "Created",
    ];

    const rows = filteredPcos.map((pco) => {
      return [
        pco.pco_number,
        pco.title || "",
        pco.status || "",
        pco.commitment?.title || pco.commitment?.contract_number || "",
        pco.commitment_type === "subcontract" ? "Subcontract" : "Purchase Order",
        String(pco.total_amount ?? 0),
        String(pco.linked_change_events_count ?? 0),
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
    link.download = "commitment-pcos-export.csv";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(
      `Exported ${filteredPcos.length} PCO${filteredPcos.length === 1 ? "" : "s"} to CSV`,
    );
  }, [filteredPcos]);

  const tableColumns = React.useMemo(() => buildPcoTableColumns(), []);

  const totalItems = pcos.length;
  const filteredItems = filteredPcos.length;

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

  const isFiltered =
    Boolean(tableState.searchInput) ||
    Boolean(activeFilters.status) ||
    Boolean(activeFilters.commitment_type);

  // Grand totals
  const grandTotals = React.useMemo(() => {
    let totalAmount = 0;
    let totalCes = 0;
    for (const pco of filteredPcos) {
      totalAmount += Number(pco.total_amount ?? 0);
      totalCes += pco.linked_change_events_count ?? 0;
    }
    return {
      total_amount: formatMoney(totalAmount),
      source_ces: String(totalCes),
    };
  }, [filteredPcos]);

  if (!hasValidProjectId) {
    return (
      <PageShell
        variant="table"
        title="Commitment PCOs"
        description="Provide a valid project identifier to access commitment PCOs."
      >
        <ErrorState
          title="Invalid Project"
          error="Commitment PCOs require a numeric project identifier. Navigate through the project workspace to continue."
        />
      </PageShell>
    );
  }

  return (
    <>
      <UnifiedTablePage
        header={{
          title: "Commitment PCOs",
          description:
            "Potential change orders are priced from linked change events. Start with a change event, then price the subcontractor or vendor impact here.",
          actions: (
            <Button
              size="sm"
              onClick={() => router.push(`/${projectId}/change-events/new`)}
              className="gap-2"
              data-testid="commitment-pcos-new-button"
            >
              <Plus />
              New Change Event
            </Button>
          ),
        }}
        toolbar={{
          totalItems,
          filteredItems,
          selectedCount: tableState.selectedIds.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search commitment PCOs...",
          currentView: tableState.currentView,
          onViewChange: (view) => {
            tableState.setCurrentView(view);
            tableState.setSearchParams({ view });
          },
          enabledViews: ["table", "card", "list"],
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
          error: error ? new Error(error) : undefined,
        }}
        table={{
          columns: tableColumns,
          getRowId: (item) => String(item.id),
          onRowClick: handleView,
          rowActions: (item) =>
            renderPcoRowActions(item, handleView, handleEdit, handleDelete, handlePromote),
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
        views={{
          card: (item) => renderPcoCard(item, handleView),
          list: (item) => renderPcoList(item, handleView),
        }}
        emptyState={{
          title: "No commitment PCOs found",
          description:
            "Create a change event first, then price it into a commitment PCO.",
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
            total_amount: (
              <span className="tabular-nums">{grandTotals.total_amount}</span>
            ),
            source_ces: (
              <span className="tabular-nums">{grandTotals.source_ces}</span>
            ),
            status: <span>--</span>,
            commitment_name: <span>--</span>,
            commitment_type: <span>--</span>,
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

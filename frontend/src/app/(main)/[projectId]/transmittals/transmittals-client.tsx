"use client";

import * as React from "react";
import type { ReactElement } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";

import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
} from "@/components/tables/unified";
import { Button } from "@/components/ui/button";
import { useProjectTitle } from "@/hooks/useProjectTitle";
import { useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import {
  useTransmittals,
  useDeleteTransmittal,
  transmittalKeys,
  type TransmittalSummary,
} from "@/hooks/use-transmittals";
import {
  buildTransmittalTableColumns,
  transmittalColumns,
  transmittalDefaultVisibleColumns,
  transmittalFilters,
  renderTransmittalCard,
  renderTransmittalList,
  type TransmittalTableRow,
} from "@/features/transmittals/transmittals-table-config";
import { TransmittalFormDialog } from "@/features/transmittals/transmittal-form-dialog";

type TransmittalFilterState = Record<string, FilterValue>;

const EMPTY_FILTERS: TransmittalFilterState = {
  status: undefined,
  delivery_method: undefined,
};

function toTableRow(item: TransmittalSummary): TransmittalTableRow {
  return {
    id: item.id,
    number: item.number ?? "",
    subject: item.subject ?? "Untitled Transmittal",
    status: item.status ?? "Draft",
    to_company: item.to_company ?? null,
    from_company: item.from_company ?? null,
    delivery_method: item.delivery_method ?? null,
    sent_date: item.sent_date ?? null,
    due_date: item.due_date ?? null,
    ball_in_court: item.ball_in_court ?? null,
    is_private: item.is_private ?? false,
    deleted_at: item.deleted_at ?? null,
  };
}

export default function TransmittalsClient(): ReactElement {
  const params = useParams<{ projectId: string }>()! ?? { projectId: "" };
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = (useSearchParams() ?? new URLSearchParams()) as NonNullable<ReturnType<typeof useSearchParams>>;

  const projectId = parseInt(params.projectId ?? "", 10);
  const activeTab = searchParams.get("tab") || "items";

  useProjectTitle("Transmittals");

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const deleteTransmittal = useDeleteTransmittal(projectId);
  const queryClient = useQueryClient();

  const handleInlineUpdate = React.useCallback(
    async (transmittalId: string, data: Record<string, unknown>) => {
      await apiFetch(`/api/projects/${projectId}/transmittals/${transmittalId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      await queryClient.invalidateQueries({
        queryKey: transmittalKeys.all(projectId),
      });
    },
    [projectId, queryClient],
  );

  const initialFilters: TransmittalFilterState = {
    status: searchParams.get("status") ?? undefined,
    delivery_method: searchParams.get("delivery_method") ?? undefined,
  };

  const tableState = useUnifiedTableState({
    entityKey: "transmittals",
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
      visibleColumns: transmittalDefaultVisibleColumns,
      filters: initialFilters,
    },
  });

  const { data: transmittals = [], isLoading } = useTransmittals(
    projectId,
    activeTab === "recycle-bin" ? "recycle-bin" : undefined,
  );

  const tableRows = React.useMemo<TransmittalTableRow[]>(
    () => transmittals.map(toTableRow),
    [transmittals],
  );

  const activeFilters = tableState.activeFilters as TransmittalFilterState;

  const filteredItems = React.useMemo(() => {
    const search = tableState.debouncedSearch.trim().toLowerCase();
    const statusFilter =
      typeof activeFilters.status === "string" ? activeFilters.status : "";
    const deliveryFilter =
      typeof activeFilters.delivery_method === "string"
        ? activeFilters.delivery_method
        : "";

    return tableRows.filter((row) => {
      if (statusFilter && row.status !== statusFilter) return false;
      if (deliveryFilter && row.delivery_method !== deliveryFilter) return false;
      if (!search) return true;
      return (
        row.number.toLowerCase().includes(search) ||
        row.subject.toLowerCase().includes(search) ||
        (row.to_company ?? "").toLowerCase().includes(search) ||
        (row.from_company ?? "").toLowerCase().includes(search) ||
        row.status.toLowerCase().includes(search)
      );
    });
  }, [activeFilters, tableRows, tableState.debouncedSearch]);

  const tableColumns = React.useMemo(
    () => buildTransmittalTableColumns({ onUpdate: handleInlineUpdate }),
    [handleInlineUpdate],
  );

  const tabs = [
    {
      label: "Items",
      href: `/${projectId}/transmittals`,
      count: activeTab === "items" ? filteredItems.length : undefined,
      isActive: activeTab === "items",
      testId: "transmittals-tab-items",
    },
    {
      label: "Recycle Bin",
      href: `/${projectId}/transmittals?tab=recycle-bin`,
      isActive: activeTab === "recycle-bin",
    },
  ];

  const handleFilterChange = (nextFilters: TransmittalFilterState) => {
    tableState.setActiveFilters(nextFilters);
    tableState.setSearchParams({
      status:
        typeof nextFilters.status === "string" ? nextFilters.status : null,
      delivery_method:
        typeof nextFilters.delivery_method === "string"
          ? nextFilters.delivery_method
          : null,
      page: "1",
    });
    tableState.setPage(1);
  };

  const isFiltered =
    Boolean(tableState.searchInput) ||
    Boolean(activeFilters.status) ||
    Boolean(activeFilters.delivery_method);

  return (
    <>
      <UnifiedTablePage
        header={{
          title: "Transmittals",
          description: "Manage document transmittals and delivery tracking",
          actions: (
            <Button
              size="sm"
              data-testid="transmittals-create"
              onClick={() => setDialogOpen(true)}
            >
              <Plus />
              Add Transmittal
            </Button>
          ),
        }}
        tabs={tabs}
        toolbar={{
          totalItems: tableRows.length,
          filteredItems: filteredItems.length,
          selectedCount: tableState.selectedIds.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search transmittals...",
          currentView: tableState.currentView,
          onViewChange: (view) => {
            tableState.setCurrentView(view);
            tableState.setSearchParams({ view });
          },
          enabledViews: ["table", "card", "list"],
          filters: transmittalFilters,
          activeFilters,
          onFilterChange: handleFilterChange,
          onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
          columns: transmittalColumns,
          visibleColumns: tableState.visibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
        }}
        data={{
          items: filteredItems,
          isLoading,
          isFetching: false,
        }}
        table={{
          columns: tableColumns,
          getRowId: (item) => String(item.id),
          onRowClick: (item) =>
            router.push(`/${projectId}/transmittals/${item.id}`),
          onDelete: (item) => deleteTransmittal.mutate(String(item.id)),
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
        views={{
          card: (item) =>
            renderTransmittalCard(item, (r) =>
              router.push(`/${projectId}/transmittals/${r.id}`),
            ),
          list: (item) =>
            renderTransmittalList(item, (r) =>
              router.push(`/${projectId}/transmittals/${r.id}`),
            ),
        }}
        emptyState={{
          title:
            activeTab === "recycle-bin"
              ? "Recycle Bin is empty"
              : "No transmittals found",
          description:
            activeTab === "recycle-bin"
              ? "No transmittals in the Recycle Bin."
              : "Create your first transmittal to get started.",
          filteredDescription: "Try adjusting your search or filters.",
          isFiltered,
          action:
            activeTab === "recycle-bin" ? undefined : (
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus />
                Create your first transmittal
              </Button>
            ),
        }}
        features={{
          enableExport: true,
          enableBulkDelete: false,
          enableRowSelection: false,
        }}
      />

      <TransmittalFormDialog
        projectId={projectId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}

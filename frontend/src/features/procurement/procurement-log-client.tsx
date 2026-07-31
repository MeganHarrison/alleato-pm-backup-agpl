"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { UnifiedTablePage, useUnifiedTableState, type FilterValue } from "@/components/tables/unified";
import { useProcurementItems } from "@/hooks/use-procurement";
import {
  procurementDefaultVisibleColumns,
  procurementFilters,
  procurementTableColumns,
} from "@/features/procurement/procurement-table-config";

export function ProcurementLogClient() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectId = Number(params?.projectId);
  const procurementQuery = useProcurementItems(projectId);
  const tableState = useUnifiedTableState({
    entityKey: "procurement-log",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 50,
      sortBy: "updated_at",
      sortDirection: "desc",
      visibleColumns: procurementDefaultVisibleColumns,
      filters: {},
    },
  });
  const items = procurementQuery.data?.data ?? [];
  const filteredItems = React.useMemo(() => {
    const search = tableState.debouncedSearch.trim().toLowerCase();
    const lifecycleStatus = tableState.activeFilters.lifecycle_status;
    return items.filter((item) => {
      const matchesSearch = !search || [
        item.title,
        item.description ?? "",
        ...item.procurement_item_submittal_links.map((link) => link.submittals?.title ?? ""),
        ...item.procurement_item_schedule_task_links.map((link) => link.schedule_tasks?.name ?? ""),
      ].some((value) => value.toLowerCase().includes(search));
      const matchesStatus = !lifecycleStatus || item.lifecycle_status === lifecycleStatus;
      return matchesSearch && matchesStatus;
    });
  }, [items, tableState.activeFilters.lifecycle_status, tableState.debouncedSearch]);
  const isFiltered = Boolean(tableState.searchInput || tableState.activeFilters.lifecycle_status);

  function updateFilters(nextFilters: Record<string, FilterValue>) {
    tableState.setActiveFilters(nextFilters);
    tableState.setPage(1);
    tableState.setSearchParams({ lifecycle_status: typeof nextFilters.lifecycle_status === "string" ? nextFilters.lifecycle_status : null, page: "1" });
  }

  return (
    <UnifiedTablePage
      header={{
        title: "Procurement Log",
        actions: (
          <Button size="sm" onClick={() => router.push(`/${projectId}/procurement/new`)}>
            <Plus className="size-4" />
            Add procurement item
          </Button>
        ),
      }}
      toolbar={{
        totalItems: items.length,
        filteredItems: filteredItems.length,
        selectedCount: 0,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search materials, submittals, or activities...",
        currentView: tableState.currentView,
        onViewChange: tableState.setCurrentView,
        enabledViews: ["table"],
        filters: procurementFilters,
        activeFilters: tableState.activeFilters,
        onFilterChange: updateFilters,
        onClearFilters: () => updateFilters({}),
        columns: procurementTableColumns,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
      }}
      data={{ items: filteredItems, isLoading: procurementQuery.isLoading, error: procurementQuery.error instanceof Error ? procurementQuery.error.message : null }}
      table={{
        columns: procurementTableColumns,
        getRowId: (item) => item.id,
        onRowClick: (item) => router.push(`/${projectId}/procurement/${item.id}`),
      }}
      sorting={{
        sortBy: tableState.sortBy,
        sortDirection: tableState.sortDirection,
        onSortChange: (sortBy, sortDirection) => {
          tableState.setSortBy(sortBy);
          tableState.setSortDirection(sortDirection);
          tableState.setSearchParams({ sort: sortBy, sort_dir: sortDirection });
        },
      }}
      emptyState={{
        title: "No procurement items yet",
        description: "Add a material or component, then link its submittal and schedule activity.",
        filteredDescription: "Try adjusting the search or status filter.",
        isFiltered,
        action: <Button size="sm" onClick={() => router.push(`/${projectId}/procurement/new`)}><Plus className="size-4" /> Add procurement item</Button>,
      }}
      features={{ enableRowSelection: false }}
      pagination={{
        page: tableState.page,
        totalPages: Math.max(1, Math.ceil(filteredItems.length / tableState.perPage)),
        perPage: tableState.perPage,
        onPageChange: tableState.setPage,
        onPerPageChange: tableState.setPerPage,
        clientSide: true,
      }}
    />
  );
}

"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
} from "@/components/tables/unified";
import {
  buildProjectCreationLogColumns,
  projectCreationLogColumnConfig,
  projectCreationLogDefaultVisibleColumns,
  projectCreationLogFilters,
} from "@/features/project-creation-log/project-creation-log-table-config";
import { useProjectCreationLog } from "@/hooks/use-project-creation-log-query";

export function ProjectCreationLogClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tableState = useUnifiedTableState({
    entityKey: "project-creation-log",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 50,
      search: "",
      visibleColumns: projectCreationLogDefaultVisibleColumns,
      filters: {
        created_via: searchParams?.get("created_via") ?? undefined,
        attribution_status:
          searchParams?.get("attribution_status") ?? undefined,
      },
    },
  });

  const activeFilters = useMemo<Record<string, FilterValue>>(
    () => ({
      created_via: searchParams?.get("created_via") ?? undefined,
      attribution_status:
        searchParams?.get("attribution_status") ?? undefined,
    }),
    [searchParams],
  );

  const { data, isLoading, isFetching, error } = useProjectCreationLog({
    page: tableState.page,
    perPage: tableState.perPage,
    search: tableState.debouncedSearch,
    createdVia:
      typeof activeFilters.created_via === "string"
        ? activeFilters.created_via
        : "",
    attributionStatus:
      typeof activeFilters.attribution_status === "string"
        ? activeFilters.attribution_status
        : "",
  });

  const columns = useMemo(() => buildProjectCreationLogColumns(), []);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const hasActiveFilters = Boolean(
    activeFilters.created_via || activeFilters.attribution_status,
  );

  function handleFilterChange(filters: Record<string, FilterValue>) {
    tableState.setActiveFilters(filters);
    tableState.setSearchParams({
      created_via:
        typeof filters.created_via === "string" ? filters.created_via : null,
      attribution_status:
        typeof filters.attribution_status === "string"
          ? filters.attribution_status
          : null,
      page: "1",
    });
  }

  return (
    <UnifiedTablePage
      header={{
        title: "Project Creation Log",
        description:
          "Authenticated user or integration evidence captured when each project was created.",
        mobileActionsInline: false,
      }}
      toolbar={{
        totalItems: total,
        filteredItems: total,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search project or job number…",
        currentView: tableState.currentView,
        enabledViews: ["table"],
        onViewChange: tableState.setCurrentView,
        filters: projectCreationLogFilters,
        activeFilters,
        onFilterChange: handleFilterChange,
        onClearFilters: () =>
          handleFilterChange({
            created_via: undefined,
            attribution_status: undefined,
          }),
        columns: projectCreationLogColumnConfig,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
      }}
      data={{
        items,
        isLoading,
        isFetching,
        error: error ?? undefined,
      }}
      table={{
        columns,
        getRowId: (item) => item.id,
        stickyHeader: true,
      }}
      pagination={{
        page: tableState.page,
        perPage: tableState.perPage,
        totalPages: Math.max(1, Math.ceil(total / tableState.perPage)),
        onPageChange: (page) => {
          tableState.setPage(page);
          tableState.setSearchParams({ page: String(page) });
        },
        onPerPageChange: (perPage) => {
          tableState.setPerPage(Number(perPage));
          tableState.setSearchParams({ per_page: perPage, page: "1" });
        },
      }}
      emptyState={{
        title: "No project creation events",
        description: "New project creation events will appear here.",
        filteredDescription:
          "No creation events match the current search or filters.",
        isFiltered: Boolean(tableState.debouncedSearch) || hasActiveFilters,
      }}
      layout={{
        fullBleedTable: true,
        alignHeaderWithFullBleedTable: true,
        minWidth: 940,
        toolbarInlineWithHeader: false,
      }}
      features={{
        enableSorting: false,
        enableViews: false,
        enableBulkDelete: false,
        enableRowSelection: false,
        enableRowActions: false,
        enableRowReorder: false,
        enableInlineEditing: false,
      }}
    />
  );
}

"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
} from "@/components/tables/unified";
import {
  aiFeatureColumns,
  aiFeatureDefaultVisibleColumns,
  aiFeatureFilters,
  aiFeatures,
  buildAiFeatureTableColumns,
} from "@/features/ai/ai-features-table-config";

const EMPTY_FILTERS: Record<string, FilterValue> = { category: undefined };

export default function AiFeaturesPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tableState = useUnifiedTableState({
    entityKey: "ai-features",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "name",
      sortDirection: "asc",
      visibleColumns: aiFeatureDefaultVisibleColumns,
      filters: EMPTY_FILTERS,
    },
  });
  const activeFilters = React.useMemo<Record<string, FilterValue>>(
    () => ({ category: searchParams.get("category") ?? undefined }),
    [searchParams],
  );
  const columns = React.useMemo(() => buildAiFeatureTableColumns(), []);
  const filteredFeatures = React.useMemo(() => {
    const search = tableState.debouncedSearch.trim().toLowerCase();
    const category = activeFilters.category;

    return aiFeatures.filter((feature) => {
      const matchesCategory = !category || feature.category === category;
      const matchesSearch =
        !search ||
        [feature.name, feature.summary, feature.workflow, feature.category]
          .join(" ")
          .toLowerCase()
          .includes(search);

      return matchesCategory && matchesSearch;
    });
  }, [activeFilters.category, tableState.debouncedSearch]);

  const hasActiveFilters = Object.values(activeFilters).some(Boolean);

  function handleFilterChange(filters: Record<string, FilterValue>) {
    tableState.setSearchParams({ ...filters, page: "1" });
  }

  return (
    <UnifiedTablePage
      header={{
        title: "AI Features",
        description:
          "Compare AI capabilities, operating controls, and the workflows they support.",
      }}
      toolbar={{
        totalItems: aiFeatures.length,
        filteredItems: filteredFeatures.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search AI features…",
        currentView: tableState.currentView,
        onViewChange: tableState.setCurrentView,
        enabledViews: ["table"],
        filters: aiFeatureFilters,
        activeFilters,
        onFilterChange: handleFilterChange,
        onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
        columns: aiFeatureColumns,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
      }}
      data={{ items: filteredFeatures, isLoading: false }}
      sorting={{
        sortBy: tableState.sortBy,
        sortDirection: tableState.sortDirection,
        onSortChange: (sortBy, sortDirection) => {
          tableState.setSortBy(sortBy);
          tableState.setSortDirection(sortDirection);
        },
      }}
      table={{
        columns,
        getRowId: (feature) => feature.id,
        onRowClick: (feature) => router.push(feature.href),
        stickyHeader: true,
      }}
      emptyState={{
        title: "No AI features found",
        description: "Available AI capabilities will appear here.",
        filteredDescription:
          "No AI features match the current search or category.",
        isFiltered:
          Boolean(tableState.debouncedSearch.trim()) || hasActiveFilters,
      }}
      layout={{ fullBleedTable: false }}
      features={{
        enableRowSelection: false,
        enableRowActions: false,
        enableViews: false,
      }}
      reportContext={{
        projectName: "Alleato",
        projectDescription: "AI workflow catalog",
      }}
    />
  );
}

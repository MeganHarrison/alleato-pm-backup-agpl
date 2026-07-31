"use client";

import * as React from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";

import {
  useUnifiedTableState,
  type FilterValue,
  type ViewMode,
} from "@/components/tables/unified";
import type {
  ServerTableDefinition,
  ServerTableFilters,
  ServerTableQueryState,
} from "./types";

interface UseServerTableDefinitionOptions<
  TItem,
  TFilters extends ServerTableFilters,
> {
  definition: ServerTableDefinition<TItem, TFilters>;
  pathname: string | null;
  router: { replace: (url: string) => void };
  searchParams: ReadonlyURLSearchParams | null;
}

function createSearchParamsSnapshot(
  searchParams: ReadonlyURLSearchParams | null,
): URLSearchParams {
  return new URLSearchParams(searchParams?.toString() ?? "");
}

function areFiltersEqual(
  left: ServerTableFilters,
  right: ServerTableFilters,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;

  for (const key of leftKeys) {
    const leftValue = left[key];
    const rightValue = right[key];
    if (Array.isArray(leftValue) || Array.isArray(rightValue)) {
      if (!Array.isArray(leftValue) || !Array.isArray(rightValue)) return false;
      if (leftValue.length !== rightValue.length) return false;
      for (let index = 0; index < leftValue.length; index += 1) {
        if (leftValue[index] !== rightValue[index]) return false;
      }
      continue;
    }
    if (leftValue !== rightValue) return false;
  }

  return true;
}

export function useServerTableDefinition<
  TItem,
  TFilters extends ServerTableFilters,
>({
  definition,
  pathname,
  router,
  searchParams,
}: UseServerTableDefinitionOptions<TItem, TFilters>) {
  const parsedFilters = React.useMemo<TFilters>(() => {
    const params = createSearchParamsSnapshot(searchParams);
    return {
      ...definition.defaultFilters,
      ...(definition.parseFiltersFromSearchParams?.(params) ?? {}),
    };
  }, [definition, searchParams]);

  const tableState = useUnifiedTableState({
    entityKey: definition.entityKey,
    searchParams,
    pathname,
    router,
    defaults: {
      view: definition.defaultView ?? "table",
      allowedViews: definition.allowedViews,
      page: 1,
      perPage: definition.defaultPerPage,
      search: "",
      sortBy: definition.defaultSortBy,
      sortDirection: definition.defaultSortDirection,
      visibleColumns: definition.defaultVisibleColumns,
      filters: parsedFilters,
    },
  });

  const [items, setItems] = React.useState<TItem[]>([]);
  const [totalItems, setTotalItems] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isFetching, setIsFetching] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  const activeFilters = tableState.activeFilters as TFilters;

  React.useEffect(() => {
    if (areFiltersEqual(activeFilters, parsedFilters)) return;
    tableState.setActiveFilters(parsedFilters);
  }, [activeFilters, parsedFilters, tableState]);

  const refresh = React.useCallback(
    async (overrides?: Partial<ServerTableQueryState<TFilters>>) => {
      setIsLoading(items.length === 0);
      setIsFetching(true);
      setError(null);

      try {
        const result = await definition.fetchPage({
          search: overrides?.search ?? tableState.debouncedSearch,
          filters: overrides?.filters ?? activeFilters,
          page: overrides?.page ?? tableState.page,
          perPage: overrides?.perPage ?? tableState.perPage,
          sortBy: overrides?.sortBy ?? tableState.sortBy,
          sortDirection: overrides?.sortDirection ?? tableState.sortDirection,
        });

        setItems(result.items);
        setTotalItems(result.total);
        setTotalPages(Math.max(result.totalPages, 1));
      } catch (fetchError) {
        setItems([]);
        setTotalItems(0);
        setTotalPages(1);
        setError(
          fetchError instanceof Error
            ? fetchError
            : new Error("Failed to load table data."),
        );
      } finally {
        setIsLoading(false);
        setIsFetching(false);
      }
    },
    [
      activeFilters,
      definition,
      items.length,
      tableState.debouncedSearch,
      tableState.page,
      tableState.perPage,
      tableState.sortBy,
      tableState.sortDirection,
    ],
  );

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const serializeFilters = React.useCallback(
    (filters: TFilters) =>
      definition.serializeFiltersToSearchParams?.(filters) ?? {},
    [definition],
  );

  const handleViewChange = React.useCallback(
    (view: ViewMode) => {
      tableState.setCurrentView(view);
      tableState.setSearchParams({ view });
    },
    [tableState],
  );

  const handleFilterChange = React.useCallback(
    (filters: TFilters) => {
      tableState.setActiveFilters(filters);
      tableState.setPage(1);
      tableState.setSearchParams({
        ...serializeFilters(filters),
        page: "1",
      });
    },
    [serializeFilters, tableState],
  );

  const handleClearFilters = React.useCallback(() => {
    handleFilterChange(definition.defaultFilters);
  }, [definition.defaultFilters, handleFilterChange]);

  const handleSortChange = React.useCallback(
    (sortBy: string | null, sortDirection: "asc" | "desc") => {
      tableState.setSortBy(sortBy);
      tableState.setSortDirection(sortDirection);
      tableState.setPage(1);
      tableState.setSearchParams({
        sort: sortBy,
        sort_dir: sortBy ? sortDirection : null,
        page: "1",
      });
    },
    [tableState],
  );

  const handlePageChange = React.useCallback(
    (page: number) => {
      tableState.setPage(page);
      tableState.setSearchParams({ page: String(page) });
    },
    [tableState],
  );

  const handlePerPageChange = React.useCallback(
    (nextPerPage: string) => {
      const parsed = Number(nextPerPage);
      if (!Number.isFinite(parsed) || parsed <= 0) return;
      tableState.setPerPage(parsed);
      tableState.setPage(1);
      tableState.setSearchParams({
        per_page: String(parsed),
        page: "1",
      });
    },
    [tableState],
  );

  const isFiltered =
    tableState.debouncedSearch.trim().length > 0 ||
    Object.values(activeFilters).some((value) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== null && value !== "";
    });

  return {
    tableState,
    items,
    totalItems,
    totalPages,
    isLoading,
    isFetching,
    error,
    activeFilters,
    isFiltered,
    refresh,
    handleViewChange,
    handleFilterChange,
    handleClearFilters,
    handleSortChange,
    handlePageChange,
    handlePerPageChange,
  };
}

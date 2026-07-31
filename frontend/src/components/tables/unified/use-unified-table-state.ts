"use client";

import * as React from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import type { ViewMode } from "./table-toolbar";

export type FilterValue =
  | string
  | number
  | boolean
  | string[]
  | null
  | undefined;

export interface UnifiedTableStateOptions {
  entityKey: string;
  searchParams: ReadonlyURLSearchParams | null;
  pathname: string | null;
  router: { replace: (url: string) => void };
  defaults: {
    view: ViewMode;
    allowedViews?: ViewMode[];
    page: number;
    perPage: number;
    search?: string;
    sortBy?: string | null;
    sortDirection?: "asc" | "desc";
    visibleColumns?: string[];
    filters: Record<string, FilterValue>;
  };
}

export interface UnifiedTableState {
  searchInput: string;
  debouncedSearch: string;
  currentView: ViewMode;
  activeFilters: Record<string, FilterValue>;
  page: number;
  perPage: number;
  visibleColumns: string[];
  selectedIds: string[];
  detailParam: string | null;
  sortBy: string | null;
  sortDirection: "asc" | "desc";
  setSearchInput: (value: string) => void;
  setCurrentView: (view: ViewMode) => void;
  setActiveFilters: React.Dispatch<
    React.SetStateAction<Record<string, FilterValue>>
  >;
  setPage: (page: number) => void;
  setPerPage: (perPage: number) => void;
  setVisibleColumns: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSortBy: (value: string | null) => void;
  setSortDirection: (value: "asc" | "desc") => void;
  setSearchParams: (updates: Record<string, string | null>) => void;
}

function mergeStoredColumnOrder(
  storedColumns: string[],
  defaultColumns: string[],
): string[] {
  if (!defaultColumns.length) return storedColumns;

  const result = storedColumns.filter(
    (id, index) =>
      typeof id === "string" && storedColumns.indexOf(id) === index,
  );

  for (const defaultColumn of defaultColumns) {
    if (result.includes(defaultColumn)) continue;

    const defaultIndex = defaultColumns.indexOf(defaultColumn);
    const nextDefault = defaultColumns
      .slice(defaultIndex + 1)
      .find((id) => result.includes(id));

    if (nextDefault) {
      result.splice(result.indexOf(nextDefault), 0, defaultColumn);
      continue;
    }

    const previousDefault = [...defaultColumns.slice(0, defaultIndex)]
      .reverse()
      .find((id) => result.includes(id));

    if (previousDefault) {
      result.splice(result.indexOf(previousDefault) + 1, 0, defaultColumn);
      continue;
    }

    result.push(defaultColumn);
  }

  return result;
}

export function useUnifiedTableState({
  entityKey,
  searchParams: searchParamsRaw,
  pathname: pathnameRaw,
  router,
  defaults,
}: UnifiedTableStateOptions): UnifiedTableState {
  const searchParams = searchParamsRaw ?? new URLSearchParams();
  const pathname = pathnameRaw ?? "";
  const allowedViews = React.useMemo<ViewMode[]>(
    () =>
      defaults.allowedViews && defaults.allowedViews.length > 0
        ? defaults.allowedViews
        : ["table", "card", "list"],
    [defaults.allowedViews],
  );
  const resolveView = React.useCallback(
    (candidate: string | null | undefined): ViewMode => {
      const normalized = candidate ?? defaults.view;
      if (
        normalized === "table" ||
        normalized === "board" ||
        normalized === "card" ||
        normalized === "list" ||
        normalized === "split"
      ) {
        return allowedViews.includes(normalized) ? normalized : defaults.view;
      }
      return defaults.view;
    },
    [allowedViews, defaults.view],
  );

  const initialSearch = searchParams.get("search") ?? defaults.search ?? "";
  const initialView = resolveView(searchParams.get("view"));
  const initialPage = Number(searchParams.get("page") ?? String(defaults.page));
  const initialPerPage = Number(
    searchParams.get("per_page") ?? String(defaults.perPage),
  );
  const initialSortBy = searchParams.get("sort") ?? defaults.sortBy ?? null;
  const initialSortDirection =
    (searchParams.get("sort_dir") as "asc" | "desc") ??
    defaults.sortDirection ??
    "asc";

  const [searchInput, setSearchInputState] = React.useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = React.useState(initialSearch);
  const [currentView, setCurrentView] = React.useState<ViewMode>(initialView);
  const [activeFilters, setActiveFilters] = React.useState<
    Record<string, FilterValue>
  >(defaults.filters);
  const [page, setPage] = React.useState(
    Number.isFinite(initialPage) && initialPage > 0
      ? initialPage
      : defaults.page,
  );
  const [perPage, setPerPage] = React.useState(
    Number.isFinite(initialPerPage) && initialPerPage > 0
      ? Math.min(initialPerPage, 150)
      : defaults.perPage,
  );
  const [visibleColumns, setVisibleColumns] = React.useState<string[]>(() => {
    if (typeof window === "undefined") {
      return defaults.visibleColumns ?? [];
    }
    const stored = window.localStorage.getItem(`${entityKey}:visibleColumns`);
    if (!stored) return defaults.visibleColumns ?? [];
    try {
      const storedColumns = JSON.parse(stored) as string[];
      const defaultColumns = defaults.visibleColumns ?? [];
      if (!Array.isArray(storedColumns)) return defaultColumns;
      return mergeStoredColumnOrder(storedColumns, defaultColumns);
    } catch {
      return defaults.visibleColumns ?? [];
    }
  });
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [sortBy, setSortBy] = React.useState<string | null>(initialSortBy);
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(
    initialSortDirection === "desc" ? "desc" : "asc",
  );
  const lastSearchParamsRef = React.useRef<string>(searchParams.toString());
  const pendingSearchParamRef = React.useRef<string | null>(null);
  const lastSearchInputAtRef = React.useRef<number>(0);

  const setSearchInput = React.useCallback((value: string) => {
    lastSearchInputAtRef.current = Date.now();
    setSearchInputState(value);
  }, []);

  const detailParam = searchParams.get("detail");

  const setSearchParams = (updates: Record<string, string | null>) => {
    const paramsCopy = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) {
        paramsCopy.delete(key);
      } else {
        paramsCopy.set(key, value);
      }
    });
    const queryString = paramsCopy.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname);
  };

  React.useEffect(() => {
    if (!visibleColumns.length) return;
    window.localStorage.setItem(
      `${entityKey}:visibleColumns`,
      JSON.stringify(visibleColumns),
    );
  }, [entityKey, visibleColumns]);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  React.useEffect(() => {
    const currentSearch = searchParams.get("search") ?? "";
    if (debouncedSearch !== currentSearch) {
      const paramsCopy = new URLSearchParams(searchParams.toString());
      if (debouncedSearch) {
        paramsCopy.set("search", debouncedSearch);
      } else {
        paramsCopy.delete("search");
      }
      paramsCopy.set("page", "1");
      const queryString = paramsCopy.toString();
      pendingSearchParamRef.current = debouncedSearch;
      router.replace(queryString ? `${pathname}?${queryString}` : pathname);
      lastSearchParamsRef.current = queryString;
      setPage(1);
    }
  }, [debouncedSearch, pathname, router, searchParams]);

  React.useEffect(() => {
    const nextParamsString = searchParams.toString();
    if (nextParamsString === lastSearchParamsRef.current) {
      return;
    }
    lastSearchParamsRef.current = nextParamsString;

    const nextView = resolveView(searchParams.get("view"));
    const nextSearch = searchParams.get("search") ?? defaults.search ?? "";
    const nextPage = Number(searchParams.get("page") ?? String(defaults.page));
    const nextPerPage = Number(
      searchParams.get("per_page") ?? String(defaults.perPage),
    );
    const nextSortBy = searchParams.get("sort") ?? defaults.sortBy ?? null;
    const nextSortDirection =
      (searchParams.get("sort_dir") as "asc" | "desc") ??
      defaults.sortDirection ??
      "asc";

    // Ignore stale router updates while a newer search param write is in-flight.
    // This prevents search input from bouncing between old/new values on rapid typing.
    if (
      pendingSearchParamRef.current !== null &&
      nextSearch !== pendingSearchParamRef.current
    ) {
      return;
    }

    if (pendingSearchParamRef.current === nextSearch) {
      pendingSearchParamRef.current = null;
    }

    // While user is actively typing, ignore URL search echoes that can arrive out-of-order.
    // This prevents the search field from bouncing between stale/new values.
    const userIsTyping = Date.now() - lastSearchInputAtRef.current < 1000;
    if (userIsTyping && nextSearch !== searchInput) {
      return;
    }

    setCurrentView((prev: ViewMode) => (prev === nextView ? prev : nextView));
    setSearchInputState((prev: string) =>
      prev === nextSearch ? prev : nextSearch,
    );
    setDebouncedSearch((prev: string) =>
      prev === nextSearch ? prev : nextSearch,
    );

    const normalizedPage =
      Number.isFinite(nextPage) && nextPage > 0 ? nextPage : defaults.page;
    const normalizedPerPage =
      Number.isFinite(nextPerPage) && nextPerPage > 0
        ? Math.min(nextPerPage, 150)
        : defaults.perPage;
    setPage((prev) => (prev === normalizedPage ? prev : normalizedPage));
    setPerPage((prev) =>
      prev === normalizedPerPage ? prev : normalizedPerPage,
    );
    setSortBy((prev) => (prev === nextSortBy ? prev : nextSortBy));
    setSortDirection((prev) =>
      prev === nextSortDirection
        ? prev
        : nextSortDirection === "desc"
          ? "desc"
          : "asc",
    );
  }, [
    defaults.page,
    defaults.perPage,
    defaults.search,
    defaults.sortBy,
    defaults.sortDirection,
    resolveView,
    searchInput,
    searchParams,
  ]);

  return {
    searchInput,
    debouncedSearch,
    currentView,
    activeFilters,
    page,
    perPage,
    visibleColumns,
    selectedIds,
    detailParam,
    sortBy,
    sortDirection,
    setSearchInput,
    setCurrentView,
    setActiveFilters,
    setPage,
    setPerPage,
    setVisibleColumns,
    setSelectedIds,
    setSortBy,
    setSortDirection,
    setSearchParams,
  };
}

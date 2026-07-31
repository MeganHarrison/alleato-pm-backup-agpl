"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { StatusDot } from "@/components/ds";
import {
  EmbeddedUnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
} from "@/components/tables/unified";

import type { EveToolTestRow } from "./eve-tool-test-registry";
import {
  buildEveToolTestingColumns,
  eveToolTestingColumnConfig,
  eveToolTestingDefaultVisibleColumns,
  eveToolTestingFilters,
  getEveToolTestStatusLabel,
  getEveToolTestStatusVariant,
} from "./eve-tool-testing-table-config";

const EMPTY_FILTERS: Record<string, FilterValue> = {
  status: undefined,
  screenshot: undefined,
  effect: undefined,
  scope: undefined,
};

interface EveToolTestingPageProps {
  initialRows: EveToolTestRow[];
}

function EveToolTestingPageInner({
  initialRows,
}: EveToolTestingPageProps) {
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = useSearchParams();
  const columns = React.useMemo(() => buildEveToolTestingColumns(), []);

  const tableState = useUnifiedTableState({
    entityKey: "eve-tool-testing",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table", "card"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "status",
      sortDirection: "asc",
      visibleColumns: eveToolTestingDefaultVisibleColumns,
      filters: EMPTY_FILTERS,
    },
  });

  const activeFilters = React.useMemo<Record<string, FilterValue>>(
    () => ({
      status: searchParams.get("status") ?? undefined,
      screenshot: searchParams.get("screenshot") ?? undefined,
      effect: searchParams.get("effect") ?? undefined,
      scope: searchParams.get("scope") ?? undefined,
    }),
    [searchParams],
  );

  const filteredRows = React.useMemo(() => {
    const query = tableState.debouncedSearch.trim().toLowerCase();
    return initialRows.filter((row) => {
      if (activeFilters.status && row.status !== activeFilters.status) {
        return false;
      }
      if (
        activeFilters.screenshot &&
        row.screenshotStatus !== activeFilters.screenshot
      ) {
        return false;
      }
      if (activeFilters.effect && row.effect !== activeFilters.effect) {
        return false;
      }
      if (activeFilters.scope && row.scope !== activeFilters.scope) {
        return false;
      }
      if (!query) return true;

      return [
        row.label,
        row.name,
        row.description,
        row.family,
        row.screenshotStatus,
        row.screenshotPath,
        row.testPrompt,
        row.blocker,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [
    activeFilters.effect,
    activeFilters.screenshot,
    activeFilters.scope,
    activeFilters.status,
    initialRows,
    tableState.debouncedSearch,
  ]);

  const hasActiveFilters = Object.values(activeFilters).some(Boolean);

  function handleFilterChange(filters: Record<string, FilterValue>) {
    tableState.setSearchParams({ ...filters, page: "1" });
  }

  return (
    <EmbeddedUnifiedTablePage
      title="Eve Tool Testing"
      toolbar={{
        totalItems: initialRows.length,
        filteredItems: filteredRows.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search tools, prompts, or blockers...",
        currentView: tableState.currentView,
        onViewChange: tableState.setCurrentView,
        enabledViews: ["table", "card"],
        filters: eveToolTestingFilters,
        activeFilters,
        onFilterChange: handleFilterChange,
        onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
        columns: eveToolTestingColumnConfig,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
      }}
      data={{
        items: filteredRows,
        isLoading: false,
      }}
      table={{
        columns,
        getRowId: (row) => row.id,
        stickyHeader: true,
        density: "compact",
      }}
      features={{ enableRowSelection: false }}
      views={{
        card: (row) => (
          <article className="space-y-4 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {row.label}
                </span>
                <p className="mt-1 text-sm text-muted-foreground">
                  {row.description}
                </p>
              </div>
              <StatusDot
                status={getEveToolTestStatusLabel(row.status)}
                variant={getEveToolTestStatusVariant(row.status)}
                className="shrink-0"
              />
            </div>
            <div className="grid grid-cols-[5rem_1fr] gap-x-4 gap-y-2 text-sm">
              <span className="text-muted-foreground">Family</span>
              <span className="text-foreground">{row.family}</span>
              <span className="text-muted-foreground">Effect</span>
              <span className="capitalize text-foreground">{row.effect}</span>
              <span className="text-muted-foreground">Scope</span>
              <span className="text-foreground">{row.scope}</span>
              <span className="text-muted-foreground">Screenshot</span>
              {row.screenshotPath ? (
                <a
                  href={row.screenshotPath}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Verified
                </a>
              ) : (
                <span className="text-muted-foreground">Not verified</span>
              )}
              <span className="text-muted-foreground">Tested date</span>
              <span className="text-foreground">
                {row.testedAt ?? "Not tested"}
              </span>
              <span className="text-muted-foreground">Test</span>
              <span className="text-foreground">{row.testPrompt}</span>
              {row.blocker ? (
                <>
                  <span className="text-destructive">Blocker</span>
                  <span className="text-destructive">{row.blocker}</span>
                </>
              ) : null}
            </div>
          </article>
        ),
      }}
      emptyState={{
        title: "No Eve tools found",
        description:
          "The canonical Eve manifest did not return any testable tools.",
        filteredDescription:
          "No Eve tools match the current search and filters.",
        isFiltered: Boolean(tableState.debouncedSearch) || hasActiveFilters,
      }}
      layout={{ fullBleedTable: true, containerPadding: false }}
    />
  );
}

export function EveToolTestingPage(props: EveToolTestingPageProps) {
  return (
    <React.Suspense fallback={null}>
      <EveToolTestingPageInner {...props} />
    </React.Suspense>
  );
}

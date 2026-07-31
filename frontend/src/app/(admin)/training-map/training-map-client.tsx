"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { KpiStrip } from "@/components/ds/kpi";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
} from "@/components/tables/unified";
import { useTrainingDocs } from "@/hooks/use-training-docs";
import type { TrainingDocWithAssets } from "@/lib/training-docs/types";
import {
  buildTrainingMapColumns,
  buildTrainingMapFilters,
  trainingMapDefaultVisibleColumns,
} from "@/features/training-docs/training-map-config";

const EMPTY_FILTERS: Record<string, FilterValue> = {
  tool_category: undefined,
  status: undefined,
  qa_status: undefined,
};

const UNCATEGORIZED = "Uncategorized";

export function TrainingMapClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: docs = [], isLoading, error, isFetching } = useTrainingDocs();

  const activeFilters = React.useMemo<Record<string, FilterValue>>(
    () => ({
      tool_category: searchParams.get("tool_category") || undefined,
      status: searchParams.get("status") || undefined,
      qa_status: searchParams.get("qa_status") || undefined,
    }),
    [searchParams],
  );

  const tableState = useUnifiedTableState({
    entityKey: "training-map",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 50,
      search: "",
      sortBy: "title",
      sortDirection: "asc",
      visibleColumns: trainingMapDefaultVisibleColumns,
      filters: EMPTY_FILTERS,
    },
  });

  const filteredDocs = React.useMemo(() => {
    return docs.filter((doc) => {
      const category = doc.tool_category?.trim() || UNCATEGORIZED;
      if (activeFilters.tool_category && category !== activeFilters.tool_category) {
        return false;
      }
      if (activeFilters.status && doc.status !== activeFilters.status) {
        return false;
      }
      if (
        activeFilters.qa_status &&
        (doc.qa_status || "not_tested") !== activeFilters.qa_status
      ) {
        return false;
      }
      return true;
    });
  }, [
    activeFilters.qa_status,
    activeFilters.status,
    activeFilters.tool_category,
    docs,
  ]);

  const coverage = React.useMemo(() => computeCoverage(docs), [docs]);

  const filters = React.useMemo(() => buildTrainingMapFilters(docs), [docs]);
  const columns = React.useMemo(() => buildTrainingMapColumns(), []);

  const handleFilterChange = React.useCallback(
    (nextFilters: Record<string, FilterValue>) => {
      tableState.setPage(1);
      tableState.setActiveFilters(nextFilters);
      tableState.setSearchParams({
        tool_category: stringFilterValue(nextFilters.tool_category),
        status: stringFilterValue(nextFilters.status),
        qa_status: stringFilterValue(nextFilters.qa_status),
        page: null,
      });
    },
    [tableState],
  );

  const hasActiveFilters = Boolean(
    tableState.searchInput.trim() ||
      activeFilters.tool_category ||
      activeFilters.status ||
      activeFilters.qa_status,
  );

  return (
    <UnifiedTablePage
      header={{
        title: "Training Map",
        description:
          "Coverage of training docs across app tools — what is still planned, drafted, and QA-verified.",
      }}
      toolbar={{
        totalItems: docs.length,
        filteredItems: filteredDocs.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search tasks, tools, keys...",
        currentView: tableState.currentView,
        onViewChange: tableState.setCurrentView,
        filters,
        activeFilters,
        onFilterChange: handleFilterChange,
        onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
      }}
      topContent={
        <KpiStrip
          metrics={[
            { label: "Tools", value: String(coverage.tools) },
            { label: "Tasks", value: String(coverage.total) },
            { label: "Planned", value: String(coverage.planned) },
            { label: "QA passing", value: String(coverage.qaPassing) },
            { label: "Live", value: String(coverage.live) },
          ]}
        />
      }
      data={{
        items: filteredDocs,
        isLoading,
        isFetching,
        error: error instanceof Error ? error : null,
      }}
      table={{
        columns,
        getRowId: (doc) => doc.id,
        onRowClick: (doc) => router.push(`/training-docs/${doc.id}`),
        stickyHeader: true,
      }}
      emptyState={{
        title: "No training coverage yet",
        description:
          "Training docs grouped by tool will appear here. Start by drafting one in Training Docs.",
        filteredDescription:
          "No training tasks match the current search or filters.",
        isFiltered: hasActiveFilters,
      }}
      layout={{ fullBleedTable: true }}
    />
  );
}

function computeCoverage(docs: TrainingDocWithAssets[]) {
  const tools = new Set<string>();
  let planned = 0;
  let qaPassing = 0;
  let live = 0;

  for (const doc of docs) {
    tools.add(doc.tool_category?.trim() || UNCATEGORIZED);
    if (doc.status === "planned") planned += 1;
    if (doc.qa_status === "passing") qaPassing += 1;
    if (doc.published_doc_path) live += 1;
  }

  return {
    tools: tools.size,
    total: docs.length,
    planned,
    qaPassing,
    live,
  };
}

function stringFilterValue(value: FilterValue): string | null {
  return typeof value === "string" && value ? value : null;
}

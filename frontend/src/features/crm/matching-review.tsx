"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterConfig,
} from "@/components/tables/unified";
import { useCrmWorkspace } from "@/hooks/use-crm";
import type { CrmActivityCandidate } from "@/lib/crm/types";
import {
  crmCandidateColumnConfig,
  crmCandidateColumns,
  crmCandidateDefaultColumns,
} from "@/features/crm/candidate-table-config";
import { buildCrmWorkspaceTabs } from "@/features/crm/crm-workspace-tabs";
import { CRM_WORKSPACE_TABLE_LAYOUT } from "@/features/crm/crm-workspace-layout";

const MATCH_FILTERS: FilterConfig[] = [
  {
    id: "source",
    label: "Source",
    type: "select",
    options: ["fireflies", "outlook", "teams"].map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  {
    id: "visibility",
    label: "Visibility",
    type: "select",
    options: [
      { value: "standard", label: "Standard" },
      { value: "restricted", label: "Restricted" },
      { value: "private_source", label: "Private source" },
    ],
  },
];

export function CrmMatchingReview() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { candidates, settings, decideCandidate, isLoading, error } =
    useCrmWorkspace();
  const tableState = useUnifiedTableState({
    entityKey: "crm-matching-local-review",
    pathname,
    router,
    searchParams,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 25,
      visibleColumns: crmCandidateDefaultColumns,
      filters: {},
      sortBy: "confidence",
      sortDirection: "desc",
    },
  });

  const items = React.useMemo(() => {
    const query = tableState.debouncedSearch.toLowerCase().trim();
    return candidates.filter((candidate) => {
      const matchesQuery =
        !query ||
        [
          candidate.subject,
          candidate.proposedCompanyName,
          ...candidate.matchSignals,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesSource =
        !tableState.activeFilters.source ||
        candidate.sourceSystem === tableState.activeFilters.source;
      const matchesVisibility =
        !tableState.activeFilters.visibility ||
        candidate.visibilityScope === tableState.activeFilters.visibility;
      return matchesQuery && matchesSource && matchesVisibility;
    });
  }, [
    candidates,
    tableState.activeFilters.source,
    tableState.activeFilters.visibility,
    tableState.debouncedSearch,
  ]);

  const decide = async (candidate: CrmActivityCandidate, accepted: boolean) => {
    try {
      await decideCandidate(candidate.id, accepted);
      toast.success(
        accepted
          ? "Communication accepted into the activity timeline"
          : "Suggestion rejected with review feedback",
      );
    } catch (error) {
      toast.error("Matching decision could not be saved", {
        description:
          error instanceof Error ? error.message : "Refresh and try again.",
      });
    }
  };

  return (
    <UnifiedTablePage
      header={{
        title: "Communication matching",
        description: error
          ? `CRM could not be loaded: ${error.message}`
          : `Review suggestions before they appear in relationship history · auto-accept is ${
              settings.autoAcceptEnabled ? "on" : "off"
            }`,
      }}
      tabs={buildCrmWorkspaceTabs(pathname)}
      layout={CRM_WORKSPACE_TABLE_LAYOUT}
      toolbar={{
        totalItems: candidates.length,
        filteredItems: items.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search communication, account, or evidence...",
        currentView: tableState.currentView,
        onViewChange: tableState.setCurrentView,
        enabledViews: ["table"],
        filters: MATCH_FILTERS,
        activeFilters: tableState.activeFilters,
        onFilterChange: tableState.setActiveFilters,
        onClearFilters: () => tableState.setActiveFilters({}),
        columns: crmCandidateColumnConfig,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
      }}
      data={{ items, isLoading }}
      table={{
        columns: crmCandidateColumns,
        getRowId: (candidate) => candidate.id,
        stickyHeader: true,
        rowActions: (candidate) =>
          candidate.status === "pending" ? (
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => decide(candidate, false)}
              >
                Reject
              </Button>
              <Button size="sm" onClick={() => decide(candidate, true)}>
                Accept
              </Button>
            </div>
          ) : null,
      }}
      emptyState={{
        title: "No matching suggestions",
        description: "New communication suggestions will wait here for review.",
        filteredDescription:
          "No suggestions match the current search and filters.",
        isFiltered:
          Boolean(tableState.debouncedSearch) ||
          Object.values(tableState.activeFilters).some(Boolean),
      }}
    />
  );
}

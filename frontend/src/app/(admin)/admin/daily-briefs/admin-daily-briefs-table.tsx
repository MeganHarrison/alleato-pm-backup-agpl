"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  UnifiedTablePage,
  useUnifiedTableState,
} from "@/components/tables/unified";
import {
  adminDailyBriefColumns,
  adminDailyBriefDefaultVisibleColumns,
  buildAdminDailyBriefTableColumns,
} from "@/features/daily-briefs/admin-daily-briefs-table-config";
import type { AdminDailyBriefHistoryItem } from "@/lib/daily-briefs/admin-history";

function searchHaystack(item: AdminDailyBriefHistoryItem) {
  return [
    item.businessDate,
    item.packetType,
    item.briefFormat,
    item.compilerVersion ?? "",
    item.embeddedSourceCount,
    item.sourceCount,
  ].join(" ");
}

export function AdminDailyBriefsTable({ briefs }: { briefs: AdminDailyBriefHistoryItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tableState = useUnifiedTableState({
    entityKey: "admin-daily-brief-history",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "generatedAt",
      sortDirection: "desc",
      visibleColumns: adminDailyBriefDefaultVisibleColumns,
      filters: {},
    },
  });
  const columns = React.useMemo(() => buildAdminDailyBriefTableColumns(), []);
  const filteredBriefs = React.useMemo(() => {
    const search = tableState.debouncedSearch.trim().toLowerCase();
    if (!search) return briefs;
    return briefs.filter((item) => searchHaystack(item).toLowerCase().includes(search));
  }, [briefs, tableState.debouncedSearch]);

  return (
    <UnifiedTablePage
      header={{
        title: "Daily Brief Operations",
        description: "Packet revisions, source indexing, and compiler state.",
      }}
      toolbar={{
        totalItems: briefs.length,
        filteredItems: filteredBriefs.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search packet date, format, or compiler...",
        currentView: tableState.currentView,
        onViewChange: tableState.setCurrentView,
        enabledViews: ["table"],
        columns: adminDailyBriefColumns,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
      }}
      data={{ items: filteredBriefs, isLoading: false }}
      sorting={{
        sortBy: tableState.sortBy,
        sortDirection: tableState.sortDirection,
        onSortChange: (sortBy, direction) => {
          tableState.setSortBy(sortBy);
          tableState.setSortDirection(direction);
        },
      }}
      table={{
        columns,
        getRowId: (item) => item.id,
        onRowClick: (item) => router.push(`/admin/daily-briefs/${item.id}`),
        stickyHeader: true,
        density: "compact",
      }}
      emptyState={{
        title: "No Daily Brief packets",
        description: "No canonical Daily Brief packet is available for operational review.",
        filteredDescription: "No Daily Brief packets match the current search.",
        isFiltered: Boolean(tableState.debouncedSearch.trim()),
      }}
      layout={{ fullBleedTable: false }}
      features={{ enableRowSelection: false, enableRowActions: false, enableViews: false }}
      reportContext={{ projectName: "Alleato", projectDescription: "Daily Brief operations" }}
    />
  );
}

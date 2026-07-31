"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";

import {
  UnifiedTablePage,
  useUnifiedTableState,
  type ColumnConfig,
  type TableColumn,
} from "@/components/tables/unified";
import { GlobalProjectPickerDialog } from "@/components/domain/global-project-picker-dialog";
import { Button } from "@/components/ui/button";
import {
  buildChangeEventTableColumns,
  changeEventColumns,
  changeEventFilters,
  renderChangeEventRowActions,
} from "@/features/change-events/change-events-table-config";
import { apiFetch } from "@/lib/api-client";
import type { ChangeEvent } from "@/types/change-events";

// ── Extended type ─────────────────────────────────────────────────────────────

export type ChangeEventWithProject = ChangeEvent & {
  projects: { id: number; name: string | null } | null;
};

// ── Column config: "Project" inserted after number_title ──────────────────────

const PROJECT_COLUMN: ColumnConfig = {
  id: "project",
  label: "Project",
  defaultVisible: true,
};

const globalChangeEventColumns: ColumnConfig[] = [
  changeEventColumns[0], // number_title — alwaysVisible
  PROJECT_COLUMN,
  ...changeEventColumns.slice(1),
];

const globalChangeEventDefaultVisibleColumns = globalChangeEventColumns
  .filter((col) => col.alwaysVisible || col.defaultVisible !== false)
  .map((col) => col.id);

// ── Props ─────────────────────────────────────────────────────────────────────

interface ChangeEventsGlobalClientProps {
  changeEvents: ChangeEventWithProject[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function filterItems(
  items: ChangeEventWithProject[],
  search: string,
  activeFilters: Record<string, string | number | boolean | string[] | null | undefined>,
): ChangeEventWithProject[] {
  let result = items;

  const q = search.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (item) =>
        (item.title ?? "").toLowerCase().includes(q) ||
        (item.number ?? "").toLowerCase().includes(q) ||
        (item.status ?? "").toLowerCase().includes(q) ||
        (item.type ?? "").toLowerCase().includes(q) ||
        (item.origin ?? "").toLowerCase().includes(q) ||
        (item.reason ?? "").toLowerCase().includes(q) ||
        (item.projects?.name ?? "").toLowerCase().includes(q),
    );
  }

  for (const [key, value] of Object.entries(activeFilters)) {
    if (value == null || value === "") continue;
    const val = String(value).toLowerCase();
    result = result.filter((item) => {
      const fieldVal = String((item as unknown as Record<string, unknown>)[key] ?? "").toLowerCase();
      return fieldVal === val;
    });
  }

  return result;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChangeEventsGlobalClient({
  changeEvents,
}: ChangeEventsGlobalClientProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();

  const [items, setItems] = useState<ChangeEventWithProject[]>(changeEvents);
  const [pickerOpen, setPickerOpen] = useState(false);

  // ── Table state ──────────────────────────────────────────────────────────────

  const tableState = useUnifiedTableState({
    entityKey: "global-change-events",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 50,
      search: "",
      sortBy: null,
      sortDirection: "desc",
      visibleColumns: globalChangeEventDefaultVisibleColumns,
      filters: {},
    },
  });

  // ── Filtering ─────────────────────────────────────────────────────────────────

  const filteredItems = useMemo(
    () => filterItems(items, tableState.debouncedSearch, tableState.activeFilters),
    [items, tableState.debouncedSearch, tableState.activeFilters],
  );

  // ── Sorting ───────────────────────────────────────────────────────────────────

  const baseColumns = useMemo(
    () => buildChangeEventTableColumns(new Set(), () => {}),
    [],
  );

  const tableColumns = useMemo((): TableColumn<ChangeEventWithProject>[] => {
    const projectColumn: TableColumn<ChangeEventWithProject> = {
      ...PROJECT_COLUMN,
      render: (item) => (
        <Link
          href={`/${item.project_id}/change-events`}
          className="text-foreground underline-offset-4 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {item.projects?.name ?? "Unknown"}
        </Link>
      ),
      sortValue: (item) => item.projects?.name ?? "",
    };

    const [numberTitleCol, ...rest] = baseColumns as TableColumn<ChangeEventWithProject>[];
    return [numberTitleCol, projectColumn, ...rest];
  }, [baseColumns]);

  const sortedItems = useMemo(() => {
    const col = tableColumns.find((c) => c.id === tableState.sortBy);
    if (!col?.sortValue) return filteredItems;
    const sortFn = col.sortValue;
    return [...filteredItems].sort((a, b) => {
      const va = sortFn(a);
      const vb = sortFn(b);
      if (va == null) return tableState.sortDirection === "asc" ? -1 : 1;
      if (vb == null) return tableState.sortDirection === "asc" ? 1 : -1;
      if (typeof va === "number" && typeof vb === "number")
        return tableState.sortDirection === "asc" ? va - vb : vb - va;
      return tableState.sortDirection === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }, [filteredItems, tableColumns, tableState.sortBy, tableState.sortDirection]);

  // ── Pagination ────────────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / tableState.perPage));
  const paginatedItems = useMemo(() => {
    const start = (tableState.page - 1) * tableState.perPage;
    return sortedItems.slice(start, start + tableState.perPage);
  }, [sortedItems, tableState.page, tableState.perPage]);

  // ── Delete helpers ────────────────────────────────────────────────────────────

  const handleDelete = useCallback(
    async (item: ChangeEventWithProject) => {
      await apiFetch(
        `/api/projects/${item.project_id}/change-events/${item.id}`,
        { method: "DELETE" },
      );
      setItems((prev) => prev.filter((ce) => ce.id !== item.id));
      tableState.setSelectedIds((prev) => prev.filter((sid) => sid !== String(item.id)));
    },
    [tableState],
  );

  const handleBulkDelete = useCallback(async () => {
    const selected = new Set(tableState.selectedIds);
    const toDelete = items.filter((ce) => selected.has(String(ce.id)));
    await Promise.all(toDelete.map((item) => handleDelete(item)));
  }, [tableState.selectedIds, items, handleDelete]);

  // ── Row actions ───────────────────────────────────────────────────────────────

  const renderRowActions = useCallback(
    (item: ChangeEventWithProject) =>
      renderChangeEventRowActions(
        item,
        (ce) => router.push(`/${ce.project_id}/change-events/${ce.id}`),
        (ce) => router.push(`/${ce.project_id}/change-events/${ce.id}`),
        (ce) => void handleDelete(ce as unknown as ChangeEventWithProject),
      ),
    [router, handleDelete],
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <UnifiedTablePage<ChangeEventWithProject>
        header={{
          title: "Change Events",
          actions: (
            <Button size="sm" onClick={() => setPickerOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              New Change Event
            </Button>
          ),
        }}
        toolbar={{
          totalItems: items.length,
          filteredItems: filteredItems.length,
          selectedCount: tableState.selectedIds.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search change events…",
          currentView: tableState.currentView,
          onViewChange: tableState.setCurrentView,
          filters: changeEventFilters,
          activeFilters: tableState.activeFilters,
          onFilterChange: (updated) => tableState.setActiveFilters(updated),
          onClearFilters: () => tableState.setActiveFilters({}),
          columns: globalChangeEventColumns,
          visibleColumns: tableState.visibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
          onBulkDelete:
            tableState.selectedIds.length > 0 ? handleBulkDelete : undefined,
        }}
        data={{
          items: paginatedItems,
          isLoading: false,
          isFetching: false,
          error: null,
        }}
        table={{
          columns: tableColumns,
          getRowId: (item) => String(item.id),
          rowActions: renderRowActions,
          onRowClick: (item) =>
            router.push(`/${item.project_id}/change-events/${item.id}`),
        }}
        sorting={{
          sortBy: tableState.sortBy,
          sortDirection: tableState.sortDirection,
          onSortChange: (col, dir) => {
            tableState.setSortBy(col);
            tableState.setSortDirection(dir);
            tableState.setPage(1);
          },
        }}
        selection={{
          selectedIds: tableState.selectedIds,
          onSelectAll: (checked) => {
            if (checked) {
              tableState.setSelectedIds(sortedItems.map((item) => String(item.id)));
            } else {
              tableState.setSelectedIds([]);
            }
          },
          onSelectRow: (id, checked) => {
            tableState.setSelectedIds((prev) =>
              checked ? [...prev, id] : prev.filter((sid) => sid !== id),
            );
          },
        }}
        emptyState={{
          title: "No change events yet",
          description:
            "Change events track potential scope or cost changes across all projects.",
          filteredDescription: "No change events match your search or filters.",
          isFiltered:
            !!tableState.debouncedSearch ||
            Object.values(tableState.activeFilters).some((v) => v != null && v !== ""),
        }}
        pagination={{
          page: tableState.page,
          totalPages,
          perPage: tableState.perPage,
          onPageChange: (p) => {
            tableState.setPage(p);
            tableState.setSearchParams({ page: String(p) });
          },
          onPerPageChange: (pp) => {
            tableState.setPerPage(Number(pp));
            tableState.setPage(1);
          },
        }}
      />

      <GlobalProjectPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        toolPath="change-events"
        toolLabel="Change Event"
      />
    </>
  );
}

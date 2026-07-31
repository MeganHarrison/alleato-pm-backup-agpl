"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { PageShell } from "@/components/layout";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
} from "@/components/tables/unified";
import { Button } from "@/components/ui/button";
import {
  useDeleteDrawing,
  useDrawings,
  useObsoleteDrawing,
  usePublishDrawing,
} from "@/hooks/use-drawings";
import { apiFetch } from "@/lib/api-client";
import {
  buildDrawingRowActions,
  buildDrawingTableColumns,
  drawingDefaultVisibleColumns,
  drawingFilters,
  renderDrawingCard,
  renderDrawingList,
} from "@/features/drawings/drawings-table-config";
import type { DrawingLogTableRow } from "@/types/drawings.types";

type DrawingFilterState = Record<string, FilterValue>;

const DEFAULT_TABLE_PROJECT_ID = "31";
const EMPTY_FILTERS: DrawingFilterState = {
  discipline: undefined,
  drawingType: undefined,
  status: undefined,
};

function normalizeFilter(value: FilterValue): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export default function DrawingsPage() {
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = useSearchParams()!;

  const tableState = useUnifiedTableState({
    entityKey: "drawings-table",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table", "card", "list"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "drawingNumber",
      sortDirection: "asc",
      visibleColumns: drawingDefaultVisibleColumns,
      filters: EMPTY_FILTERS,
    },
  });

  const activeFilters = tableState.activeFilters as DrawingFilterState;
  const disciplineFilter = normalizeFilter(activeFilters.discipline);
  const drawingTypeFilter = normalizeFilter(activeFilters.drawingType);
  const statusFilter = normalizeFilter(activeFilters.status);

  const {
    data: drawingsData,
    isLoading,
    isFetching,
    error,
  } = useDrawings(DEFAULT_TABLE_PROJECT_ID, {
    page: tableState.page,
    page_size: tableState.perPage,
    search: tableState.debouncedSearch || undefined,
    discipline: disciplineFilter,
    status: statusFilter,
  });
  const deleteDrawing = useDeleteDrawing(DEFAULT_TABLE_PROJECT_ID);
  const publishDrawing = usePublishDrawing(DEFAULT_TABLE_PROJECT_ID);
  const obsoleteDrawing = useObsoleteDrawing(DEFAULT_TABLE_PROJECT_ID);

  const drawings = React.useMemo(
    () => drawingsData?.drawings ?? [],
    [drawingsData],
  );

  const filteredItems = React.useMemo(() => {
    if (!drawingTypeFilter) return drawings;

    return drawings.filter(
      (drawing) => drawing.drawingType === drawingTypeFilter,
    );
  }, [drawingTypeFilter, drawings]);

  const tableColumns = React.useMemo(() => buildDrawingTableColumns(), []);

  const getDrawingProjectId = React.useCallback(
    (item: DrawingLogTableRow) => item.projectId || DEFAULT_TABLE_PROJECT_ID,
    [],
  );

  const handleOpenDrawing = React.useCallback(
    (item: DrawingLogTableRow) => {
      router.push(`/${getDrawingProjectId(item)}/drawings/viewer/${item.id}`);
    },
    [getDrawingProjectId, router],
  );

  const handleEditDrawing = React.useCallback(
    (item: DrawingLogTableRow) => {
      router.push(`/${getDrawingProjectId(item)}/drawings/${item.id}`);
    },
    [getDrawingProjectId, router],
  );

  const handleEmailDrawing = React.useCallback(
    (item: DrawingLogTableRow) => {
      const label = [item.drawingNumber, item.title]
        .filter(Boolean)
        .join(" - ");
      const drawingUrl = `${window.location.origin}/${getDrawingProjectId(
        item,
      )}/drawings/viewer/${item.id}`;

      window.location.href = `mailto:?subject=${encodeURIComponent(
        label || "Drawing",
      )}&body=${encodeURIComponent(drawingUrl)}`;
    },
    [getDrawingProjectId],
  );

  const handleDownloadDrawing = React.useCallback(
    async (item: DrawingLogTableRow) => {
      try {
        const data = await apiFetch<{
          downloadUrl?: string;
          fileName?: string;
        }>(
          `/api/projects/${getDrawingProjectId(item)}/drawings/${item.id}/download`,
        );

        if (!data.downloadUrl) {
          toast.error("No downloadable file found for this drawing");
          return;
        }

        const anchor = document.createElement("a");
        anchor.href = data.downloadUrl;
        anchor.download =
          data.fileName ??
          `${item.drawingNumber || item.title || "drawing"}.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      } catch (downloadError) {
        toast.error("Could not download drawing", {
          description:
            downloadError instanceof Error
              ? downloadError.message
              : "The drawing download request failed.",
        });
      }
    },
    [getDrawingProjectId],
  );

  const handleDeleteDrawing = React.useCallback(
    (item: DrawingLogTableRow) => {
      deleteDrawing.mutate(item.id);
    },
    [deleteDrawing],
  );

  const handleFilterChange = React.useCallback(
    (nextFilters: DrawingFilterState) => {
      tableState.setActiveFilters(nextFilters);
      tableState.setSearchParams({
        discipline: normalizeFilter(nextFilters.discipline) ?? null,
        drawingType: normalizeFilter(nextFilters.drawingType) ?? null,
        status: normalizeFilter(nextFilters.status) ?? null,
        page: "1",
      });
      tableState.setPage(1);
    },
    [tableState],
  );

  const isFiltered =
    Boolean(tableState.searchInput) ||
    Boolean(disciplineFilter) ||
    Boolean(drawingTypeFilter) ||
    Boolean(statusFilter);

  return (
    <PageShell variant="table" title="Drawings" showHeader={false}>
      <UnifiedTablePage<DrawingLogTableRow>
        header={{
          title: "Drawings",
          description: "Construction drawings and blueprints",
          actions: (
            <Button
              size="sm"
              onClick={() =>
                router.push(`/${DEFAULT_TABLE_PROJECT_ID}/drawings`)
              }
            >
              <Plus className="h-4 w-4" />
              Upload Drawing
            </Button>
          ),
        }}
        toolbar={{
          totalItems: drawings.length,
          filteredItems: filteredItems.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search drawings...",
          currentView: tableState.currentView,
          onViewChange: tableState.setCurrentView,
          filters: drawingFilters,
          activeFilters,
          onFilterChange: handleFilterChange,
          onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
          selectedCount: tableState.selectedIds.length,
        }}
        data={{
          items: filteredItems,
          isLoading,
          isFetching,
          error: error instanceof Error ? error : null,
        }}
        table={{
          columns: tableColumns,
          getRowId: (item) => item.id,
          onRowClick: handleOpenDrawing,
          onDelete: handleDeleteDrawing,
          rowActions: buildDrawingRowActions({
            onEdit: handleEditDrawing,
            onEmail: handleEmailDrawing,
            onDownload: handleDownloadDrawing,
            onPublish: (drawingId, publish) =>
              publishDrawing.mutate({ drawingId, publish }),
            onObsolete: (drawingId, obsolete) =>
              obsoleteDrawing.mutate({ drawingId, obsolete }),
            onDelete: handleDeleteDrawing,
          }),
        }}
        sorting={{
          sortBy: tableState.sortBy,
          sortDirection: tableState.sortDirection,
          onSortChange: (sortBy, sortDirection) => {
            tableState.setSortBy(sortBy);
            tableState.setSortDirection(sortDirection);
            tableState.setSearchParams({
              sort: sortBy,
              sort_dir: sortDirection,
              page: "1",
            });
            tableState.setPage(1);
          },
        }}
        selection={{
          selectedIds: tableState.selectedIds,
          onSelectAll: (checked) =>
            tableState.setSelectedIds(
              checked ? filteredItems.map((item) => item.id) : [],
            ),
          onSelectRow: (id, checked) =>
            tableState.setSelectedIds((current) =>
              checked
                ? current.includes(id)
                  ? current
                  : [...current, id]
                : current.filter((selectedId) => selectedId !== id),
            ),
        }}
        pagination={{
          page: tableState.page,
          totalPages: Math.max(
            1,
            Math.ceil(filteredItems.length / tableState.perPage),
          ),
          perPage: tableState.perPage,
          onPageChange: (page) => {
            tableState.setPage(page);
            tableState.setSearchParams({ page: String(page) });
          },
          onPerPageChange: (perPage) => {
            const nextPerPage = Number(perPage);
            tableState.setPerPage(nextPerPage);
            tableState.setPage(1);
            tableState.setSearchParams({
              per_page: String(nextPerPage),
              page: "1",
            });
          },
          clientSide: true,
        }}
        views={{
          card: (item) => renderDrawingCard(item, handleOpenDrawing),
          list: (item) => renderDrawingList(item, handleOpenDrawing),
        }}
        emptyState={{
          title: "No drawings",
          description:
            "Upload drawings to make them searchable and available from the project record.",
          filteredDescription:
            "No drawings match the current search or filters.",
          isFiltered,
        }}
      />
    </PageShell>
  );
}

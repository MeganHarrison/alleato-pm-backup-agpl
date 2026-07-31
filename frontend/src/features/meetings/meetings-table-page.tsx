"use client";

import type { ReactElement, ReactNode } from "react";

import { FileDown } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DetailPanel, UnifiedTablePage } from "@/components/tables/unified";
import type { Meeting } from "@/lib/validation/meetings";
import {
  meetingColumns,
  renderMeetingCard,
  renderMeetingList,
  renderMeetingRowActions,
} from "@/features/meetings/meetings-table-config";
import { useMeetingsTable, EMPTY_FILTERS } from "@/features/meetings/use-meetings-table";

interface MeetingsTablePageProps {
  initialMeetings: Meeting[];
  projectId?: string;
  headerActions?: ReactNode;
  tabs?: { label: string; href: string; isActive?: boolean }[];
}

export function MeetingsTablePage({
  initialMeetings,
  projectId,
  headerActions,
  tabs,
}: MeetingsTablePageProps): ReactElement {
  const {
    tableState,
    pagedMeetings,
    totalItems,
    unfilteredTotal,
    totalPages,
    filters,
    activeFilters,
    detailFields,
    editingMeeting,
    detailPanelOpen,
    tableColumns,
    isFiltered,
    deleteDialogOpen,
    setDeleteDialogOpen,
    meetingToDelete,
    setMeetingToDelete,
    bulkDeleteDialogOpen,
    setBulkDeleteDialogOpen,
    handleFilterChange,
    handleRowClick,
    handleOpenMeetingPage,
    handleEdit,
    handlePanelOpenChange,
    handleSave,
    handleDeleteConfirm,
    handleBulkDeleteConfirm,
    bulkEditFields,
    handleBulkEdit,
    handleSelectAll,
    handleSelectRow,
    handleOpenSource,
    handleOpenRecording,
    handleDownloadTranscriptPdf,
    handleDownloadMarkdown,
    handleBulkDownloadMarkdown,
    handleExport,
  } = useMeetingsTable(initialMeetings, projectId);

  const selectedCount = tableState.selectedIds.length;

  return (
    <>
      <UnifiedTablePage
        header={{
          title: "Meetings",
          description: "Synced call recordings and transcripts from Fireflies and Teams",
          actions: headerActions,
        }}
        tabs={tabs}
        layout={{
          headerAlignment: "left",
          toolbarInlineWithHeader: true,
        }}
        toolbar={{
          totalItems: unfilteredTotal,
          filteredItems: totalItems,
          selectedCount: tableState.selectedIds.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search meetings...",
          currentView: tableState.currentView,
          onViewChange: (view) => {
            tableState.setCurrentView(view);
            tableState.setSearchParams({ view });
          },
          filters,
          activeFilters,
          onFilterChange: handleFilterChange,
          onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
          columns: meetingColumns,
          visibleColumns: tableState.visibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
          onExport: handleExport,
          onBulkDelete: () => setBulkDeleteDialogOpen(true),
          customActions: (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => void handleBulkDownloadMarkdown()}
                    aria-label="Download markdown"
                  >
                    <FileDown />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {selectedCount > 0
                    ? `Download markdown (${selectedCount} selected)`
                    : "Download all as markdown"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ),
          // Stable, project-agnostic scope so a "Quick view" saved on project A
          // also applies on project B. See user_table_views table.
          savedViewsScope: "meetings",
        }}
        data={{
          items: pagedMeetings,
          isLoading: false,
        }}
        table={{
          columns: tableColumns,
          getRowId: (item) => item.id,
          onRowClick: handleRowClick,
          bulkEdit: {
            fields: bulkEditFields,
            onApply: handleBulkEdit,
            itemNoun: "meeting",
          },
          rowActions: (item) =>
            renderMeetingRowActions(
              item,
              handleOpenMeetingPage,
              handleEdit,
              (meeting) => {
                setMeetingToDelete(meeting);
                setDeleteDialogOpen(true);
              },
              handleOpenSource,
              handleOpenRecording,
              handleDownloadTranscriptPdf,
              handleDownloadMarkdown,
            ),
        }}
        sorting={{
          sortBy: tableState.sortBy,
          sortDirection: tableState.sortDirection,
          onSortChange: (sortBy, direction) => {
            tableState.setSortBy(sortBy);
            tableState.setSortDirection(direction);
            tableState.setSearchParams({
              sort: sortBy,
              sort_dir: direction,
              page: "1",
            });
            tableState.setPage(1);
          },
        }}
        selection={{
          selectedIds: tableState.selectedIds,
          onSelectAll: handleSelectAll,
          onSelectRow: handleSelectRow,
        }}
        views={{
          card: (item) => renderMeetingCard(item, handleRowClick),
          list: (item) => renderMeetingList(item, handleRowClick),
        }}
        emptyState={{
          title: "No meetings found",
          description: "You have not added any meetings yet.",
          filteredDescription: "Try adjusting your search or filters",
          isFiltered,
        }}
        features={{
          enableBulkDelete: true,
          enableRowSelection: true,
        }}
        pagination={{
          page: tableState.page,
          totalPages,
          perPage: tableState.perPage,
          onPageChange: (nextPage) => {
            tableState.setPage(nextPage);
            tableState.setSearchParams({ page: String(nextPage) });
          },
          onPerPageChange: (nextPerPage) => {
            const parsed = Number(nextPerPage);
            if (!Number.isFinite(parsed) || parsed <= 0) return;
            tableState.setPerPage(parsed);
            tableState.setSearchParams({ per_page: String(parsed), page: "1" });
            tableState.setPage(1);
          },
        }}
      />

      <DetailPanel
        open={detailPanelOpen}
        onOpenChange={handlePanelOpenChange}
        item={editingMeeting}
        title={editingMeeting?.title ?? "Meeting"}
        fields={detailFields}
        onSave={handleSave}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this meeting? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!meetingToDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected meetings</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {tableState.selectedIds.length} selected meeting
              {tableState.selectedIds.length === 1 ? "" : "s"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={tableState.selectedIds.length === 0}
            >
              Delete selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

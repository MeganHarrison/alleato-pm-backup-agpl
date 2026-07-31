"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout";
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
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
} from "@/components/tables/unified";
import { useCurrentUserProfile } from "@/hooks/use-current-user-profile";
import {
  useKnowledgeDocuments,
  useDeleteKnowledgeDocument,
  type KnowledgeDocument,
} from "@/hooks/use-knowledge-documents";
import {
  knowledgeColumns,
  knowledgeDefaultVisibleColumns,
  knowledgeFilters,
  buildKnowledgeTableColumns,
} from "./knowledge-table-config";
import { KnowledgeUploadDialog } from "./knowledge-upload-dialog";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KnowledgeTablePage() {
  const router = useRouter();
  const pathname = usePathname()!;
  const searchParams = useSearchParams()!;
  const { profile, isLoading: isLoadingProfile } = useCurrentUserProfile();
  const isAdmin = profile?.isAdmin === true;

  // Table state
  const tableState = useUnifiedTableState({
    entityKey: "knowledge",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "created_at",
      sortDirection: "desc",
      visibleColumns: knowledgeDefaultVisibleColumns,
      filters: {},
    },
  });

  // Data fetching
  const { data: documents = [], isLoading } = useKnowledgeDocuments({
    search: tableState.debouncedSearch || undefined,
    manage: true,
  });

  // Mutations
  const deleteMutation = useDeleteKnowledgeDocument();

  // UI state
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<KnowledgeDocument | null>(null);

  // Sorting
  const sortedDocuments = React.useMemo(() => {
    if (!tableState.sortBy) return documents;
    return [...documents].sort((a, b) => {
      const key = tableState.sortBy as keyof KnowledgeDocument;
      const aVal = a[key] ?? "";
      const bVal = b[key] ?? "";
      const cmp = String(aVal).localeCompare(String(bVal));
      return tableState.sortDirection === "desc" ? -cmp : cmp;
    });
  }, [documents, tableState.sortBy, tableState.sortDirection]);

  // Filter by status if selected
  const filteredDocuments = React.useMemo(() => {
    const statusFilter = tableState.activeFilters.status as string | undefined;
    if (!statusFilter) return sortedDocuments;
    return sortedDocuments.filter((d) => d.status === statusFilter);
  }, [sortedDocuments, tableState.activeFilters.status]);

  // Pagination
  const totalPages = Math.ceil(filteredDocuments.length / tableState.perPage);
  const pagedDocuments = filteredDocuments.slice(
    (tableState.page - 1) * tableState.perPage,
    tableState.page * tableState.perPage,
  );

  // Table columns
  const tableColumns = React.useMemo(
    () =>
      buildKnowledgeTableColumns({
        onDelete: (item) => setDeleteTarget(item),
      }),
    [],
  );

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }

  function handleFilterChange(filters: Record<string, FilterValue>) {
    tableState.setActiveFilters(filters);
    tableState.setPage(1);
  }

  function handleExport() {
    const headers = ["Title", "Status", "Tags", "File", "Date", "Created"];
    const rows = filteredDocuments.map((d) => [
      d.title ?? d.file_name ?? "",
      d.status ?? "",
      d.tags?.join(", ") ?? "",
      d.file_name ?? "",
      d.date ?? d.created_at ?? "",
      d.created_at ? new Date(d.created_at).toLocaleDateString() : "",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "knowledge-documents-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const activeFilters: Record<string, FilterValue> = {};
  if (tableState.activeFilters.status) {
    activeFilters.status = tableState.activeFilters.status;
  }

  const isFiltered =
    !!tableState.debouncedSearch || Object.keys(activeFilters).length > 0;

  if (isLoadingProfile) {
    return (
      <PageShell
        variant="content"
        title="Manage Knowledge Sources"
        description="Checking your access before loading source management."
      >
        <div className="h-24 animate-pulse rounded-lg bg-muted/30" />
      </PageShell>
    );
  }

  if (!isAdmin) {
    return (
      <PageShell
        variant="content"
        title="Manage Knowledge Sources"
        description="Company knowledge source management is limited to admins."
      >
        <div className="space-y-2">
          <p className="text-sm text-foreground">
            You can still browse approved knowledge from the Knowledge Base.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/knowledge">Open Knowledge Base</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <>
      <UnifiedTablePage<KnowledgeDocument>
        header={{
          title: "Manage Knowledge Sources",
          description:
            "Admin source manager for knowledge documents uploaded to the RAG pipeline.",
          actions: (
            <Button onClick={() => setUploadOpen(true)} size="sm">
              <Upload />
              Upload Source
            </Button>
          ),
        }}
        layout={{
          toolbarInlineWithHeader: true,
        }}
        toolbar={{
          totalItems: documents.length,
          filteredItems: filteredDocuments.length,
          selectedCount: 0,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search knowledge sources…",
          currentView: tableState.currentView,
          onViewChange: tableState.setCurrentView,
          enabledViews: ["table"],
          filters: knowledgeFilters,
          activeFilters,
          onFilterChange: handleFilterChange,
          onClearFilters: () => {
            tableState.setActiveFilters({});
            tableState.setPage(1);
          },
          columns: knowledgeColumns,
          visibleColumns: tableState.visibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
          onExport: handleExport,
        }}
        data={{
          items: pagedDocuments,
          isLoading,
        }}
        table={{
          columns: tableColumns,
          getRowId: (item) => item.id,
        }}
        sorting={{
          sortBy: tableState.sortBy,
          sortDirection: tableState.sortDirection,
          onSortChange: (sortBy, direction) => {
            tableState.setSortBy(sortBy);
            tableState.setSortDirection(direction);
          },
        }}
        pagination={{
          page: tableState.page,
          totalPages,
          perPage: tableState.perPage,
          onPageChange: tableState.setPage,
          onPerPageChange: (v) => {
            tableState.setPerPage(parseInt(v));
            tableState.setPage(1);
          },
          clientSide: true,
        }}
        emptyState={{
          title: "No knowledge sources yet",
          description:
            "Upload documents to build the company knowledge base. Files are processed through the RAG pipeline and become searchable by Ask Alleato.",
          filteredDescription: "No sources match your current filters.",
          isFiltered,
          action: (
            <Button onClick={() => setUploadOpen(true)} size="sm">
              <Upload />
              Upload First Source
            </Button>
          ),
        }}
        features={{
          enableSearch: true,
          enableFilters: true,
          enableColumnToggle: true,
          enableExport: true,
          enableViews: false,
        }}
      />

      <KnowledgeUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete knowledge source?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.title ?? deleteTarget?.file_name}&rdquo; and
              its storage file will be permanently deleted. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

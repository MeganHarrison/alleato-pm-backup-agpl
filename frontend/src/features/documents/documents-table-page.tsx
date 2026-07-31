"use client";

import * as React from "react";

import { format } from "date-fns";
import { Loader2, Upload, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { UnifiedTablePage } from "@/components/tables/unified";
import type { TableColumn } from "@/components/tables/unified";
import { Button } from "@/components/ui/button";
import {
  Modal as Dialog,
  ModalContent as DialogContent,
  ModalDescription as DialogDescription,
  ModalFooter as DialogFooter,
  ModalHeader as DialogHeader,
  ModalTitle as DialogTitle,
} from "@/components/ui/unified-modal";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type PipelineDoc,
  buildDocumentTableColumns,
  getDocumentViewUrl,
  renderDocumentCard,
  renderDocumentList,
  renderDocumentRowActions,
} from "@/features/documents/documents-table-config";
import type { DocumentFilterState } from "@/features/documents/documents-table-definition";
import { useServerTableDefinition } from "@/features/tables/server-table";
import type { ServerTableDefinition } from "@/features/tables/server-table";
import { apiFetch } from "@/lib/api-client";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";

const MAX_FILE_SIZE = 50 * 1000 * 1000;

interface SimpleProject {
  id: number;
  name: string | null;
}

type ViewPreference = "external-first" | "internal-first";

export interface DocumentsTablePageProps {
  definition: ServerTableDefinition<PipelineDoc, DocumentFilterState>;
  title: string;
  eyebrow?: React.ReactNode;
  description: string;
  uploadEnabled?: boolean;
  inlineEditingEnabled?: boolean;
  projectAssignmentEnabled?: boolean;
  deleteEnabled?: boolean;
  exportFilePrefix?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyFilteredDescription?: string;
  openPreference?: ViewPreference;
  pageArea?: string;
  uploadProjectId?: number | null;
  tableColumns?: TableColumn<PipelineDoc>[];
  renderCard?: (item: PipelineDoc, onView: (item: PipelineDoc) => void) => React.ReactElement;
  renderList?: (item: PipelineDoc, onView: (item: PipelineDoc) => void) => React.ReactElement;
  selectedDocId?: string;
  onSelectDoc?: (doc: PipelineDoc) => void;
  cardGridClassName?: string;
  headerTitleClassName?: string;
  onDocumentsChange?: (documents: PipelineDoc[]) => void;
}

function UploadDialog({
  open,
  onOpenChange,
  onUploadComplete,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: () => void;
  projectId?: number | null;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = React.useState<File[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setFiles([]);
      setIsUploading(false);
    }
  }, [open]);

  const handleFileSelection = React.useCallback(
    (nextFiles: FileList | null) => {
      const valid = Array.from(nextFiles ?? []).filter(
        (file) => file.size <= MAX_FILE_SIZE,
      );
      const oversized = Array.from(nextFiles ?? []).filter(
        (file) => file.size > MAX_FILE_SIZE,
      );

      if (oversized.length > 0) {
        toast.error("Files larger than 50 MB were skipped.");
      }

      setFiles(valid.slice(0, 10));
    },
    [],
  );

  const handleUpload = React.useCallback(async () => {
    if (files.length === 0) {
      toast.error("Select at least one file.");
      return;
    }

    setIsUploading(true);
    const failed: string[] = [];
    const warnings: string[] = [];

    for (const file of files) {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("title", file.name.replace(/\.[^.]+$/, ""));
      if (projectId) {
        formData.set("project_id", String(projectId));
      }

      try {
        const result = await apiFetch<{
          pipelineQueued?: boolean;
          pipelineMessage?: string | null;
        }>("/api/documents/upload", {
          method: "POST",
          body: formData,
        });
        if (result.pipelineQueued === false && result.pipelineMessage) {
          warnings.push(`${file.name}: ${result.pipelineMessage}`);
        }
      } catch {
        failed.push(file.name);
      }
    }

    setIsUploading(false);

    if (failed.length > 0) {
      toast.error(
        failed.length === files.length
          ? "Document upload failed."
          : `${files.length - failed.length} uploaded, ${failed.length} failed.`,
      );
      return;
    }

    toast.success(
      `${files.length} document${files.length === 1 ? "" : "s"} uploaded.`,
    );
    if (warnings.length > 0) {
      toast.warning(
        warnings.length === 1
          ? warnings[0]
          : `${warnings.length} uploads need pipeline retry.`,
      );
    }
    onOpenChange(false);
    onUploadComplete();
  }, [files, onOpenChange, onUploadComplete, projectId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
          <DialogDescription>
            Upload documents into the shared document library.
            {projectId ? " New uploads will be assigned to this project." : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-dashed border-border p-4">
            <Input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt,.md,.markdown"
              onChange={(event) => handleFileSelection(event.target.files)}
              disabled={isUploading}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Up to 10 files. Supported: PDF, DOCX, DOC, TXT, MD. Max 50 MB each.
            </p>
          </div>

          {files.length > 0 ? (
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={`${file.name}-${file.size}`}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round(file.size / 1024)} KB
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setFiles((current) =>
                        current.filter(
                          (candidate) =>
                            !(
                              candidate.name === file.name &&
                              candidate.size === file.size
                            ),
                        ),
                      )
                    }
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleUpload()}
            disabled={isUploading || files.length === 0}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading
              </>
            ) : (
              "Upload"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignProjectDialog({
  open,
  onOpenChange,
  document: doc,
  projects,
  onAssign,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: PipelineDoc | null;
  projects: SimpleProject[];
  onAssign: (docId: string, projectId: number | null) => void;
}) {
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>("");

  React.useEffect(() => {
    if (doc?.project_id) {
      setSelectedProjectId(String(doc.project_id));
    } else {
      setSelectedProjectId("");
    }
  }, [doc]);

  const handleSave = () => {
    if (!doc) return;
    const projectId =
      selectedProjectId && selectedProjectId !== "__none__"
        ? Number(selectedProjectId)
        : null;
    onAssign(doc.id, projectId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign to Project</DialogTitle>
          <DialogDescription>
            {doc?.title || "Untitled Document"}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Select
            value={selectedProjectId}
            onValueChange={setSelectedProjectId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a project..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No project</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name || `Project #${p.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getInternalDocumentHref(doc: PipelineDoc): string | null {
  if (doc.type === "teams_dm_conversation" && !doc.project_id) {
    return `/teams-conversations/${encodeURIComponent(doc.id)}`;
  }
  if (!doc.project_id) return null;
  return `/${doc.project_id}/intelligence/sources/${encodeURIComponent(doc.id)}`;
}

export function DocumentsTablePage({
  definition,
  title,
  eyebrow,
  description,
  uploadEnabled = true,
  inlineEditingEnabled = true,
  projectAssignmentEnabled = true,
  deleteEnabled = true,
  exportFilePrefix = "documents",
  emptyTitle = "No documents found",
  emptyDescription = "Upload your first document to start building your RAG library.",
  emptyFilteredDescription = "Try adjusting your search or filters.",
  openPreference = "external-first",
  pageArea,
  uploadProjectId,
  tableColumns: customTableColumns,
  renderCard: customRenderCard,
  renderList: customRenderList,
  selectedDocId: _selectedDocId,
  onSelectDoc,
  cardGridClassName,
  headerTitleClassName,
  onDocumentsChange,
}: DocumentsTablePageProps) {
  const router = useRouter();
  const pathname = usePathname()!;
  const searchParams = useSearchParams()!;
  const area = pageArea ?? `${definition.entityKey}-table`;

  const [projects, setProjects] = React.useState<SimpleProject[]>([]);
  const [uploadDialogOpen, setUploadDialogOpen] = React.useState(false);
  const [assignDoc, setAssignDoc] = React.useState<PipelineDoc | null>(null);
  const lastErrorMessageRef = React.useRef<string | null>(null);

  const projectNames = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const p of projects) {
      if (p.name) map.set(p.id, p.name);
    }
    return map;
  }, [projects]);

  const {
    tableState,
    items: documents,
    totalItems: totalDocuments,
    totalPages,
    isLoading,
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
  } = useServerTableDefinition<PipelineDoc, DocumentFilterState>({
    definition,
    searchParams,
    pathname,
    router,
  });

  React.useEffect(() => {
    onDocumentsChange?.(documents);
  }, [documents, onDocumentsChange]);

  React.useEffect(() => {
    if (!error) return;
    if (lastErrorMessageRef.current === error.message) return;
    lastErrorMessageRef.current = error.message;
    reportNonCriticalFailure({
      area,
      operation: "load-documents-page",
      error,
      userVisibleFallback: `${title} could not be loaded.`,
    });
    toast.error(error.message);
  }, [area, error, title]);

  const fetchProjects = React.useCallback(async () => {
    if (!projectAssignmentEnabled) return;
    try {
      const result = await apiFetch<
        { data?: SimpleProject[]; projects?: SimpleProject[] } | SimpleProject[]
      >("/api/projects?fields=id,name", { cache: "no-store" });
      const list = Array.isArray(result)
        ? result
        : (result.data ?? result.projects ?? []);
      setProjects(list as SimpleProject[]);
    } catch (error) {
      reportNonCriticalFailure({
        area,
        operation: "load-project-options",
        error,
        userVisibleFallback: "Project assignment options could not be loaded.",
      });
    }
  }, [area, projectAssignmentEnabled]);

  React.useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const handleAssignProject = React.useCallback(
    async (docId: string, projectId: number | null) => {
      try {
        await apiFetch(`/api/documents/${docId}/assign-project`, {
          method: "PATCH",
          body: JSON.stringify({ project_id: projectId }),
        });
        toast.success(
          projectId ? "Document assigned to project" : "Project assignment removed",
        );
        await refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to assign project";
        toast.error(message);
      }
    },
    [refresh],
  );

  const handleEditField = React.useCallback(
    async (docId: string, field: string, value: string) => {
      try {
        const parsedValue =
          field === "project_id"
            ? value && value !== "__none__"
              ? Number(value)
              : null
            : value || null;

        await apiFetch(`/api/documents/${docId}/assign-project`, {
          method: "PATCH",
          body: JSON.stringify({ [field]: parsedValue }),
        });
        await refresh();
        if (field === "project_id") {
          toast.success(
            parsedValue ? "Project assigned" : "Project removed",
          );
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update";
        toast.error(message);
      }
    },
    [refresh],
  );

  const defaultTableColumns = React.useMemo(
    () =>
      buildDocumentTableColumns({
        projectNames,
        projects,
        onEditField: inlineEditingEnabled ? handleEditField : undefined,
      }),
    [
      projectNames,
      projects,
      inlineEditingEnabled,
      handleEditField,
      onSelectDoc,
    ],
  );
  const tableColumns = customTableColumns ?? defaultTableColumns;

  const handleDeleteDocument = React.useCallback(
    async (doc: PipelineDoc) => {
      try {
        await apiFetch(`/api/documents/${doc.id}`, { method: "DELETE" });
        toast.success("Document deleted");
        await refresh();
      } catch {
        toast.error("Failed to delete document");
      }
    },
    [refresh],
  );

  const handleView = React.useCallback((doc: PipelineDoc) => {
    const internalHref = getInternalDocumentHref(doc);
    const externalHref = getDocumentViewUrl(doc);

    if (openPreference === "internal-first" && internalHref) {
      router.push(internalHref);
      return;
    }

    if (externalHref) {
      window.open(externalHref, "_blank", "noopener,noreferrer");
      return;
    }

    if (internalHref) {
      router.push(internalHref);
      return;
    }

    toast.info(`Document: ${doc.title || doc.id}`);
  }, [openPreference, router]);

  const handleExport = React.useCallback(() => {
    const headers = [
      "Title",
      "Type",
      "Category",
      "Source",
      "Pipeline Stage",
      "Created",
    ];
    const rows = documents.map((d) => [
      d.title || "",
      d.type || "",
      d.category || "",
      d.source || "",
      d.pipeline_stage || "",
      d.created_at ? format(new Date(d.created_at), "yyyy-MM-dd") : "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFilePrefix}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }, [documents, exportFilePrefix]);

  return (
    <>
      {uploadEnabled ? (
        <UploadDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          projectId={uploadProjectId}
          onUploadComplete={() => {
            void refresh({ page: tableState.page });
          }}
        />
      ) : null}
      {projectAssignmentEnabled ? (
        <AssignProjectDialog
          open={assignDoc !== null}
          onOpenChange={(open) => {
            if (!open) setAssignDoc(null);
          }}
          document={assignDoc}
          projects={projects}
          onAssign={handleAssignProject}
        />
      ) : null}
      <UnifiedTablePage
        layout={cardGridClassName ? { cardGridClassName } : undefined}
        header={{
          title,
          eyebrow,
          description,
          actions: uploadEnabled ? (
            <Button
              size="sm"
              onClick={() => setUploadDialogOpen(true)}
              className="gap-2"
            >
              <Upload />
              Upload
            </Button>
          ) : undefined,
          titleClassName: headerTitleClassName,
        }}
        toolbar={{
          totalItems: totalDocuments,
          filteredItems: totalDocuments,
          selectedCount: 0,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: definition.searchPlaceholder,
          currentView: tableState.currentView,
          onViewChange: handleViewChange,
          enabledViews: definition.allowedViews,
          filters: definition.filters,
          activeFilters,
          onFilterChange: (filters) =>
            handleFilterChange(filters as DocumentFilterState),
          onClearFilters: handleClearFilters,
          columns: definition.columns,
          visibleColumns: tableState.visibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
          savedViewsScope: definition.entityKey,
          savedViewsDefaults: {
            visibleColumns: definition.defaultVisibleColumns,
            columnOrder: definition.columns.map((column) => column.id),
            columnWidths: {},
            sortBy: definition.defaultSortBy,
            sortDirection: definition.defaultSortDirection,
            filters: definition.defaultFilters,
          },
          onExport: handleExport,
        }}
        data={{
          items: documents,
          isLoading,
          isFetching: false,
          error,
        }}
        table={{
          columns: tableColumns,
          getRowId: (item) => item.id,
          onRowClick: onSelectDoc ?? handleView,
          rowActions: (item) =>
            renderDocumentRowActions(
              item,
              onSelectDoc ?? handleView,
              projectAssignmentEnabled ? (doc) => setAssignDoc(doc) : undefined,
              deleteEnabled ? handleDeleteDocument : undefined,
            ),
        }}
        sorting={{
          sortBy: tableState.sortBy,
          sortDirection: tableState.sortDirection,
          onSortChange: handleSortChange,
        }}
        views={{
          card: (item) =>
            (customRenderCard ?? renderDocumentCard)(
              item,
              onSelectDoc ?? handleView,
            ),
          list: (item) =>
            (customRenderList ?? renderDocumentList)(
              item,
              onSelectDoc ?? handleView,
            ),
        }}
        emptyState={{
          title: emptyTitle,
          description: emptyDescription,
          filteredDescription: emptyFilteredDescription,
          isFiltered,
          action: uploadEnabled ? (
            <Button size="sm" onClick={() => setUploadDialogOpen(true)}>
              Upload document
            </Button>
          ) : undefined,
        }}
        features={{
          enableInlineEditing: inlineEditingEnabled,
        }}
        pagination={{
          page: tableState.page,
          totalPages,
          perPage: tableState.perPage,
          onPageChange: handlePageChange,
          onPerPageChange: handlePerPageChange,
        }}
      />
    </>
  );
}

"use client";

import * as React from "react";
import type { ReactElement } from "react";
import { useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Archive,
  Download,
  Eye,
  FileText,
  Mail,
  Pencil,
  Plus,
  Bell,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";

import {
  TableRowActionsMenu,
  UnifiedTablePage,
  useUnifiedTableState,
  type TableColumn,
  type FilterValue,
  type TableRowActionItem,
} from "@/components/tables/unified";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from "@/components/ui/unified-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  SpecificationUploadDialog,
  SpecificationEditModal,
} from "@/components/specifications";
import {
  useArchiveSpecification,
  useProjectSpecificationRevisions,
  useSpecifications,
  useToggleSpecificationSubscription,
  type ProjectSpecificationRevision,
} from "@/hooks/use-specifications";
import { useSpecificationAreas } from "@/hooks/use-specification-areas";
import type { SpecificationWithRevision } from "@/types/specifications.types";

type StatusFilter = "active" | "archived" | "superseded";
type SpecificationsTab = "specifications" | "revisions" | "recycle";
type SpecFilterState = Record<string, FilterValue>;

const EMPTY_FILTERS: SpecFilterState = {
  status: undefined,
  area_id: undefined,
};

const DEFAULT_VISIBLE_SPEC_COLUMNS = [
  "section_number",
  "title",
  "status",
  "revision",
  "file_size",
  "updated_at",
  "areas",
];

const DEFAULT_VISIBLE_REVISION_COLUMNS = [
  "section_number",
  "section_title",
  "revision",
  "file_name",
  "file_size",
  "uploaded_at",
];

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeCsv(value: string | number | null | undefined): string {
  const normalized = value == null ? "" : String(value);
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function openPrintWindow(title: string, tableHeaders: string[], tableRows: string[][]) {
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) {
    toast.error("Popup blocked. Allow popups to export PDF.");
    return;
  }

  const headerHtml = tableHeaders.map((header) => `<th>${header}</th>`).join("");
  const rowsHtml = tableRows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("");

  popup.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; }
          h1 { font-size: 20px; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
          th { background: #f5f5f5; font-weight: 600; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <table>
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
}

function renderSpecCard(spec: SpecificationWithRevision, onView: (id: number) => void): ReactElement {
  return (
    <div
      className="cursor-pointer rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
      onClick={() => onView(spec.id)}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{spec.title}</p>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{spec.section_number}</p>
        </div>
        <Badge variant={spec.status === "active" ? "default" : "secondary"}>{spec.status}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {spec.current_revision && <span>Rev {spec.current_revision.revision_number}</span>}
        {spec.current_revision && <span>{formatFileSize(spec.current_revision.file_size)}</span>}
        <span>
          {formatDistanceToNow(new Date(spec.updated_at || spec.created_at), {
            addSuffix: true,
          })}
        </span>
      </div>
    </div>
  );
}

function renderSpecList(spec: SpecificationWithRevision, onView: (id: number) => void): ReactElement {
  return (
    <div
      className="flex cursor-pointer items-center justify-between px-4 py-2.5 transition-colors hover:bg-muted/50"
      onClick={() => onView(spec.id)}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{spec.section_number}</span>
          <span className="truncate text-sm font-medium">{spec.title}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(spec.updated_at || spec.created_at), {
            addSuffix: true,
          })}
        </p>
      </div>
      <div className="ml-3 shrink-0">
        <Badge variant={spec.status === "active" ? "default" : "secondary"}>{spec.status}</Badge>
      </div>
    </div>
  );
}

function CreateDivisionDialog({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [divisionNumber, setDivisionNumber] = useState("");
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = divisionNumber.trim().length > 0 && title.trim().length > 0;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      await apiFetch(`/api/projects/${projectId}/specifications/divisions`, {
        method: "POST",
        body: JSON.stringify({
          division_number: divisionNumber.trim(),
          title: title.trim(),
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ["specification-divisions", projectId] });
      toast.success("Specification division created");
      setDivisionNumber("");
      setTitle("");
      setOpen(false);
    } catch (error) {
      toast.error("Could not create division", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4" />
          Create Division
        </Button>
      </ModalTrigger>
      <ModalContent size="md">
        <ModalHeader>
          <ModalTitle>Create Division</ModalTitle>
          <ModalDescription>
            Adds a division label. Section assignment is derived from section numbers until division mapping is stored.
          </ModalDescription>
        </ModalHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="spec-division-number">Number</Label>
            <Input
              id="spec-division-number"
              value={divisionNumber}
              onChange={(event) => setDivisionNumber(event.target.value)}
              placeholder="08"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="spec-division-title">Description</Label>
            <Textarea
              id="spec-division-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Openings"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              Create
            </Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}

function CreateSpecificationDialog({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sectionNumber, setSectionNumber] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = sectionNumber.trim().length > 0 && title.trim().length > 0;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      await apiFetch(`/api/projects/${projectId}/specifications/sections`, {
        method: "POST",
        body: JSON.stringify({
          section_number: sectionNumber.trim(),
          title: title.trim(),
          description: description.trim() || null,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ["specifications", projectId] });
      toast.success("Specification created");
      setSectionNumber("");
      setTitle("");
      setDescription("");
      setOpen(false);
    } catch (error) {
      toast.error("Could not create specification", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4" />
          Create Specification
        </Button>
      </ModalTrigger>
      <ModalContent size="xl">
        <ModalHeader>
          <ModalTitle>Create Specification</ModalTitle>
          <ModalDescription>
            Creates a section record. Upload a file separately to add the first revision.
          </ModalDescription>
        </ModalHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="spec-section-number">Number</Label>
            <Input
              id="spec-section-number"
              value={sectionNumber}
              onChange={(event) => setSectionNumber(event.target.value)}
              placeholder="08-1113"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="spec-section-title">Description</Label>
            <Input
              id="spec-section-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Doors, Frames, Hardware"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="spec-section-notes">Notes</Label>
            <Textarea
              id="spec-section-notes"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional internal notes"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              Create
            </Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}

export default function ProjectSpecificationsPage() {
  const params = useParams<{ projectId: string }>()! ?? { projectId: "" };
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = (useSearchParams() ?? new URLSearchParams()) as NonNullable<ReturnType<typeof useSearchParams>>;
  const projectId = params.projectId;

  const activeTab = (searchParams.get("spec_tab") as SpecificationsTab) || "specifications";

  const [editingSpec, setEditingSpec] = useState<SpecificationWithRevision | null>(null);
  const [subscribedSectionIds, setSubscribedSectionIds] = useState<Record<number, boolean>>({});

  const { data: areas } = useSpecificationAreas(projectId);
  const archiveMutation = useArchiveSpecification(projectId);
  const toggleSubscriptionMutation = useToggleSpecificationSubscription(projectId);

  const initialFilters: SpecFilterState = {
    status: searchParams.get("status") ?? undefined,
    area_id: searchParams.get("area_id") ?? undefined,
  };

  const tableState = useUnifiedTableState({
    entityKey: activeTab === "revisions" ? "specification-revisions" : "specifications",
    searchParams,
    pathname,
    router,
    defaults: {
      view: activeTab === "revisions" ? "table" : "table",
      allowedViews: activeTab === "revisions" ? ["table"] : ["table", "card", "list"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: activeTab === "revisions" ? "uploaded_at" : "section_number",
      sortDirection: activeTab === "revisions" ? "desc" : "asc",
      visibleColumns:
        activeTab === "revisions" ? DEFAULT_VISIBLE_REVISION_COLUMNS : DEFAULT_VISIBLE_SPEC_COLUMNS,
      filters: initialFilters,
    },
  });

  const activeFilters = tableState.activeFilters as SpecFilterState;
  const statusFilter = typeof activeFilters.status === "string" ? activeFilters.status : undefined;
  const areaFilter = typeof activeFilters.area_id === "string" ? activeFilters.area_id : undefined;

  const effectiveStatus =
    activeTab === "recycle"
      ? "archived"
      : (statusFilter as StatusFilter | undefined);

  const { data, isLoading, isFetching } = useSpecifications(projectId, {
    search: tableState.debouncedSearch || undefined,
    status: activeTab === "revisions" ? undefined : effectiveStatus,
    area_id: areaFilter ? parseInt(areaFilter, 10) : undefined,
    page: tableState.page,
    page_size: tableState.perPage,
  });

  const {
    data: revisionsData,
    isLoading: isLoadingRevisions,
    isFetching: isFetchingRevisions,
  } = useProjectSpecificationRevisions(projectId);

  const specifications = React.useMemo(() => {
    const rows = data?.specifications ?? [];
    if (activeTab === "specifications") {
      return rows.filter((spec) => spec.status !== "archived");
    }
    if (activeTab === "recycle") {
      return rows.filter((spec) => spec.status === "archived");
    }
    return rows;
  }, [activeTab, data?.specifications]);

  const revisions = React.useMemo(() => {
    const rows = revisionsData?.revisions ?? [];
    const search = tableState.debouncedSearch.trim().toLowerCase();
    if (!search) return rows;
    return rows.filter((revision) => {
      const haystack = [
        revision.section_number,
        revision.section_title,
        revision.file_name,
        revision.notes ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }, [revisionsData?.revisions, tableState.debouncedSearch]);

  React.useEffect(() => {
    tableState.setSelectedIds([]);
  }, [activeTab]);

  const handleView = (specId: number) => {
    router.push(`/${projectId}/specifications/${specId}`);
  };

  const handleDownload = async (specId: number, revisionId: number) => {
    try {
      const { url } = await apiFetch<{ url: string }>(
        `/api/projects/${projectId}/specifications/${specId}/revisions/${revisionId}/download`,
      );
      window.open(url, "_blank");
    } catch {
      toast.error("Failed to download file");
    }
  };

  const sendSpecificationEmail = (spec: SpecificationWithRevision) => {
    const subject = encodeURIComponent(`Specification: ${spec.section_number} ${spec.title}`);
    const body = encodeURIComponent(
      `Specification details:\n\nSection: ${spec.section_number}\nTitle: ${spec.title}\nStatus: ${spec.status}\n\nLink: ${window.location.origin}/${projectId}/specifications/${spec.id}`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const sendRevisionEmail = (revision: ProjectSpecificationRevision) => {
    const subject = encodeURIComponent(
      `Specification Revision: ${revision.section_number} Rev ${revision.revision_number}`,
    );
    const body = encodeURIComponent(
      `Revision details:\n\nSection: ${revision.section_number}\nTitle: ${revision.section_title}\nRevision: ${revision.revision_number}\nFile: ${revision.file_name}`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleArchive = async (spec: SpecificationWithRevision) => {
    await archiveMutation.mutateAsync(spec);
  };

  const handleToggleSubscribe = async (sectionId: number) => {
    const currentlySubscribed = subscribedSectionIds[sectionId] === true;
    await toggleSubscriptionMutation.mutateAsync({
      sectionId,
      subscribe: !currentlySubscribed,
    });
    setSubscribedSectionIds((prev) => ({ ...prev, [sectionId]: !currentlySubscribed }));
  };

  const handleExportCsv = () => {
    if (activeTab === "revisions") {
      const headers = ["Section #", "Title", "Revision", "File Name", "File Size", "Uploaded"];
      const lines = revisions.map((revision) =>
        [
          escapeCsv(revision.section_number),
          escapeCsv(revision.section_title),
          escapeCsv(revision.revision_number),
          escapeCsv(revision.file_name),
          escapeCsv(formatFileSize(revision.file_size)),
          escapeCsv(new Date(revision.uploaded_at).toLocaleString()),
        ].join(","),
      );
      downloadTextFile(
        `specification-revisions-${projectId}.csv`,
        [headers.join(","), ...lines].join("\n"),
        "text/csv;charset=utf-8",
      );
      return;
    }

    const headers = ["Section #", "Title", "Status", "Revision", "File Size", "Last Updated"];
    const lines = specifications.map((spec) =>
      [
        escapeCsv(spec.section_number),
        escapeCsv(spec.title),
        escapeCsv(spec.status),
        escapeCsv(spec.current_revision?.revision_number ?? ""),
        escapeCsv(spec.current_revision ? formatFileSize(spec.current_revision.file_size) : ""),
        escapeCsv(new Date(spec.updated_at || spec.created_at).toLocaleString()),
      ].join(","),
    );

    downloadTextFile(
      `specifications-${projectId}.csv`,
      [headers.join(","), ...lines].join("\n"),
      "text/csv;charset=utf-8",
    );
  };

  const handleExportPdf = () => {
    if (activeTab === "revisions") {
      openPrintWindow(
        "Specification Revisions",
        ["Section #", "Title", "Revision", "File Name", "File Size", "Uploaded"],
        revisions.map((revision) => [
          revision.section_number,
          revision.section_title,
          `Rev ${revision.revision_number}`,
          revision.file_name,
          formatFileSize(revision.file_size),
          new Date(revision.uploaded_at).toLocaleString(),
        ]),
      );
      return;
    }

    openPrintWindow(
      activeTab === "recycle" ? "Specifications Recycle Bin" : "Specifications",
      ["Section #", "Title", "Status", "Revision", "File Size", "Last Updated"],
      specifications.map((spec) => [
        spec.section_number,
        spec.title,
        spec.status,
        spec.current_revision ? `Rev ${spec.current_revision.revision_number}` : "—",
        spec.current_revision ? formatFileSize(spec.current_revision.file_size) : "—",
        formatDistanceToNow(new Date(spec.updated_at || spec.created_at), { addSuffix: true }),
      ]),
    );
  };

  const tabs = React.useMemo(() => {
    const baseParams = new URLSearchParams(searchParams.toString());
    const createHref = (tab: SpecificationsTab) => {
      const nextParams = new URLSearchParams(baseParams.toString());
      nextParams.set("spec_tab", tab);
      nextParams.set("page", "1");
      if (tab === "revisions") {
        nextParams.delete("status");
        nextParams.delete("area_id");
      }
      return `${pathname}?${nextParams.toString()}`;
    };

    return [
      { label: "Specifications", href: createHref("specifications"), isActive: activeTab === "specifications" },
      { label: "All Revisions", href: createHref("revisions"), isActive: activeTab === "revisions" },
      { label: "Recycle Bin", href: createHref("recycle"), isActive: activeTab === "recycle" },
    ];
  }, [activeTab, pathname, searchParams]);

  const headerActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {activeTab === "specifications" && (
        <>
          <SpecificationUploadDialog projectId={projectId}>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Upload
            </Button>
          </SpecificationUploadDialog>
          <CreateDivisionDialog projectId={projectId} />
          <CreateSpecificationDialog projectId={projectId} />
        </>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleExportPdf}>Export as PDF</DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportCsv}>Export as CSV</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button size="sm" variant="ghost" asChild>
        <Link href={`/${projectId}/specifications/settings`}>
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </Button>
    </div>
  );

  const handleFilterChange = (next: SpecFilterState) => {
    tableState.setActiveFilters(next);
    tableState.setSearchParams({
      status: typeof next.status === "string" ? next.status : null,
      area_id: typeof next.area_id === "string" ? next.area_id : null,
      page: "1",
    });
    tableState.setPage(1);
  };

  const specFilters = React.useMemo(
    () => [
      ...(activeTab !== "recycle"
        ? [
            {
              id: "status",
              label: "Status",
              type: "select" as const,
              options: [
                { value: "active", label: "Active" },
                { value: "superseded", label: "Superseded" },
              ],
            },
          ]
        : []),
      ...(areas && areas.length > 0
        ? [
            {
              id: "area_id",
              label: "Area",
              type: "select" as const,
              options: (areas as { id: number; name: string }[]).map((area) => ({
                value: area.id.toString(),
                label: area.name,
              })),
            },
          ]
        : []),
    ],
    [activeTab, areas],
  );

  const specColumns = React.useMemo<TableColumn<SpecificationWithRevision>[]>(
    () => [
      {
        id: "section_number",
        label: "Section #",
        render: (spec) => <span className="font-mono font-medium">{spec.section_number}</span>,
        sortValue: (spec) => spec.section_number,
        sortable: true,
      },
      {
        id: "title",
        label: "Title",
        render: (spec) => (
          <div>
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{spec.title}</span>
            </div>
            {spec.description && (
              <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{spec.description}</p>
            )}
          </div>
        ),
        sortValue: (spec) => spec.title,
        sortable: true,
      },
      {
        id: "status",
        label: "Status",
        render: (spec) => <Badge variant={spec.status === "active" ? "default" : "secondary"}>{spec.status}</Badge>,
        sortValue: (spec) => spec.status,
        sortable: true,
      },
      {
        id: "revision",
        label: "Revision",
        render: (spec) =>
          spec.current_revision ? (
            <span className="text-sm">Rev {spec.current_revision.revision_number}</span>
          ) : (
            <span className="text-sm text-muted-foreground">No revisions</span>
          ),
      },
      {
        id: "file_size",
        label: "File Size",
        render: (spec) =>
          spec.current_revision ? (
            <span className="text-sm">{formatFileSize(spec.current_revision.file_size)}</span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          ),
      },
      {
        id: "updated_at",
        label: "Last Updated",
        render: (spec) => (
          <span className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(spec.updated_at || spec.created_at), {
              addSuffix: true,
            })}
          </span>
        ),
        sortValue: (spec) => new Date(spec.updated_at || spec.created_at).getTime(),
        sortable: true,
      },
      {
        id: "areas",
        label: "Areas",
        render: (spec) =>
          spec.area_count > 0 ? (
            <Badge variant="secondary" className="text-xs">
              {spec.area_count}
            </Badge>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          ),
      },
    ],
    [],
  );

  const revisionColumns = React.useMemo<TableColumn<ProjectSpecificationRevision>[]>(
    () => [
      {
        id: "section_number",
        label: "Section #",
        render: (revision) => <span className="font-mono font-medium">{revision.section_number}</span>,
        sortValue: (revision) => revision.section_number,
        sortable: true,
      },
      {
        id: "section_title",
        label: "Title",
        render: (revision) => <span className="font-medium">{revision.section_title}</span>,
        sortValue: (revision) => revision.section_title,
        sortable: true,
      },
      {
        id: "revision",
        label: "Revision",
        render: (revision) => <span>Rev {revision.revision_number}</span>,
        sortValue: (revision) => revision.revision_number,
        sortable: true,
      },
      {
        id: "file_name",
        label: "File Name",
        render: (revision) => <span className="text-sm">{revision.file_name}</span>,
        sortValue: (revision) => revision.file_name,
        sortable: true,
      },
      {
        id: "file_size",
        label: "File Size",
        render: (revision) => <span className="text-sm">{formatFileSize(revision.file_size)}</span>,
        sortValue: (revision) => revision.file_size,
        sortable: true,
      },
      {
        id: "uploaded_at",
        label: "Uploaded",
        render: (revision) => (
          <span className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(revision.uploaded_at), {
              addSuffix: true,
            })}
          </span>
        ),
        sortValue: (revision) => new Date(revision.uploaded_at).getTime(),
        sortable: true,
      },
    ],
    [],
  );

  const specSelectedIds = tableState.selectedIds;
  const handleSelectAllSpecs = (checked: boolean) => {
    tableState.setSelectedIds(checked ? specifications.map((item) => String(item.id)) : []);
  };
  const handleSelectSpecRow = (id: string, checked: boolean) => {
    tableState.setSelectedIds(
      checked
        ? [...tableState.selectedIds, id]
        : tableState.selectedIds.filter((selectedId) => selectedId !== id),
    );
  };

  const handleSelectAllRevisions = (checked: boolean) => {
    tableState.setSelectedIds(
      checked ? revisions.map((revision) => `revision-${revision.id}`) : [],
    );
  };
  const handleSelectRevisionRow = (id: string, checked: boolean) => {
    tableState.setSelectedIds(
      checked
        ? [...tableState.selectedIds, id]
        : tableState.selectedIds.filter((selectedId) => selectedId !== id),
    );
  };

  if (activeTab === "revisions") {
    return (
      <UnifiedTablePage
        header={{
          title: "Specifications",
          description: "Track every specification revision across this project",
          actions: headerActions,
        }}
        tabs={tabs}
        toolbar={{
          totalItems: revisions.length,
          filteredItems: revisions.length,
          selectedCount: specSelectedIds.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search revisions...",
          currentView: "table",
          onViewChange: () => undefined,
          enabledViews: ["table"],
          filters: [],
          activeFilters: {},
          onFilterChange: () => undefined,
          onClearFilters: () => undefined,
          columns: revisionColumns.map((column) => ({ id: column.id, label: column.label })),
          visibleColumns: tableState.visibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
        }}
        data={{
          items: revisions,
          isLoading: isLoadingRevisions,
          isFetching: isFetchingRevisions,
        }}
        table={{
          columns: revisionColumns,
          getRowId: (item) => `revision-${item.id}`,
          onRowClick: (item) => handleView(item.section_id),
          rowActions: (item) => {
            const actions: TableRowActionItem[] = [
              {
                key: "open-section",
                label: "View Section",
                icon: Eye,
                onSelect: () => handleView(item.section_id),
              },
              {
                key: "download",
                label: "Download",
                icon: Download,
                onSelect: () => handleDownload(item.section_id, item.id),
              },
              {
                key: "email",
                label: "Email",
                icon: Mail,
                onSelect: () => sendRevisionEmail(item),
              },
            ];
            return <TableRowActionsMenu items={actions} />;
          },
        }}
        selection={{
          selectedIds: tableState.selectedIds,
          onSelectAll: handleSelectAllRevisions,
          onSelectRow: handleSelectRevisionRow,
        }}
        sorting={{
          sortBy: tableState.sortBy,
          sortDirection: tableState.sortDirection,
          onSortChange: (sortBy, direction) => {
            tableState.setSortBy(sortBy);
            tableState.setSortDirection(direction);
            tableState.setSearchParams({ sort: sortBy, sort_dir: direction });
          },
        }}
        emptyState={{
          title: "No revisions",
          description: "No specification revisions have been uploaded yet.",
          filteredDescription: "Try adjusting your search.",
          isFiltered: Boolean(tableState.searchInput),
        }}
        pagination={{
          page: tableState.page,
          perPage: tableState.perPage,
          totalPages: 1,
          onPageChange: () => undefined,
          onPerPageChange: () => undefined,
          clientSide: true,
        }}
        features={{
          enableExport: false,
          enableBulkDelete: false,
          enableRowSelection: true,
        }}
      />
    );
  }

  return (
    <>
      <UnifiedTablePage
        header={{
          title: "Specifications",
          description:
            activeTab === "recycle"
              ? "Archived specifications in recycle bin"
              : "Manage project specifications",
          actions: headerActions,
        }}
        tabs={tabs}
        toolbar={{
          totalItems: specifications.length,
          filteredItems: specifications.length,
          selectedCount: specSelectedIds.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search by section number or title...",
          currentView: tableState.currentView,
          onViewChange: (view) => {
            tableState.setCurrentView(view);
            tableState.setSearchParams({ view });
          },
          enabledViews: ["table", "card", "list"],
          filters: specFilters,
          activeFilters,
          onFilterChange: handleFilterChange,
          onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
          columns: specColumns.map((column) => ({ id: column.id, label: column.label })),
          visibleColumns: tableState.visibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
        }}
        data={{
          items: specifications,
          isLoading,
          isFetching,
        }}
        table={{
          columns: specColumns,
          getRowId: (item) => String(item.id),
          onRowClick: (item) => handleView(item.id),
          rowActions: (item) => {
            const isSubscribed = subscribedSectionIds[item.id] === true;
            const actions: TableRowActionItem[] = [
              {
                key: "edit",
                label: "Edit",
                icon: Pencil,
                onSelect: () => setEditingSpec(item),
              },
              {
                key: "email",
                label: "Email",
                icon: Mail,
                onSelect: () => sendSpecificationEmail(item),
              },
              ...(item.current_revision
                ? [
                    {
                      key: "download",
                      label: "Download",
                      icon: Download,
                      onSelect: () => handleDownload(item.id, item.current_revision!.id),
                    } satisfies TableRowActionItem,
                  ]
                : []),
              {
                key: "subscribe",
                label: isSubscribed ? "Unsubscribe" : "Subscribe",
                icon: Bell,
                onSelect: () => handleToggleSubscribe(item.id),
              },
              {
                key: "archive",
                label: item.status === "archived" ? "Archived" : "Archive",
                icon: Archive,
                onSelect: () => handleArchive(item),
                disabled: item.status === "archived",
              },
            ];
            return <TableRowActionsMenu items={actions} />;
          },
        }}
        selection={{
          selectedIds: tableState.selectedIds,
          onSelectAll: handleSelectAllSpecs,
          onSelectRow: handleSelectSpecRow,
        }}
        views={{
          card: (item) => renderSpecCard(item, handleView),
          list: (item) => renderSpecList(item, handleView),
        }}
        sorting={{
          sortBy: tableState.sortBy,
          sortDirection: tableState.sortDirection,
          onSortChange: (sortBy, direction) => {
            tableState.setSortBy(sortBy);
            tableState.setSortDirection(direction);
            tableState.setSearchParams({ sort: sortBy, sort_dir: direction });
          },
        }}
        pagination={{
          page: tableState.page,
          perPage: tableState.perPage,
          totalPages: Math.max(1, Math.ceil((data?.total_count || 0) / tableState.perPage)),
          onPageChange: (page) => {
            tableState.setPage(page);
            tableState.setSearchParams({ page: page.toString() });
          },
          onPerPageChange: (perPage) => {
            const n = parseInt(perPage, 10) || 25;
            tableState.setPerPage(n);
            tableState.setPage(1);
            tableState.setSearchParams({ per_page: perPage, page: "1" });
          },
        }}
        emptyState={{
          title: activeTab === "recycle" ? "Recycle bin is empty" : "No specifications",
          description:
            activeTab === "recycle"
              ? "Archived specifications will appear here."
              : "Get started by uploading specifications.",
          filteredDescription: "Try adjusting your search or filters.",
          isFiltered: Boolean(tableState.searchInput) || Boolean(statusFilter) || Boolean(areaFilter),
          action: (
            <SpecificationUploadDialog projectId={projectId}>
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Upload
              </Button>
            </SpecificationUploadDialog>
          ),
        }}
        features={{
          enableExport: false,
          enableBulkDelete: false,
          enableRowSelection: true,
        }}
      />

      <SpecificationEditModal
        projectId={projectId}
        specification={editingSpec}
        open={!!editingSpec}
        onOpenChange={(open) => !open && setEditingSpec(null)}
      />
    </>
  );
}

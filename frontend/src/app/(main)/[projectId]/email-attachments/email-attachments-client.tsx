"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronDown,
  Download,
  FileText,
  ImageIcon,
  Loader2,
  Mail,
  Paperclip,
  Plus,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CellDate,
  CellNumber,
  CellStackText,
  CellText,
  TruncatedCell,
  UnifiedTablePage,
  useUnifiedTableState,
  type TableColumn,
} from "@/components/tables/unified";
import { apiFetch } from "@/lib/api-client";
import { useProjects, type Project } from "@/hooks/use-projects";
import { handleFormError } from "@/lib/handle-form-error";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

const PdfDocument = dynamic(
  async () => {
    const mod = await import("react-pdf");
    mod.pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    return mod.Document;
  },
  { ssr: false },
);

const PdfPage = dynamic(
  async () => {
    const mod = await import("react-pdf");
    mod.pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    return mod.Page;
  },
  { ssr: false },
);

export const ATTACHMENT_TYPES = [
  "Drawings",
  "Submittal",
  "Invoice",
  "Pay App",
  "RFI",
  "Contract",
  "Proposal",
  "Specifications",
  "Photos",
  "Correspondence",
  "Report",
  "Other",
] as const;

export const ATTACHMENT_CATEGORIES = [
  "Project Documents",
  "Financial",
  "Correspondence",
  "Legal",
  "Technical",
  "Other",
] as const;

interface EmailAttachment {
  id: number;
  emailId: number;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  contentType: string | null;
  createdAt: string | null;
  textLength: number;
  graphAttachmentId: string | null;
  checksumSha256: string | null;
  attachmentType: string | null;
  attachmentCategory: string | null;
  project: {
    id: number;
    name: string | null;
    projectNumber: string | null;
  } | null;
  email: {
    id: number;
    subject: string;
    fromName: string | null;
    fromEmail: string | null;
    receivedAt: string | null;
    sentAt: string | null;
    createdAt: string | null;
  } | null;
}

interface EmailAttachmentsClientProps {
  projectId?: number;
  scope?: "project" | "global";
  title?: string;
  tabs?: {
    label: string;
    href: string;
    count?: number;
    isActive?: boolean;
    testId?: string;
    countTestId?: string;
  }[];
}

interface AttachmentPatchResponse {
  success: boolean;
  project?: {
    id: number;
    name: string | null;
    projectNumber: string | null;
  } | null;
}

const attachmentColumns = [
  { id: "fileName", label: "File", defaultVisible: true, alwaysVisible: true },
  { id: "type", label: "Type", defaultVisible: true },
  { id: "category", label: "Category", defaultVisible: true },
  { id: "preview", label: "Preview", defaultVisible: true },
  { id: "email", label: "Email", defaultVisible: true },
  { id: "sender", label: "From", defaultVisible: true },
  { id: "received", label: "Received", defaultVisible: true },
  { id: "size", label: "Size", defaultVisible: true },
  { id: "text", label: "Text", defaultVisible: false },
];

const globalAttachmentColumns = [
  attachmentColumns[0],
  { id: "project", label: "Project", defaultVisible: true },
  ...attachmentColumns.slice(1),
];

function formatBytes(value: number | null): string {
  if (!value) return "Unknown";

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Unknown";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function receivedAt(attachment: EmailAttachment): string | null {
  return (
    attachment.email?.receivedAt ||
    attachment.email?.sentAt ||
    attachment.createdAt ||
    null
  );
}

function senderLabel(attachment: EmailAttachment): string {
  const senderName = attachment.email?.fromName?.trim();
  const senderEmail = attachment.email?.fromEmail?.trim();

  if (senderName && senderEmail) return `${senderName} <${senderEmail}>`;
  if (senderName) return senderName;
  if (senderEmail) return senderEmail;
  return "Unknown sender";
}

function attachmentUrl(
  projectId: number | undefined,
  attachmentId: number,
): string {
  if (projectId) {
    return `/api/projects/${projectId}/email-attachments/${attachmentId}/download`;
  }
  return `/api/email-attachments/${attachmentId}/download`;
}

function patchUrl(projectId: number | undefined, attachmentId: number): string {
  if (projectId) {
    return `/api/projects/${projectId}/email-attachments/${attachmentId}`;
  }
  return `/api/email-attachments/${attachmentId}`;
}

function previewUrl(
  projectId: number | undefined,
  attachmentId: number,
): string {
  return `${attachmentUrl(projectId, attachmentId)}?disposition=inline`;
}

function isPreviewableAttachment(attachment: EmailAttachment): boolean {
  const contentType = attachment.contentType?.toLowerCase() ?? "";
  return contentType.startsWith("image/") || contentType.includes("pdf");
}

function previewIcon(attachment: EmailAttachment): React.ReactElement {
  const contentType = attachment.contentType?.toLowerCase() ?? "";
  if (contentType.startsWith("image/")) {
    return <ImageIcon className="size-4 text-muted-foreground" />;
  }
  return <FileText className="size-4 text-muted-foreground" />;
}

function isImageAttachment(attachment: EmailAttachment): boolean {
  return (attachment.contentType?.toLowerCase() ?? "").startsWith("image/");
}

function isPdfAttachment(attachment: EmailAttachment): boolean {
  return (attachment.contentType?.toLowerCase() ?? "").includes("pdf");
}

function AttachmentPreviewThumbnail({
  attachment,
  projectId,
}: {
  attachment: EmailAttachment;
  projectId?: number;
}) {
  const src = previewUrl(projectId, attachment.id);

  if (isImageAttachment(attachment)) {
    return (
      <img
        src={src}
        alt=""
        className="h-full w-full object-cover"
        loading="lazy"
      />
    );
  }

  if (isPdfAttachment(attachment)) {
    return (
      <PdfDocument
        file={src}
        loading={
          <div className="flex h-full w-full items-center justify-center">
            <FileText className="size-4 text-muted-foreground" />
          </div>
        }
        error={
          <div className="flex h-full w-full items-center justify-center">
            <FileText className="size-4 text-muted-foreground" />
          </div>
        }
      >
        <PdfPage
          pageNumber={1}
          width={96}
          renderAnnotationLayer={false}
          renderTextLayer={false}
        />
      </PdfDocument>
    );
  }

  return previewIcon(attachment);
}

function AttachmentPreviewViewer({
  attachment,
  projectId,
}: {
  attachment: EmailAttachment;
  projectId?: number;
}) {
  const [numPages, setNumPages] = React.useState(1);
  const src = previewUrl(projectId, attachment.id);

  if (isImageAttachment(attachment)) {
    return (
      <div className="flex h-full items-center justify-center overflow-auto bg-muted/30 p-6">
        <img
          src={src}
          alt={attachment.fileName}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }

  if (isPdfAttachment(attachment)) {
    return (
      <div className="h-full overflow-auto bg-muted/30 p-6">
        <PdfDocument
          file={src}
          onLoadSuccess={({ numPages: nextNumPages }) =>
            setNumPages(nextNumPages)
          }
          loading={
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading preview...
            </div>
          }
          error={
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Preview failed to load.
            </div>
          }
          className="mx-auto flex w-fit flex-col gap-4"
        >
          {Array.from({ length: numPages }, (_, index) => (
            <PdfPage
              key={index + 1}
              pageNumber={index + 1}
              width={900}
              renderAnnotationLayer
              renderTextLayer
              className="overflow-hidden rounded-md bg-background shadow-sm"
            />
          ))}
        </PdfDocument>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      No preview is available for this attachment type.
    </div>
  );
}

function projectLabel(attachment: EmailAttachment): string {
  const projectNumber = attachment.project?.projectNumber?.trim();
  const projectName = attachment.project?.name?.trim();
  const projectId = attachment.project?.id;

  if (projectNumber && projectName) return `${projectNumber} - ${projectName}`;
  if (projectName) return projectName;
  if (projectNumber) return projectNumber;
  return projectId ? `Project ${projectId}` : "Unknown project";
}

function buildAttachmentTypeOptions(
  attachments: EmailAttachment[],
): string[] {
  const defaults = [...ATTACHMENT_TYPES];
  const known = new Set(defaults.map((value) => value.toLowerCase()));
  const custom = attachments
    .map((attachment) => attachment.attachmentType?.trim() ?? "")
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .filter((value) => !known.has(value.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  return [...defaults, ...custom];
}

function normalizeCustomOption(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function TypeSelectCell({
  attachment,
  projectId,
  availableTypes,
  onUpdate,
}: {
  attachment: EmailAttachment;
  projectId?: number;
  availableTypes: string[];
  onUpdate: (
    id: number,
    field: "attachmentType" | "attachmentCategory",
    value: string | null,
  ) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const trimmedSearch = normalizeCustomOption(search);
  const hasExactMatch = availableTypes.some(
    (type) => type.toLowerCase() === trimmedSearch.toLowerCase(),
  );

  const handleChange = async (value: string | null) => {
    const next = value === "__clear__" ? null : value;
    setSaving(true);
    try {
      await apiFetch(patchUrl(projectId, attachment.id), {
        method: "PATCH",
        body: JSON.stringify({ attachmentType: next }),
      });
      onUpdate(attachment.id, "attachmentType", next);
      setOpen(false);
      setSearch("");
    } catch (error) {
      handleFormError(error, { entity: "attachment type", action: "update" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          // DESIGN-SYSTEM EXCEPTION: inline taxonomy editing is an interactive table cell.
          // Promote this into a shared editable combobox cell before reusing it elsewhere.
          className="h-7 w-40 justify-between px-2 text-xs font-normal"
          data-row-interactive="true"
          disabled={saving}
          aria-label="Attachment type"
        >
          <span
            className={
              attachment.attachmentType
                ? "truncate text-foreground"
                : "truncate text-muted-foreground"
            }
          >
            {attachment.attachmentType ?? "Set type..."}
          </span>
          {saving ? (
            <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0"
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <Command shouldFilter>
          <CommandInput
            placeholder="Search or create type..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No matching types.</CommandEmpty>
            <CommandGroup>
              {attachment.attachmentType ? (
                <CommandItem
                  value="__clear__"
                  onSelect={() => void handleChange("__clear__")}
                  className="text-muted-foreground"
                >
                  Clear type
                </CommandItem>
              ) : null}
              {trimmedSearch && !hasExactMatch ? (
                <CommandItem
                  value={`create ${trimmedSearch}`}
                  onSelect={() => void handleChange(trimmedSearch)}
                >
                  <Plus className="size-3.5" />
                  Create "{trimmedSearch}"
                </CommandItem>
              ) : null}
              {availableTypes.map((type) => (
                <CommandItem
                  key={type}
                  value={type}
                  onSelect={() => void handleChange(type)}
                >
                  <Check
                    className={`size-3.5 ${attachment.attachmentType === type ? "opacity-100" : "opacity-0"}`}
                  />
                  <span className="truncate">{type}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function CategorySelectCell({
  attachment,
  projectId,
  onUpdate,
}: {
  attachment: EmailAttachment;
  projectId?: number;
  onUpdate: (
    id: number,
    field: "attachmentType" | "attachmentCategory",
    value: string | null,
  ) => void;
}) {
  const [saving, setSaving] = React.useState(false);

  const handleChange = async (value: string) => {
    const next = value === "__clear__" ? null : value;
    setSaving(true);
    try {
      await apiFetch(patchUrl(projectId, attachment.id), {
        method: "PATCH",
        body: JSON.stringify({ attachmentCategory: next }),
      });
      onUpdate(attachment.id, "attachmentCategory", next);
    } catch {
      toast.error("Failed to update category");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Select
      value={attachment.attachmentCategory ?? ""}
      onValueChange={handleChange}
      disabled={saving}
    >
      <SelectTrigger
        // DESIGN-SYSTEM EXCEPTION: inline taxonomy editing is an interactive table cell.
        // Move to a shared EditableSelectCell primitive before adding this pattern elsewhere.
        className="h-7 w-40 text-xs"
        data-row-interactive="true"
        aria-label="Attachment category"
      >
        <SelectValue placeholder="Set category..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__clear__" className="text-muted-foreground">
          — clear —
        </SelectItem>
        {ATTACHMENT_CATEGORIES.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ProjectSelectCell({
  attachment,
  onUpdateProject,
}: {
  attachment: EmailAttachment;
  onUpdateProject: (
    id: number,
    project: EmailAttachment["project"],
  ) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const { projects, isLoading } = useProjects({ enabled: open, limit: 250 });

  const handleSelect = async (project: Project) => {
    if (attachment.project?.id === project.id) {
      setOpen(false);
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch<AttachmentPatchResponse>(
        patchUrl(undefined, attachment.id),
        {
          method: "PATCH",
          body: JSON.stringify({ projectId: project.id }),
        },
      );

      onUpdateProject(attachment.id, {
        id: response.project?.id ?? project.id,
        name: response.project?.name ?? project.name,
        projectNumber:
          response.project?.projectNumber ?? project.project_number ?? null,
      });
      setOpen(false);
    } catch (error) {
      handleFormError(error, {
        entity: "attachment project assignment",
        action: "update",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          // DESIGN-SYSTEM EXCEPTION: project reassignment is an interactive table cell.
          // Promote this into a shared editable project cell before reusing it elsewhere.
          className="h-7 w-56 justify-between px-2 text-xs font-normal"
          data-row-interactive="true"
          disabled={saving}
        >
          <span className="truncate text-left">{projectLabel(attachment)}</span>
          {saving ? (
            <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search projects..." />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Loading..." : "No projects found."}
            </CommandEmpty>
            <CommandGroup>
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={`${project.project_number ?? ""} ${project.name ?? ""}`}
                  onSelect={() => void handleSelect(project)}
                >
                  <Check
                    className={`size-3.5 ${attachment.project?.id === project.id ? "opacity-100" : "opacity-0"}`}
                  />
                  <span className="truncate">
                    {project.project_number
                      ? `${project.project_number} - ${project.name ?? `Project ${project.id}`}`
                      : (project.name ?? `Project ${project.id}`)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function EmailAttachmentsClient({
  projectId,
  scope = "project",
  title = "Email Attachments",
  tabs,
}: EmailAttachmentsClientProps): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname()!;
  const searchParams = useSearchParams()!;
  const queryClient = useQueryClient();
  const isGlobal = scope === "global" || !projectId;
  const columnsConfig = isGlobal ? globalAttachmentColumns : attachmentColumns;

  const queryKey = [
    isGlobal ? "email-attachments-global" : "email-attachments",
    projectId,
  ];

  const [previewAttachment, setPreviewAttachment] =
    React.useState<EmailAttachment | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);

  const tableState = useUnifiedTableState({
    entityKey: isGlobal ? "email-attachments-global" : "email-attachments",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "received",
      sortDirection: "desc",
      visibleColumns: columnsConfig
        .filter((c) => c.defaultVisible !== false)
        .map((c) => c.id),
      filters: {},
    },
  });

  const {
    data: attachments = [],
    isLoading,
    error,
  } = useQuery<EmailAttachment[]>({
    queryKey,
    queryFn: ({ signal }) =>
      apiFetch<EmailAttachment[]>(
        isGlobal
          ? "/api/email-attachments"
          : `/api/projects/${projectId}/email-attachments`,
        { signal },
      ),
    enabled: isGlobal || Number.isInteger(projectId),
  });

  const attachmentTypeOptions = React.useMemo(
    () => buildAttachmentTypeOptions(attachments),
    [attachments],
  );

  React.useEffect(() => {
    if (tableState.visibleColumns.length === 0) {
      tableState.setVisibleColumns(
        columnsConfig
          .filter((c) => c.defaultVisible !== false)
          .map((c) => c.id),
      );
    }
  }, [
    columnsConfig,
    tableState.visibleColumns.length,
    tableState.setVisibleColumns,
  ]);

  const handleFieldUpdate = React.useCallback(
    (
      id: number,
      field: "attachmentType" | "attachmentCategory",
      value: string | null,
    ) => {
      queryClient.setQueryData<EmailAttachment[]>(
        queryKey,
        (prev) =>
          prev?.map((a) => (a.id === id ? { ...a, [field]: value } : a)) ?? [],
      );
    },
    [queryClient, queryKey],
  );

  const handleProjectUpdate = React.useCallback(
    (id: number, project: EmailAttachment["project"]) => {
      queryClient.setQueryData<EmailAttachment[]>(
        queryKey,
        (prev) =>
          prev?.map((attachment) =>
            attachment.id === id ? { ...attachment, project } : attachment,
          ) ?? [],
      );

      void queryClient.invalidateQueries({
        predicate: (query) => {
          const root = query.queryKey[0];
          return root === "emails" || root === "email-attachments" || root === "email-attachments-global";
        },
      });
    },
    [queryClient, queryKey],
  );

  const columns = React.useMemo<TableColumn<EmailAttachment>[]>(() => {
    const baseColumns: TableColumn<EmailAttachment>[] = [
      {
        id: "fileName",
        label: "File",
        sortable: true,
        alwaysVisible: true,
        sortValue: (item) => item.fileName,
        render: (item) => (
          <CellStackText
            primary={item.fileName}
            secondary={item.contentType || "Unknown type"}
            icon={<Paperclip className="size-4" />}
          />
        ),
      },
      {
        id: "type",
        label: "Type",
        sortable: true,
        sortValue: (item) => item.attachmentType ?? "",
        render: (item) => (
          <TypeSelectCell
            attachment={item}
            projectId={isGlobal ? undefined : projectId}
            availableTypes={attachmentTypeOptions}
            onUpdate={handleFieldUpdate}
          />
        ),
      },
      {
        id: "category",
        label: "Category",
        sortable: true,
        sortValue: (item) => item.attachmentCategory ?? "",
        render: (item) => (
          <CategorySelectCell
            attachment={item}
            projectId={isGlobal ? undefined : projectId}
            onUpdate={handleFieldUpdate}
          />
        ),
      },
      {
        id: "preview",
        label: "Preview",
        render: (item) => {
          if (!isPreviewableAttachment(item)) {
            return <CellText value="No preview" muted />;
          }

          return (
            <Button
              variant="outline"
              size="sm"
              data-row-interactive="true"
              onClick={() => setPreviewAttachment(item)}
              // DESIGN-SYSTEM EXCEPTION: attachment thumbnails need fixed media dimensions inside a table cell.
              // Keep this exception local until thumbnail table cells become a shared primitive.
              className="h-16 w-24 overflow-hidden bg-background p-0"
              aria-label={`Preview ${item.fileName}`}
            >
              <AttachmentPreviewThumbnail
                attachment={item}
                projectId={isGlobal ? undefined : projectId}
              />
            </Button>
          );
        },
      },
      {
        id: "email",
        label: "Email",
        sortable: true,
        sortValue: (item) => item.email?.subject ?? "",
        render: (item) => (
          <TruncatedCell
            value={item.email?.subject || "No subject"}
            maxWidth={220}
          />
        ),
      },
      ...(isGlobal
        ? [
            {
              id: "project",
              label: "Project",
              sortable: true,
              sortValue: projectLabel,
              render: (item: EmailAttachment) =>
                (
                  <ProjectSelectCell
                    attachment={item}
                    onUpdateProject={handleProjectUpdate}
                  />
                ),
            } satisfies TableColumn<EmailAttachment>,
          ]
        : []),
      {
        id: "sender",
        label: "From",
        sortable: true,
        sortValue: senderLabel,
        render: (item) => (
          <CellStackText
            primary={
              item.email?.fromName || item.email?.fromEmail || "Unknown sender"
            }
            secondary={item.email?.fromName ? item.email.fromEmail : null}
          />
        ),
      },
      {
        id: "received",
        label: "Received",
        sortable: true,
        sortValue: (item) => receivedAt(item) ?? "",
        render: (item) => <CellDate value={receivedAt(item)} showTime />,
      },
      {
        id: "size",
        label: "Size",
        sortable: true,
        sortValue: (item) => item.fileSize ?? 0,
        render: (item) => <CellText value={formatBytes(item.fileSize)} muted />,
      },
      {
        id: "text",
        label: "Text",
        sortable: true,
        sortValue: (item) => item.textLength,
        render: (item) =>
          item.textLength > 0 ? (
            <CellNumber value={item.textLength} muted />
          ) : (
            <CellText value="No text" muted />
          ),
      },
    ];

    return baseColumns;
  }, [
    attachmentTypeOptions,
    handleFieldUpdate,
    handleProjectUpdate,
    isGlobal,
    projectId,
  ]);

  const searchTerm = tableState.debouncedSearch.trim().toLowerCase();
  const filteredAttachments = React.useMemo(() => {
    if (!searchTerm) return attachments;

    return attachments.filter((attachment) =>
      [
        attachment.fileName,
        attachment.contentType ?? "",
        attachment.email?.subject ?? "",
        projectLabel(attachment),
        senderLabel(attachment),
        attachment.attachmentType ?? "",
        attachment.attachmentCategory ?? "",
      ].some((value) => value.toLowerCase().includes(searchTerm)),
    );
  }, [attachments, searchTerm]);

  const sortedAttachments = React.useMemo(() => {
    if (!tableState.sortBy) return filteredAttachments;

    const column = columns.find((item) => item.id === tableState.sortBy);
    const getSortValue = column?.sortValue;
    if (!getSortValue) return filteredAttachments;

    return [...filteredAttachments].sort((a, b) => {
      const valueA = getSortValue(a);
      const valueB = getSortValue(b);

      if (typeof valueA === "number" && typeof valueB === "number") {
        return tableState.sortDirection === "asc"
          ? valueA - valueB
          : valueB - valueA;
      }

      const comparison = String(valueA ?? "").localeCompare(
        String(valueB ?? ""),
      );
      return tableState.sortDirection === "asc" ? comparison : -comparison;
    });
  }, [
    columns,
    filteredAttachments,
    tableState.sortBy,
    tableState.sortDirection,
  ]);

  const totalItems = filteredAttachments.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / tableState.perPage));
  const pageStart = (tableState.page - 1) * tableState.perPage;
  const pageEnd = pageStart + tableState.perPage;
  const pagedAttachments = sortedAttachments.slice(pageStart, pageEnd);
  const isFiltered = Boolean(tableState.searchInput);

  React.useEffect(() => {
    if (tableState.page > totalPages) {
      tableState.setPage(1);
      tableState.setSearchParams({ page: "1" });
    }
  }, [tableState, totalPages]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      tableState.setSelectedIds(
        pagedAttachments.map((item) => String(item.id)),
      );
    } else {
      tableState.setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      tableState.setSelectedIds((prev) => [...prev, id]);
    } else {
      tableState.setSelectedIds((prev) => prev.filter((x) => x !== id));
    }
  };

  const handleBulkDelete = async () => {
    const ids = tableState.selectedIds;
    if (ids.length === 0) return;

    setIsBulkDeleting(true);
    const errors: string[] = [];

    for (const id of ids) {
      try {
        await apiFetch(
          isGlobal
            ? `/api/email-attachments/${id}`
            : `/api/projects/${projectId}/email-attachments/${id}`,
          { method: "DELETE" },
        );
      } catch {
        errors.push(id);
      }
    }

    tableState.setSelectedIds([]);
    await queryClient.invalidateQueries({ queryKey });

    if (errors.length > 0) {
      toast.error(
        `${ids.length - errors.length} deleted, ${errors.length} failed`,
      );
    } else {
      toast.success(
        `${ids.length} attachment${ids.length === 1 ? "" : "s"} deleted`,
      );
    }

    setIsBulkDeleting(false);
    setBulkDeleteOpen(false);
  };

  const handleExport = () => {
    if (filteredAttachments.length === 0) {
      toast.info("No attachments to export");
      return;
    }

    const rows = filteredAttachments.map((attachment) => {
      const baseValues = [
        attachment.fileName,
        attachment.attachmentType ?? "",
        attachment.attachmentCategory ?? "",
        attachment.email?.subject ?? "",
        senderLabel(attachment),
        formatDate(receivedAt(attachment)),
        formatBytes(attachment.fileSize),
        attachment.textLength,
      ];

      return (
        isGlobal
          ? [
              attachment.fileName,
              attachment.attachmentType ?? "",
              attachment.attachmentCategory ?? "",
              attachment.email?.subject ?? "",
              projectLabel(attachment),
              senderLabel(attachment),
              formatDate(receivedAt(attachment)),
              formatBytes(attachment.fileSize),
              attachment.textLength,
            ]
          : baseValues
      )
        .map((value) => JSON.stringify(value))
        .join(",");
    });

    const csv = [
      isGlobal
        ? "File,Type,Category,Email,Project,From,Received,Size,Text Length"
        : "File,Type,Category,Email,From,Received,Size,Text Length",
      ...rows,
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `email-attachments-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <UnifiedTablePage
        header={{
          title: tabs ? "" : title,
          variant: tabs ? "compact" : undefined,
          actions: tabs ? undefined : (
            <Button variant="outline" size="sm" asChild>
              <Link href={projectId ? `/${projectId}/emails` : "/emails"}>
                <Mail />
                Emails
              </Link>
            </Button>
          ),
        }}
        tabs={tabs}
        toolbar={{
          totalItems,
          filteredItems: totalItems,
          selectedCount: tableState.selectedIds.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search attachments...",
          currentView: "table",
          onViewChange: () => undefined,
          enabledViews: ["table"],
          activeFilters: {},
          onFilterChange: () => undefined,
          onClearFilters: () => undefined,
          columns: columnsConfig,
          visibleColumns: tableState.visibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
          onExport: handleExport,
          onBulkDelete:
            tableState.selectedIds.length > 0
              ? () => setBulkDeleteOpen(true)
              : undefined,
        }}
        data={{
          items: pagedAttachments,
          isLoading,
          error: error instanceof Error ? error : null,
        }}
        table={{
          columns,
          getRowId: (item) => String(item.id),
          rowActions: (item) => (
            <Button variant="ghost" size="icon-sm" asChild>
              <a
                href={attachmentUrl(isGlobal ? undefined : projectId, item.id)}
                aria-label={`Download ${item.fileName}`}
              >
                <Download />
              </a>
            </Button>
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
        emptyState={{
          title: "No email attachments found",
          description:
            "No synced Outlook attachments are stored for this project yet.",
          filteredDescription: "Try adjusting your search.",
          isFiltered,
          icon: <Paperclip className="h-10 w-10 text-muted-foreground" />,
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
            tableState.setSearchParams({
              per_page: String(parsed),
              page: "1",
            });
            tableState.setPage(1);
          },
        }}
        features={{
          enableViews: false,
          enableFilters: false,
          enableBulkDelete: true,
          enableRowSelection: true,
          enableRowReorder: false,
          enableInlineEditing: false,
        }}
      />

      <Modal
        open={Boolean(previewAttachment)}
        onOpenChange={(open) => {
          if (!open) setPreviewAttachment(null);
        }}
      >
        <ModalContent
          size="5xl"
          className="max-h-screen overflow-hidden p-0"
          style={{ height: "85vh" }}
        >
          <ModalHeader className="border-b border-border px-6 pb-4 pt-6">
            <ModalTitle className="truncate pr-8">
              {previewAttachment?.fileName ?? "Attachment preview"}
            </ModalTitle>
            <ModalDescription>
              {previewAttachment?.contentType || "Attachment preview"}
            </ModalDescription>
          </ModalHeader>
          {previewAttachment ? (
            <div className="min-h-0" style={{ height: "calc(85vh - 96px)" }}>
              <AttachmentPreviewViewer
                attachment={previewAttachment}
                projectId={isGlobal ? undefined : projectId}
              />
            </div>
          ) : null}
        </ModalContent>
      </Modal>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {tableState.selectedIds.length} Attachment
              {tableState.selectedIds.length === 1 ? "" : "s"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{tableState.selectedIds.length}</strong> selected
              attachment{tableState.selectedIds.length === 1 ? "" : "s"}?
              <br />
              <br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting
                ? "Deleting..."
                : `Delete ${tableState.selectedIds.length} Attachment${tableState.selectedIds.length === 1 ? "" : "s"}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

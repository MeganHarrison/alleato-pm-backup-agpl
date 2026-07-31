import type { KeyboardEvent, ReactElement } from "react";
import Link from "next/link";

import { formatDate } from "@/lib/format";
import {
  Download,
  Eye,
  File,
  FileCode,
  FileImage,
  FilePen,
  FileSpreadsheet,
  FileText,
  FileVideo,
  FolderOpen,
  Lock,
  MoreVertical,
  Trash2,
} from "lucide-react";

import { StatusBadge } from "@/components/ds";
import type {
  ColumnConfig,
  FilterConfig,
  TableColumn,
} from "@/components/tables/unified";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProjectDocument } from "@/hooks/use-documents";
import {
  DOCUMENT_TYPE_OPTIONS,
  documentTypeLabel,
} from "@/features/documents/document-types";

// =============================================================================
// Filter Options
// =============================================================================

const STATUS_OPTIONS = [
  { value: "Draft", label: "Draft" },
  { value: "Published", label: "Published" },
  { value: "Superseded", label: "Superseded" },
  { value: "Archived", label: "Archived" },
];

const CATEGORY_OPTIONS = [
  { value: "General", label: "General" },
  { value: "Financial", label: "Financial" },
  { value: "Legal", label: "Legal" },
  { value: "Technical", label: "Technical" },
  { value: "Administrative", label: "Administrative" },
  { value: "Safety", label: "Safety" },
  { value: "Environmental", label: "Environmental" },
  { value: "Design", label: "Design" },
];

// =============================================================================
// Column Config
// =============================================================================

export const projectDocumentColumns: ColumnConfig[] = [
  { id: "title", label: "Title", alwaysVisible: true },
  { id: "document_type", label: "Type", defaultVisible: true },
  { id: "category", label: "Category", defaultVisible: false },
  { id: "created_at", label: "Date", defaultVisible: true },
  { id: "uploaded_by", label: "Uploaded By", defaultVisible: true },
  { id: "content_type", label: "Format", defaultVisible: true },
  { id: "file_name", label: "File Name", defaultVisible: false },
  { id: "folder", label: "Folder", defaultVisible: false },
  { id: "version", label: "Version", defaultVisible: false },
  { id: "status", label: "Status", defaultVisible: false },
  { id: "file_size", label: "File Size", defaultVisible: false },
  { id: "is_private", label: "Private", defaultVisible: false },
  { id: "reviewed_by", label: "Reviewed By", defaultVisible: false },
  { id: "reviewed_at", label: "Reviewed At", defaultVisible: false },
  { id: "description", label: "Description", defaultVisible: false },
];

export const projectDocumentFilters: FilterConfig[] = [
  {
    id: "document_type",
    label: "Type",
    type: "select",
    options: [...DOCUMENT_TYPE_OPTIONS],
  },
  {
    id: "status",
    label: "Status",
    type: "select",
    options: STATUS_OPTIONS,
  },
  {
    id: "folder",
    label: "Folder",
    type: "text",
  },
  {
    id: "category",
    label: "Category",
    type: "select",
    options: CATEGORY_OPTIONS,
  },
];

export const projectDocumentDefaultVisibleColumns = projectDocumentColumns
  .filter((col) => col.defaultVisible !== false)
  .map((col) => col.id);

// =============================================================================
// Helpers
// =============================================================================

export function formatProjectDocumentFileSize(
  bytes: number | null | undefined,
): string {
  if (bytes === null || bytes === undefined) return "-";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function sortValueForDate(value: string | null | undefined): number {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getProjectDocumentColumn(id: string): ColumnConfig {
  const column = projectDocumentColumns.find(
    (candidate) => candidate.id === id,
  );
  if (!column) {
    throw new Error(`Missing project document column config: ${id}`);
  }
  return column;
}

function projectDocumentPreviewHref(projectId: string, documentId: number): string {
  return `/${projectId}/documents/${documentId}`;
}

function projectDocumentInlineFileHref(
  projectId: string,
  documentId: number,
): string {
  return `/api/projects/${projectId}/documents/${documentId}/download?disposition=inline`;
}

function projectDocumentDownloadHref(
  projectId: string,
  documentId: number,
): string {
  return `/api/projects/${projectId}/documents/${documentId}/download`;
}

export function inferProjectDocumentFormat(item: ProjectDocument): {
  label: string;
  icon: ReactElement;
} {
  const contentType = item.content_type?.toLowerCase() ?? "";
  const extension = item.file_name.split(".").pop()?.toLowerCase() ?? "";
  const format = contentType || extension;

  if (format.includes("pdf") || extension === "pdf") {
    return { label: "PDF", icon: <FileText className="h-4 w-4" /> };
  }
  if (
    format.includes("spreadsheet") ||
    format.includes("excel") ||
    ["xls", "xlsx", "csv"].includes(extension)
  ) {
    return {
      label: "Spreadsheet",
      icon: <FileSpreadsheet className="h-4 w-4" />,
    };
  }
  if (
    format.includes("image") ||
    ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(extension)
  ) {
    return { label: "Image", icon: <FileImage className="h-4 w-4" /> };
  }
  if (
    format.includes("video") ||
    ["mp4", "mov", "avi", "mkv", "webm"].includes(extension)
  ) {
    return { label: "Video", icon: <FileVideo className="h-4 w-4" /> };
  }
  if (
    format.includes("json") ||
    format.includes("xml") ||
    [
      "js",
      "ts",
      "tsx",
      "jsx",
      "py",
      "rb",
      "json",
      "xml",
      "html",
      "css",
    ].includes(extension)
  ) {
    return { label: "Code", icon: <FileCode className="h-4 w-4" /> };
  }
  if (
    format.includes("word") ||
    format.includes("document") ||
    ["doc", "docx", "txt", "rtf"].includes(extension)
  ) {
    return { label: "Document", icon: <FileText className="h-4 w-4" /> };
  }

  return { label: "File", icon: <File className="h-4 w-4" /> };
}

// =============================================================================
// Table Columns Builder
// =============================================================================

export function buildDocumentTableColumns(opts?: {
  onCategoryChange?: (
    item: ProjectDocument,
    category: string | null,
  ) => void | Promise<void>;
  projectId?: string;
}): TableColumn<ProjectDocument>[] {
  return [
    {
      ...getProjectDocumentColumn("title"),
      width: 280,
      render: (item) => {
        const content = (
          <div className="flex min-w-0 items-center gap-1.5">
            {item.is_private && (
              <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate font-medium text-foreground">
              {item.title}
            </span>
          </div>
        );

        if (!opts?.projectId) {
          return content;
        }

        return (
          <Link
            href={projectDocumentPreviewHref(opts.projectId, item.id)}
            className="block min-w-0"
            onClick={(event) => event.stopPropagation()}
          >
            {content}
          </Link>
        );
      },
      csvValue: (item) => item.title,
      sortValue: (item) => item.title,
      sortable: true,
    },
    {
      ...getProjectDocumentColumn("document_type"),
      width: 150,
      render: (item) => (
        <span className="text-muted-foreground">
          {documentTypeLabel(item.document_type)}
        </span>
      ),
      csvValue: (item) => documentTypeLabel(item.document_type),
      sortValue: (item) => item.document_type ?? "",
      sortable: true,
    },
    {
      ...getProjectDocumentColumn("category"),
      width: 160,
      render: (item) => (
        <span className="text-muted-foreground">{item.category ?? "-"}</span>
      ),
      csvValue: (item) => item.category ?? "",
      sortValue: (item) => item.category ?? "",
      sortable: true,
      editable: Boolean(opts?.onCategoryChange),
      editValue: (item) => item.category ?? "",
      onEdit: (item, value) => opts?.onCategoryChange?.(item, value || null),
      renderEditor: ({ item, onCancel }) => (
        <Select
          open
          defaultValue={item.category ?? "__none__"}
          onOpenChange={(open) => {
            if (!open) onCancel();
          }}
          onValueChange={(value) => {
            void opts?.onCategoryChange?.(
              item,
              value === "__none__" ? null : value,
            );
            onCancel();
          }}
        >
          <SelectTrigger
            className="h-7 w-36 border-border bg-background px-2 text-xs"
            onClick={(event) => event.stopPropagation()}
          >
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {CATEGORY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      ...getProjectDocumentColumn("created_at"),
      width: 120,
      render: (item) => (
        <span className="text-muted-foreground">
          {formatDate(item.created_at)}
        </span>
      ),
      csvValue: (item) => item.created_at ?? "",
      sortValue: (item) => sortValueForDate(item.created_at),
      sortable: true,
    },
    {
      ...getProjectDocumentColumn("uploaded_by"),
      render: (item) => (
        <span className="text-muted-foreground">{item.uploaded_by ?? "-"}</span>
      ),
      csvValue: (item) => item.uploaded_by ?? "",
      sortValue: (item) => item.uploaded_by ?? "",
      sortable: true,
    },
    {
      ...getProjectDocumentColumn("content_type"),
      width: 96,
      align: "center",
      render: (item) => {
        const format = inferProjectDocumentFormat(item);
        return (
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground"
            title={format.label}
            aria-label={format.label}
          >
            {format.icon}
          </span>
        );
      },
      csvValue: (item) => item.content_type ?? "",
      sortValue: (item) => item.content_type ?? "",
    },
    {
      ...getProjectDocumentColumn("file_name"),
      render: (item) => (
        <span className="text-muted-foreground">{item.file_name}</span>
      ),
      csvValue: (item) => item.file_name,
      sortValue: (item) => item.file_name,
      sortable: true,
    },
    {
      ...getProjectDocumentColumn("folder"),
      render: (item) => (
        <div className="flex items-center gap-1.5">
          <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">{item.folder ?? "Root"}</span>
        </div>
      ),
      csvValue: (item) => item.folder ?? "Root",
      sortValue: (item) => item.folder ?? "Root",
      sortable: true,
    },
    {
      ...getProjectDocumentColumn("version"),
      width: 90,
      render: (item) => (
        <span className="text-muted-foreground">v{item.version ?? 1}</span>
      ),
      csvValue: (item) => String(item.version ?? 1),
      sortValue: (item) => item.version ?? 1,
      sortable: true,
    },
    {
      ...getProjectDocumentColumn("status"),
      width: 120,
      render: (item) => <StatusBadge status={item.status} />,
      csvValue: (item) => item.status,
      sortValue: (item) => item.status,
      sortable: true,
    },
    {
      ...getProjectDocumentColumn("file_size"),
      width: 100,
      render: (item) => (
        <span className="text-muted-foreground tabular-nums">
          {formatProjectDocumentFileSize(item.file_size)}
        </span>
      ),
      csvValue: (item) => formatProjectDocumentFileSize(item.file_size),
      sortValue: (item) => item.file_size ?? 0,
      sortable: true,
    },
    {
      ...getProjectDocumentColumn("is_private"),
      width: 80,
      render: (item) => (
        <span className="text-muted-foreground">
          {item.is_private ? "Yes" : "No"}
        </span>
      ),
      csvValue: (item) => (item.is_private ? "Yes" : "No"),
      sortValue: (item) => (item.is_private ? 1 : 0),
    },
    {
      ...getProjectDocumentColumn("reviewed_by"),
      render: (item) => (
        <span className="text-muted-foreground">{item.reviewed_by ?? "-"}</span>
      ),
      csvValue: (item) => item.reviewed_by ?? "",
      sortValue: (item) => item.reviewed_by ?? "",
    },
    {
      ...getProjectDocumentColumn("reviewed_at"),
      render: (item) => (
        <span className="text-muted-foreground">
          {formatDate(item.reviewed_at)}
        </span>
      ),
      csvValue: (item) => item.reviewed_at ?? "",
      sortValue: (item) => sortValueForDate(item.reviewed_at),
    },
    {
      ...getProjectDocumentColumn("description"),
      render: (item) => (
        <span className="text-muted-foreground line-clamp-2">
          {item.description ?? "-"}
        </span>
      ),
      csvValue: (item) => item.description ?? "",
      sortValue: (item) => item.description ?? "",
    },
  ];
}

// =============================================================================
// Card View — Dropbox-style preview
// =============================================================================

function getFileTypeInfo(fileName: string): {
  icon: ReactElement;
  bg: string;
  ext: string;
} {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext))
    return {
      icon: <FileImage className="h-10 w-10" />,
      bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      ext,
    };
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext))
    return {
      icon: <FileVideo className="h-10 w-10" />,
      bg: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
      ext,
    };
  if (["xls", "xlsx", "csv"].includes(ext))
    return {
      icon: <FileSpreadsheet className="h-10 w-10" />,
      bg: "bg-green-500/10 text-green-600 dark:text-green-400",
      ext,
    };
  if (["doc", "docx", "txt", "rtf"].includes(ext))
    return {
      icon: <FileText className="h-10 w-10" />,
      bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      ext,
    };
  if (["pdf"].includes(ext))
    return {
      icon: <FileText className="h-10 w-10" />,
      bg: "bg-red-500/10 text-red-600 dark:text-red-400",
      ext,
    };
  if (
    [
      "js",
      "ts",
      "tsx",
      "jsx",
      "py",
      "rb",
      "json",
      "xml",
      "html",
      "css",
    ].includes(ext)
  )
    return {
      icon: <FileCode className="h-10 w-10" />,
      bg: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
      ext,
    };

  return {
    icon: <File className="h-10 w-10" />,
    bg: "bg-muted text-muted-foreground",
    ext,
  };
}

export function renderDocumentCard(
  item: ProjectDocument,
  onClick: (doc: ProjectDocument) => void,
  projectId?: string,
): ReactElement {
  const { icon, bg, ext } = getFileTypeInfo(item.file_name ?? "");
  const format = inferProjectDocumentFormat(item).label;
  const inlineHref =
    projectId && (item.storage_path || item.file_url)
      ? projectDocumentInlineFileHref(projectId, item.id)
      : null;
  const canShowImagePreview = inlineHref && format === "Image";
  const canShowPdfPreview = inlineHref && format === "PDF";
  const updatedDate = formatDate(item.updated_at ?? item.created_at);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick(item);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Preview ${item.title}`}
      className="group min-w-0 cursor-pointer overflow-hidden rounded-md border border-border bg-background transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onClick={() => onClick(item)}
      onKeyDown={handleKeyDown}
    >
      <div
        className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden ${canShowImagePreview || canShowPdfPreview ? "bg-muted/40" : bg}`}
      >
        {canShowImagePreview ? (
          <img
            src={inlineHref}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : canShowPdfPreview ? (
          <iframe
            src={`${inlineHref}#toolbar=0&navpanes=0&scrollbar=0`}
            title={`${item.title} preview`}
            className="h-full w-full pointer-events-none bg-background"
            loading="lazy"
          />
        ) : (
          icon
        )}
        {ext && (
          <span className="absolute bottom-2 right-2 rounded-sm bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-foreground shadow-xs">
            {ext}
          </span>
        )}
        {item.is_private && (
          <span className="absolute top-2 right-2">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        )}
      </div>

      <div className="space-y-2 px-3 py-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium leading-tight text-foreground">
            {item.title}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
            {item.file_name}
          </p>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1 truncate">
            <FolderOpen className="h-3 w-3 shrink-0" />
            <span className="truncate">{item.folder ?? "Root"}</span>
          </span>
          <span className="shrink-0">{updatedDate}</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// List View
// =============================================================================

export function renderDocumentList(
  item: ProjectDocument,
  onClick: (doc: ProjectDocument) => void,
): ReactElement {
  return (
    <div
      className="flex cursor-pointer items-center justify-between px-4 py-2.5 transition-colors hover:bg-muted/50"
      onClick={() => onClick(item)}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="text-xs text-muted-foreground">
          {[
            item.file_name,
            item.folder ?? "Root",
            `v${item.version ?? 1}`,
            item.category,
            formatProjectDocumentFileSize(item.file_size),
            formatDate(item.created_at),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="ml-3 flex shrink-0 items-center gap-2">
        {item.is_private && (
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <StatusBadge status={item.status} />
      </div>
    </div>
  );
}

// =============================================================================
// Row Actions
// =============================================================================

export function renderDocumentRowActions(
  item: ProjectDocument,
  projectId: string,
  onEdit: (doc: ProjectDocument) => void,
  onDelete: (doc: ProjectDocument) => void,
): ReactElement {
  const previewUrl = projectDocumentPreviewHref(projectId, item.id);
  const downloadUrl = projectDocumentDownloadHref(projectId, item.id);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Row actions"
        >
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(item.storage_path || item.file_url) && (
          <DropdownMenuItem asChild>
            <Link href={previewUrl}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Link>
          </DropdownMenuItem>
        )}
        {(item.storage_path || item.file_url) && (
          <DropdownMenuItem asChild>
            <a href={downloadUrl} download={item.file_name}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onEdit(item)}>
          <FilePen className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive"
          onClick={() => onDelete(item)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

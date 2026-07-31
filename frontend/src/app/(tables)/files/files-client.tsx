"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, ChevronsUpDown, Loader2, Tag } from "lucide-react";
import {
  UnifiedTablePage,
  type ColumnConfig,
  type FilterConfig,
  type TableColumn,
} from "@/components/tables/unified";
import { CellText, TableDateValue } from "@/components/tables/unified";
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
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import { appToast as toast } from "@/lib/toast/app-toast";
import {
  ACTIVE_FILE_GROUPS,
  EMPTY_FILE_FILTERS,
  FILE_GROUP_META,
  type FileFilterState,
  type FileGroup,
  type FileItem,
  type Project,
  fileColumnsConfig as columns,
  filesTableDefinition,
} from "@/features/files/files-table-definition";
import { useServerTableDefinition } from "@/features/tables/server-table";
import { fileHref } from "@/features/files/file-link";

// Source label

function friendlySource(item: FileItem): string {
  const sys = item.source_system ?? item.source ?? "";
  if (sys.includes("sharepoint")) return "SharePoint";
  if (sys.includes("onedrive") || sys === "microsoft_graph") return "OneDrive";
  if (sys.includes("knowledge_upload") || sys.includes("upload"))
    return "Uploaded";
  if (sys.includes("google")) return "Google Drive";
  return sys || "—";
}

// Folder helpers

function parsePathFromSharePointUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const personalMatch = parsed.pathname.match(
      /\/personal\/[^/]+\/Documents\/(.+)/,
    );
    if (personalMatch) return decodeURIComponent(personalMatch[1]);
    const siteMatch = parsed.pathname.match(
      /\/sites\/[^/]+\/(?:Shared%20Documents|Documents|[^/]+\/[^/]+)\/(.+)/,
    );
    if (siteMatch) return decodeURIComponent(siteMatch[1]);
    return null;
  } catch {
    return null;
  }
}

function resolvedPath(item: FileItem): string[] {
  if (item.source_path) {
    const parts = item.source_path.split("/").filter(Boolean);
    if (parts.length >= 3) return parts;
  }
  const url = item.source_web_url ?? item.url;
  if (url) {
    const urlPath = parsePathFromSharePointUrl(url);
    if (urlPath) {
      const parts = urlPath.split("/").filter(Boolean);
      if (parts.length >= 2) return parts;
    }
  }
  if (item.source_path) return item.source_path.split("/").filter(Boolean);
  return [];
}

function parentFolderName(item: FileItem): string {
  const parts = resolvedPath(item);
  return parts.length >= 2 ? (parts[parts.length - 2] ?? "—") : "—";
}

function fullFolderPath(item: FileItem): string {
  const parts = resolvedPath(item);
  return parts.length > 1 ? parts.slice(0, -1).join(" / ") : "";
}

// File size

function formatSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function reportDocumentMetadataFailure({
  operation,
  error,
  docId,
  userVisibleFallback,
}: {
  operation: string;
  error: unknown;
  docId?: string;
  userVisibleFallback: string;
}) {
  reportNonCriticalFailure({
    area: "files-table",
    operation,
    error,
    userVisibleFallback,
    metadata: { docId },
  });
  toast.error(userVisibleFallback, {
    description: "Your change was not saved. Please retry from the row action.",
  });
}

// Inline project select

function InlineProjectSelect({
  item,
  projects,
  onSave,
}: {
  item: FileItem;
  projects: Project[];
  onSave: (
    docId: string,
    projectId: number | null,
    projectName: string | null,
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSelect = async (projectId: number | null) => {
    if (projectId === item.project_id) {
      setOpen(false);
      return;
    }

    const project = projects.find((p) => p.id === projectId) ?? null;
    const previousProjectId = item.project_id ?? null;
    const previousProjectName = item.project ?? null;

    onSave(item.id, projectId, project?.name ?? null);
    setSaving(true);
    setOpen(false);
    try {
      await apiFetch(`/api/documents/${item.id}/assign-project`, {
        method: "PATCH",
        body: JSON.stringify({ project_id: projectId }),
      });
    } catch (error) {
      onSave(item.id, previousProjectId, previousProjectName);
      reportDocumentMetadataFailure({
        operation: "assign-project",
        error,
        docId: item.id,
        userVisibleFallback: "Project assignment could not be saved.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={saving}
          onClick={(e) => e.stopPropagation()}
          className="h-7 w-full justify-between px-1.5 text-sm font-normal hover:bg-muted/60 data-[state=open]:bg-muted/60"
        >
          {item.project ? (
            <span className="truncate text-left text-foreground">{item.project}</span>
          ) : (
            <span className="truncate text-left text-muted-foreground/50 italic">
              Assign project...
            </span>
          )}
          {saving ? (
            <Loader2 className="ml-2 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <Command>
          <CommandInput placeholder="Search projects..." autoFocus />
          <CommandList>
            <CommandEmpty>No projects found.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__none__" onSelect={() => void handleSelect(null)}>
                <Check
                  className={`mr-2 h-3.5 w-3.5 ${item.project_id == null ? "opacity-100" : "opacity-0"}`}
                />
                <span className="text-muted-foreground italic">Unassigned</span>
              </CommandItem>
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={project.name}
                  onSelect={() => void handleSelect(project.id)}
                >
                  <Check
                    className={`mr-2 h-3.5 w-3.5 ${project.id === item.project_id ? "opacity-100" : "opacity-0"}`}
                  />
                  <span className="truncate">{project.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Inline tag editor

function InlineTagEditor({
  item,
  onSave,
}: {
  item: FileItem;
  onSave: (docId: string, tags: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.tags ?? "");
  const [saving, setSaving] = useState(false);

  const currentTags = (item.tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const open = () => {
    setValue(item.tags ?? "");
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/documents/${item.id}/assign-project`, {
        method: "PATCH",
        body: JSON.stringify({ tags: value }),
      });
      onSave(item.id, value);
      setEditing(false);
    } catch (error) {
      reportDocumentMetadataFailure({
        operation: "save-tags",
        error,
        docId: item.id,
        userVisibleFallback: "Tags could not be saved.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <Input
        ref={(el) => el?.focus()}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") setEditing(false);
        }}
        onClick={(e) => e.stopPropagation()}
        className="h-7 border-0 bg-transparent px-1.5 text-xs shadow-none focus-visible:ring-0"
        placeholder="tag1, tag2, …"
        disabled={saving}
      />
    );
  }

  if (currentTags.length === 0) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-1.5 text-xs text-muted-foreground/40 italic font-normal hover:text-muted-foreground"
        onClick={(e) => {
          e.stopPropagation();
          open();
        }}
      >
        Add tags
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-1.5 py-1 flex flex-nowrap gap-1 justify-start overflow-hidden max-w-full"
      title="Click to edit tags"
      onClick={(e) => {
        e.stopPropagation();
        open();
      }}
    >
      {currentTags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
        >
          {tag}
        </span>
      ))}
    </Button>
  );
}

// Markdown stripper for compact preview cells

function stripMarkdownToPlain(text: string): string {
  return (
    text
      // code fences and inline code
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      // images and links: keep label
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      // headings, blockquote markers, list bullets
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s{0,3}>\s?/gm, "")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      // emphasis markers
      .replace(/(\*\*|__)(.*?)\1/g, "$2")
      .replace(/(\*|_)(.*?)\1/g, "$2")
      // strikethrough
      .replace(/~~(.*?)~~/g, "$1")
      // horizontal rules
      .replace(/^\s*([-*_])\1{2,}\s*$/gm, "")
      // collapse whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

// Inline string select (combobox)

function StringCombobox({
  value,
  options,
  onSelect,
  autoFocus,
  placeholder = "Search or create...",
  clearLabel = "Clear",
}: {
  value: string | null;
  options: string[];
  onSelect: (next: string | null) => void;
  autoFocus?: boolean;
  placeholder?: string;
  clearLabel?: string;
}) {
  const [search, setSearch] = useState("");
  const normalized = search.trim();
  const lowerSearch = normalized.toLowerCase();
  const showCreateOption =
    normalized.length > 0 &&
    !options.some((opt) => opt.toLowerCase() === lowerSearch);

  return (
    <Command>
      <CommandInput
        placeholder={placeholder}
        value={search}
        onValueChange={setSearch}
        autoFocus={autoFocus}
      />
      <CommandList>
        <CommandEmpty>No matching categories.</CommandEmpty>
        <CommandGroup>
          <CommandItem value="__none__" onSelect={() => onSelect(null)}>
            <span className="text-muted-foreground italic">{clearLabel}</span>
            {value == null && <Check className="ml-auto h-4 w-4" />}
          </CommandItem>
          {options.map((opt) => (
            <CommandItem key={opt} value={opt} onSelect={() => onSelect(opt)}>
              {opt}
              {value === opt && <Check className="ml-auto h-4 w-4" />}
            </CommandItem>
          ))}
          {showCreateOption && (
            <CommandItem
              value={`__create__${normalized}`}
              onSelect={() => onSelect(normalized)}
            >
              <span className="text-muted-foreground">Create&nbsp;</span>
              <span className="font-medium">"{normalized}"</span>
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

function InlineStringSelect({
  value,
  options,
  onCommit,
  clearLabel,
  placeholder,
  fieldKey,
  docId,
}: {
  value: string | null;
  options: string[];
  onCommit: (docId: string, next: string | null) => void;
  clearLabel: string;
  placeholder: string;
  fieldKey: "category" | "access_level" | "document_type";
  docId: string;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSelect = async (next: string | null) => {
    setOpen(false);
    const normalizedNext = next ?? null;
    const normalizedCurrent = value ?? null;
    if (normalizedNext === normalizedCurrent) return;
    setSaving(true);
    try {
      await apiFetch(`/api/documents/${docId}/assign-project`, {
        method: "PATCH",
        body: JSON.stringify({ [fieldKey]: next }),
      });
      onCommit(docId, next);
    } catch (error) {
      reportDocumentMetadataFailure({
        operation: `save-${fieldKey}`,
        error,
        docId,
        userVisibleFallback:
          fieldKey === "category"
            ? "Category could not be saved."
            : fieldKey === "document_type"
              ? "File type could not be saved."
              : "Access level could not be saved.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          role="combobox"
          aria-expanded={open}
          disabled={saving}
          onClick={(e) => e.stopPropagation()}
          className="h-7 w-full justify-between px-1.5 text-sm font-normal hover:bg-muted/60 data-[state=open]:bg-muted/60"
        >
          {value ? (
            <span className="truncate text-muted-foreground">{value}</span>
          ) : (
            <span className="truncate text-muted-foreground/50 italic">-</span>
          )}
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-56 p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <StringCombobox
          value={value}
          options={options}
          onSelect={handleSelect}
          autoFocus
          placeholder={placeholder}
          clearLabel={clearLabel}
        />
      </PopoverContent>
    </Popover>
  );
}

// Bulk metadata dialog

function BulkMetadataDialog({
  open,
  onOpenChange,
  selectedCount,
  categoryOptions,
  projects,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  categoryOptions: string[];
  projects: Project[];
  onApply: (fields: {
    project_id?: number | null;
    category?: string | null;
  }) => Promise<void>;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [projectValue, setProjectValue] = useState("__unchanged__");
  const [projectTouched, setProjectTouched] = useState(false);
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedCategory(null);
      setProjectValue("__unchanged__");
      setProjectTouched(false);
      setCategoryTouched(false);
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!projectTouched && !categoryTouched) return;
    setSubmitting(true);
    try {
      await onApply({
        ...(projectTouched
          ? { project_id: projectValue === "__none__" ? null : Number(projectValue) }
          : {}),
        ...(categoryTouched ? { category: selectedCategory } : {}),
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="md">
        <ModalHeader>
          <ModalTitle>
            Bulk edit {selectedCount} file
            {selectedCount === 1 ? "" : "s"}
          </ModalTitle>
          <ModalDescription>
            Update project assignment and category for the current selection.
            Leave either field unchanged if you only want to edit the other.
          </ModalDescription>
        </ModalHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Project</label>
            <Select
              value={projectValue}
              onValueChange={(value) => {
                setProjectValue(value);
                setProjectTouched(value !== "__unchanged__");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Leave unchanged" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="__unchanged__">Leave unchanged</SelectItem>
                <SelectItem value="__none__">Clear project</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={String(project.id)}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Category</label>
            <div className="rounded-md border border-border">
              <StringCombobox
                value={selectedCategory}
                options={categoryOptions}
                placeholder="Search or create category..."
                clearLabel="Clear category"
                onSelect={(next) => {
                  setSelectedCategory(next);
                  setCategoryTouched(true);
                }}
                autoFocus
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-0 text-xs text-muted-foreground"
              onClick={() => {
                setSelectedCategory(null);
                setCategoryTouched(false);
              }}
            >
              Leave category unchanged
            </Button>
          </div>
        </div>
        {(projectTouched || categoryTouched) && (
          <div className="space-y-1 text-sm text-muted-foreground">
            {projectTouched ? (
              <p>
                Project:{" "}
                {projectValue === "__none__" ? (
                  <span className="italic">cleared</span>
                ) : (
                  <span className="font-medium text-foreground">
                    {projects.find((project) => String(project.id) === projectValue)?.name ??
                      "Selected project"}
                  </span>
                )}
              </p>
            ) : null}
            {categoryTouched ? (
              <p>
                Category:{" "}
                {selectedCategory === null ? (
                  <span className="italic">cleared</span>
                ) : (
                  <span className="font-medium text-foreground">
                    {selectedCategory}
                  </span>
                )}
              </p>
            ) : null}
          </div>
        )}
        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={(!projectTouched && !categoryTouched) || submitting}
          >
            {submitting ? "Applying..." : `Apply to ${selectedCount}`}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// Indexed / RAG status badge

function IndexedBadge({ status }: { status: string | null }) {
  if (status === "embedded") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-status-success bg-status-success/10 px-1.5 py-0.5 rounded">
        Indexed
      </span>
    );
  }
  if (status === "ocr_partial") {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-medium text-status-warning bg-status-warning/10 px-1.5 py-0.5 rounded"
        title="OCR ran but this PDF exceeded the page cap — only the first pages were indexed. The full document may not be searchable."
      >
        Partial
      </span>
    );
  }
  if (status === "no_text") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
        No text
      </span>
    );
  }
  if (status === "ocr_failed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-status-error bg-status-error/10 px-1.5 py-0.5 rounded">
        OCR failed
      </span>
    );
  }
  if (status === "raw_ingested") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-status-info bg-status-info/10 px-1.5 py-0.5 rounded">
        Pending
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">{status ?? "—"}</span>;
}

function col(id: string): ColumnConfig {
  const found = columns.find((c) => c.id === id);
  if (!found) throw new Error(`Column config not found: ${id}`);
  return found;
}

const DEFAULT_ACCESS_OPTIONS = [
  "public",
  "internal",
  "confidential",
  "restricted",
];

function buildColumns(
  projects: Project[],
  categoryOptions: string[],
  documentTypeOptions: string[],
  accessOptions: string[],
  onProjectSave: (
    docId: string,
    projectId: number | null,
    projectName: string | null,
  ) => void,
  onTagSave: (docId: string, tags: string) => void,
  onCategorySave: (docId: string, category: string | null) => void,
  onDocumentTypeSave: (docId: string, documentType: string | null) => void,
  onAccessSave: (docId: string, access: string | null) => void,
): TableColumn<FileItem>[] {
  return [
    {
      ...col("name"),
      render: (item) => {
        const href = fileHref(item);
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="min-w-0">
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium truncate block hover:underline underline-offset-2"
                >
                  {item.file_name ?? item.title ?? "Untitled"}
                </a>
              ) : (
                <span className="font-medium truncate block">
                  {item.file_name ?? item.title ?? "Untitled"}
                </span>
              )}
            </div>
          </div>
        );
      },
      csvValue: (item) => item.file_name ?? item.title ?? "",
      sortValue: (item) => (item.file_name ?? item.title ?? "").toLowerCase(),
      sortable: true,
      width: 320,
    },
    {
      ...col("project"),
      render: (item) => (
        <InlineProjectSelect
          item={item}
          projects={projects}
          onSave={onProjectSave}
        />
      ),
      csvValue: (item) => item.project ?? "",
      sortValue: (item) => item.project ?? "",
      sortable: true,
      width: 220,
    },
    {
      ...col("document_type"),
      render: (item) => (
        <InlineStringSelect
          docId={item.id}
          value={item.document_type}
          options={documentTypeOptions}
          onCommit={onDocumentTypeSave}
          fieldKey="document_type"
          placeholder="Search or create..."
          clearLabel="Clear type"
        />
      ),
      csvValue: (item) => item.document_type ?? "",
      sortValue: (item) => item.document_type ?? "",
      sortable: true,
      width: 180,
    },
    {
      ...col("category"),
      render: (item) => (
        <InlineStringSelect
          docId={item.id}
          value={item.category}
          options={categoryOptions}
          onCommit={onCategorySave}
          fieldKey="category"
          placeholder="Search or create..."
          clearLabel="Clear category"
        />
      ),
      csvValue: (item) => item.category ?? "",
      sortValue: (item) => item.category ?? "",
      sortable: true,
      width: 180,
    },
    {
      ...col("date"),
      render: (item) => <TableDateValue value={item.date ?? item.created_at} />,
      csvValue: (item) => item.date ?? item.created_at ?? "",
      sortValue: (item) => {
        const d = item.date ?? item.created_at;
        return d ? new Date(d).getTime() : 0;
      },
      sortable: true,
    },
    {
      ...col("overview"),
      render: (item) => {
        const plain = item.overview ? stripMarkdownToPlain(item.overview) : "";
        return plain ? (
          <span
            className="text-sm text-muted-foreground line-clamp-2"
            title={plain}
          >
            {plain}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground/40">—</span>
        );
      },
      csvValue: (item) =>
        item.overview ? stripMarkdownToPlain(item.overview) : "",
      sortValue: (item) => item.overview ?? "",
      sortable: false,
      width: 280,
    },
    {
      ...col("status"),
      render: (item) => <IndexedBadge status={item.status} />,
      csvValue: (item) => item.status ?? "",
      sortValue: (item) => item.status ?? "",
      sortable: true,
      width: 110,
    },
    {
      ...col("access_level"),
      render: (item) => (
        <InlineStringSelect
          docId={item.id}
          value={item.access_level}
          options={accessOptions}
          onCommit={onAccessSave}
          fieldKey="access_level"
          placeholder="Search or create..."
          clearLabel="Clear access"
        />
      ),
      csvValue: (item) => item.access_level ?? "",
      sortValue: (item) => item.access_level ?? "",
      sortable: true,
      width: 160,
    },
    {
      ...col("source"),
      render: (item) => <CellText value={friendlySource(item)} muted />,
      csvValue: (item) => friendlySource(item),
      sortValue: (item) => friendlySource(item),
      sortable: true,
    },
    {
      ...col("modified"),
      render: (item) => (
        <TableDateValue
          value={item.source_last_modified_at ?? item.date ?? item.created_at}
        />
      ),
      csvValue: (item) =>
        item.source_last_modified_at ?? item.date ?? item.created_at ?? "",
      sortValue: (item) => {
        const d = item.source_last_modified_at ?? item.date ?? item.created_at;
        return d ? new Date(d).getTime() : 0;
      },
      sortable: true,
    },
    {
      ...col("participants"),
      render: (item) =>
        item.participants ? (
          <span
            className="text-sm text-muted-foreground truncate"
            title={item.participants}
          >
            {item.participants}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground/40">—</span>
        ),
      csvValue: (item) => item.participants ?? "",
      sortValue: (item) => item.participants ?? "",
      sortable: false,
      width: 220,
    },
    {
      ...col("folder"),
      render: (item) => {
        const parent = parentFolderName(item);
        const full = fullFolderPath(item);
        return (
          <span
            className="text-sm text-muted-foreground truncate"
            title={full || undefined}
          >
            {parent}
          </span>
        );
      },
      csvValue: (item) => parentFolderName(item),
      sortValue: (item) => parentFolderName(item).toLowerCase(),
      sortable: true,
      width: 200,
    },
    {
      ...col("size"),
      render: (item) => (
        <span className="text-sm text-muted-foreground tabular-nums">
          {formatSize(item.source_size)}
        </span>
      ),
      csvValue: (item) => formatSize(item.source_size),
      sortValue: (item) => item.source_size ?? 0,
      sortable: true,
    },
    {
      ...col("full_path"),
      render: (item) => <CellText value={fullFolderPath(item) || null} muted />,
      csvValue: (item) => fullFolderPath(item),
      sortValue: (item) => fullFolderPath(item).toLowerCase(),
      sortable: true,
      width: 320,
    },
    {
      ...col("division"),
      render: (item) => <CellText value={item.division} muted />,
      csvValue: (item) => item.division ?? "",
      sortValue: (item) => item.division ?? "",
      sortable: true,
    },
    {
      ...col("tags"),
      render: (item) => <InlineTagEditor item={item} onSave={onTagSave} />,
      csvValue: (item) => item.tags ?? "",
      sortable: false,
      width: 240,
    },
  ];
}

// ── Row actions ───────────────────────────────────────────────────────────────

function renderRowActions(item: FileItem) {
  const href = fileHref(item);
  if (!href) return null;
  return (
    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
      <a href={href} target="_blank" rel="noreferrer" title="Open file">
        <ArrowRight className="h-4 w-4" />
      </a>
    </Button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function FilesClient() {
  const searchParams = useSearchParams();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const activeGroup = (searchParams?.get("group") ?? "") as FileGroup | "";
  const [projects, setProjects] = useState<Project[]>([]);
  const [lastErrorMessage, setLastErrorMessage] = useState<string | null>(null);

  const {
    tableState,
    items,
    totalItems: totalCount,
    totalPages,
    isLoading,
    error,
    activeFilters: af,
    handleViewChange,
    handleFilterChange,
    handleSortChange,
    handlePageChange,
    handlePerPageChange,
  } = useServerTableDefinition<FileItem, FileFilterState>({
    definition: filesTableDefinition,
    searchParams,
    pathname,
    router,
  });

  useEffect(() => {
    void (async () => {
      try {
        const result = await apiFetch<
          { data?: Project[]; projects?: Project[] } | Project[]
        >("/api/projects?fields=id,name", { cache: "no-store" });
        const list = Array.isArray(result)
          ? result
          : (result.data ?? result.projects ?? []);
        setProjects(list as Project[]);
      } catch (fetchError) {
        reportNonCriticalFailure({
          area: "files-table",
          operation: "load-project-options",
          error: fetchError,
          userVisibleFallback: "Project options could not be loaded.",
        });
      }
    })();
  }, []);

  useEffect(() => {
    if (!error) return;
    if (lastErrorMessage === error.message) return;
    setLastErrorMessage(error.message);
    reportNonCriticalFailure({
      area: "files-table",
      operation: "load-files-page",
      error,
      userVisibleFallback: "Files could not be loaded.",
    });
    toast.error(error.message);
  }, [error, lastErrorMessage]);

  // Optimistic overrides for inline edits
  const [projectOverrides, setProjectOverrides] = useState<
    Record<string, { project_id: number | null; project: string | null }>
  >({});
  const [tagOverrides, setTagOverrides] = useState<Record<string, string>>({});
  const [categoryOverrides, setCategoryOverrides] = useState<
    Record<string, string | null>
  >({});
  const [documentTypeOverrides, setDocumentTypeOverrides] = useState<
    Record<string, string | null>
  >({});
  const [accessOverrides, setAccessOverrides] = useState<
    Record<string, string | null>
  >({});

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMetadataOpen, setBulkMetadataOpen] = useState(false);

  const handleProjectSave = useCallback(
    (docId: string, projectId: number | null, projectName: string | null) => {
      setProjectOverrides((prev) => ({
        ...prev,
        [docId]: { project_id: projectId, project: projectName },
      }));
    },
    [],
  );

  const handleTagSave = useCallback((docId: string, tags: string) => {
    setTagOverrides((prev) => ({ ...prev, [docId]: tags }));
  }, []);

  const handleCategorySave = useCallback(
    (docId: string, category: string | null) => {
      setCategoryOverrides((prev) => ({ ...prev, [docId]: category }));
    },
    [],
  );

  const handleDocumentTypeSave = useCallback(
    (docId: string, documentType: string | null) => {
      setDocumentTypeOverrides((prev) => ({
        ...prev,
        [docId]: documentType,
      }));
    },
    [],
  );

  const handleAccessSave = useCallback(
    (docId: string, access: string | null) => {
      setAccessOverrides((prev) => ({ ...prev, [docId]: access }));
    },
    [],
  );

  const itemsWithOverrides = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        ...(projectOverrides[item.id] ?? {}),
        ...(tagOverrides[item.id] !== undefined
          ? { tags: tagOverrides[item.id] }
          : {}),
        ...(categoryOverrides[item.id] !== undefined
          ? { category: categoryOverrides[item.id] }
          : {}),
        ...(documentTypeOverrides[item.id] !== undefined
          ? { document_type: documentTypeOverrides[item.id] }
          : {}),
        ...(accessOverrides[item.id] !== undefined
          ? { access_level: accessOverrides[item.id] }
          : {}),
      })),
    [
      items,
      projectOverrides,
      tagOverrides,
      categoryOverrides,
      documentTypeOverrides,
      accessOverrides,
    ],
  );

  const categoryOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const item of itemsWithOverrides) {
      const c = item.category?.trim();
      if (c) seen.add(c);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [itemsWithOverrides]);

  const documentTypeOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const item of itemsWithOverrides) {
      const type = item.document_type?.trim();
      if (type) seen.add(type);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [itemsWithOverrides]);

  const accessOptions = useMemo(() => {
    const seen = new Set<string>(DEFAULT_ACCESS_OPTIONS);
    for (const item of itemsWithOverrides) {
      const a = item.access_level?.trim();
      if (a) seen.add(a);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [itemsWithOverrides]);

  // Filter configs: project options built from the projects list
  const fileFilters = useMemo<FilterConfig[]>(
    () => [
      {
        id: "file_type",
        label: "File Type",
        type: "multiSelect",
        options: [
          { value: "pdf", label: "PDF" },
          { value: "word", label: "Word" },
          { value: "spreadsheet", label: "Spreadsheet" },
          { value: "presentation", label: "Slides" },
          { value: "image", label: "Image" },
          { value: "text", label: "Text" },
          { value: "other", label: "Other" },
        ],
      },
      {
        id: "project_id",
        label: "Project",
        type: "select",
        options: [
          { value: "__unassigned__", label: "Unassigned" },
          ...projects.map((p) => ({ value: String(p.id), label: p.name })),
        ],
      },
      {
        id: "source",
        label: "Source",
        type: "select",
        options: [
          { value: "OneDrive", label: "OneDrive" },
          { value: "SharePoint", label: "SharePoint" },
          { value: "Uploaded", label: "Uploaded" },
        ],
      },
      {
        id: "assigned",
        label: "Assignment",
        type: "select",
        options: [
          { value: "assigned", label: "Assigned to project" },
          { value: "unassigned", label: "Unassigned" },
        ],
      },
      {
        id: "indexed",
        label: "RAG Status",
        type: "multiSelect",
        options: [
          { value: "embedded", label: "Indexed" },
          { value: "raw_ingested", label: "Pending indexing" },
          { value: "ocr_partial", label: "Partially indexed (page cap)" },
          { value: "no_text", label: "No text / not indexed" },
          { value: "ocr_failed", label: "OCR failed" },
        ],
      },
      {
        id: "modified_after",
        label: "Modified after",
        type: "date",
      },
      {
        id: "modified_before",
        label: "Modified before",
        type: "date",
      },
    ],
    [projects],
  );

  const tabs = [
    {
      label: "All",
      href: pathname,
      isActive: !activeGroup,
    },
    ...ACTIVE_FILE_GROUPS.map((g) => ({
      label: FILE_GROUP_META[g].label,
      href: `${pathname}?group=${g}`,
      isActive: activeGroup === g,
    })),
  ];

  const customIsFiltered =
    Boolean(tableState.debouncedSearch.trim()) ||
    Object.entries(af).some(([key, value]) => {
      if (key === "group") return false;
      return Array.isArray(value) ? value.length > 0 : Boolean(value);
    });

  const handleToolbarFilterChange = useCallback(
    (filters: FileFilterState) => {
      handleFilterChange({
        ...filters,
        group: activeGroup || undefined,
      });
    },
    [activeGroup, handleFilterChange],
  );

  const handleClearToolbarFilters = useCallback(() => {
    handleFilterChange({
      ...EMPTY_FILE_FILTERS,
      group: activeGroup || undefined,
    });
  }, [activeGroup, handleFilterChange]);

  const filteredItems = itemsWithOverrides;

  const tableColumns = useMemo(
    () =>
      buildColumns(
        projects,
        categoryOptions,
        documentTypeOptions,
        accessOptions,
        handleProjectSave,
        handleTagSave,
        handleCategorySave,
        handleDocumentTypeSave,
        handleAccessSave,
      ),
    [
      projects,
      categoryOptions,
      documentTypeOptions,
      accessOptions,
      handleProjectSave,
      handleTagSave,
      handleCategorySave,
      handleDocumentTypeSave,
      handleAccessSave,
    ],
  );

  const serverSortedColumns = new Set([
    "modified",
    "name",
    "project",
    "document_type",
    "category",
    "date",
    "status",
    "access_level",
    "size",
    "division",
  ]);

  const sortedItems = useMemo(() => {
    if (tableState.sortBy && serverSortedColumns.has(tableState.sortBy)) {
      return filteredItems;
    }
    const col = tableColumns.find((c) => c.id === tableState.sortBy);
    if (!col?.sortValue) return filteredItems;
    const sortValue = col.sortValue;
    return [...filteredItems].sort((a, b) => {
      const va = sortValue(a);
      const vb = sortValue(b);
      if (va == null) return tableState.sortDirection === "asc" ? -1 : 1;
      if (vb == null) return tableState.sortDirection === "asc" ? 1 : -1;
      if (typeof va === "number" && typeof vb === "number")
        return tableState.sortDirection === "asc" ? va - vb : vb - va;
      return tableState.sortDirection === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }, [
    filteredItems,
    tableColumns,
    tableState.sortBy,
    tableState.sortDirection,
  ]);

  const activeTabLabel =
    tabs
      .find((t) => t.isActive)
      ?.label.split(" (")[0]
      .toLowerCase() ?? "file";

  // Selection handlers: onSelectAll operates on the current page's visible items.
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      const pageIds = sortedItems.map((i) => i.id);
      if (checked) {
        setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
      } else {
        const pageSet = new Set(pageIds);
        setSelectedIds((prev) => prev.filter((id) => !pageSet.has(id)));
      }
    },
    [sortedItems],
  );

  const handleSelectRow = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }, []);

  const handleBulkMetadataApply = useCallback(
    async (fields: { project_id?: number | null; category?: string | null }) => {
      if (selectedIds.length === 0) return;
      try {
        await apiFetch(`/api/documents/bulk-update`, {
          method: "PATCH",
          body: JSON.stringify({ doc_ids: selectedIds, fields }),
        });
        if ("category" in fields) {
          setCategoryOverrides((prev) => {
            const next = { ...prev };
            for (const id of selectedIds) next[id] = fields.category ?? null;
            return next;
          });
        }
        if ("project_id" in fields) {
          const projectName =
            fields.project_id == null
              ? null
              : projects.find((project) => project.id === fields.project_id)?.name ?? null;
          setProjectOverrides((prev) => {
            const next = { ...prev };
            for (const id of selectedIds) {
              next[id] = {
                project_id: fields.project_id ?? null,
                project: projectName,
              };
            }
            return next;
          });
        }
        setSelectedIds([]);
      } catch (error) {
        reportDocumentMetadataFailure({
          operation: "bulk-set-metadata",
          error,
          userVisibleFallback: "Selected file updates could not be saved.",
        });
        throw error;
      }
    },
    [projects, selectedIds],
  );

  return (
    <>
      <UnifiedTablePage<FileItem>
        header={{
          title: "Files",
          description: `${totalCount.toLocaleString()} ${activeGroup ? FILE_GROUP_META[activeGroup].label : "file"}${totalCount === 1 ? "" : "s"} from OneDrive, SharePoint, and uploads`,
        }}
        tabs={tabs}
        layout={{ fullBleedTable: true }}
        toolbar={{
          totalItems: totalCount,
          filteredItems: totalCount,
          selectedCount: selectedIds.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: filesTableDefinition.searchPlaceholder,
          currentView: tableState.currentView,
          onViewChange: handleViewChange,
          filters: fileFilters,
          activeFilters: af,
          onFilterChange: (filters) =>
            handleToolbarFilterChange(filters as FileFilterState),
          onClearFilters: handleClearToolbarFilters,
          columns,
          visibleColumns: tableState.visibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
          savedViewsScope: filesTableDefinition.entityKey,
          savedViewsDefaults: {
            visibleColumns: filesTableDefinition.defaultVisibleColumns,
            columnOrder: columns.map((column) => column.id),
            columnWidths: {},
            sortBy: filesTableDefinition.defaultSortBy,
            sortDirection: filesTableDefinition.defaultSortDirection,
            filters: filesTableDefinition.defaultFilters,
          },
          customActions:
            selectedIds.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkMetadataOpen(true)}
                className="h-8"
              >
                <Tag className="h-3.5 w-3.5 mr-1.5" />
                Bulk edit
              </Button>
            ) : null,
        }}
        data={{
          items: sortedItems,
          isLoading,
          isFetching: false,
          error,
        }}
        table={{
          columns: tableColumns,
          getRowId: (item) => item.id,
          rowActions: renderRowActions,
        }}
        sorting={{
          sortBy: tableState.sortBy,
          sortDirection: tableState.sortDirection,
          onSortChange: handleSortChange,
        }}
        selection={{
          selectedIds,
          onSelectAll: handleSelectAll,
          onSelectRow: handleSelectRow,
        }}
        emptyState={{
          title: `No ${activeTabLabel} files`,
          description: activeGroup
            ? `No ${FILE_GROUP_META[activeGroup].label.toLowerCase()} files have been synced yet.`
            : "No files have been synced from OneDrive or SharePoint yet.",
          filteredDescription: "Try adjusting your search.",
          isFiltered: customIsFiltered,
        }}
        pagination={{
          page: tableState.page,
          totalPages,
          perPage: tableState.perPage,
          onPageChange: handlePageChange,
          onPerPageChange: handlePerPageChange,
        }}
      />
      <BulkMetadataDialog
        open={bulkMetadataOpen}
        onOpenChange={setBulkMetadataOpen}
        selectedCount={selectedIds.length}
        categoryOptions={categoryOptions}
        projects={projects}
        onApply={handleBulkMetadataApply}
      />
    </>
  );
}

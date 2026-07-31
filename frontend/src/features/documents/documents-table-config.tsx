import type { ReactElement } from "react";

import { formatDate } from "@/lib/format";
import {
  ArrowRight,
  Eye,
  FolderOpen,
  Link,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/ds";
import {
  DOCUMENT_TYPE_OPTIONS,
  documentTypeLabel,
} from "@/features/documents/document-types";
import { TABLE_LINK_CLASSNAME } from "@/components/tables/unified";
import type {
  ColumnConfig,
  FilterConfig,
  TableColumn,
} from "@/components/tables/unified";
import { InlineSelectEditor } from "@/components/tables/unified/inline-select-editor";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type PipelineDoc = {
  id: string;
  fireflies_id: string | null;
  title: string | null;
  status: string | null;
  type: string | null;
  category: string | null;
  document_type: string | null;
  source: string | null;
  source_system: string | null;
  source_web_url: string | null;
  date: string | null;
  created_at: string | null;
  captured_at: string | null;
  file_path: string | null;
  storage_bucket: string | null;
  url: string | null;
  project_id: number | null;
  project_name?: string | null;
  summary: string | null;
  overview: string | null;
  participants: string | null;
  participants_array: string[] | null;
  pipeline_stage: string;
  attempt_count: number;
  last_attempt_at: string | null;
  error_message: string | null;
};

const SOURCE_FILTER_OPTIONS = [
  { value: "microsoft_graph", label: "Microsoft (OneDrive/Email)" },
  { value: "local_filesystem", label: "Local Filesystem" },
  { value: "manual_upload", label: "Manual Upload" },
  { value: "fireflies", label: "Fireflies" },
  { value: "knowledge_upload", label: "Knowledge Upload" },
  { value: "Zapier", label: "Zapier" },
];

const SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  SOURCE_FILTER_OPTIONS.map((option) => [option.value.toLowerCase(), option.label]),
);

/** Human-readable label for a document's `source`/`source_system` value. */
export function documentSourceLabel(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  return SOURCE_LABELS[value.toLowerCase()] ?? value.replace(/_/g, " ");
}

const TYPE_FILTER_OPTIONS = [
  { value: "document", label: "Document" },
  { value: "email_attachment", label: "Email Attachment" },
  { value: "knowledge-base", label: "Knowledge Base" },
  { value: "rfi_question", label: "RFI Question" },
  { value: "rfi_response", label: "RFI Response" },
  { value: "estimate", label: "Estimate" },
  { value: "invoice", label: "Invoice" },
  { value: "change order", label: "Change Order" },
  { value: "progress report", label: "Progress Report" },
  { value: "daily report", label: "Daily Report" },
  { value: "weekly report", label: "Weekly Report" },
  { value: "procurement log", label: "Procurement Log" },
  { value: "clarifications", label: "Clarifications" },
  // Communications types (accessible via explicit filter)
  { value: "teams_dm", label: "Teams DM" },
  { value: "teams_dm_conversation", label: "Teams Conversation" },
  { value: "teams_message", label: "Teams Message" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
];

const CATEGORY_FILTER_OPTIONS = [
  { value: "document", label: "Document" },
  { value: "contract", label: "Contract" },
  { value: "financial_document", label: "Financial Document" },
  { value: "knowledge", label: "Knowledge" },
  { value: "drawing", label: "Drawing" },
  { value: "specification", label: "Specification" },
  { value: "budget", label: "Budget" },
  { value: "commitment", label: "Commitment" },
  { value: "rfi", label: "RFI" },
  { value: "submittal", label: "Submittal" },
  { value: "lein-waiver", label: "Lien Waiver" },
  { value: "psr", label: "PSR" },
  { value: "attachment", label: "Attachment" },
  { value: "change-order", label: "Change Order" },
  { value: "permit", label: "Permit" },
  { value: "email", label: "Email" },
  { value: "teams_message", label: "Teams Message" },
  { value: "Internal", label: "Internal" },
  { value: "Interview", label: "Interview" },
];

// Column order: Title | Project | Type | Category | Source | Stage | Created | Error
export const documentColumns: ColumnConfig[] = [
  { id: "title", label: "Document", alwaysVisible: true },
  { id: "project", label: "Project", defaultVisible: true },
  { id: "document_type", label: "Doc Type", defaultVisible: true },
  { id: "type", label: "Type", defaultVisible: false },
  { id: "category", label: "Category", defaultVisible: false },
  { id: "source", label: "Source", defaultVisible: true },
  { id: "pipeline_stage", label: "Pipeline Stage", defaultVisible: true },
  { id: "created_at", label: "Created", defaultVisible: true },
  { id: "error", label: "Error", defaultVisible: false },
];

export const documentFilters: FilterConfig[] = [
  {
    id: "source",
    label: "Source",
    type: "select",
    options: SOURCE_FILTER_OPTIONS,
  },
  {
    id: "document_type",
    label: "Doc Type",
    type: "select",
    options: [...DOCUMENT_TYPE_OPTIONS],
  },
  {
    id: "type",
    label: "Type",
    type: "select",
    options: TYPE_FILTER_OPTIONS,
  },
  {
    id: "category",
    label: "Category",
    type: "select",
    options: CATEGORY_FILTER_OPTIONS,
  },
  {
    id: "pipeline_stage",
    label: "Pipeline Stage",
    type: "select",
    options: [
      { value: "done", label: "Complete" },
      { value: "raw_ingested", label: "Raw Ingested" },
      { value: "pending", label: "Pending" },
      { value: "processing", label: "Processing" },
      { value: "failed", label: "Failed" },
      { value: "unknown", label: "Unknown" },
    ],
  },
  {
    id: "date",
    label: "Date Added",
    type: "dateRange",
  },
];

export const documentDefaultVisibleColumns = documentColumns
  .filter((column) => column.defaultVisible !== false)
  .map((column) => column.id);

function stageLabel(stage: string): string {
  switch (stage) {
    case "done":
      return "Complete";
    case "raw_ingested":
      return "Raw Ingested";
    case "pending":
      return "Pending";
    case "processing":
      return "Processing";
    case "failed":
      return "Failed";
    default:
      return stage || "Unknown";
  }
}

/**
 * Get the viewable URL for a document. Checks for:
 * 1. Direct URL (e.g. fireflies link)
 * 2. Supabase storage file path
 */
export function getDocumentViewUrl(doc: PipelineDoc): string | null {
  if (doc.url) return doc.url;
  if (doc.source_web_url) return doc.source_web_url;
  if (doc.file_path && doc.storage_bucket) {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${doc.storage_bucket}/${doc.file_path}`;
  }
  if (doc.file_path) {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${doc.file_path}`;
  }
  return null;
}

export function buildDocumentTableColumns(opts?: {
  projectNames?: Map<number, string>;
  projects?: Array<{ id: number; name: string | null }>;
  onEditField?: (docId: string, field: string, value: string) => void;
}): TableColumn<PipelineDoc>[] {
  const {
    projectNames,
    projects,
    onEditField,
  } = opts ?? {};
  const handleEdit = (field: string) =>
    onEditField
      ? (item: PipelineDoc, value: string) => onEditField(item.id, field, value)
      : undefined;

  return [
    // Title
    {
      ...documentColumns[0],
      render: (item) => {
        const href = getDocumentViewUrl(item);

        if (!href) {
          return <span className="font-medium">{item.title || "Untitled Document"}</span>;
        }

        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className={`font-medium ${TABLE_LINK_CLASSNAME}`}
          >
            {item.title || "Untitled Document"}
          </a>
        );
      },
      sortValue: (item) => item.title ?? "Untitled",
      sortable: true,
      // Title is the link to the detail page — never inline-editable.
    },
    // Project (dropdown select editor)
    {
      ...documentColumns[1],
      render: (item) => {
        if (!item.project_id) {
          return (
            <span className="text-sm text-muted-foreground italic">
              Unassigned
            </span>
          );
        }
        const name = item.project_name ?? projectNames?.get(item.project_id);
        return (
          <span className="text-sm text-muted-foreground">
            {name || `Project #${item.project_id}`}
          </span>
        );
      },
      sortValue: (item) => item.project_id ?? 0,
      sortable: true,
      editable: Boolean(onEditField),
      editValue: (item) => String(item.project_id ?? ""),
      onEdit: onEditField
        ? (item: PipelineDoc, value: string) =>
            onEditField(item.id, "project_id", value)
        : undefined,
      renderEditor: ({ value, onChange, onCommit, onCancel }) => (
        <InlineSelectEditor
          value={value}
          options={[
            { value: "__none__", label: "No project" },
            ...(projects ?? []).map((project) => ({
              value: String(project.id),
              label: project.name || `Project #${project.id}`,
            })),
          ]}
          placeholder="Search projects..."
          searchable
          onChange={onChange}
          onCommit={onCommit}
          onCancel={onCancel}
        />
      ),
    },
    // Doc Type (folder-derived construction document type)
    {
      ...documentColumns[2],
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {documentTypeLabel(item.document_type)}
        </span>
      ),
      sortValue: (item) => item.document_type ?? "",
      sortable: true,
      editable: Boolean(onEditField),
      editType: "select",
      editValue: (item) => item.document_type ?? "",
      editOptions: [...DOCUMENT_TYPE_OPTIONS],
      onEdit: handleEdit("document_type"),
    },
    // Type
    {
      ...documentColumns[3],
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.type || "-"}
        </span>
      ),
      sortValue: (item) => item.type,
      sortable: true,
      editable: Boolean(onEditField),
      editType: "select",
      editValue: (item) => item.type ?? "",
      editOptions: TYPE_FILTER_OPTIONS,
      onEdit: handleEdit("type"),
    },
    // Category
    {
      ...documentColumns[4],
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.category || "-"}
        </span>
      ),
      sortValue: (item) => item.category,
      sortable: true,
      editable: Boolean(onEditField),
      editType: "select",
      editValue: (item) => item.category ?? "",
      editOptions: CATEGORY_FILTER_OPTIONS,
      onEdit: handleEdit("category"),
    },
    // Source
    {
      ...documentColumns[5],
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {documentSourceLabel(item.source ?? item.source_system) || "-"}
        </span>
      ),
      sortValue: (item) => item.source,
      sortable: true,
    },
    // Pipeline Stage
    {
      ...documentColumns[6],
      render: (item) => (
        <StatusBadge
          status={stageLabel(item.pipeline_stage)}
          variant={
            item.error_message
              ? "error"
              : item.pipeline_stage === "done"
                ? "success"
                : "warning"
          }
        />
      ),
      sortValue: (item) => item.pipeline_stage,
      sortable: true,
      // Read-only: pipeline_stage is the RAG ingestion state machine, not user-settable.
      editable: false,
    },
    // Created
    {
      ...documentColumns[7],
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(item.created_at)}
        </span>
      ),
      sortValue: (item) => item.created_at,
      sortable: true,
    },
    // Error
    {
      ...documentColumns[8],
      render: (item) =>
        item.error_message ? (
          <span className="text-xs text-destructive line-clamp-2">
            {item.error_message}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        ),
    },
  ];
}

export function renderDocumentCard(
  item: PipelineDoc,
  onView: (item: PipelineDoc) => void,
): ReactElement {
  return (
    <Button
      type="button"
      variant="ghost"
      data-testid="document-card"
      className="h-auto w-full min-w-0 flex flex-col items-stretch gap-2 whitespace-normal rounded-lg border border-border p-4 text-left hover:bg-muted/50"
      onClick={() => onView(item)}
    >
      <div className="flex w-full min-w-0 items-start justify-between gap-2">
        <span className="min-w-0 font-medium text-sm line-clamp-2">
          {item.title || "Untitled Document"}
        </span>
        <StatusBadge
          status={stageLabel(item.pipeline_stage)}
          variant={
            item.error_message
              ? "error"
              : item.pipeline_stage === "done"
                ? "success"
                : "warning"
          }
        />
      </div>
      <div className="flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {item.type && <span className="truncate">{item.type}</span>}
        {item.category && <span className="truncate">{item.category}</span>}
        {documentSourceLabel(item.source ?? item.source_system) && (
          <span className="truncate">
            {documentSourceLabel(item.source ?? item.source_system)}
          </span>
        )}
        {item.created_at && <span>{formatDate(item.created_at)}</span>}
      </div>
      {item.error_message && (
        <span className="text-xs text-destructive line-clamp-1">
          {item.error_message}
        </span>
      )}
    </Button>
  );
}

export function renderDocumentList(
  item: PipelineDoc,
  onView: (item: PipelineDoc) => void,
): ReactElement {
  return (
    <Button
      type="button"
      variant="ghost"
      className="h-auto flex w-full items-center justify-between gap-4 rounded-md px-3 py-2.5 text-left hover:bg-muted/50"
      onClick={() => onView(item)}
    >
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {item.title || "Untitled Document"}
        </span>
        <span className="text-xs text-muted-foreground">
          {[
            item.type,
            item.category,
            documentSourceLabel(item.source ?? item.source_system),
            formatDate(item.created_at),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
      <StatusBadge
        status={stageLabel(item.pipeline_stage)}
        variant={
          item.error_message
            ? "error"
            : item.pipeline_stage === "done"
              ? "success"
              : "warning"
        }
      />
    </Button>
  );
}

export function renderDocumentRowActions(
  item: PipelineDoc,
  onView: (item: PipelineDoc) => void,
  onAssignProject?: (item: PipelineDoc) => void,
  onDelete?: (item: PipelineDoc) => void,
): ReactElement {
  const viewUrl = getDocumentViewUrl(item);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {viewUrl && (
          <DropdownMenuItem asChild>
            <a href={viewUrl} target="_blank" rel="noopener noreferrer">
              <ArrowRight className="mr-2 h-4 w-4" />
              View file
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onView(item)}>
          <Eye className="mr-2 h-4 w-4" />
          Details
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {onAssignProject && (
          <DropdownMenuItem onClick={() => onAssignProject(item)}>
            <FolderOpen className="mr-2 h-4 w-4" />
            {item.project_id ? "Change project" : "Assign to project"}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => {
            void navigator.clipboard.writeText(item.id);
            toast.success("Document ID copied");
          }}
        >
          <Link className="mr-2 h-4 w-4" />
          Copy ID
        </DropdownMenuItem>
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(item)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

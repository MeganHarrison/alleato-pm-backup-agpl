import * as React from "react";

import {
  ArrowUpRight,
  Download,
  FileText,
  Headphones,
  type LucideIcon,
  Pencil,
  Plus,
  Trash2,
  Video,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/forms/SearchableSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StatusBadge, type StatusVariant } from "@/components/ds/status-badge";
import {
  CellLink,
  type ColumnConfig,
  type FilterConfig,
  type TableColumn,
  type DetailFieldConfig,
  TableAvatarUsers,
  TableDateValue,
  TableRowActionsMenu,
  TableStatusDot,
  TableTagBadge,
  formatParticipantDisplayName,
} from "@/components/tables/unified";
import { cn } from "@/lib/utils";
import type { Meeting } from "@/lib/validation/meetings";
import { getMeetingDetailHref } from "@/features/meetings/meeting-routes";

// ─── Inline editing types ───────────────────────────────────────────────────

export type EditableField = "title" | "date" | "project" | "type" | "category";

export interface EditContext {
  editingCell: { meetingId: string; field: EditableField } | null;
  editingValue: string;
  projectOptions: Array<{ value: string; label: string }>;
  categoryOptions: Array<{ value: string; label: string }>;
  handleCellClick: (meeting: Meeting, field: EditableField) => void;
  setEditingValue: (value: string) => void;
  handleInlineSave: (options?: {
    valueOverride?: string;
    move?: "next" | "prev";
  }) => Promise<void>;
  handleInlineFieldSave: (
    meeting: Meeting,
    field: EditableField,
    value: string,
  ) => Promise<void>;
  handleCreateCategory: (value: string) => Promise<boolean>;
  handleInlineCancel: () => void;
}

export type GetMeetingHref = (meeting: Meeting) => string;

const defaultGetMeetingHref: GetMeetingHref = (meeting) =>
  getMeetingDetailHref({ meetingId: meeting.id });

// ─── Column configs ──────────────────────────────────────────────────────────

export const meetingColumns: ColumnConfig[] = [
  { id: "title", label: "Title", alwaysVisible: true },
  { id: "project", label: "Project", defaultVisible: true },
  { id: "date", label: "Date", defaultVisible: true },
  { id: "description", label: "Description", defaultVisible: true },
  { id: "participants", label: "Participants", defaultVisible: true },
  { id: "sentiment", label: "Sentiment", defaultVisible: true },
  { id: "overview", label: "Overview", defaultVisible: false },
  { id: "action_items", label: "Action Items", defaultVisible: false },
  { id: "bullet_points", label: "Bullet Points", defaultVisible: false },
  { id: "duration_minutes", label: "Duration", defaultVisible: true },
  { id: "summary", label: "Summary", defaultVisible: false },
  { id: "content", label: "Content", defaultVisible: false },
  { id: "type", label: "Type", defaultVisible: false },
  { id: "category", label: "Category", defaultVisible: true },
  { id: "links", label: "Links", defaultVisible: true },
  { id: "embedding", label: "Embedding", defaultVisible: false },
  // Keywords lives last so it renders as the right-most column in the table.
  { id: "keywords", label: "Keywords", defaultVisible: true },
];

export const meetingDefaultVisibleColumns = meetingColumns
  .filter((column) => column.defaultVisible !== false)
  .map((column) => column.id);

function getMeetingColumn(id: string): ColumnConfig {
  const column = meetingColumns.find((candidate) => candidate.id === id);
  if (!column) {
    throw new Error(`Missing meeting column config for ${id}`);
  }
  return column;
}

// ─── Filter / detail field builders ─────────────────────────────────────────

export function buildMeetingFilters(options: {
  types: string[];
  categories: string[];
}): FilterConfig[] {
  return [
    {
      id: "datePreset",
      label: "Date",
      type: "select",
      options: [
        { value: "today", label: "Today" },
        { value: "yesterday", label: "Yesterday" },
        { value: "this_week", label: "This week" },
        { value: "this_month", label: "This month" },
        { value: "this_year", label: "This year" },
        { value: "custom", label: "Custom dates" },
      ],
    },
    {
      id: "dateFrom",
      label: "From",
      type: "date",
    },
    {
      id: "dateTo",
      label: "To",
      type: "date",
    },
    {
      id: "type",
      label: "Type",
      type: "select",
      options: options.types.map((type) => ({ value: type, label: type })),
    },
    {
      id: "category",
      label: "Category",
      type: "select",
      options: options.categories.map((category) => ({
        value: category,
        label: category,
      })),
    },
  ];
}

export function buildMeetingDetailFields(options: {
  projectOptions: Array<{ value: string; label: string }>;
}): DetailFieldConfig[] {
  return [
    { id: "title", label: "Title", type: "text", placeholder: "Meeting title" },
    { id: "date", label: "Date", type: "date" },
    { id: "type", label: "Type", type: "text", placeholder: "Weekly sync" },
    { id: "category", label: "Category", type: "text", placeholder: "Project" },
    {
      id: "project",
      label: "Project",
      type: "select",
      options: options.projectOptions,
      placeholder: "Select project",
    },
    { id: "description", label: "Description", type: "textarea", fullWidth: true },
    { id: "participants", label: "Participants", type: "text" },
    { id: "source", label: "Source", type: "text" },
    { id: "url", label: "URL", type: "text" },
    { id: "summary", label: "Summary", type: "textarea", fullWidth: true },
  ];
}

// ─── Markdown export helper ───────────────────────────────────────────────────

/**
 * Builds a standalone markdown file for a meeting from its transcript content
 * (falling back to the summary). Returns null when there is nothing to export.
 */
export function buildMeetingMarkdownFile(
  meeting: Meeting,
): { filename: string; body: string } | null {
  const markdown = meeting.content?.trim() ?? meeting.summary?.trim() ?? "";
  if (!markdown) return null;

  const title = meeting.title ?? "Meeting Transcript";

  let dateKey: string | null = null;
  let dateLabel = "";
  if (meeting.date) {
    const parsed = new Date(meeting.date);
    if (!Number.isNaN(parsed.getTime())) {
      dateKey = parsed.toISOString().slice(0, 10);
      dateLabel = parsed.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  }

  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "meeting";
  const filename = `${dateKey ? `${dateKey}-` : ""}${slug}.md`;
  const body = `# ${title}\n${dateLabel ? `\n_${dateLabel}_\n` : ""}\n${markdown}\n`;

  return { filename, body };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function parseParticipants(item: Meeting): string[] {
  const normalizeEntry = (value: unknown): string | null => {
    if (typeof value === "string") {
      const trimmed = value.trim().replace(/^["'{\[]+/, "").replace(/["'}\]]+$/, "");
      return trimmed || null;
    }
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      const preferred = record.name ?? record.display_name ?? record.displayName ?? record.email;
      if (typeof preferred === "string" && preferred.trim()) {
        return preferred.trim();
      }
    }
    return null;
  };

  const dedupe = (values: unknown[]): string[] =>
    Array.from(
      new Set(
        values
          .map(normalizeEntry)
          .filter((value): value is string => Boolean(value)),
      ),
    );

  const participantsArray = item.participants_array;
  if (Array.isArray(participantsArray) && participantsArray.length > 0) {
    return dedupe(participantsArray);
  }

  const rawParticipants = item.participants?.trim();
  if (!rawParticipants) return [];

  if (rawParticipants.startsWith("[")) {
    try {
      const parsed = JSON.parse(rawParticipants) as unknown;
      if (Array.isArray(parsed)) {
        return dedupe(parsed);
      }
    } catch {
      // Fall through to delimiter parsing.
    }
  }

  return dedupe(rawParticipants.split(/[\n,;]+/));
}

export function getParticipantDisplayName(value: string): string {
  return formatParticipantDisplayName(value);
}

function getEmbeddingStatus(item: Meeting): {
  label: string;
  variant: StatusVariant;
  sortValue: number;
} {
  const normalizedStatus = item.embedding_status?.trim().toLowerCase();

  if (normalizedStatus === "unavailable") {
    return { label: "Unavailable", variant: "error", sortValue: 0 };
  }

  if (
    normalizedStatus === "embedded" ||
    normalizedStatus === "processed" ||
    normalizedStatus === "compiled" ||
    normalizedStatus === "segmented"
  ) {
    return { label: "Embedded", variant: "success", sortValue: 3 };
  }

  if (normalizedStatus === "error" || normalizedStatus === "embedding_error") {
    return { label: "Error", variant: "error", sortValue: 0 };
  }

  if (
    normalizedStatus === "skipped_low_content" ||
    normalizedStatus === "intentionally_excluded" ||
    normalizedStatus === "skipped"
  ) {
    return { label: "Excluded", variant: "neutral", sortValue: 1 };
  }

  if (normalizedStatus === "metadata_only" || normalizedStatus === "missing_metadata") {
    return { label: "Metadata only", variant: "neutral", sortValue: 1 };
  }

  if (normalizedStatus === "pending" || normalizedStatus === "processing" || !normalizedStatus) {
    return { label: "Pending", variant: "warning", sortValue: 2 };
  }

  return { label: "Unavailable", variant: "error", sortValue: 0 };
}

function EmptyCell(): React.ReactElement {
  return <span className="text-xs text-muted-foreground">—</span>;
}

function normalizeText(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function TextPreviewCell({
  value,
  emptyLabel = "No value",
  className = "max-w-56",
}: {
  value: string | null | undefined;
  emptyLabel?: string;
  className?: string;
}): React.ReactElement {
  const text = normalizeText(value);
  if (!text) {
    return (
      <span className="text-xs text-muted-foreground" title={emptyLabel}>
        —
      </span>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`block truncate text-xs text-muted-foreground ${className}`}>
            {text}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-96 border bg-popover p-3 text-popover-foreground shadow-sm">
          <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap">
            {text}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function MinimalIconLink({
  href,
  icon: Icon,
  label,
}: {
  href: string | null | undefined;
  icon: LucideIcon;
  label: string;
}): React.ReactElement {
  const normalizedHref = normalizeText(href);
  if (!normalizedHref) return <EmptyCell />;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={normalizedHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(event) => event.stopPropagation()}
          >
            <Icon className="h-3.5 w-3.5 stroke-[1.75]" />
          </a>
        </TooltipTrigger>
        <TooltipContent sideOffset={6}>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function formatDuration(minutes: number | null | undefined): string {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) {
    return "";
  }

  const roundedMinutes = Math.round(minutes);
  const hours = Math.floor(roundedMinutes / 60);
  const remainder = roundedMinutes % 60;

  if (hours > 0 && remainder > 0) return `${hours}h ${remainder}m`;
  if (hours > 0) return `${hours}h`;
  return `${remainder}m`;
}

function formatSentiment(value: unknown): string {
  const summary = parseSentimentSummary(value);
  if (summary) {
    return [
      `positive ${summary.positive}%`,
      `neutral ${summary.neutral}%`,
      `negative ${summary.negative}%`,
    ].join(", ");
  }

  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Positive" : "Negative";
  if (Array.isArray(value)) {
    return value
      .map((entry) => formatSentiment(entry))
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const preferred =
      record.label ??
      record.sentiment ??
      record.overall ??
      record.tone ??
      record.score;
    if (preferred != null) return formatSentiment(preferred);
    return JSON.stringify(record);
  }
  return "";
}

type SentimentTone = "positive" | "neutral" | "negative";

interface SentimentSummary {
  positive: number;
  neutral: number;
  negative: number;
  dominantTone: SentimentTone;
  dominantValue: number;
}

function coercePercent(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace("%", ""));
    if (Number.isFinite(parsed)) return Math.max(0, Math.min(100, Math.round(parsed)));
  }
  return null;
}

function parseSentimentRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) return null;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function parseSentimentSummary(value: unknown): SentimentSummary | null {
  const record = parseSentimentRecord(value);
  if (!record) return null;

  const positive =
    coercePercent(record.positive_pct ?? record.positive ?? record.positivePercent) ?? 0;
  const neutral =
    coercePercent(record.neutral_pct ?? record.neutral ?? record.neutralPercent) ?? 0;
  const negative =
    coercePercent(record.negative_pct ?? record.negative ?? record.negativePercent) ?? 0;

  if (positive === 0 && neutral === 0 && negative === 0) return null;

  const entries: Array<[SentimentTone, number]> = [
    ["positive", positive],
    ["neutral", neutral],
    ["negative", negative],
  ];
  const [dominantTone, dominantValue] = entries.reduce((current, next) =>
    next[1] > current[1] ? next : current,
  );

  return { positive, neutral, negative, dominantTone, dominantValue };
}

const SENTIMENT_LABELS: Record<SentimentTone, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
};

const SENTIMENT_CLASSES: Record<SentimentTone, string> = {
  positive: "border-success/20 bg-success/10 text-success",
  neutral: "border-border bg-muted/50 text-muted-foreground",
  negative: "border-destructive/20 bg-destructive/10 text-destructive",
};

function SentimentCell({ value }: { value: unknown }): React.ReactElement {
  const summary = parseSentimentSummary(value);
  const fallback = formatSentiment(value);

  if (!summary && !fallback) {
    return (
      <span className="text-xs text-muted-foreground" title="No sentiment">
        —
      </span>
    );
  }

  if (!summary) {
    return (
      <Badge
        variant="outline"
        className="rounded-sm border-border/70 bg-muted/40 px-1.5 py-0 text-[11px] font-normal text-muted-foreground"
      >
        {fallback}
      </Badge>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center">
            <Badge
              variant="outline"
              className={cn(
                "rounded-sm px-1.5 py-0 text-[11px] font-normal",
                SENTIMENT_CLASSES[summary.dominantTone],
              )}
            >
              {SENTIMENT_LABELS[summary.dominantTone]} {summary.dominantValue}%
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent className="border bg-popover p-3 text-popover-foreground shadow-sm">
          <div className="grid gap-1 text-xs">
            <div className="flex items-center justify-between gap-8">
              <span className="text-muted-foreground">Positive</span>
              <span className="font-medium text-foreground">{summary.positive}%</span>
            </div>
            <div className="flex items-center justify-between gap-8">
              <span className="text-muted-foreground">Neutral</span>
              <span className="font-medium text-foreground">{summary.neutral}%</span>
            </div>
            <div className="flex items-center justify-between gap-8">
              <span className="text-muted-foreground">Negative</span>
              <span className="font-medium text-foreground">{summary.negative}%</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function getKeywordTags(keywords: string[] | null | undefined): string[] {
  if (!Array.isArray(keywords)) return [];

  return Array.from(
    new Set(
      keywords
        .map((keyword) => keyword.trim())
        .filter(Boolean),
    ),
  );
}

interface OverviewItem {
  title: string;
  body: string;
}

function stripMarkdown(value: string): string {
  return value
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function parseOverviewItems(value: string | null | undefined): OverviewItem[] {
  const text = normalizeText(value);
  if (!text) return [];

  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\s+-\s+\*\*/g, "\n- **")
    .replace(/\s+-\s+/g, "\n- ");

  const bulletItems = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean);

  const items = bulletItems.length > 1 ? bulletItems : [normalized.trim()];

  return items.map((item) => {
    const clean = stripMarkdown(item);
    const [title, ...rest] = clean.split(/:\s+/);
    const body = rest.join(": ").trim();

    if (body) {
      return { title: title.trim(), body };
    }
    return { title: clean, body: "" };
  });
}

function formatOverview(value: string | null | undefined): string {
  return parseOverviewItems(value)
    .map((item) => (item.body ? `${item.title}: ${item.body}` : item.title))
    .join("; ");
}

function OverviewCell({
  value,
}: {
  value: string | null | undefined;
}): React.ReactElement {
  const items = parseOverviewItems(value);
  if (items.length === 0) {
    return (
      <span className="text-xs text-muted-foreground" title="No overview">
        —
      </span>
    );
  }

  const [firstItem] = items;
  const remainingCount = Math.max(0, items.length - 1);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="grid max-w-80 gap-0.5 whitespace-normal text-xs leading-snug">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-medium text-foreground/90">
                {firstItem.title}
              </span>
              {remainingCount > 0 ? (
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  +{remainingCount}
                </span>
              ) : null}
            </div>
            {firstItem.body ? (
              <span className="truncate text-muted-foreground">{firstItem.body}</span>
            ) : null}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-96 border bg-popover p-3 text-popover-foreground shadow-sm">
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={`${item.title}-${item.body}`} className="text-xs leading-relaxed">
                <span className="font-medium text-foreground">{item.title}</span>
                {item.body ? (
                  <span className="text-muted-foreground">: {item.body}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function formatKeywords(keywords: string[] | null | undefined): string {
  return getKeywordTags(keywords).join(", ");
}

function KeywordTagsCell({
  keywords,
  maxVisible = 3,
}: {
  keywords: string[] | null | undefined;
  maxVisible?: number;
}): React.ReactElement {
  const tags = getKeywordTags(keywords);
  if (tags.length === 0) {
    return (
      <span className="text-xs text-muted-foreground" title="No keywords">
        —
      </span>
    );
  }

  const visibleTags = tags.slice(0, maxVisible);
  const hiddenTags = tags.slice(maxVisible);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex max-w-60 flex-nowrap items-center gap-1 overflow-hidden">
            {visibleTags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="max-w-24 truncate rounded-sm border-border/70 bg-muted/40 px-1.5 py-0 text-[11px] font-normal text-muted-foreground"
              >
                {tag}
              </Badge>
            ))}
            {hiddenTags.length > 0 ? (
              <Badge
                variant="secondary"
                className="rounded-sm px-1.5 py-0 text-[11px] font-normal text-muted-foreground"
              >
                +{hiddenTags.length}
              </Badge>
            ) : null}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-80 border bg-popover p-3 text-popover-foreground shadow-sm">
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="rounded-sm border-border/70 bg-muted/40 px-1.5 py-0 text-[11px] font-normal text-muted-foreground"
              >
                {tag}
              </Badge>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Inline edit primitives ───────────────────────────────────────────────────

/**
 * Wraps a cell value in a hover-to-edit container.
 * When `isEditing`, renders `children` (the input).
 * When not editing, renders the display value with a subtle hover affordance.
 */
function EditableCellWrapper({
  isEditing,
  displayContent,
  onClickToEdit,
  children,
}: {
  isEditing: boolean;
  displayContent: React.ReactNode;
  onClickToEdit: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  if (isEditing) {
    return <>{children}</>;
  }
  const handleEditIntent = (event: React.MouseEvent) => {
    event.preventDefault();
    onClickToEdit(event);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      className="flex h-auto min-h-7 w-full cursor-pointer items-center justify-start rounded px-1 -mx-1 text-left font-normal transition-colors hover:bg-accent/20"
      onMouseDown={handleEditIntent}
      onClick={handleEditIntent}
    >
      {displayContent}
    </Button>
  );
}

function InlineTextInput({
  value,
  onChange,
  onSave,
  onCancel,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: (move?: "next" | "prev") => void;
  onCancel: () => void;
  placeholder?: string;
}) {
  return (
    <Input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => onSave()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onSave();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
          return;
        }
        if (e.key === "Tab") {
          e.preventDefault();
          onSave(e.shiftKey ? "prev" : "next");
        }
      }}
      onClick={(e) => e.stopPropagation()}
      autoFocus
      placeholder={placeholder}
      className="h-7 min-w-32 border-0 bg-accent/25 px-2 text-sm text-foreground focus-visible:ring-1"
    />
  );
}

function InlineDateInput({
  value,
  onChange,
  onSave,
  onCancel,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: (move?: "next" | "prev") => void;
  onCancel: () => void;
}) {
  return (
    <Input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => onSave()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onSave();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
          return;
        }
        if (e.key === "Tab") {
          e.preventDefault();
          onSave(e.shiftKey ? "prev" : "next");
        }
      }}
      onClick={(e) => e.stopPropagation()}
      autoFocus
      aria-label="Edit date"
      title="Edit date"
      className="h-7 w-auto border-0 bg-accent/25 px-2 text-sm text-foreground focus-visible:ring-1"
    />
  );
}

function InlineCategorySelect({
  value,
  categoryOptions,
  onSave,
  onCreateCategory,
  onCancel,
}: {
  value: string;
  categoryOptions: Array<{ value: string; label: string }>;
  onSave: (v: string, move?: "next" | "prev") => void;
  onCreateCategory: (value: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [open, setOpen] = React.useState(true);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [newCategory, setNewCategory] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);

  async function handleCreateCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCategory = newCategory.trim();
    if (!normalizedCategory) return;

    setIsCreating(true);
    const saved = await onCreateCategory(normalizedCategory);
    setIsCreating(false);
    if (saved) {
      setCreateDialogOpen(false);
      setNewCategory("");
    }
  }

  return (
    <>
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            e.preventDefault();
            onSave(value, e.shiftKey ? "prev" : "next");
          }
        }}
      >
        <Select
          open={open}
          onOpenChange={setOpen}
          value={value || "__none__"}
          onValueChange={(nextValue) => {
            if (nextValue === "__create_new_category__") {
              setOpen(false);
              setNewCategory("");
              setCreateDialogOpen(true);
              return;
            }
            onSave(nextValue === "__none__" ? "" : nextValue);
          }}
        >
          <SelectTrigger
            aria-label="Select category"
            title="Select category"
            className="h-7 min-w-32 border-0 bg-accent/25 px-2 text-sm text-foreground focus:ring-1"
          >
            <SelectValue placeholder="No category" />
          </SelectTrigger>
          <SelectContent onEscapeKeyDown={onCancel}>
            <SelectItem value="__none__">No category</SelectItem>
            {categoryOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
            <SelectItem value="__create_new_category__" className="text-primary">
              <span className="inline-flex items-center gap-2">
                <Plus className="h-3.5 w-3.5" />
                Create new category…
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Modal open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>Create new category</ModalTitle>
            <ModalDescription>Add a category and assign it to this meeting.</ModalDescription>
          </ModalHeader>
          <form onSubmit={handleCreateCategory}>
            <div className="space-y-2 py-2">
              <Label htmlFor="new-meeting-category">Category name</Label>
              <Input
                id="new-meeting-category"
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                placeholder="e.g. Client coordination"
                maxLength={100}
                disabled={isCreating}
                autoFocus
              />
            </div>
            <ModalFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating || !newCategory.trim()}>
                {isCreating ? "Creating…" : "Create category"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
}

// ─── Column builder ───────────────────────────────────────────────────────────

export function buildMeetingTableColumns(
  editContext?: EditContext,
  getMeetingHref: GetMeetingHref = defaultGetMeetingHref,
): TableColumn<Meeting>[] {
  return [
    // ── Title: link to project detail page ──────────────────────────────────
    {
      ...getMeetingColumn("title"),
      render: (item) => {
        const isEditing =
          editContext?.editingCell?.meetingId === item.id &&
          editContext?.editingCell?.field === "title";
        const titleText = item.title ?? "Untitled";

        if (isEditing) {
          return (
            <InlineTextInput
              value={editContext?.editingValue ?? ""}
              onChange={(v) => editContext?.setEditingValue(v)}
              onSave={(move) => editContext?.handleInlineSave({ move })}
              onCancel={() => editContext?.handleInlineCancel()}
              placeholder="Meeting title"
            />
          );
        }

        const embeddingStatus = getEmbeddingStatus(item);

        return (
          <div className="group/title inline-flex items-center gap-2 min-w-0 w-full">
            <TableStatusDot
              status={embeddingStatus.variant === "neutral" ? null : embeddingStatus.label}
              fallbackLabel={`Embedding: ${embeddingStatus.label}`}
            />
            <CellLink
              value={titleText}
              href={getMeetingHref(item)}
              className="font-medium truncate"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-auto shrink-0 opacity-0 group-hover/title:opacity-100 focus-visible:opacity-100"
              onClick={(event) => {
                event.stopPropagation();
                editContext?.handleCellClick(item, "title");
              }}
              aria-label="Edit meeting title"
              title="Edit title"
            >
              <Pencil />
            </Button>
          </div>
        );
      },
      csvValue: (item) => item.title ?? "",
      sortValue: (item) => item.title ?? "",
    },

    // ── Project: inline select ───────────────────────────────────────────────
    {
      ...getMeetingColumn("project"),
      render: (item) => {
        const selectedProjectValue = item.project_id
          ? String(item.project_id)
          : "__none__";
        const hasNoProject =
          selectedProjectValue === "__none__" ||
          (item.project ?? "").trim().toLowerCase() === "no project";

        return (
          <div className="w-full min-w-0 max-w-full" onClick={(event) => event.stopPropagation()}>
            <SearchableSelect
              options={[
                { value: "__none__", label: "No project" },
                ...(editContext?.projectOptions ?? []),
              ]}
              value={selectedProjectValue}
              onValueChange={(nextValue) => {
                void editContext?.handleInlineFieldSave(
                  item,
                  "project",
                  nextValue === "__none__" ? "" : nextValue,
                );
              }}
              placeholder="No project"
              searchPlaceholder="Search projects..."
              emptyMessage="No projects found."
              showIndicator={false}
              triggerVariant="ghost"
              className="w-full min-w-0"
              triggerClassName={cn(
                "h-7 w-full rounded-sm px-1 text-xs font-normal text-muted-foreground hover:bg-accent/20 focus-visible:ring-1",
                hasNoProject ? "text-red-600" : "text-muted-foreground",
              )}
            />
          </div>
        );
      },
      csvValue: (item) => item.project ?? "",
      sortValue: (item) => item.project ?? "",
    },

    // ── Date: inline editable ────────────────────────────────────────────────
    {
      ...getMeetingColumn("date"),
      render: (item) => {
        const isEditing =
          editContext?.editingCell?.meetingId === item.id &&
          editContext?.editingCell?.field === "date";

        return (
          <EditableCellWrapper
            isEditing={Boolean(isEditing)}
            displayContent={
              <TableDateValue value={item.date} showTime emptyLabel="No date" />
            }
            onClickToEdit={(e) => {
              e.stopPropagation();
              editContext?.handleCellClick(item, "date");
            }}
          >
            <InlineDateInput
              value={editContext?.editingValue ?? ""}
              onChange={(v) => editContext?.setEditingValue(v)}
              onSave={(move) => editContext?.handleInlineSave({ move })}
              onCancel={() => editContext?.handleInlineCancel()}
            />
          </EditableCellWrapper>
        );
      },
      csvValue: (item) => item.date ?? "",
      sortValue: (item) => (item.date ? new Date(item.date).getTime() : 0),
    },

    // ── Description: compact text preview ───────────────────────────────────
    {
      ...getMeetingColumn("description"),
      render: (item) => {
        const description = item.description?.trim();
        if (!description) {
          return null;
        }

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block max-w-48 truncate text-xs text-muted-foreground">
                  {description}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-96 border bg-popover p-3 text-popover-foreground shadow-sm">
                <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                  {description}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
      csvValue: (item) => item.description ?? "",
      sortValue: (item) => item.description ?? "",
    },

    // ── Participants: avatar stack with full tooltip ────────────────────────
    {
      ...getMeetingColumn("participants"),
      render: (item) => {
        const participants = parseParticipants(item);
        return <TableAvatarUsers users={participants} />;
      },
      csvValue: (item) => parseParticipants(item).join("; "),
      sortValue: (item) => parseParticipants(item).length,
    },

    // ── Sentiment: compact percentage preview ──────────────────────────────
    {
      ...getMeetingColumn("sentiment"),
      render: (item) => <SentimentCell value={item.sentiment} />,
      csvValue: (item) => formatSentiment(item.sentiment),
      sortValue: (item) => formatSentiment(item.sentiment),
      width: 124,
    },

    // ── Overview: compact takeaway preview ─────────────────────────────────
    {
      ...getMeetingColumn("overview"),
      render: (item) => <OverviewCell value={item.overview} />,
      csvValue: (item) => formatOverview(item.overview),
      sortValue: (item) => formatOverview(item.overview),
      width: 320,
    },

    // ── Action items: compact text preview ──────────────────────────────────
    {
      ...getMeetingColumn("action_items"),
      render: (item) => (
        <TextPreviewCell value={item.action_items} emptyLabel="No action items" />
      ),
      csvValue: (item) => item.action_items ?? "",
      sortValue: (item) => item.action_items ?? "",
      width: 240,
    },

    // ── Bullet points: compact text preview ─────────────────────────────────
    {
      ...getMeetingColumn("bullet_points"),
      render: (item) => (
        <TextPreviewCell value={item.bullet_points} emptyLabel="No bullet points" />
      ),
      csvValue: (item) => item.bullet_points ?? "",
      sortValue: (item) => item.bullet_points ?? "",
      width: 240,
    },

    // ── Duration: minutes formatted as h/m ──────────────────────────────────
    {
      ...getMeetingColumn("duration_minutes"),
      render: (item) => {
        const duration = formatDuration(item.duration_minutes);
        return duration ? (
          <span className="text-xs text-muted-foreground">{duration}</span>
        ) : (
          <EmptyCell />
        );
      },
      csvValue: (item) => formatDuration(item.duration_minutes),
      sortValue: (item) => item.duration_minutes ?? 0,
      width: 96,
    },

    // ── Summary: compact text preview ───────────────────────────────────────
    {
      ...getMeetingColumn("summary"),
      render: (item) => (
        <TextPreviewCell value={item.summary} emptyLabel="No summary" />
      ),
      csvValue: (item) => item.summary ?? "",
      sortValue: (item) => item.summary ?? "",
      width: 240,
    },

    // ── Content: transcript/content preview, hidden by default ──────────────
    {
      ...getMeetingColumn("content"),
      render: (item) => (
        <TextPreviewCell value={item.content} emptyLabel="No content" />
      ),
      csvValue: (item) => item.content ?? "",
      sortValue: (item) => item.content ?? "",
      width: 280,
    },

    // ── Type: inline text ────────────────────────────────────────────────────
    {
      ...getMeetingColumn("type"),
      render: (item) => {
        const isEditing =
          editContext?.editingCell?.meetingId === item.id &&
          editContext?.editingCell?.field === "type";

        return (
          <EditableCellWrapper
            isEditing={Boolean(isEditing)}
            displayContent={
              <TableTagBadge label={item.type} variant="secondary" emptyLabel="No type" />
            }
            onClickToEdit={(e) => {
              e.stopPropagation();
              editContext?.handleCellClick(item, "type");
            }}
          >
            <InlineTextInput
              value={editContext?.editingValue ?? ""}
              onChange={(v) => editContext?.setEditingValue(v)}
              onSave={(move) => editContext?.handleInlineSave({ move })}
              onCancel={() => editContext?.handleInlineCancel()}
              placeholder="Enter type…"
            />
          </EditableCellWrapper>
        );
      },
      csvValue: (item) => item.type ?? "",
      sortValue: (item) => item.type ?? "",
    },

    // ── Category: inline text ────────────────────────────────────────────────
    {
      ...getMeetingColumn("category"),
      render: (item) => {
        const isEditing =
          editContext?.editingCell?.meetingId === item.id &&
          editContext?.editingCell?.field === "category";

        return (
          <EditableCellWrapper
            isEditing={Boolean(isEditing)}
            displayContent={
              <TableTagBadge label={item.category} variant="outline" emptyLabel="No category" />
            }
            onClickToEdit={(e) => {
              e.stopPropagation();
              editContext?.handleCellClick(item, "category");
            }}
          >
            <InlineCategorySelect
              value={editContext?.editingValue ?? ""}
              categoryOptions={editContext?.categoryOptions ?? []}
              onCreateCategory={(value) =>
                editContext?.handleCreateCategory(value) ?? Promise.resolve(false)
              }
              onSave={(v, move) =>
                editContext?.handleInlineSave({ valueOverride: v, move })
              }
              onCancel={() => editContext?.handleInlineCancel()}
            />
          </EditableCellWrapper>
        );
      },
      csvValue: (item) => item.category ?? "",
      sortValue: (item) => item.category ?? "",
    },

    // ── Links: source and media actions ─────────────────────────────────────
    {
      ...getMeetingColumn("links"),
      render: (item) => {
        return (
          <div
            className="flex items-center gap-1"
            onClick={(event) => event.stopPropagation()}
          >
            {item.source && !item.source.includes("supabase.co/storage") ? (
              <MinimalIconLink href={item.source} icon={FileText} label="Transcript" />
            ) : null}
            {item.fireflies_link ? (
              <MinimalIconLink href={item.fireflies_link} icon={Zap} label="Fireflies recording" />
            ) : null}
            {item.video ? (
              <MinimalIconLink href={item.video} icon={Video} label="Video" />
            ) : null}
            {item.audio ? (
              <MinimalIconLink href={item.audio} icon={Headphones} label="Audio" />
            ) : null}
          </div>
        );
      },
      csvValue: (item) =>
        [
          item.source ? "transcript" : "",
          item.fireflies_link ? "fireflies" : "",
          item.video ? "video" : "",
          item.audio ? "audio" : "",
        ]
          .filter(Boolean)
          .join(", "),
      sortValue: (item) => {
        return [
          item.source ? "transcript" : "",
          item.fireflies_link ? "fireflies" : "",
          item.video ? "video" : "",
          item.audio ? "audio" : "",
        ]
          .filter(Boolean)
          .join(",");
      },
    },

    // ── Embedding: summary vectorization status ─────────────────────────────
    {
      ...getMeetingColumn("embedding"),
      render: (item) => {
        const status = getEmbeddingStatus(item);
        return <StatusBadge status={status.label} variant={status.variant} />;
      },
      csvValue: (item) => getEmbeddingStatus(item).label,
      sortValue: (item) => getEmbeddingStatus(item).sortValue,
      sortable: true,
      editable: false,
    },

    // ── Keywords: compact tag preview, positioned as the last column ────────
    {
      ...getMeetingColumn("keywords"),
      render: (item) => <KeywordTagsCell keywords={item.keywords} />,
      csvValue: (item) => formatKeywords(item.keywords),
      sortValue: (item) => formatKeywords(item.keywords),
      width: 220,
    },
  ];
}

// ─── Row actions ──────────────────────────────────────────────────────────────

export function renderMeetingRowActions(
  item: Meeting,
  onOpenMeetingPage: (meeting: Meeting) => void,
  onEdit: (meeting: Meeting) => void,
  onDelete: (meeting: Meeting) => void,
  onOpenSource: (meeting: Meeting) => void,
  onOpenRecording: (meeting: Meeting) => void,
  onDownloadPdf: (meeting: Meeting) => void,
  onDownloadMarkdown: (meeting: Meeting) => void,
): React.ReactElement {
  return (
    <TableRowActionsMenu
      items={[
        {
          key: "open",
          label: "Open meeting page",
          icon: ArrowUpRight,
          onSelect: () => onOpenMeetingPage(item),
        },
        {
          key: "edit",
          label: "Edit details",
          icon: Pencil,
          onSelect: () => onEdit(item),
        },
        ...(item.source
          ? [
              {
                key: "source",
                label: "View transcript",
                icon: FileText,
                onSelect: () => onOpenSource(item),
              },
            ]
          : []),
        ...(item.fireflies_link
          ? [
              {
                key: "fireflies",
                label: "View Fireflies",
                icon: Zap,
                onSelect: () => onOpenRecording(item),
              },
            ]
          : []),
        {
          key: "download-markdown",
          label: "Download markdown",
          icon: FileText,
          onSelect: () => onDownloadMarkdown(item),
        },
        {
          key: "download-pdf",
          label: "Download transcript PDF",
          icon: Download,
          onSelect: () => onDownloadPdf(item),
        },
        {
          key: "delete",
          label: "Delete",
          icon: Trash2,
          onSelect: () => onDelete(item),
          destructive: true,
        },
      ]}
    />
  );
}

// ─── Card / list renderers ────────────────────────────────────────────────────

export function renderMeetingCard(item: Meeting, onClick: (meeting: Meeting) => void): React.ReactElement {
  return (
    <div
      className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => onClick(item)}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <TableDateValue value={item.date} className="uppercase text-muted-foreground" />
          {/* eslint-disable-next-line design-system/no-raw-heading */}
          <h3 className="font-medium">{item.title ?? "Untitled Meeting"}</h3>
        </div>
        <TableTagBadge label={item.type} variant="secondary" />
      </div>
      <p className="text-sm text-muted-foreground">{item.project ?? "—"}</p>
      {item.category && (
        <p className="text-sm text-muted-foreground mt-1">{item.category}</p>
      )}
    </div>
  );
}

export function renderMeetingList(item: Meeting, onClick: (meeting: Meeting) => void): React.ReactElement {
  return (
    <div
      className="flex items-center justify-between py-2 px-3 rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => onClick(item)}
    >
      <div>
        <p className="text-sm font-medium">{item.title ?? "Untitled Meeting"}</p>
        <TableDateValue value={item.date} className="text-muted-foreground" />
      </div>
      <TableTagBadge label={item.type} variant="secondary" />
    </div>
  );
}

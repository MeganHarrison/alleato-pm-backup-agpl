"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CheckSquare2,
  Clock,
  Flag,
  FolderOpen,
  KanbanSquare,
  ListFilter,
  Loader2,
  PanelLeft,
  Pencil,
  Tag,
  Table2,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { format } from "date-fns";

import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
} from "@/components/tables/unified";
import { TaskFeedbackButtons } from "@/components/ai/TaskFeedbackButtons";
import { SwipeableListRow } from "@/components/ds/SwipeableListRow";
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
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DetailPropertyBar,
  DetailPropertyItem,
} from "@/components/ui/detail-property-bar";
import { SplitPage, SplitPageFrame } from "@/components/ui/split-page";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { appToast as toast } from "@/lib/toast/app-toast";
import { getErrorDetail } from "@/lib/format-error";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import { useConfirm } from "@/hooks/use-confirm";
import { useCurrentUserProfile } from "@/hooks/use-current-user-profile";
import {
  type TasksRow,
  getTaskCategory,
  getTaskSourceLabel,
  getTaskSourceTitle,
  getTaskSourceTarget,
} from "@/features/tasks/task-utils";
import {
  buildTaskFeedbackSnapshot,
  buildTasksFilters,
  buildTasksTableColumns,
  getTaskProjectId,
  isAiGeneratedTask,
  renderTasksRowActions,
  tasksColumns,
  tasksDefaultVisibleColumns,
} from "@/features/tasks/tasks-table-config";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import { Markdown } from "@/components/misc/markdown";
import { TasksBoardView } from "@/features/tasks/tasks-board-view";
import {
  parseTasksWorkSurfaceState,
  serializeTaskFilterParams,
  taskMatchesWorkSurfaceFilters,
  taskViewParam,
} from "@/features/tasks/tasks-work-surface-state";
import {
  type EmailThreadMessage,
  type MeetingContextItem,
  type MeetingContextSection,
  type TeamsConversationMessage,
  cleanSourceContextText,
  parseEmailThread,
  parseMeetingContext,
  parseTeamsConversation,
} from "@/features/tasks/email-thread-parser";
import { NewTaskDialog } from "@/features/tasks/new-task-dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Scope = "mine" | "all";
type StatusFilter = "open" | "done";
type DisplayStatus = "open" | "in_progress" | "done";
type TasksFilterState = Record<string, FilterValue>;
type TaskPatch = {
  description?: string;
  status?: string;
  due_date?: string | null;
  project_id?: number | null;
  category?: string | null;
  priority?: string | null;
  assignee_user_id?: string | null;
};

type ProjectOption = {
  id: number;
  name: string | null;
  project_number?: string | null;
  "job number"?: string | null;
};

type UserOption = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  person_id?: string | null;
};

function notifyTasksFailure({
  operation,
  title,
  fallback,
  error,
  metadata,
}: {
  operation: string;
  title: string;
  fallback: string;
  error: unknown;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}) {
  const description = getErrorDetail(error);
  reportNonCriticalFailure({
    area: "tasks-table",
    operation,
    error,
    userVisibleFallback: fallback,
    metadata,
  });
  toast.error(title, { description });
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TASK_CATEGORIES = [
  "Accounting",
  "Compliance",
  "Design",
  "Estimating",
  "General",
  "Operations",
];

const TASK_PRIORITY_OPTIONS = [
  { value: "__none__", label: "Not set" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "done", label: "Done" },
];

export const TASKS_SPLIT_WORKSPACE_CLASSNAME =
  "relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-background";
export const TASKS_SPLIT_FIRST_PANE_WIDTH = "30rem";

const DONE_STATUSES = new Set(["complete", "closed", "done", "cancelled"]);
const IN_PROGRESS_STATUSES = new Set(["in_progress", "started", "active"]);
const EMPTY_FILTERS: TasksFilterState = {
  status: "open",
  source_system: undefined,
};

const PANEL_MIN_PCT = 20;
const PANEL_MAX_PCT = 75;
const PANEL_DEFAULT_PCT = 50;
const PANEL_STORAGE_KEY = "tasks-inbox-panel-pct";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDisplayStatus(status: string | null): DisplayStatus {
  const s = (status ?? "").toLowerCase();
  if (DONE_STATUSES.has(s)) return "done";
  if (IN_PROGRESS_STATUSES.has(s)) return "in_progress";
  return "open";
}

function getSavedPanelPct(): number {
  if (typeof window === "undefined") return PANEL_DEFAULT_PCT;
  try {
    const saved = localStorage.getItem(PANEL_STORAGE_KEY);
    if (saved) {
      const pct = parseFloat(saved);
      if (pct >= PANEL_MIN_PCT && pct <= PANEL_MAX_PCT) return pct;
    }
  } catch (error) {
    console.warn("[tasks] Failed to read saved task panel width.", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return PANEL_DEFAULT_PCT;
}

function isOverdue(dueDateStr: string | null): boolean {
  if (!dueDateStr) return false;
  return new Date(dueDateStr).getTime() < Date.now();
}

function formatShortDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, "MMM d, yyyy");
}

const TASK_LIST_MIN_WIDTH = "69.5rem";
const TASK_LIST_GRID_TEMPLATE =
  "44px minmax(18rem, 1.7fr) minmax(10rem, 0.9fr) minmax(8rem, 0.75fr) minmax(7rem, 0.65fr) minmax(6.5rem, 0.55fr) minmax(6.5rem, 0.55fr) minmax(7rem, 0.65fr) minmax(6.5rem, 0.5fr)";
const TASK_LIST_PINNED_TASK_LEFT = "44px";
const DETAIL_META_SELECT_CLASS =
  "h-7 w-auto min-w-0 max-w-44 gap-1 border-0 bg-transparent px-0 text-sm font-medium shadow-none hover:bg-transparent focus:ring-0 data-[state=open]:bg-transparent [&>svg]:ml-0.5 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:text-muted-foreground/60";
const DETAIL_META_DATE_TRIGGER_CLASS =
  "h-7 min-w-0 justify-start gap-1.5 px-0 text-sm font-medium text-foreground hover:bg-transparent";

export const TASK_DETAIL_PROPERTY_BAR_CLASSNAME = "mt-3 mb-0";
export const TASK_DETAIL_SECONDARY_PROPERTY_BAR_CLASSNAME = "mt-2 mb-0 pb-0";

function TaskListHeader({
  allVisibleSelected,
  someVisibleSelected,
  visibleTaskIds,
  selectedTaskIds,
  onToggleVisibleSelection,
}: {
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  visibleTaskIds: string[];
  selectedTaskIds: string[];
  onToggleVisibleSelection: (checked: boolean) => void;
}) {
  return (
    <div
      className="sticky top-0 z-40 grid items-center border-b border-border/40 bg-background text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
      style={{
        gridTemplateColumns: TASK_LIST_GRID_TEMPLATE,
        minWidth: TASK_LIST_MIN_WIDTH,
      }}
    >
      <div className="sticky left-0 z-50 flex h-9 items-center justify-center bg-background">
        <Checkbox
          checked={
            allVisibleSelected
              ? true
              : someVisibleSelected
                ? "indeterminate"
                : false
          }
          onCheckedChange={(value) => onToggleVisibleSelection(value === true)}
          disabled={visibleTaskIds.length === 0}
          aria-label="Select visible tasks"
        />
      </div>
      <div
        className="sticky z-40 h-9 border-r border-border/40 bg-background px-2 leading-9"
        style={{ left: TASK_LIST_PINNED_TASK_LEFT }}
      >
        Task
      </div>
      <div className="px-2">Project</div>
      <div className="px-2">Assigned</div>
      <div className="px-2">Source</div>
      <div className="px-2">Source date</div>
      <div className="px-2">Date assigned</div>
      <div className="px-2">Assigned by</div>
      <div className="px-2">Priority</div>
      <span className="sr-only">
        {selectedTaskIds.length > 0
          ? `${selectedTaskIds.length} selected`
          : "No tasks selected"}
      </span>
    </div>
  );
}

function formatPriorityLabel(priority: string | null): string {
  if (!priority) return "Not set";
  return `${priority.charAt(0).toUpperCase()}${priority.slice(1).toLowerCase()}`;
}

function projectOptionLabel(project: ProjectOption): string {
  const projectNumber = project.project_number ?? project["job number"] ?? null;
  return projectNumber
    ? `${projectNumber} - ${project.name ?? "Unnamed project"}`
    : (project.name ?? `Project ${project.id}`);
}

function taskProjectLabel(task: TasksRow, projects: ProjectOption[]): string {
  if (task.project_name) return task.project_name;

  const projectId = task.project_id ?? task.project_ids?.[0] ?? null;
  if (!projectId) return "Unassigned";

  const project = projects.find((item) => item.id === projectId);
  return project ? projectOptionLabel(project) : `Project ${projectId}`;
}

function userOptionLabel(user: UserOption): string {
  return user.full_name || user.email || "Unnamed user";
}

const COLLAPSED_CONTEXT_CHARS = 1800;

function formatContextDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTeamsMessageTime(value: string): string {
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTeamsConversationDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return formatContextDate(value) ?? value;

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  ).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function splitContextParagraphs(value: string): string[] {
  if (!value.trim()) return [];

  const cleanParagraph = (paragraph: string) =>
    paragraph
      .replace(/[^\S\n]+/g, " ")
      .replace(/\s([,.;:!?])/g, "$1")
      .trim();

  const naturalParagraphs = value
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (naturalParagraphs.length > 1) {
    return naturalParagraphs.flatMap((paragraph) => {
      const lines = paragraph.split(/\n+/).map(cleanParagraph).filter(Boolean);
      return lines.length > 1 ? lines : [cleanParagraph(paragraph)];
    });
  }

  const explicitLines = value.split(/\n+/).map(cleanParagraph).filter(Boolean);

  if (explicitLines.length > 1) {
    return explicitLines;
  }

  const normalized = value
    .replace(/[^\S\n]+/g, " ")
    .replace(/\s([,.;:!?])/g, "$1")
    .trim();

  const sentences = normalized
    .split(
      /(?<=[.!?])\s+(?=(?:[A-Z@]|\d|Thanks|Thank you|Please|Who|See|Let|Can|I|We)\b)/,
    )
    .map((part) => part.trim())
    .filter(Boolean);

  const paragraphs: string[] = [];
  let current = "";

  sentences.forEach((sentence) => {
    if (!current) {
      current = sentence;
      return;
    }

    if (current.length + sentence.length > 360) {
      paragraphs.push(current);
      current = sentence;
      return;
    }

    current = `${current} ${sentence}`;
  });

  if (current) paragraphs.push(current);
  return paragraphs.length > 0 ? paragraphs : [normalized];
}

type ContextTextBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "bullet"; text: string };

function splitMeetingContextText(value: string): ContextTextBlock[] {
  const cleanText = value
    .replace(/\s+##\s+/g, "\n## ")
    .replace(/\s+-\s+/g, "\n- ")
    .replace(/[^\S\n]+/g, " ")
    .trim();

  if (!cleanText) return [];

  return cleanText
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/[^\S\n]+/g, " ")
        .replace(/\s([,.;:!?])/g, "$1")
        .trim(),
    )
    .filter(Boolean)
    .map((line): ContextTextBlock => {
      if (line.startsWith("##")) {
        const headingText = line.replace(/^#+\s*/, "").trim();
        if (headingText.length > 80) {
          return {
            type: "paragraph",
            text: headingText,
          };
        }

        return {
          type: "heading",
          text: headingText,
        };
      }

      if (line.startsWith("-")) {
        return {
          type: "bullet",
          text: line.replace(/^-\s*/, "").trim(),
        };
      }

      return { type: "paragraph", text: line };
    })
    .filter((block) => block.text.length > 0);
}

function TeamsMessageRow({ message }: { message: TeamsConversationMessage }) {
  return (
    <article className="grid gap-2 border-b border-border/30 py-3 last:border-b-0 sm:grid-cols-[128px_minmax(0,1fr)]">
      <div className="min-w-0 space-y-0.5">
        <div className="truncate text-xs font-semibold text-foreground">
          {message.author}
        </div>
        <time className="block text-[11px] leading-4 text-muted-foreground">
          {formatTeamsMessageTime(message.date)}
        </time>
      </div>
      <div className="min-w-0 text-xs leading-5 text-foreground">
        {splitContextParagraphs(message.body).map((paragraph, index) => (
          <p key={`${message.date}-${index}`} className="break-words">
            {paragraph}
          </p>
        ))}
      </div>
    </article>
  );
}

function MeetingContextItemRow({ item }: { item: MeetingContextItem }) {
  return (
    <div className="grid gap-1 border-b border-border/30 py-3 last:border-b-0 sm:grid-cols-[150px_minmax(0,1fr)]">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {item.label}
      </div>
      <div className="min-w-0 space-y-2 text-xs leading-5 text-foreground">
        {splitContextParagraphs(item.body).map((paragraph, index) => (
          <p key={`${item.label}-${index}`} className="break-words">
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );
}

function MeetingContextSectionBlock({
  section,
}: {
  section: MeetingContextSection;
}) {
  const bodyBlocks = section.body ? splitMeetingContextText(section.body) : [];

  return (
    <section className="space-y-3 border-b border-border/35 py-4 first:pt-0 last:border-b-0 last:pb-0">
      <div className="text-xs font-semibold text-foreground">
        {section.title}
      </div>
      {bodyBlocks.length > 0 && (
        <div className="space-y-3 text-xs leading-5 text-foreground">
          {bodyBlocks.map((block, index) => {
            if (block.type === "heading") {
              return (
                <p
                  key={`${section.title}-heading-${index}`}
                  className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {block.text}
                </p>
              );
            }

            if (block.type === "bullet") {
              return (
                <div
                  key={`${section.title}-bullet-${index}`}
                  className="grid grid-cols-[0.625rem_minmax(0,1fr)] gap-2"
                >
                  <span className="mt-2 h-1 w-1 rounded-full bg-muted-foreground/60" />
                  <p className="min-w-0 break-words">{block.text}</p>
                </div>
              );
            }

            return (
              <p
                key={`${section.title}-paragraph-${index}`}
                className="break-words"
              >
                {block.text}
              </p>
            );
          })}
        </div>
      )}
      {section.items.length > 0 && (
        <div>
          {section.items.map((item) => (
            <MeetingContextItemRow
              key={`${section.title}-${item.label}`}
              item={item}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ContextBody({
  value,
  collapsedChars = COLLAPSED_CONTEXT_CHARS,
}: {
  value: string;
  collapsedChars?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const normalizedValue = normalizeTaskMarkdownContext(value);
  const isLong = normalizedValue.length > collapsedChars;
  const visibleBody =
    !isLong || expanded
      ? normalizedValue
      : `${normalizedValue.slice(0, collapsedChars).trim()}...`;

  return (
    <div className="space-y-2">
      <Markdown className="text-sm leading-6 text-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_em]:italic [&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mb-1.5 [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-medium [&_li]:mb-1 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_p]:leading-6 last:[&_p]:mb-0 [&_strong]:font-semibold [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5">
        {visibleBody}
      </Markdown>
      {isLong && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto px-0 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Show less" : "Show full message"}
        </Button>
      )}
    </div>
  );
}

function isEmailSourceContext(value: string): boolean {
  return (
    /\bSubject:\s/i.test(value) ||
    /\bFrom:\s+[^<\n]{0,160}<[^>\n]+>/i.test(value)
  );
}

function MessageCard({ message }: { message: EmailThreadMessage }) {
  const sentLabel = formatContextDate(message.date);

  return (
    <article className="space-y-3 border-b border-border/35 py-4 last:border-b-0 last:pb-0 first:pt-0">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="min-w-0 truncate text-xs font-semibold text-foreground">
          {message.subject ?? message.from ?? "Email message"}
        </div>
        {sentLabel && (
          <time className="shrink-0 text-[11px] font-medium text-muted-foreground">
            {sentLabel}
          </time>
        )}
      </div>
      <div className="grid gap-1 text-[11px] leading-4 text-muted-foreground sm:grid-cols-[56px_minmax(0,1fr)]">
        {message.from && (
          <>
            <span className="font-medium uppercase tracking-wide">From</span>
            <span className="min-w-0 truncate">{message.from}</span>
          </>
        )}
        {message.to && (
          <>
            <span className="font-medium uppercase tracking-wide">To</span>
            <span className="min-w-0 truncate">{message.to}</span>
          </>
        )}
      </div>
      <ContextBody value={message.body} collapsedChars={900} />
    </article>
  );
}

function SourceContextBlock({ value }: { value: string }) {
  const text = normalizeTaskMarkdownContext(value);
  const teamsConversation = parseTeamsConversation(text);

  if (teamsConversation && teamsConversation.messages.length > 0) {
    return (
      <div className="w-full">
        <div className="mb-2 flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div className="min-w-0 truncate text-xs font-semibold text-foreground">
            Teams: {teamsConversation.title}
          </div>
          {teamsConversation.date && (
            <time className="shrink-0 text-[11px] font-medium text-muted-foreground">
              {formatTeamsConversationDate(teamsConversation.date)}
            </time>
          )}
        </div>
        <div className="divide-y-0">
          {teamsConversation.messages.map((message) => (
            <TeamsMessageRow
              key={`${message.date}-${message.author}`}
              message={message}
            />
          ))}
        </div>
      </div>
    );
  }

  const meetingContext = parseMeetingContext(text);

  if (meetingContext && meetingContext.sections.length > 0) {
    return (
      <div className="w-full">
        {meetingContext.sections.map((section, index) => (
          <MeetingContextSectionBlock
            key={`${section.title}-${index}`}
            section={section}
          />
        ))}
      </div>
    );
  }

  const messages = isEmailSourceContext(text) ? parseEmailThread(text) : [];

  if (messages.length > 1) {
    return (
      <div className="w-full">
        {messages.map((message, index) => (
          <MessageCard
            key={`${message.subject ?? "message"}-${message.date ?? index}`}
            message={message}
          />
        ))}
      </div>
    );
  }

  const message = messages[0];
  const body = (message?.body ?? text) || text;

  return (
    <div className="w-full">
      <ContextBody value={body} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visual tokens
// ---------------------------------------------------------------------------

const STATUS_SELECT_CLASSES: Record<DisplayStatus, string> = {
  done: "text-emerald-700 dark:text-emerald-400",
  // "Open" is the neutral default state — keep it quiet (no orange, which is the
  // AI/brain accent color and would blend in rather than differentiate).
  open: "text-muted-foreground",
  in_progress: "text-blue-700 dark:text-blue-400",
};

// High priority is the only urgent signal — red text on a light-red background,
// matching the product board. Medium/low stay muted and consistent with the
// other neutral tags. No orange (reserved for the AI/brain accent).
const PRIORITY_META: Record<
  string,
  { dot: string; badge: string; label: string }
> = {
  high: {
    dot: "bg-destructive",
    badge: "bg-destructive/10 text-destructive",
    label: "High priority",
  },
  medium: {
    dot: "bg-muted-foreground/50",
    badge: "bg-muted text-foreground",
    label: "Medium priority",
  },
  low: {
    dot: "bg-muted-foreground/30",
    badge: "bg-muted text-muted-foreground",
    label: "Low priority",
  },
};

// ---------------------------------------------------------------------------
// Resizable Panel Hook
// ---------------------------------------------------------------------------

function useResizablePanel(
  containerRef: React.RefObject<HTMLDivElement | null>,
) {
  const [leftPct, setLeftPct] = useState(PANEL_DEFAULT_PCT);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startPct = useRef(PANEL_DEFAULT_PCT);

  useEffect(() => {
    setLeftPct(getSavedPanelPct());
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      startX.current = e.clientX;
      startPct.current = leftPct;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [leftPct],
  );

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!isDragging.current) return;
      const containerWidth =
        containerRef.current?.offsetWidth ?? window.innerWidth;
      const deltaPct = ((e.clientX - startX.current) / containerWidth) * 100;
      const newPct = Math.min(
        PANEL_MAX_PCT,
        Math.max(PANEL_MIN_PCT, startPct.current + deltaPct),
      );
      setLeftPct(newPct);
    }
    function handleMouseUp() {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        localStorage.setItem(PANEL_STORAGE_KEY, String(leftPct));
      } catch (error) {
        reportNonCriticalFailure({
          area: "tasks-table",
          operation: "save-panel-width",
          error,
          userVisibleFallback: "Task panel width was not saved locally.",
          metadata: { leftPct },
        });
      }
    }
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [containerRef, leftPct]);

  return { leftPct, handleMouseDown };
}

// ---------------------------------------------------------------------------
// TaskListItem
// ---------------------------------------------------------------------------

export function TaskListItem({
  item,
  projects,
  isSelected,
  isChecked,
  onClick,
  onCheckedChange,
  onDelete,
}: {
  item: TasksRow;
  projects: ProjectOption[];
  isSelected: boolean;
  isChecked: boolean;
  onClick: () => void;
  onCheckedChange: (checked: boolean) => void;
  onDelete?: () => void;
}) {
  const ds = toDisplayStatus(item.status);
  const sourceLabel = getTaskSourceLabel(item);
  const priority = (item.priority ?? "").toLowerCase();
  const priorityMeta = PRIORITY_META[priority];
  const priorityLabel = item.priority
    ? formatPriorityLabel(item.priority)
    : "—";
  const isDone = ds === "done";
  const assignedBy = item.assigned_by ?? "—";
  const assignedDate = formatShortDate(item.created_at);
  const sourceDate = formatShortDate(item.source_date);
  const assignedTo = item.assignee_name ?? item.assignee_email ?? "Unassigned";
  const projectLabel = taskProjectLabel(item, projects);
  const pinnedCellClassName = isSelected
    ? "bg-accent"
    : "bg-background group-hover:bg-muted/50";

  return (
    <SwipeableListRow onEdit={onClick} onDelete={onDelete}>
      <div
        role="button"
        tabIndex={0}
        data-task-item
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick();
          }
        }}
        className={cn(
          "group grid cursor-pointer items-center border-b border-border/30 text-sm transition-colors",
          isSelected ? "bg-accent" : "hover:bg-muted/50",
        )}
        style={{
          gridTemplateColumns: TASK_LIST_GRID_TEMPLATE,
          minWidth: TASK_LIST_MIN_WIDTH,
        }}
      >
        <div
          className={cn(
            "sticky left-0 z-20 flex min-h-12 self-stretch items-center justify-center",
            pinnedCellClassName,
          )}
        >
          <Checkbox
            checked={isChecked}
            onCheckedChange={(value) => onCheckedChange(value === true)}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Select ${item.description || item.title || "task"}`}
          />
        </div>
        <div
          className={cn(
            "sticky z-10 flex min-h-12 min-w-0 self-stretch items-start gap-2 overflow-hidden border-r border-border/30 px-2 py-2.5",
            pinnedCellClassName,
          )}
          style={{ left: TASK_LIST_PINNED_TASK_LEFT }}
        >
          <div className="min-w-0 flex-1 overflow-hidden">
            <p
              className={cn(
                "line-clamp-2 min-w-0 text-sm leading-snug",
                isSelected
                  ? "font-medium text-foreground"
                  : "text-foreground/90",
                isDone &&
                  "text-muted-foreground line-through decoration-muted-foreground/40",
              )}
            >
              {item.description || item.title || "Untitled task"}
            </p>
          </div>
        </div>
        <div
          className="min-w-0 truncate px-2 text-sm text-muted-foreground"
          title={projectLabel}
        >
          {projectLabel}
        </div>
        <div
          className="min-w-0 truncate px-2 text-sm text-foreground"
          title={assignedTo}
        >
          {assignedTo}
        </div>
        <div
          className="min-w-0 truncate px-2 text-sm text-muted-foreground"
          title={sourceLabel}
        >
          {sourceLabel || "—"}
        </div>
        <div
          className="min-w-0 truncate px-2 text-sm text-muted-foreground"
          title={sourceDate}
        >
          {sourceDate}
        </div>
        <div
          className="min-w-0 truncate px-2 text-sm text-muted-foreground"
          title={assignedDate}
        >
          {assignedDate}
        </div>
        <div
          className="min-w-0 truncate px-2 text-sm text-muted-foreground"
          title={assignedBy}
        >
          {assignedBy}
        </div>
        <div
          className="min-w-0 truncate px-2 text-sm text-muted-foreground"
          title={priorityLabel}
        >
          <span className="inline-flex min-w-0 items-center gap-1.5">
            {priorityMeta && (
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  priorityMeta.dot,
                )}
              />
            )}
            <span className="truncate">{priorityLabel}</span>
          </span>
        </div>
      </div>
    </SwipeableListRow>
  );
}

function TaskSplitListItem({
  item,
  projects,
  isSelected,
  isChecked,
  onClick,
  onCheckedChange,
}: {
  item: TasksRow;
  projects: ProjectOption[];
  isSelected: boolean;
  isChecked: boolean;
  onClick: () => void;
  onCheckedChange: (checked: boolean) => void;
}) {
  const ds = toDisplayStatus(item.status);
  const priority = (item.priority ?? "").toLowerCase();
  const priorityMeta = PRIORITY_META[priority];
  const sourceLabel = getTaskSourceLabel(item);
  const projectLabel = taskProjectLabel(item, projects);
  const assignedTo = item.assignee_name ?? item.assignee_email ?? "Unassigned";
  const dateLabel = formatShortDate(item.source_date ?? item.created_at);

  return (
    <div
      role="button"
      tabIndex={0}
      data-task-item
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group flex cursor-pointer gap-2.5 border-b border-border/40 px-5 py-3 text-left transition-colors",
        isSelected
          ? "bg-muted/55"
          : "hover:bg-muted/30",
      )}
    >
      <Checkbox
        checked={isChecked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        onClick={(event) => event.stopPropagation()}
        aria-label={`Select ${item.description || item.title || "task"}`}
        className="mt-0.5 shrink-0"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <p
            className={cn(
              "line-clamp-1 text-sm font-medium leading-5 text-foreground",
              ds === "done" &&
                "text-muted-foreground line-through decoration-muted-foreground/40",
            )}
          >
            {item.description || item.title || "Untitled task"}
          </p>
          <span className="shrink-0 text-xs text-muted-foreground">
            {dateLabel}
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 overflow-hidden text-xs text-muted-foreground">
          <span className="max-w-48 truncate">{projectLabel}</span>
          <span className="max-w-32 truncate">{assignedTo}</span>
          {sourceLabel ? (
            <span className="max-w-32 truncate">{sourceLabel}</span>
          ) : null}
          {priorityMeta ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className={cn("h-1.5 w-1.5 rounded-full", priorityMeta.dot)}
              />
              {formatPriorityLabel(priority)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function normalizeTaskMarkdownContext(value: string): string {
  return cleanSourceContextText(value)
    .replace(/^\s*\{\}\s*$/gm, "")
    .trim();
}

function parseTaskDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("T")[0]?.split("-").map(Number) ?? [];
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function TaskDueDatePicker({
  value,
  overdue,
  disabled,
  onChange,
}: {
  value: string | null;
  overdue: boolean;
  disabled: boolean;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedDate = parseTaskDate(value);
  const dueLabel = selectedDate
    ? format(selectedDate, "MMM d, yyyy")
    : "Not set";

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            className={cn(
              DETAIL_META_DATE_TRIGGER_CLASS,
              !selectedDate && "text-muted-foreground",
            )}
            aria-label="Task due date"
          >
            <span>{dueLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              onChange(date ? format(date, "yyyy-MM-dd") : null);
              setOpen(false);
            }}
          />
          {selectedDate && (
            <div className="border-t px-3 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-full justify-start px-2 text-xs"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                Clear due date
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {value && overdue && (
        <span className="text-xs font-medium text-destructive">Overdue</span>
      )}
    </div>
  );
}

function updateTaskCategoryLocally(
  task: TasksRow,
  category: string | null,
): TasksRow {
  const metadata =
    typeof task.extraction_metadata === "object" &&
    task.extraction_metadata !== null &&
    !Array.isArray(task.extraction_metadata)
      ? { ...(task.extraction_metadata as Record<string, unknown>) }
      : {};

  if (category) {
    metadata.task_category = category;
  } else {
    delete metadata.task_category;
  }

  return { ...task, extraction_metadata: metadata };
}

// ---------------------------------------------------------------------------
// TaskDetail
// ---------------------------------------------------------------------------

function TaskDetail({
  task,
  updatingId,
  deletingId,
  onUpdateStatus,
  onUpdateTask,
  onDelete,
  onBack,
  projects,
  projectsLoading,
  users,
  usersLoading,
}: {
  task: TasksRow;
  updatingId: string | null;
  deletingId: string | null;
  onUpdateStatus: (id: string, status: string) => void;
  onUpdateTask: (
    id: string,
    patch: TaskPatch,
    localPatch?: Partial<TasksRow>,
  ) => Promise<boolean> | boolean;
  onDelete: (id: string) => void;
  onBack?: () => void;
  projects: ProjectOption[];
  projectsLoading: boolean;
  users: UserOption[];
  usersLoading: boolean;
}) {
  const selectedAssigneeValue = task.assignee_person_id
    ? `person:${task.assignee_person_id}`
    : task.assignee_email
      ? `email:${task.assignee_email.toLowerCase()}`
      : "__unassigned__";
  const matchedAssigneeUser =
    users.find(
      (u) =>
        u.person_id &&
        task.assignee_person_id &&
        u.person_id === task.assignee_person_id,
    ) ??
    users.find(
      (u) =>
        u.email &&
        task.assignee_email &&
        u.email.toLowerCase() === task.assignee_email?.toLowerCase(),
    ) ??
    null;
  const fallbackAssigneeLabel =
    task.assignee_name || task.assignee_email || null;
  const [isEditingText, setIsEditingText] = useState(false);
  const [taskTextDraft, setTaskTextDraft] = useState(
    task.description || task.title || "",
  );
  const taskTextInputRef = useRef<HTMLTextAreaElement | null>(null);
  const ds = toDisplayStatus(task.status);
  const sourceLabel = getTaskSourceLabel(task);
  const sourceTitle = getTaskSourceTitle(task);
  const sourceTarget = getTaskSourceTarget(task);
  const category = getTaskCategory(task);
  const overdue = isOverdue(task.due_date);
  const { confirm: confirmDelete, ConfirmDialog } = useConfirm();
  const sourceLinkLabel = sourceTitle || sourceTarget?.href || sourceLabel;
  const taskProjectId = task.project_id ?? task.project_ids?.[0] ?? null;
  const selectedProjectValue = taskProjectId
    ? String(taskProjectId)
    : "__none__";
  const projectPropertyLabel = taskProjectLabel(task, projects);
  const selectedCategoryValue = category || "__none__";
  const selectedPriorityValue =
    task.priority?.trim().toLowerCase() || "__none__";
  const taskFeedbackSnapshot = {
    ...buildTaskFeedbackSnapshot(task),
    notes: task.assigned_by ? `Assigned by ${task.assigned_by}` : null,
  };
  const createdLabel = task.created_at
    ? new Date(task.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not set";
  const statusOptions = [
    { value: "open", label: "Open" },
    { value: "in_progress", label: "In Progress" },
    { value: "done", label: "Done" },
    { value: "cancelled", label: "Cancelled" },
  ];

  useEffect(() => {
    if (!isEditingText) {
      setTaskTextDraft(task.description || task.title || "");
    }
  }, [isEditingText, task.description, task.title]);

  useEffect(() => {
    if (!isEditingText) return;
    taskTextInputRef.current?.focus();
    taskTextInputRef.current?.select();
  }, [isEditingText]);

  async function handleDelete() {
    const ok = await confirmDelete({
      description: "Delete this task? This cannot be undone.",
      variant: "destructive",
      confirmLabel: "Delete",
    });
    if (ok && task.id) onDelete(task.id);
  }

  async function handleSaveTaskText() {
    if (!task.id) return;
    const description = taskTextDraft.trim();
    if (!description) {
      toast.error("Task text is required");
      return;
    }

    const updated = await onUpdateTask(
      task.id,
      { description },
      { description },
    );
    if (!updated) return;
    setIsEditingText(false);
  }

  return (
    <>
      {ConfirmDialog}
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-7 py-5">
        {onBack && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="mb-5 h-auto gap-1.5 px-0 py-0 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground lg:hidden"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All tasks
          </Button>
        )}

        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {isEditingText ? (
              <div className="space-y-2">
                <Textarea
                  ref={taskTextInputRef}
                  value={taskTextDraft}
                  onChange={(event) => setTaskTextDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setTaskTextDraft(task.description || task.title || "");
                      setIsEditingText(false);
                    }
                    if (
                      (event.metaKey || event.ctrlKey) &&
                      event.key === "Enter"
                    ) {
                      event.preventDefault();
                      void handleSaveTaskText();
                    }
                  }}
                  disabled={updatingId === task.id}
                  className="min-h-24 resize-y text-xl font-semibold leading-snug"
                  aria-label="Task text"
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      void handleSaveTaskText();
                    }}
                    disabled={updatingId === task.id}
                  >
                    {updatingId === task.id && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setTaskTextDraft(task.description || task.title || "");
                      setIsEditingText(false);
                    }}
                    disabled={updatingId === task.id}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsEditingText(true)}
                  disabled={updatingId === task.id}
                  aria-label="Edit task text"
                  title="Edit task text"
                  className="group -ml-2 h-auto w-full min-w-0 items-start justify-start gap-3 whitespace-normal px-2 py-1 text-left hover:bg-muted/50"
                >
                  <span className="min-w-0 flex-1 break-words text-xl font-semibold leading-snug text-foreground">
                    {task.description || task.title || "Untitled task"}
                  </span>
                  <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </span>
                </Button>
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="mt-0.5 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            disabled={deletingId === task.id}
            aria-label="Delete task"
            title="Delete task"
            onClick={() => {
              void handleDelete();
            }}
          >
            {deletingId === task.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>

        <DetailPropertyBar className={TASK_DETAIL_PROPERTY_BAR_CLASSNAME}>
          <DetailPropertyItem
            icon={CheckCircle2}
            contentClassName="overflow-visible"
            aria-label="Task status"
          >
            <Select
              value={task.status ?? "open"}
              onValueChange={(value) =>
                task.id && onUpdateStatus(task.id, value)
              }
              disabled={updatingId === task.id}
            >
              <SelectTrigger
                className={cn(
                  DETAIL_META_SELECT_CLASS,
                  STATUS_SELECT_CLASSES[ds],
                )}
              >
                {updatingId === task.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <SelectValue />
                )}
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DetailPropertyItem>

          <DetailPropertyItem
            icon={UserRound}
            contentClassName="overflow-visible"
            muted={!fallbackAssigneeLabel && !matchedAssigneeUser}
            aria-label="Task assignee"
          >
            <Select
              value={selectedAssigneeValue}
              onValueChange={(value) => {
                if (!task.id) return;
                if (value === "__unassigned__") {
                  onUpdateTask(
                    task.id,
                    { assignee_user_id: null },
                    {
                      assignee_person_id: null,
                      assignee_name: null,
                      assignee_email: null,
                    },
                  );
                  return;
                }
                const nextUser = users.find(
                  (u) => `person:${u.person_id ?? ""}` === value,
                );
                if (!nextUser) return;
                onUpdateTask(
                  task.id,
                  { assignee_user_id: nextUser.id },
                  {
                    assignee_person_id: nextUser.person_id ?? null,
                    assignee_name: userOptionLabel(nextUser),
                    assignee_email: nextUser.email ?? null,
                  },
                );
              }}
              disabled={updatingId === task.id || usersLoading}
            >
              <SelectTrigger className={DETAIL_META_SELECT_CLASS}>
                <SelectValue
                  placeholder={
                    usersLoading
                      ? "Loading…"
                      : (fallbackAssigneeLabel ?? "Unassigned")
                  }
                >
                  {matchedAssigneeUser
                    ? userOptionLabel(matchedAssigneeUser)
                    : (fallbackAssigneeLabel ?? undefined)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unassigned__">Unassigned</SelectItem>
                {users
                  .filter((u) => u.person_id)
                  .map((user) => (
                    <SelectItem
                      key={user.id}
                      value={`person:${user.person_id}`}
                    >
                      {userOptionLabel(user)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </DetailPropertyItem>

          <DetailPropertyItem
            icon={FolderOpen}
            contentClassName="overflow-visible"
            muted={selectedProjectValue === "__none__"}
            aria-label="Task project"
          >
            <Select
              value={selectedProjectValue}
              onValueChange={(value) => {
                if (!task.id) return;
                if (value === "__none__") {
                  onUpdateTask(
                    task.id,
                    { project_id: null },
                    { project_id: null, project_ids: [], project_name: null },
                  );
                  return;
                }
                const pid = Number.parseInt(value, 10);
                const project = projects.find((item) => item.id === pid);
                onUpdateTask(
                  task.id,
                  { project_id: pid },
                  {
                    project_id: pid,
                    project_ids: [pid],
                    project_name: project
                      ? projectOptionLabel(project)
                      : task.project_name,
                  },
                );
              }}
              disabled={updatingId === task.id || projectsLoading}
            >
              <SelectTrigger className={DETAIL_META_SELECT_CLASS}>
                <SelectValue
                  placeholder={
                    projectsLoading ? "Loading…" : projectPropertyLabel
                  }
                >
                  {selectedProjectValue !== "__none__"
                    ? projectPropertyLabel
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No project</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={String(project.id)}>
                    {projectOptionLabel(project)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DetailPropertyItem>

          <DetailPropertyItem
            icon={Flag}
            contentClassName="overflow-visible"
            muted={selectedPriorityValue === "__none__"}
            aria-label="Task priority"
          >
            <Select
              value={selectedPriorityValue}
              onValueChange={(value) => {
                if (!task.id) return;
                const nextPriority = value === "__none__" ? null : value;
                onUpdateTask(
                  task.id,
                  { priority: nextPriority },
                  { priority: nextPriority },
                );
              }}
              disabled={updatingId === task.id}
            >
              <SelectTrigger className={DETAIL_META_SELECT_CLASS}>
                {updatingId === task.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <SelectValue />
                )}
              </SelectTrigger>
              <SelectContent>
                {TASK_PRIORITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DetailPropertyItem>
        </DetailPropertyBar>

        <DetailPropertyBar
          className={TASK_DETAIL_SECONDARY_PROPERTY_BAR_CLASSNAME}
        >
          <DetailPropertyItem
            icon={CalendarDays}
            contentClassName="overflow-visible"
            muted={!task.due_date}
            aria-label="Task due date"
          >
            <TaskDueDatePicker
              value={task.due_date}
              overdue={overdue && ds !== "done"}
              disabled={updatingId === task.id}
              onChange={(dueDate) => {
                if (!task.id) return;
                onUpdateTask(
                  task.id,
                  { due_date: dueDate },
                  { due_date: dueDate },
                );
              }}
            />
          </DetailPropertyItem>

          <DetailPropertyItem
            icon={Tag}
            contentClassName="overflow-visible"
            muted={selectedCategoryValue === "__none__"}
            aria-label="Task category"
          >
            <Select
              value={selectedCategoryValue}
              onValueChange={(value) => {
                if (!task.id) return;
                const nextCategory = value === "__none__" ? null : value;
                onUpdateTask(
                  task.id,
                  { category: nextCategory },
                  updateTaskCategoryLocally(task, nextCategory),
                );
              }}
              disabled={updatingId === task.id}
            >
              <SelectTrigger className={DETAIL_META_SELECT_CLASS}>
                {updatingId === task.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <SelectValue />
                )}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Not set</SelectItem>
                {DEFAULT_TASK_CATEGORIES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DetailPropertyItem>

          <DetailPropertyItem
            icon={ArrowUpRight}
            href={sourceTarget?.href}
            external={sourceTarget?.external}
            muted={!sourceTarget}
            title={sourceLinkLabel || "No source"}
            aria-label="Task source"
            contentClassName="max-w-48"
          >
            {sourceTarget ? sourceLinkLabel : sourceLinkLabel || "No source"}
          </DetailPropertyItem>

          <DetailPropertyItem icon={Clock} aria-label="Task created date">
            {createdLabel}
          </DetailPropertyItem>
        </DetailPropertyBar>

        {task.id && isAiGeneratedTask(task) && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-muted-foreground/70">
              Good task?
            </span>
            <TaskFeedbackButtons
              projectId={taskProjectId}
              taskId={task.id}
              taskSnapshot={taskFeedbackSnapshot}
              compact
              onRemove={() => {
                if (task.id) onDelete(task.id);
              }}
            />
          </div>
        )}

        {task.source_context && (
          <section className="mt-5 min-w-0 space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Context
            </p>
            <SourceContextBlock value={task.source_context} />
          </section>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// EmptyDetail
// ---------------------------------------------------------------------------

function EmptyDetail({
  total,
  loading,
  scope,
}: {
  total: number;
  loading: boolean;
  scope: Scope;
}) {
  return (
    <div className="flex h-full flex-col justify-center px-8 py-10">
      <div className="max-w-sm space-y-2">
        <p className="text-sm font-semibold text-foreground">
        {loading
          ? "Loading tasks…"
          : total === 0
            ? "No tasks yet"
            : "Select a task"}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          {loading
            ? "Fetching the task queue."
            : total === 0
              ? scope === "mine"
                ? "Tasks assigned to you from meetings, email, and documents will appear here."
                : "Company tasks from meetings, email, and documents will appear here."
              : "Choose a task from the list to review details and make edits here."}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TasksInbox — shared by /tasks and /[projectId]/tasks
// ---------------------------------------------------------------------------

interface TasksInboxProps {
  projectId?: string | null;
  projectName?: string | null;
  defaultScope?: Scope;
  showTabs?: boolean;
}

export function TasksInbox({
  projectId = null,
  projectName = null,
  defaultScope = "mine",
  showTabs = true,
}: TasksInboxProps) {
  const isProjectScoped = Boolean(projectId);

  const router = useRouter();
  const pathname =
    usePathname() ?? (isProjectScoped ? `/${projectId}/tasks` : "/tasks");
  const searchParamsRaw = useSearchParams();
  const searchParams = (searchParamsRaw ??
    new URLSearchParams()) as ReadonlyURLSearchParams;
  const { profile, isLoading: profileLoading } = useCurrentUserProfile();
  const isAdmin = profile?.isAdmin === true;

  const rawScope = searchParams.get("scope");
  const rawTaskId = searchParams.get("task");
  const searchParamsKey = searchParams.toString();
  const workSurfaceState = useMemo(
    () => parseTasksWorkSurfaceState(new URLSearchParams(searchParamsKey)),
    [searchParamsKey],
  );
  const initialScope: Scope =
    rawScope === "all" || rawScope === "mine" ? rawScope : defaultScope;

  const [scope, setScope] = useState<Scope>(initialScope);
  const [items, setItems] = useState<TasksRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("open");
  const [selectedId, setSelectedId] = useState<string | null>(rawTaskId);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [bulkCategory, setBulkCategory] = useState("__no_change__");
  const [bulkAssigneeUserId, setBulkAssigneeUserId] = useState("__no_change__");
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(Boolean(rawTaskId));
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [selectedTaskDetails, setSelectedTaskDetails] = useState<
    TasksRow | null | undefined
  >(undefined);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [splitViewHeight, setSplitViewHeight] = useState<number | null>(null);

  const listPanelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { leftPct, handleMouseDown } = useResizablePanel(containerRef);

  const syncSplitViewHeight = useCallback(() => {
    if (typeof window === "undefined") return;

    const top = containerRef.current?.getBoundingClientRect().top;
    if (top == null) return;

    const nextHeight = Math.max(window.innerHeight - top, 320);
    setSplitViewHeight((prev) => (prev === nextHeight ? prev : nextHeight));
  }, []);

  const setSplitViewContainer = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    if (!node || typeof window === "undefined") return;

    const nextHeight = Math.max(
      window.innerHeight - node.getBoundingClientRect().top,
      320,
    );
    setSplitViewHeight((prev) => (prev === nextHeight ? prev : nextHeight));
  }, []);

  const tableState = useUnifiedTableState({
    entityKey: isProjectScoped ? `project-tasks-${projectId}` : "tasks",
    searchParams,
    pathname,
    router,
    defaults: {
      view: workSurfaceState.view,
      allowedViews: ["list", "board"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "created_at",
      sortDirection: "desc",
      visibleColumns: tasksDefaultVisibleColumns,
      filters: workSurfaceState.filters,
    },
  });
  const setActiveFilters = tableState.setActiveFilters;

  useEffect(() => {
    setActiveFilters((current) => {
      const next = { ...current, ...workSurfaceState.filters };
      return JSON.stringify(next) === JSON.stringify(current) ? current : next;
    });
    setFilter(workSurfaceState.filters.status);
  }, [setActiveFilters, workSurfaceState.filters]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    syncSplitViewHeight();
    window.addEventListener("resize", syncSplitViewHeight);

    return () => window.removeEventListener("resize", syncSplitViewHeight);
  }, [
    filter,
    scope,
    selectedTaskIds.length,
    syncSplitViewHeight,
    tableState.currentView,
  ]);

  useEffect(() => {
    if (!rawTaskId) return;
    setSelectedId(rawTaskId);
    setSheetOpen(true);
  }, [rawTaskId]);

  const selectedListItem = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId],
  );

  // Merge lazily loaded detail data into the selected task for deep links and source context.
  const selectedWithContext = useMemo(() => {
    if (selectedTaskDetails) {
      return {
        ...(selectedListItem ?? selectedTaskDetails),
        ...selectedTaskDetails,
      };
    }
    return selectedListItem;
  }, [selectedListItem, selectedTaskDetails]);

  // Lazy-load the selected task when opened from the URL or list.
  // List queries intentionally exclude heavy source text, so the detail fetch is the source of truth for context.
  useEffect(() => {
    if (!selectedId) {
      setSelectedTaskDetails(undefined);
      return;
    }
    setSelectedTaskDetails(undefined);
    let cancelled = false;
    void apiFetch<{ task: TasksRow }>(`/api/tasks/${selectedId}`)
      .then((data) => {
        if (!cancelled) setSelectedTaskDetails(data.task ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        reportNonCriticalFailure({
          area: "tasks-table",
          operation: "load-selected-task-detail",
          error: err,
          userVisibleFallback: "The selected task detail could not be loaded.",
          metadata: { selectedId },
        });
        setSelectedTaskDetails(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // ---- Fetch ----
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const url = isProjectScoped
        ? `/api/tasks?project_id=${projectId}&scope=${scope}`
        : `/api/tasks?scope=${scope}`;
      const data = await apiFetch<{ data?: TasksRow[] }>(url);
      setItems(data.data ?? []);
      setTotal((data.data ?? []).length);
    } catch (err) {
      notifyTasksFailure({
        operation: "load-tasks",
        title: "Could not load tasks",
        fallback: "The task list could not be loaded.",
        error: err,
        metadata: { projectId: projectId ?? null, scope },
      });
    } finally {
      setLoading(false);
    }
  }, [isProjectScoped, projectId, scope]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    let cancelled = false;

    async function fetchProjects() {
      setProjectsLoading(true);
      try {
        const result = await apiFetch<{ data?: ProjectOption[] }>(
          "/api/projects?limit=250&archived=false",
          {
            cache: "no-store",
          },
        );
        if (!cancelled) setProjects(result.data ?? []);
      } catch (err) {
        if (!cancelled) {
          notifyTasksFailure({
            operation: "load-project-options",
            title: "Could not load project options",
            fallback:
              "Project options could not be loaded for the task filters.",
            error: err,
            metadata: { scope },
          });
        }
      } finally {
        if (!cancelled) setProjectsLoading(false);
      }
    }

    void fetchProjects();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchUsers() {
      setUsersLoading(true);
      try {
        const result = await apiFetch<{ users?: UserOption[] }>("/api/users", {
          cache: "no-store",
        });
        if (!cancelled) setUsers(result.users ?? []);
      } catch (err) {
        if (!cancelled) {
          notifyTasksFailure({
            operation: "load-user-options",
            title: "Could not load assignee options",
            fallback: "Assignee options could not be loaded for task editing.",
            error: err,
            metadata: { scope },
          });
        }
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    }

    void fetchUsers();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleScopeChange = useCallback((nextScope: Scope) => {
    setScope(nextScope);
    setSelectedId(null);
    setSelectedTaskIds([]);
    setFilter("open");
    setMobileShowDetail(false);
  }, []);

  useEffect(() => {
    const nextScope: Scope =
      rawScope === "all" || rawScope === "mine" ? rawScope : defaultScope;
    if (nextScope !== scope) handleScopeChange(nextScope);
  }, [defaultScope, handleScopeChange, rawScope, scope]);

  const scopeTabs = useMemo(() => {
    const basePath = isProjectScoped ? `/${projectId}/tasks` : "/tasks";
    const tabs: { label: string; href: string; scope: Scope }[] = [
      { label: "My Tasks", href: `${basePath}?scope=mine`, scope: "mine" },
      ...(isAdmin
        ? [
            {
              label: "All Tasks",
              href: `${basePath}?scope=all`,
              scope: "all" as Scope,
            },
          ]
        : []),
    ];
    return tabs.map((tab) => ({
      label: tab.label,
      href: tab.href,
      isActive: scope === tab.scope,
    }));
  }, [isAdmin, isProjectScoped, projectId, scope]);

  // ---- Filtered list ----
  // The canonical List and Board views consume the same normalized task set.
  const baseFilteredItems = useMemo(() => {
    const searchTerm = tableState.debouncedSearch.trim().toLowerCase();
    const sourceFilter =
      typeof tableState.activeFilters.source_system === "string"
        ? tableState.activeFilters.source_system.toLowerCase()
        : null;
    const projectFilter =
      typeof tableState.activeFilters.project_id === "string"
        ? tableState.activeFilters.project_id
        : null;
    return items.filter((item) => {
      if (!taskMatchesWorkSurfaceFilters(item, tableState.activeFilters)) {
        return false;
      }

      if (
        sourceFilter &&
        getTaskSourceLabel(item).toLowerCase() !== sourceFilter
      )
        return false;

      if (projectFilter) {
        const itemProjectId = getTaskProjectId(item);
        if (projectFilter === "__none__") {
          if (itemProjectId !== null) return false;
        } else if (String(itemProjectId ?? "") !== projectFilter) {
          return false;
        }
      }

      if (!searchTerm) return true;

      return (
        (item.metadata_id ?? "").toLowerCase().includes(searchTerm) ||
        (item.segment_id ?? "").toLowerCase().includes(searchTerm) ||
        (item.source_chunk_id ?? "").toLowerCase().includes(searchTerm) ||
        (item.description ?? "").toLowerCase().includes(searchTerm) ||
        (item.assignee_name ?? "").toLowerCase().includes(searchTerm) ||
        (item.project_name ?? "").toLowerCase().includes(searchTerm) ||
        (item.assignee_email ?? "").toLowerCase().includes(searchTerm) ||
        (item.source_date ?? "").toLowerCase().includes(searchTerm) ||
        getTaskSourceLabel(item).toLowerCase().includes(searchTerm) ||
        getTaskSourceTitle(item).toLowerCase().includes(searchTerm)
      );
    });
  }, [
    items,
    tableState.activeFilters.assignee_person_id,
    tableState.activeFilters.due_date_from,
    tableState.activeFilters.due_date_to,
    tableState.activeFilters.priority,
    tableState.activeFilters.project_id,
    tableState.activeFilters.source_system,
    tableState.activeFilters.status,
    tableState.debouncedSearch,
  ]);

  // Status-filtered items: used inside the split view list and for counts.
  // The split view's open/done tabs update `filter` (and activeFilters.status)
  // so the list reflects the active tab without blocking the split view from rendering.
  const filteredItems = useMemo(() => {
    const activeStatus =
      tableState.activeFilters.status === "open" ||
      tableState.activeFilters.status === "done"
        ? tableState.activeFilters.status
        : filter;

    return baseFilteredItems.filter((item) => {
      const ds = toDisplayStatus(item.status);
      if (activeStatus === "open" && !(ds === "open" || ds === "in_progress"))
        return false;
      if (activeStatus === "done" && ds !== "done") return false;
      return true;
    });
  }, [baseFilteredItems, filter, tableState.activeFilters.status]);

  const visibleTaskIds = useMemo(
    () =>
      filteredItems
        .map((item) => item.id)
        .filter((id): id is string => Boolean(id)),
    [filteredItems],
  );

  const selectedVisibleCount = useMemo(
    () => visibleTaskIds.filter((id) => selectedTaskIds.includes(id)).length,
    [selectedTaskIds, visibleTaskIds],
  );

  const allVisibleSelected =
    visibleTaskIds.length > 0 && selectedVisibleCount === visibleTaskIds.length;
  const someVisibleSelected =
    selectedVisibleCount > 0 && selectedVisibleCount < visibleTaskIds.length;

  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...DEFAULT_TASK_CATEGORIES,
          ...items.map((item) => getTaskCategory(item)).filter(Boolean),
        ]),
      ).sort((left, right) => left.localeCompare(right)),
    [items],
  );

  useEffect(() => {
    const liveIds = new Set(items.map((item) => item.id).filter(Boolean));
    setSelectedTaskIds((current) => current.filter((id) => liveIds.has(id)));
  }, [items]);

  // Auto-select first item
  useEffect(() => {
    if (loading || filteredItems.length === 0) return;
    const currentExists =
      selectedId && filteredItems.some((i) => i.id === selectedId);
    if (!currentExists) {
      setSelectedId(filteredItems[0].id);
      setFocusedIndex(0);
    }
  }, [loading, filteredItems, selectedId]);

  useEffect(() => {
    if (selectedId) {
      const idx = filteredItems.findIndex((i) => i.id === selectedId);
      if (idx >= 0) setFocusedIndex(idx);
    }
  }, [selectedId, filteredItems]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;
      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          if (!filteredItems.length) return;
          const nextIdx = Math.min(focusedIndex + 1, filteredItems.length - 1);
          setFocusedIndex(nextIdx);
          setSelectedId(filteredItems[nextIdx].id);
          listPanelRef.current
            ?.querySelectorAll("[data-task-item]")
            [nextIdx]?.scrollIntoView({ block: "nearest" });
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          if (!filteredItems.length) return;
          const prevIdx = Math.max(focusedIndex - 1, 0);
          setFocusedIndex(prevIdx);
          setSelectedId(filteredItems[prevIdx].id);
          listPanelRef.current
            ?.querySelectorAll("[data-task-item]")
            [prevIdx]?.scrollIntoView({ block: "nearest" });
          break;
        }
        case "Enter":
          if (!filteredItems.length) return;
          setSelectedId(filteredItems[focusedIndex].id);
          setMobileShowDetail(true);
          break;
        case "Escape":
          setMobileShowDetail(false);
          break;
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [filteredItems, focusedIndex]);

  // ---- Update task fields ----
  async function updateTask(
    id: string,
    patch: TaskPatch,
    localPatch: Partial<TasksRow> = patch,
  ) {
    setUpdatingId(id);
    try {
      await apiFetch(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      toast.success("Task updated");
      setItems((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...localPatch } : t)),
      );
      return true;
    } catch (err) {
      notifyTasksFailure({
        operation: "update-task",
        title: "Could not update task",
        fallback: "The task update did not save.",
        error: err,
        metadata: {
          taskId: id,
          fields: Object.keys(patch).join(","),
        },
      });
      return false;
    } finally {
      setUpdatingId(null);
    }
  }

  async function updateStatus(id: string, status: string) {
    await updateTask(id, { status }, { status });
  }

  function toggleTaskSelection(id: string, checked: boolean) {
    setSelectedTaskIds((current) => {
      if (checked) return current.includes(id) ? current : [...current, id];
      return current.filter((taskId) => taskId !== id);
    });
  }

  function toggleVisibleSelection(checked: boolean) {
    setSelectedTaskIds((current) => {
      if (!checked) return current.filter((id) => !visibleTaskIds.includes(id));
      return Array.from(new Set([...current, ...visibleTaskIds]));
    });
  }

  async function applyBulkEdit() {
    if (selectedTaskIds.length === 0) return;

    const payload: {
      task_ids: string[];
      category?: string | null;
      assignee_user_id?: string | null;
    } = { task_ids: selectedTaskIds };

    const selectedUser =
      bulkAssigneeUserId !== "__no_change__" &&
      bulkAssigneeUserId !== "__unassigned__"
        ? users.find((user) => user.id === bulkAssigneeUserId)
        : null;

    if (bulkCategory === "__clear__") {
      payload.category = null;
    } else if (bulkCategory !== "__no_change__") {
      payload.category = bulkCategory;
    }

    if (bulkAssigneeUserId === "__unassigned__") {
      payload.assignee_user_id = null;
    } else if (bulkAssigneeUserId !== "__no_change__") {
      payload.assignee_user_id = bulkAssigneeUserId;
    }

    if (
      payload.category === undefined &&
      payload.assignee_user_id === undefined
    ) {
      toast.error("Choose a category or assignee before applying bulk edits");
      return;
    }

    setBulkUpdating(true);
    try {
      await apiFetch("/api/tasks/bulk", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      setItems((current) =>
        current.map((task) => {
          if (!task.id || !selectedTaskIds.includes(task.id)) return task;

          let nextTask = task;
          if (payload.category !== undefined) {
            nextTask = updateTaskCategoryLocally(nextTask, payload.category);
          }

          if (payload.assignee_user_id !== undefined) {
            nextTask = {
              ...nextTask,
              assignee_person_id: selectedUser?.person_id ?? null,
              assignee_email: selectedUser?.email ?? null,
              assignee_name:
                payload.assignee_user_id === null
                  ? null
                  : selectedUser
                    ? userOptionLabel(selectedUser)
                    : nextTask.assignee_name,
            };
          }

          return nextTask;
        }),
      );
      setBulkCategory("__no_change__");
      setBulkAssigneeUserId("__no_change__");
      toast.success(
        `Updated ${selectedTaskIds.length} selected task${selectedTaskIds.length === 1 ? "" : "s"}`,
      );
    } catch (err) {
      notifyTasksFailure({
        operation: "bulk-update-tasks",
        title: "Could not update selected tasks",
        fallback: "The selected task updates did not save.",
        error: err,
        metadata: {
          selectedCount: selectedTaskIds.length,
          fields: Object.keys(payload)
            .filter((key) => key !== "task_ids")
            .join(","),
        },
      });
    } finally {
      setBulkUpdating(false);
    }
  }

  async function deleteItem(id: string) {
    setDeletingId(id);
    try {
      await apiFetch(`/api/tasks/${id}`, { method: "DELETE" });
      toast.success("Task deleted");
      if (selectedId === id) {
        setSelectedId(null);
        setMobileShowDetail(false);
      }
      setSelectedTaskIds((current) =>
        current.filter((taskId) => taskId !== id),
      );
      setItems((prev) => prev.filter((t) => t.id !== id));
      setTotal((prev) => prev - 1);
    } catch (err) {
      notifyTasksFailure({
        operation: "delete-task",
        title: "Could not delete task",
        fallback: "The task could not be deleted.",
        error: err,
        metadata: { taskId: id },
      });
    } finally {
      setDeletingId(null);
    }
  }

  async function deleteSelectedItems() {
    if (selectedTaskIds.length === 0) return;

    setBulkDeleting(true);
    try {
      await apiFetch("/api/tasks/bulk", {
        method: "DELETE",
        body: JSON.stringify({ task_ids: selectedTaskIds }),
      });

      const selectedSet = new Set(selectedTaskIds);
      setItems((prev) =>
        prev.filter((task) => !task.id || !selectedSet.has(task.id)),
      );
      setTotal((prev) => Math.max(0, prev - selectedSet.size));
      if (selectedId && selectedSet.has(selectedId)) {
        setSelectedId(null);
        setMobileShowDetail(false);
      }
      setSelectedTaskIds([]);
      toast.success(
        `Deleted ${selectedSet.size} selected task${selectedSet.size === 1 ? "" : "s"}`,
      );
    } catch (err) {
      notifyTasksFailure({
        operation: "bulk-delete-tasks",
        title: "Could not delete selected tasks",
        fallback: "The selected tasks could not be deleted.",
        error: err,
        metadata: { selectedCount: selectedTaskIds.length },
      });
    } finally {
      setBulkDeleting(false);
      setBulkDeleteDialogOpen(false);
    }
  }

  function selectItem(id: string) {
    setSelectedId(id);
    setMobileShowDetail(true);
    tableState.setSearchParams({ task: id });
  }

  const filters = useMemo(() => {
    const sourceFilters = buildTasksFilters(items).filter(
      (item) => item.id !== "status",
    );
    const projectFilters = isProjectScoped
      ? []
      : [
          {
            id: "project_id",
            label: "Project",
            type: "select" as const,
            options: [
              { value: "__none__", label: "Unlinked" },
              ...projects.map((project) => ({
                value: String(project.id),
                label: projectOptionLabel(project),
              })),
            ],
          },
        ];
    const assigneeFilters = [
      {
        id: "assignee_person_id",
        label: "Assigned to",
        type: "select" as const,
        options: [
          { value: "__unassigned__", label: "Unassigned" },
          ...users
            .filter((user) => user.person_id)
            .map((user) => ({
              value: user.person_id as string,
              label: userOptionLabel(user),
            })),
        ],
      },
    ];
    return [
      {
        id: "status",
        label: "Status",
        type: "select" as const,
        options: STATUS_FILTERS.map((item) => ({
          value: item.value,
          label: item.label,
        })),
      },
      ...projectFilters,
      ...assigneeFilters,
      ...sourceFilters,
    ];
  }, [isProjectScoped, items, projects, users]);

  const selectItemRef = useRef(selectItem);
  selectItemRef.current = selectItem;
  const updateTaskRef = useRef(updateTask);
  updateTaskRef.current = updateTask;
  const deleteItemRef = useRef(deleteItem);
  deleteItemRef.current = deleteItem;

  const openPanelForItem = useCallback((item: TasksRow) => {
    if (item.id) {
      selectItemRef.current(item.id);
      setSheetOpen(true);
    }
  }, []);

  const tableColumns = useMemo(
    () =>
      buildTasksTableColumns(null, {
        onOpenPanel: openPanelForItem,
        onUpdate: async (id, patch) => {
          const saved = await updateTaskRef.current(id, patch);
          if (!saved) {
            throw new Error("Task update did not save.");
          }
        },
        onDelete: (id) => {
          void deleteItemRef.current(id);
        },
        projects,
        users,
      }),
    [openPanelForItem, projects, users],
  );
  const allowedColumnIds = useMemo(
    () => tasksColumns.map((column) => column.id),
    [],
  );
  const sanitizedVisibleColumns = useMemo(() => {
    const visible = tableState.visibleColumns.filter((id) =>
      allowedColumnIds.includes(id),
    );
    return visible.length > 0 ? visible : tasksDefaultVisibleColumns;
  }, [allowedColumnIds, tableState.visibleColumns]);

  const isFiltered =
    tableState.debouncedSearch.trim().length > 0 ||
    tableState.activeFilters.status === "done" ||
    tableState.activeFilters.source_system !== undefined ||
    tableState.activeFilters.project_id !== undefined ||
    tableState.activeFilters.assignee_person_id !== undefined ||
    tableState.activeFilters.priority !== undefined ||
    tableState.activeFilters.due_date_from !== undefined ||
    tableState.activeFilters.due_date_to !== undefined;

  const handleFilterChange = useCallback(
    (nextFilters: Record<string, FilterValue>) => {
      tableState.setActiveFilters(nextFilters);
      if (nextFilters.status === "open" || nextFilters.status === "done") {
        setFilter(nextFilters.status);
      }
      tableState.setPage(1);
      tableState.setSearchParams(serializeTaskFilterParams(nextFilters));
    },
    [tableState],
  );

  const handleStatusFilterChange = useCallback(
    (value: string) => {
      if (value !== "open" && value !== "done") return;

      setFilter(value);
      tableState.setActiveFilters((current) => ({
        ...current,
        status: value,
      }));
      tableState.setPage(1);
      tableState.setSearchParams({
        status: value === "done" ? "done" : null,
      });
      setSelectedId(null);
      setMobileShowDetail(false);
    },
    [tableState],
  );

  const handleOpenSource = useCallback(
    (item: TasksRow) => {
      const target = getTaskSourceTarget(item);
      if (!target) {
        toast.error("This task does not have a linked source record yet");
        return;
      }
      if (target.external) {
        window.open(target.href, "_blank", "noopener,noreferrer");
        return;
      }
      router.push(target.href);
    },
    [router],
  );

  const handleExport = useCallback(() => {
    const headers = [
      "Task Name",
      "Project Name",
      "Assigned User",
      "Source",
      "Created From",
      "Source Date",
      "Assignee Email",
      "Due Date",
      "Priority",
      "Status",
    ];
    const rows = filteredItems.map((task) => [
      task.description || "",
      task.project_name || "",
      task.assignee_name || "",
      getTaskSourceLabel(task),
      getTaskSourceTitle(task),
      task.source_date ? format(new Date(task.source_date), "yyyy-MM-dd") : "",
      task.assignee_email || "",
      task.due_date ? format(new Date(task.due_date), "yyyy-MM-dd") : "",
      task.priority || "",
      task.status || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tasks-${format(new Date(), "yyyy-MM-dd")}.csv`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }, [filteredItems]);

  const description = isProjectScoped
    ? projectName
      ? `Tasks associated with ${projectName}`
      : "Tasks for this project"
    : "Tasks assigned from meetings, emails, documents, and source intelligence.";

  if (tableState.currentView === "split") {
    return (
      <>
        <SplitPageFrame
          height="fill"
          className={TASKS_SPLIT_WORKSPACE_CLASSNAME}
        >
          <SplitPage
            variant="two-column"
            breakpoint="xl"
            firstPaneWidth={TASKS_SPLIT_FIRST_PANE_WIDTH}
            defaultIsOpen={!selectedWithContext}
            className="min-h-0 flex-1"
          >
            <div
              className={cn(
                "relative flex h-full w-full min-w-0 flex-col overflow-hidden border-b border-border/70 bg-background xl:border-b-0 xl:border-r",
                mobileShowDetail ? "hidden xl:flex" : "flex",
              )}
            >
              <div className="border-b border-border/70 px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[28px] font-semibold tracking-[-0.03em] text-foreground">
                      Tasks
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        tableState.setCurrentView("list");
                        tableState.setSearchParams({ view: "list" });
                      }}
                      aria-label="Table view"
                      title="Table view"
                      className="h-8 w-8 rounded-full shadow-none"
                    >
                      <Table2 className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        tableState.setCurrentView("board");
                        tableState.setSearchParams({ view: "board" });
                      }}
                      aria-label="Board view"
                      title="Board view"
                      className="h-8 w-8 rounded-full shadow-none"
                    >
                      <KanbanSquare className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Split view"
                      title="Split view"
                      className="h-8 w-8 rounded-full bg-muted text-foreground shadow-none"
                    >
                      <PanelLeft className="h-4 w-4" />
                    </Button>
                    <ExpandableSearch
                      value={tableState.searchInput}
                      onChange={tableState.setSearchInput}
                      placeholder="Search tasks"
                      ariaLabel="Search tasks"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Showing ${
                        STATUS_FILTERS.find((item) => item.value === filter)
                          ?.label ?? "Open"
                      } tasks. Switch to ${
                        filter === "open" ? "Done" : "Open"
                      } tasks.`}
                      title={`Showing ${
                        STATUS_FILTERS.find((item) => item.value === filter)
                          ?.label ?? "Open"
                      } tasks`}
                      className={cn(
                        "h-8 w-8 rounded-full shadow-none",
                        filter === "done" && "bg-muted text-foreground",
                      )}
                      onClick={() =>
                        handleStatusFilterChange(
                          filter === "open" ? "done" : "open",
                        )
                      }
                    >
                      <ListFilter className="h-4 w-4" />
                    </Button>
                    <NewTaskDialog
                      projects={projects}
                      users={users}
                      defaultProjectId={
                        isProjectScoped ? Number(projectId) : null
                      }
                      onCreated={fetchItems}
                    />
                  </div>
                </div>

                {showTabs && !profileLoading ? (
                  <nav className="mt-3 flex items-center gap-5">
                    {scopeTabs.map((tab) => (
                      <Button
                        key={tab.label}
                        type="button"
                        variant="ghost"
                        onClick={() => router.push(`${tab.href}&view=list`)}
                        className={cn(
                          "relative h-auto rounded-none px-0 py-2 text-sm font-medium shadow-none hover:bg-transparent",
                          tab.isActive
                            ? "text-primary"
                            : "text-foreground/70 hover:text-foreground/90",
                        )}
                      >
                        {tab.label}
                        <span
                          aria-hidden="true"
                          className={cn(
                            "pointer-events-none absolute bottom-0 left-0 right-0 h-0.5 rounded-full transition-colors",
                            tab.isActive ? "bg-primary" : "bg-transparent",
                          )}
                        />
                      </Button>
                    ))}
                  </nav>
                ) : null}
              </div>

              <div
                data-task-list-scroll
                className="min-h-0 flex-1 overflow-y-auto"
              >
                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="px-6 py-10 text-sm text-muted-foreground">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div className="mt-5 text-lg font-semibold tracking-[-0.02em] text-foreground">
                      Nothing here
                    </div>
                    <p className="mt-2 max-w-xs leading-6">
                      No {filter} tasks
                      {scope === "mine" ? " assigned to you" : ""}.
                    </p>
                  </div>
                ) : (
                  filteredItems.map((item) => (
                    <TaskSplitListItem
                      key={item.id}
                      item={item}
                      projects={projects}
                      isSelected={selectedId === item.id}
                      isChecked={
                        item.id ? selectedTaskIds.includes(item.id) : false
                      }
                      onClick={() => item.id && selectItem(item.id)}
                      onCheckedChange={(checked) =>
                        item.id && toggleTaskSelection(item.id, checked)
                      }
                    />
                  ))
                )}
              </div>
            </div>

            <div className="hidden min-w-0 flex-1 flex-col overflow-hidden xl:flex">
              <div className="min-h-0 flex-1 overflow-y-auto">
                {!selectedWithContext ? (
                  <EmptyDetail
                    total={total}
                    loading={loading}
                    scope={scope}
                  />
                ) : (
                  <TaskDetail
                    task={selectedWithContext}
                    updatingId={updatingId}
                    deletingId={deletingId}
                    onUpdateStatus={updateStatus}
                    onUpdateTask={updateTask}
                    onDelete={deleteItem}
                    projects={projects}
                    projectsLoading={projectsLoading}
                    users={users}
                    usersLoading={usersLoading}
                  />
                )}
              </div>
            </div>
          </SplitPage>
        </SplitPageFrame>
      </>
    );
  }

  return (
    <>
      <UnifiedTablePage<TasksRow>
        header={{
          title: "Tasks",
          description,
          actions: (
            <NewTaskDialog
              projects={projects}
              users={users}
              defaultProjectId={isProjectScoped ? Number(projectId) : null}
              onCreated={fetchItems}
            />
          ),
        }}
        tabs={showTabs && !profileLoading ? scopeTabs : undefined}
        toolbar={{
          totalItems: items.length,
          filteredItems: baseFilteredItems.length,
          selectedCount: selectedTaskIds.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search tasks...",
          currentView: tableState.currentView,
          onViewChange: (view) => {
            if (view !== "list" && view !== "board") return;
            tableState.setCurrentView(view);
            tableState.setSearchParams({ view: taskViewParam(view) });
          },
          enabledViews: ["list", "board"],
          filters,
          activeFilters: tableState.activeFilters,
          onFilterChange: handleFilterChange,
          onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
          columns: tasksColumns,
          visibleColumns: sanitizedVisibleColumns,
          onColumnVisibilityChange: (columns) =>
            tableState.setVisibleColumns(
              columns.filter((id) => allowedColumnIds.includes(id)),
            ),
          onExport: handleExport,
          onBulkDelete:
            selectedTaskIds.length > 0
              ? () => setBulkDeleteDialogOpen(true)
              : undefined,
        }}
        data={{
          items: baseFilteredItems,
          isLoading: loading,
          isFetching: false,
        }}
        table={{
          columns: tableColumns,
          getRowId: (item) => item.id ?? "",
          onRowClick:
            tableState.currentView === "list"
              ? undefined
              : (item) => {
                  if (item.id) selectItem(item.id);
                },
          activeRowId: selectedId,
          rowActions: (item) =>
            renderTasksRowActions(
              item,
              handleOpenSource,
              item.id ? () => deleteItem(item.id!) : undefined,
            ),
        }}
        views={{
          board: ({ items }) => (
            <TasksBoardView items={items} onOpen={openPanelForItem} />
          ),
          split: () => (
            <div
              ref={setSplitViewContainer}
              data-task-split-view
              className="flex min-h-0 flex-1 overflow-hidden border-t border-border/40"
              style={
                splitViewHeight ? { height: `${splitViewHeight}px` } : undefined
              }
            >
              {/* Left: task list */}
              <div
                ref={listPanelRef}
                className={cn(
                  "flex h-full min-w-0 flex-col overflow-hidden border-r border-border/40 bg-background lg:w-[var(--tasks-left-pct)]",
                  mobileShowDetail ? "hidden lg:flex" : "flex",
                  "w-full lg:shrink-0",
                )}
                style={{ "--tasks-left-pct": `${leftPct}%` } as CSSProperties}
              >
                {/* Status filter tabs */}
                <div className="py-2 pr-2">
                  <Tabs
                    value={filter}
                    onValueChange={(value) => {
                      if (value === "open" || value === "done") {
                        setFilter(value);
                        tableState.setActiveFilters((current) => ({
                          ...current,
                          status: value,
                        }));
                        setSelectedId(null);
                        setMobileShowDetail(false);
                      }
                    }}
                  >
                    <TabsList>
                      {STATUS_FILTERS.map((tab) => (
                        <TabsTrigger key={tab.value} value={tab.value}>
                          {tab.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>

                {/* Bulk action bar */}
                {selectedTaskIds.length > 0 && (
                  <div className="border-b border-border/40 px-3 py-2">
                    <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {selectedTaskIds.length} selected
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedTaskIds([])}
                        className="h-8 gap-1.5 px-2 text-xs text-muted-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                        Clear
                      </Button>
                    </div>

                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                      <Select
                        value={bulkCategory}
                        onValueChange={setBulkCategory}
                      >
                        <SelectTrigger className="h-8 w-full gap-2 sm:w-44">
                          <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__no_change__">
                            Category unchanged
                          </SelectItem>
                          <SelectItem value="__clear__">
                            Clear category
                          </SelectItem>
                          {categoryOptions.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={bulkAssigneeUserId}
                        onValueChange={setBulkAssigneeUserId}
                        disabled={usersLoading}
                      >
                        <SelectTrigger className="h-8 w-full gap-2 sm:w-56">
                          <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <SelectValue
                            placeholder={
                              usersLoading ? "Loading users..." : "Assign user"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__no_change__">
                            Assignee unchanged
                          </SelectItem>
                          <SelectItem value="__unassigned__">
                            Unassigned
                          </SelectItem>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {userOptionLabel(user)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <div className="flex items-center gap-2 sm:ml-auto">
                        <Button
                          type="button"
                          size="sm"
                          onClick={applyBulkEdit}
                          disabled={bulkUpdating}
                          className="h-8 gap-1.5"
                        >
                          {bulkUpdating ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckSquare2 className="h-3.5 w-3.5" />
                          )}
                          Apply
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setBulkDeleteDialogOpen(true)}
                          disabled={bulkDeleting}
                          className="h-8 gap-1.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Task list */}
                <div
                  data-task-list-scroll
                  className="flex-1 overflow-auto overscroll-contain"
                >
                  {!loading && filteredItems.length > 0 && (
                    <TaskListHeader
                      allVisibleSelected={allVisibleSelected}
                      someVisibleSelected={someVisibleSelected}
                      visibleTaskIds={visibleTaskIds}
                      selectedTaskIds={selectedTaskIds}
                      onToggleVisibleSelection={toggleVisibleSelection}
                    />
                  )}

                  {loading && (
                    <div className="flex items-center justify-center py-20">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                    </div>
                  )}

                  {!loading && filteredItems.length === 0 && (
                    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                      <CheckCircle2 className="mb-3 h-8 w-8 text-muted-foreground/30" />
                      <p className="text-sm font-medium text-foreground">
                        {filter === "open" && scope === "mine"
                          ? "All caught up"
                          : "Nothing here"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        No {filter} tasks
                        {scope === "mine" ? " assigned to you" : ""}.
                      </p>
                    </div>
                  )}

                  {!loading &&
                    filteredItems.map((item) => (
                      <TaskListItem
                        key={item.id}
                        item={item}
                        projects={projects}
                        isSelected={selectedId === item.id}
                        isChecked={
                          item.id ? selectedTaskIds.includes(item.id) : false
                        }
                        onClick={() => item.id && selectItem(item.id)}
                        onCheckedChange={(checked) =>
                          item.id && toggleTaskSelection(item.id, checked)
                        }
                        onDelete={() => item.id && deleteItem(item.id)}
                      />
                    ))}
                </div>
              </div>

              {/* Resize handle */}
              <div
                className="group relative hidden w-1 shrink-0 cursor-col-resize lg:block"
                onMouseDown={handleMouseDown}
                aria-hidden="true"
              >
                <div className="absolute inset-y-0 left-0 w-px bg-border/40 transition-colors group-hover:bg-primary/50 group-active:bg-primary" />
                <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
              </div>

              {/* Right: detail panel (desktop) */}
              <div
                data-task-detail-panel
                className="hidden min-h-0 min-w-0 flex-1 lg:flex lg:flex-col"
              >
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  {!selectedWithContext ? (
                    <EmptyDetail
                      total={total}
                      loading={loading}
                      scope={scope}
                    />
                  ) : (
                    <TaskDetail
                      task={selectedWithContext}
                      updatingId={updatingId}
                      deletingId={deletingId}
                      onUpdateStatus={updateStatus}
                      onUpdateTask={updateTask}
                      onDelete={deleteItem}
                      projects={projects}
                      projectsLoading={projectsLoading}
                      users={users}
                      usersLoading={usersLoading}
                    />
                  )}
                </div>
              </div>

              {/* Mobile: full-screen detail */}
              {mobileShowDetail && selectedWithContext && (
                <div className="flex h-full flex-1 flex-col overflow-y-auto overscroll-contain bg-background lg:hidden">
                  <TaskDetail
                    task={selectedWithContext}
                    updatingId={updatingId}
                    deletingId={deletingId}
                    onUpdateStatus={updateStatus}
                    onUpdateTask={updateTask}
                    onDelete={deleteItem}
                    onBack={() => setMobileShowDetail(false)}
                    projects={projects}
                    projectsLoading={projectsLoading}
                    users={users}
                    usersLoading={usersLoading}
                  />
                </div>
              )}
            </div>
          ),
        }}
        selection={{
          selectedIds: selectedTaskIds,
          onSelectAll: toggleVisibleSelection,
          onSelectRow: toggleTaskSelection,
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
          title: "No tasks found",
          description:
            "Tasks appear here when they are linked to a source record.",
          filteredDescription: "Try adjusting your search or filters.",
          isFiltered,
        }}
        features={{
          enableExport: true,
          enableBulkDelete: true,
          enableRowSelection: true,
          enableInlineEditing: true,
        }}
        layout={{
          fullBleedTable: false,
          toolbarInlineWithHeader: true,
          containerClassName: "pt-0",
        }}
      />

      <AlertDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected tasks</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedTaskIds.length} selected
              task
              {selectedTaskIds.length === 1 ? "" : "s"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteSelectedItems}
              disabled={bulkDeleting || selectedTaskIds.length === 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleting ? "Deleting..." : "Delete selected"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg overflow-y-auto p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Task detail</SheetTitle>
          </SheetHeader>
          {selectedWithContext && (
            <TaskDetail
              task={selectedWithContext}
              updatingId={updatingId}
              deletingId={deletingId}
              onUpdateStatus={updateStatus}
              onUpdateTask={updateTask}
              onDelete={(id) => {
                deleteItem(id);
                setSheetOpen(false);
              }}
              projects={projects}
              projectsLoading={projectsLoading}
              users={users}
              usersLoading={usersLoading}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

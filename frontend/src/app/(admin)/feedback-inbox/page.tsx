"use client";

import dynamic from "next/dynamic";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ArrowRight,
  ArrowUpDown,
  Check,
  Columns3,
  Pencil,
  Filter,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRight,
  Table2,
  Tag,
  Shapes,
  CircleDot,
  AlertCircle,
  Trash2,
  X,
} from "lucide-react";
import {
  Button,
  Checkbox,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ds";
import { PageShell } from "@/components/layout";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SheetDescription,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
  SidePanel,
  SidePanelBody,
  SidePanelContent,
  SidePanelHeader,
  SidePanelTitle,
} from "@/components/ui/side-panel";
import { SplitPage, SplitPageFrame, useSplitPage } from "@/components/ui/split-page";
import {
  EmbeddedUnifiedTablePage,
  type TableColumn,
  useUnifiedTableState,
} from "@/components/tables/unified";
import { BoardView, type BoardColumnDefinition } from "@/components/tables/unified/board-view";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import {
  displayAdminFeedbackTitle,
  isCommentRedundantWithTitle,
} from "@/lib/admin-feedback/title";
import { apiFetch } from "@/lib/api-client";
import { appToast as toast } from "@/lib/toast/app-toast";
import { cn } from "@/lib/utils";

import { FeedbackDetail } from "./_components/feedback-detail";
import { FeedbackQueue } from "./_components/feedback-queue";

const VeltFeedbackComments = dynamic(
  () => import("@/components/velt/VeltFeedbackComments").then((m) => m.VeltFeedbackComments),
  { ssr: false },
);
import {
  FEEDBACK_STATUS_TABS,
  FEEDBACK_INBOX_TABS,
  STATUS_FILTERS,
  STATUS_META,
  STATUS_OPTIONS,
} from "./constants";
import {
  getAssignedAgent,
  getDispatchStatus,
  notifyFeedbackInboxFailure,
  submitterLabel,
  relativeTime,
  toDisplayStatus,
  toolLabelFromPath,
} from "./helpers";
import {
  expandFeedbackStatusAliases,
  normalizeFeedbackStoredStatus,
} from "./status-aliases";
import type {
  DisplayStatus,
  FeedbackInboxTab,
  FeedbackItem,
  StatusFilter,
  ToolOption,
} from "./types";

const ACTIVE_EXCLUDED_STATUS_QUERY = "in_review,resolved,closed,deferred,archived";
const ALL_STATUS_QUERY =
  "open,github_failed,submitted,in_progress,triaged,diagnosing,fixing,verifying,in_review,pr_created,deferred,resolved,closed";
const FEEDBACK_LAYOUT_STORAGE_KEY = "alleato-feedback-inbox-layout";
const FEEDBACK_VIEW_STORAGE_KEY = "alleato-feedback-inbox-view";
const FEEDBACK_LEFT_DEFAULT = 456;
const FEEDBACK_LEFT_MIN = 320;
const FEEDBACK_LEFT_MAX = 640;

type FeedbackSortValue =
  | "newest"
  | "oldest"
  | "priority"
  | "tool"
  | "source"
  | "status";
type FeedbackDateFilter = "all" | "today" | "7d" | "30d" | "older";
type FeedbackViewMode = "split" | "board" | "table";
type FeedbackSeverity = "low" | "medium" | "high";
type BulkEditTarget = "status" | "priority" | "tool" | "category";

const FEEDBACK_SORT_OPTIONS: {
  value: FeedbackSortValue;
  label: string;
}[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "priority", label: "Priority first" },
  { value: "tool", label: "Tool A-Z" },
  { value: "source", label: "Source A-Z" },
  { value: "status", label: "Status" },
];
const FEEDBACK_DATE_FILTERS: {
  value: FeedbackDateFilter;
  label: string;
}[] = [
  { value: "all", label: "Any date" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "older", label: "Older than 30 days" },
];
const FEEDBACK_PRIORITY_OPTIONS: {
  value: FeedbackSeverity;
  label: string;
}[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];
const FEEDBACK_BOARD_COLUMNS: BoardColumnDefinition[] = STATUS_OPTIONS
  .filter((option) => option.value !== "archived")
  .map((option) => ({
    id: option.value,
    label: option.label,
    emptyLabel: `No ${option.label.toLowerCase()} feedback`,
  }));

const FEEDBACK_TABLE_DEFAULT_VISIBLE_COLUMNS = [
  "created_at",
  "status",
  "severity",
  "title",
  "tool",
  "source",
  "submitter",
  "category",
  "github_issue",
] as const;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function loadFeedbackLayout() {
  const fallback = {
    leftWidth: FEEDBACK_LEFT_DEFAULT,
    leftCollapsed: false,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(FEEDBACK_LAYOUT_STORAGE_KEY);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored) as Partial<typeof fallback>;
    return {
      leftWidth:
        typeof parsed.leftWidth === "number"
          ? clampNumber(parsed.leftWidth, FEEDBACK_LEFT_MIN, FEEDBACK_LEFT_MAX)
          : fallback.leftWidth,
      leftCollapsed:
        typeof parsed.leftCollapsed === "boolean"
          ? parsed.leftCollapsed
          : fallback.leftCollapsed,
    };
  } catch {
    return fallback;
  }
}

function saveFeedbackLayout(preference: {
  leftWidth: number;
  leftCollapsed: boolean;
}) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    FEEDBACK_LAYOUT_STORAGE_KEY,
    JSON.stringify(preference),
  );
}

function loadFeedbackViewMode(): FeedbackViewMode {
  if (typeof window === "undefined") return "split";
  const stored = window.localStorage.getItem(FEEDBACK_VIEW_STORAGE_KEY);
  if (stored === "board" || stored === "table") return stored;
  return "split";
}

function saveFeedbackViewMode(viewMode: FeedbackViewMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FEEDBACK_VIEW_STORAGE_KEY, viewMode);
}

function feedbackStatusQuery(filter: StatusFilter): string | null {
  if (filter === "all") return ALL_STATUS_QUERY;
  if (filter === "active") return null;
  if (filter === "open") {
    return "open,github_failed,submitted,in_progress,triaged,diagnosing,fixing,verifying,pr_created";
  }
  if (filter === "in_progress")
    return "in_progress,triaged,diagnosing,fixing,verifying,pr_created";
  if (filter === "in_review") return expandFeedbackStatusAliases("in_review").join(",");
  if (filter === "verified") return expandFeedbackStatusAliases("verified").join(",");
  if (filter === "dispatched") return ALL_STATUS_QUERY;
  if (filter === "deferred") return "deferred";
  return filter;
}

function feedbackExcludedStatusQuery(filter: StatusFilter): string | null {
  if (filter === "active") return ACTIVE_EXCLUDED_STATUS_QUERY;
  return null;
}

function sortRank(item: FeedbackItem): number {
  if (item.severity === "high") return 0;
  if (item.severity === "medium") return 1;
  if (item.severity === "low") return 2;
  return 3;
}

function itemToolLabel(item: FeedbackItem): string {
  return toolLabelFromPath(item.page_path) ?? item.page_title ?? item.page_path;
}

function itemSourceLabel(item: FeedbackItem): string {
  return item.page_title ?? item.page_path;
}

function feedbackBoardColumnId(item: FeedbackItem): DisplayStatus {
  return toDisplayStatus(item.status);
}

function formatFeedbackTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function buildFeedbackTableColumns(): TableColumn<FeedbackItem>[] {
  return [
    {
      id: "created_at",
      label: "Submitted",
      defaultVisible: true,
      sortable: false,
      width: 150,
      render: (item) => (
        <span
          className="block whitespace-nowrap text-xs text-foreground"
          title={formatFeedbackTimestamp(item.created_at)}
        >
          {relativeTime(item.created_at)}
        </span>
      ),
      csvValue: (item) => item.created_at,
    },
    {
      id: "status",
      label: "Status",
      defaultVisible: true,
      sortable: false,
      width: 120,
      render: (item) => {
        const displayStatus = toDisplayStatus(item.status);
        const meta = STATUS_META[displayStatus];
        return (
          <div className="inline-flex items-center gap-2 whitespace-nowrap text-xs text-foreground">
            <span className={cn("h-2 w-2 rounded-full", meta.dotClassName)} />
            <span>{meta.label}</span>
          </div>
        );
      },
      csvValue: (item) => STATUS_META[toDisplayStatus(item.status)].label,
    },
    {
      id: "severity",
      label: "Priority",
      defaultVisible: true,
      sortable: false,
      width: 90,
      render: (item) => (
        <span
          className={cn(
            "text-xs",
            item.severity === "high"
              ? "font-medium text-status-error"
              : "text-muted-foreground",
          )}
        >
          {item.severity ? item.severity.replace(/^\w/, (char) => char.toUpperCase()) : "—"}
        </span>
      ),
      csvValue: (item) => item.severity ?? "",
    },
    {
      id: "title",
      label: "Feedback",
      alwaysVisible: true,
      sortable: false,
      render: (item) => {
        const title = displayAdminFeedbackTitle({
          storedTitle: item.title,
          requestType: item.request_type,
          comment: item.comment,
          targetText: item.target_text,
          pageTitle: item.page_title,
        });
        const showCommentPreview = !isCommentRedundantWithTitle(title, item.comment);
        return (
          <div className="min-w-0 space-y-0.5">
            <span className="block line-clamp-2 text-xs font-medium leading-snug text-foreground">
              {title}
            </span>
            {showCommentPreview ? (
              <span className="block line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                {item.comment}
              </span>
            ) : null}
          </div>
        );
      },
      csvValue: (item) =>
        displayAdminFeedbackTitle({
          storedTitle: item.title,
          requestType: item.request_type,
          comment: item.comment,
          targetText: item.target_text,
          pageTitle: item.page_title,
        }),
    },
    {
      id: "request_type",
      label: "Type",
      defaultVisible: false,
      sortable: false,
      width: 120,
      render: (item) => (
        <span className="text-xs text-muted-foreground">
          {item.request_type.replace(/_/g, " ")}
        </span>
      ),
      csvValue: (item) => item.request_type,
    },
    {
      id: "tool",
      label: "Tool",
      defaultVisible: true,
      sortable: false,
      width: 140,
      render: (item) => (
        <span className="text-xs text-foreground">
          {itemToolLabel(item)}
        </span>
      ),
      csvValue: (item) => itemToolLabel(item),
    },
    {
      id: "source",
      label: "Source",
      defaultVisible: true,
      sortable: false,
      width: 180,
      render: (item) => (
        <span
          className="block line-clamp-2 text-xs text-foreground"
          title={item.page_path}
        >
          {item.page_title ?? item.page_path}
        </span>
      ),
      csvValue: (item) => `${item.page_title ?? ""} ${item.page_path}`.trim(),
    },
    {
      id: "page_link",
      label: "Page",
      defaultVisible: false,
      sortable: false,
      width: 90,
      render: (item) => (
        <a
          href={item.page_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          <ArrowRight className="h-3 w-3" />
          Open
        </a>
      ),
      csvValue: (item) => item.page_url,
    },
    {
      id: "submitter",
      label: "Submitted by",
      defaultVisible: true,
      sortable: false,
      width: 150,
      render: (item) => (
        <span className="text-xs text-foreground">{submitterLabel(item)}</span>
      ),
      csvValue: (item) => submitterLabel(item),
    },
    {
      id: "category",
      label: "Category",
      defaultVisible: true,
      sortable: false,
      width: 140,
      render: (item) => (
        <span className="text-xs text-muted-foreground">{item.category ?? "—"}</span>
      ),
      csvValue: (item) => item.category ?? "",
    },
    {
      id: "github_issue",
      label: "GitHub",
      defaultVisible: true,
      sortable: false,
      width: 110,
      render: (item) =>
        item.github_issue_number && item.github_issue_url ? (
          <a
            href={item.github_issue_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            <ArrowRight className="h-3 w-3" />
            #{item.github_issue_number}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
      csvValue: (item) => item.github_issue_url ?? "",
    },
    {
      id: "screenshot",
      label: "Screenshot",
      defaultVisible: false,
      sortable: false,
      width: 100,
      render: (item) =>
        item.screenshot_url ? (
          <a
            href={item.screenshot_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            <ArrowRight className="h-3 w-3" />
            View
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
      csvValue: (item) => item.screenshot_url ?? "",
    },
    {
      id: "updated_at",
      label: "Updated",
      defaultVisible: false,
      sortable: false,
      width: 140,
      render: (item) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatFeedbackTimestamp(item.updated_at)}
        </span>
      ),
      csvValue: (item) => item.updated_at,
    },
  ];
}

function matchesDateFilter(item: FeedbackItem, filter: FeedbackDateFilter): boolean {
  if (filter === "all") return true;

  const createdAt = new Date(item.created_at).getTime();
  const now = Date.now();
  const ageMs = now - createdAt;
  const dayMs = 86_400_000;

  if (filter === "today") {
    return new Date(item.created_at).toDateString() === new Date().toDateString();
  }
  if (filter === "7d") return ageMs <= 7 * dayMs;
  if (filter === "30d") return ageMs <= 30 * dayMs;
  return ageMs > 30 * dayMs;
}

export default function FeedbackInboxPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [allTools, setAllTools] = useState<ToolOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FeedbackInboxTab>("all");
  const [filter, setFilter] = useState<StatusFilter>("open");
  const [dateFilter, setDateFilter] = useState<FeedbackDateFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [toolFilter, setToolFilter] = useState("all");
  const [submitterFilter, setSubmitterFilter] = useState("all");
  const [searchValue, setSearchValue] = useState("");
  const [sortBy, setSortBy] = useState<FeedbackSortValue>("newest");
  const [viewMode, setViewMode] = useState<FeedbackViewMode>("split");
  const [leftWidth, setLeftWidth] = useState(FEEDBACK_LEFT_DEFAULT);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [sendingToGitHub, setSendingToGitHub] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<DisplayStatus | "none">("none");
  const [bulkPriority, setBulkPriority] = useState<FeedbackSeverity | "none">("none");
  const [bulkToolId, setBulkToolId] = useState("none");
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const listPanelRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const preference = loadFeedbackLayout();
    setLeftWidth(preference.leftWidth);
    setLeftCollapsed(preference.leftCollapsed);
    setViewMode(loadFeedbackViewMode());
  }, []);

  useEffect(() => {
    saveFeedbackLayout({ leftWidth, leftCollapsed });
  }, [leftWidth, leftCollapsed]);

  useEffect(() => {
    saveFeedbackViewMode(viewMode);
  }, [viewMode]);

  const dispatchScoped = useCallback(
    (list: FeedbackItem[]) =>
      filter === "dispatched"
        ? list.filter(
            (item) =>
              getDispatchStatus(item) === "dispatched" ||
              getAssignedAgent(item) !== null,
          )
        : list,
    [filter],
  );

  const issueItems = useMemo(
    () =>
      dispatchScoped(
        items.filter((item) => item.request_type !== "feature_request"),
      ),
    [items, dispatchScoped],
  );
  const featureRequestItems = useMemo(
    () =>
      dispatchScoped(
        items.filter((item) => item.request_type === "feature_request"),
      ),
    [items, dispatchScoped],
  );

  const tabScopedItems =
    activeTab === "feature_requests"
      ? featureRequestItems
      : activeTab === "issues"
        ? issueItems
        : dispatchScoped(items);
  const toolOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const item of tabScopedItems) {
      const label = itemToolLabel(item);
      options.set(label, label);
    }
    return [...options.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [tabScopedItems]);
  const categoryOptions = useMemo(() => {
    const options = new Set<string>();
    for (const item of tabScopedItems) {
      if (item.category) options.add(item.category);
    }
    return [...options]
      .map((value) => ({ value, label: value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [tabScopedItems]);
  const submitterOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const item of tabScopedItems) {
      const value = item.created_by;
      const label = item.submitter?.full_name || item.submitter?.email || item.created_by;
      options.set(value, label);
    }
    return [...options.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [tabScopedItems]);
  const filterScopedItems = useMemo(
    () =>
      tabScopedItems.filter((item) => {
        if (!matchesDateFilter(item, dateFilter)) return false;
        if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
        if (toolFilter !== "all" && itemToolLabel(item) !== toolFilter) return false;
        if (submitterFilter !== "all" && item.created_by !== submitterFilter) return false;
        return true;
      }),
    [categoryFilter, dateFilter, submitterFilter, tabScopedItems, toolFilter],
  );
  const searchTerm = searchValue.trim().toLowerCase();
  const visibleItems = useMemo(() => {
    const filtered = searchTerm
      ? filterScopedItems.filter((item) => {
          const submitter =
            item.submitter?.full_name || item.submitter?.email || item.created_by;
          const fields = [
            item.title,
            item.comment,
            itemToolLabel(item),
            item.page_title ?? "",
            item.page_path,
            item.page_url,
            item.category ?? "",
            item.target_text ?? "",
            submitter,
            item.github_issue_number ? `#${item.github_issue_number}` : "",
          ];
          return fields.some((field) => field.toLowerCase().includes(searchTerm));
        })
      : filterScopedItems;

    return [...filtered].sort((a, b) => {
      if (sortBy === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === "priority") {
        const priorityDiff = sortRank(a) - sortRank(b);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === "tool") {
        const toolDiff = itemToolLabel(a).localeCompare(itemToolLabel(b));
        if (toolDiff !== 0) return toolDiff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === "source") {
        const sourceA = itemSourceLabel(a).toLowerCase();
        const sourceB = itemSourceLabel(b).toLowerCase();
        return sourceA.localeCompare(sourceB);
      }
      if (sortBy === "status") {
        const statusA = toDisplayStatus(a.status);
        const statusB = toDisplayStatus(b.status);
        const statusDiff = statusA.localeCompare(statusB);
        if (statusDiff !== 0) return statusDiff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [filterScopedItems, searchTerm, sortBy]);
  const currentTabLabel =
    FEEDBACK_INBOX_TABS.find((tab) => tab.value === activeTab)?.label ?? "Issues";
  const selected = useMemo(
    () => visibleItems.find((i) => i.id === selectedId) ?? null,
    [visibleItems, selectedId],
  );
  const visibleItemIds = useMemo(
    () => visibleItems.map((item) => item.id),
    [visibleItems],
  );
  const allVisibleSelected =
    visibleItemIds.length > 0 &&
    visibleItemIds.every((id) => selectedIds.includes(id));
  const currentFilterLabel =
    STATUS_FILTERS.find((statusFilter) => statusFilter.value === filter)?.label ??
    filter.replace("_", " ");
  const activeFilterCount =
    (activeTab !== "all" ? 1 : 0) +
    (dateFilter !== "all" ? 1 : 0) +
    (categoryFilter !== "all" ? 1 : 0) +
    (toolFilter !== "all" ? 1 : 0) +
    (submitterFilter !== "all" ? 1 : 0);

  // ---- Fetch ----
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const statusQuery = feedbackStatusQuery(filter);
      const excludedStatusQuery = feedbackExcludedStatusQuery(filter);
      params.set("excludeBoardItems", "true");
      if (statusQuery) params.set("status", statusQuery);
      if (excludedStatusQuery) params.set("excludeStatus", excludedStatusQuery);
      const data = await apiFetch<{ items?: FeedbackItem[]; total?: number }>(
        `/api/admin/feedback?${params.toString()}`,
      );
      setItems(data.items ?? []);
    } catch (err) {
      notifyFeedbackInboxFailure({
        operation: "load-feedback-items",
        title: "Could not load feedback items",
        fallback: "The feedback inbox list could not be loaded.",
        error: err,
        metadata: { filter },
      });
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    let cancelled = false;

    async function loadTools() {
      try {
        const data = await apiFetch<{ tools?: ToolOption[] }>(
          "/api/admin/feedback/tools?action=list",
        );
        if (!cancelled) {
          setAllTools(data.tools ?? []);
        }
      } catch (err) {
        notifyFeedbackInboxFailure({
          operation: "load-feedback-tools",
          title: "Could not load tools",
          fallback: "Tool options could not be loaded for bulk editing.",
          error: err,
        });
      }
    }

    loadTools();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) => visibleItemIds.includes(id)),
    );
  }, [visibleItemIds]);

  // Auto-select the most recent item when items load or current selection is invalid
  useEffect(() => {
    if (loading) return;
    if (visibleItems.length === 0) {
      if (selectedId) setSelectedId(null);
      setFocusedIndex(0);
      return;
    }
    const currentExists = selectedId && visibleItems.some((i) => i.id === selectedId);
    if (viewMode === "table") {
      if (selectedId && !currentExists) {
        setSelectedId(null);
      }
      return;
    }
    if (!currentExists) {
      setSelectedId(visibleItems[0].id);
      setFocusedIndex(0);
    }
  }, [loading, selectedId, viewMode, visibleItems]);

  // Keep focusedIndex in sync with selectedId
  useEffect(() => {
    if (selectedId) {
      const idx = visibleItems.findIndex((i) => i.id === selectedId);
      if (idx >= 0) setFocusedIndex(idx);
    }
  }, [selectedId, visibleItems]);

  // ---- Keyboard Navigation ----
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          if (visibleItems.length === 0) return;
          const nextIdx = Math.min(focusedIndex + 1, visibleItems.length - 1);
          setFocusedIndex(nextIdx);
          setSelectedId(visibleItems[nextIdx].id);
          const listEl = listPanelRef.current;
          if (listEl) {
            const buttons = listEl.querySelectorAll("[data-feedback-item]");
            buttons[nextIdx]?.scrollIntoView({ block: "nearest" });
          }
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          if (visibleItems.length === 0) return;
          const prevIdx = Math.max(focusedIndex - 1, 0);
          setFocusedIndex(prevIdx);
          setSelectedId(visibleItems[prevIdx].id);
          const listEl = listPanelRef.current;
          if (listEl) {
            const buttons = listEl.querySelectorAll("[data-feedback-item]");
            buttons[prevIdx]?.scrollIntoView({ block: "nearest" });
          }
          break;
        }
        case "Enter": {
          if (visibleItems.length === 0) return;
          setSelectedId(visibleItems[focusedIndex].id);
          break;
        }
        case "c": {
          e.preventDefault();
          commentInputRef.current?.focus();
          break;
        }
        case "g": {
          if (selected?.github_issue_url) {
            window.open(selected.github_issue_url, "_blank", "noopener,noreferrer");
          }
          break;
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [visibleItems, focusedIndex, selected]);

  // ---- Update status ----
  async function updateStatus(id: string, status: DisplayStatus) {
    setUpdatingId(id);
    const persistedStatus =
      status === "in_review"
        ? "resolved"
        : normalizeFeedbackStoredStatus(status);
    try {
      await apiFetch("/api/admin/feedback", {
        method: "PATCH",
        body: JSON.stringify({ id, status: persistedStatus }),
      });
      const statusLabel =
        STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
      toast.success(`Marked as ${statusLabel}`);
      fetchItems();
    } catch (err) {
      notifyFeedbackInboxFailure({
        operation: "update-feedback-status",
        title: "Could not update status",
        fallback: "The feedback item status could not be updated.",
        error: err,
        metadata: { feedbackId: id, status: persistedStatus },
      });
    } finally {
      setUpdatingId(null);
    }
  }

  async function updateSeverity(
    id: string,
    severity: "high" | "medium" | "low",
  ) {
    setUpdatingId(id);
    try {
      await apiFetch("/api/admin/feedback", {
        method: "PATCH",
        body: JSON.stringify({ id, severity }),
      });
      toast.success("Priority updated");
      fetchItems();
    } catch (err) {
      notifyFeedbackInboxFailure({
        operation: "update-feedback-priority",
        title: "Could not update priority",
        fallback: "The feedback priority could not be updated.",
        error: err,
        metadata: { feedbackId: id, severity },
      });
    } finally {
      setUpdatingId(null);
    }
  }

  async function updateCategory(id: string, category: string | null) {
    setUpdatingId(id);
    try {
      await apiFetch("/api/admin/feedback", {
        method: "PATCH",
        body: JSON.stringify({ id, category }),
      });
      toast.success(category ? "Category updated" : "Category cleared");
      fetchItems();
    } catch (err) {
      notifyFeedbackInboxFailure({
        operation: "update-feedback-category",
        title: "Could not update category",
        fallback: "The feedback category could not be updated.",
        error: err,
        metadata: { feedbackId: id, category },
      });
    } finally {
      setUpdatingId(null);
    }
  }

  async function updateRequestType(id: string, requestType: string) {
    setUpdatingId(id);
    try {
      await apiFetch("/api/admin/feedback", {
        method: "PATCH",
        body: JSON.stringify({ id, request_type: requestType }),
      });
      toast.success("Type updated");
      fetchItems();
    } catch (err) {
      notifyFeedbackInboxFailure({
        operation: "update-feedback-request-type",
        title: "Could not update type",
        fallback: "The feedback type could not be updated.",
        error: err,
        metadata: { feedbackId: id, requestType },
      });
    } finally {
      setUpdatingId(null);
    }
  }

  async function updateTitle(id: string, title: string) {
    setUpdatingId(id);
    try {
      await apiFetch("/api/admin/feedback", {
        method: "PATCH",
        body: JSON.stringify({ id, title }),
      });
      toast.success("Title updated");
      fetchItems();
    } catch (err) {
      notifyFeedbackInboxFailure({
        operation: "update-feedback-title",
        title: "Could not update title",
        fallback: "The feedback title could not be updated.",
        error: err,
        metadata: { feedbackId: id },
      });
    } finally {
      setUpdatingId(null);
    }
  }

  async function updateTool(id: string, toolValue: string) {
    setUpdatingId(id);
    try {
      const toolId = toolValue === "unassigned" ? null : Number(toolValue);
      await apiFetch("/api/admin/feedback/tools", {
        method: "POST",
        body: JSON.stringify({ feedbackId: id, toolId }),
      });
      toast.success(toolId == null ? "Tool cleared" : "Tool updated");
      fetchItems();
    } catch (err) {
      notifyFeedbackInboxFailure({
        operation: "update-feedback-tool",
        title: "Could not update tool",
        fallback: "The feedback tool could not be updated.",
        error: err,
        metadata: { feedbackId: id, toolValue },
      });
    } finally {
      setUpdatingId(null);
    }
  }

  async function applyBulkStatus() {
    if (bulkStatus === "none" || selectedIds.length === 0) return;
    setBulkUpdating(true);
    const persistedStatus =
      bulkStatus === "in_review"
        ? "resolved"
        : normalizeFeedbackStoredStatus(bulkStatus);
    try {
      await Promise.all(
        selectedIds.map((id) =>
          apiFetch("/api/admin/feedback", {
            method: "PATCH",
            body: JSON.stringify({ id, status: persistedStatus }),
          }),
        ),
      );
      toast.success(`Updated status for ${selectedIds.length} items`);
      setSelectedIds([]);
      setBulkStatus("none");
      fetchItems();
    } catch (err) {
      notifyFeedbackInboxFailure({
        operation: "bulk-update-feedback-status",
        title: "Could not bulk update status",
        fallback: "The selected feedback statuses could not be updated.",
        error: err,
        metadata: { count: selectedIds.length },
      });
    } finally {
      setBulkUpdating(false);
    }
  }

  async function applyBulkPriority() {
    if (bulkPriority === "none" || selectedIds.length === 0) return;
    setBulkUpdating(true);
    try {
      await Promise.all(
        selectedIds.map((id) =>
          apiFetch("/api/admin/feedback", {
            method: "PATCH",
            body: JSON.stringify({ id, severity: bulkPriority }),
          }),
        ),
      );
      toast.success(`Updated priority for ${selectedIds.length} items`);
      setSelectedIds([]);
      setBulkPriority("none");
      fetchItems();
    } catch (err) {
      notifyFeedbackInboxFailure({
        operation: "bulk-update-feedback-priority",
        title: "Could not bulk update priority",
        fallback: "The selected feedback priorities could not be updated.",
        error: err,
        metadata: { count: selectedIds.length },
      });
    } finally {
      setBulkUpdating(false);
    }
  }

  async function applyBulkTool() {
    if (bulkToolId === "none" || selectedIds.length === 0) return;
    setBulkUpdating(true);
    try {
      const toolId = bulkToolId === "unassigned" ? null : Number(bulkToolId);
      await Promise.all(
        selectedIds.map((feedbackId) =>
          apiFetch("/api/admin/feedback/tools", {
            method: "POST",
            body: JSON.stringify({ feedbackId, toolId }),
          }),
        ),
      );
      toast.success(`Updated tool for ${selectedIds.length} items`);
      setSelectedIds([]);
      setBulkToolId("none");
      fetchItems();
    } catch (err) {
      notifyFeedbackInboxFailure({
        operation: "bulk-update-feedback-tool",
        title: "Could not bulk update tool",
        fallback: "The selected feedback tools could not be updated.",
        error: err,
        metadata: { count: selectedIds.length },
      });
    } finally {
      setBulkUpdating(false);
    }
  }

  async function applyBulkCategory(clear = false) {
    if ((!clear && bulkCategory.trim().length === 0) || selectedIds.length === 0) {
      return;
    }
    setBulkUpdating(true);
    try {
      const category = clear ? null : bulkCategory.trim();
      await Promise.all(
        selectedIds.map((id) =>
          apiFetch("/api/admin/feedback", {
            method: "PATCH",
            body: JSON.stringify({ id, category }),
          }),
        ),
      );
      toast.success(
        clear
          ? `Cleared category for ${selectedIds.length} items`
          : `Updated category for ${selectedIds.length} items`,
      );
      setSelectedIds([]);
      setBulkCategory("");
      fetchItems();
    } catch (err) {
      notifyFeedbackInboxFailure({
        operation: clear
          ? "bulk-clear-feedback-category"
          : "bulk-update-feedback-category",
        title: clear ? "Could not clear categories" : "Could not bulk update category",
        fallback: clear
          ? "The selected feedback categories could not be cleared."
          : "The selected feedback categories could not be updated.",
        error: err,
        metadata: { count: selectedIds.length },
      });
    } finally {
      setBulkUpdating(false);
    }
  }

  // ---- Send to GitHub ----
  async function sendToGitHub(id: string) {
    setSendingToGitHub(true);
    try {
      const data = await apiFetch<{ githubIssue?: { number?: number } }>(
        "/api/admin/feedback",
        {
          method: "PUT",
          body: JSON.stringify({ id }),
        },
      );
      toast.success(`Created GitHub issue #${data.githubIssue?.number ?? ""}`);
      fetchItems();
    } catch (err) {
      notifyFeedbackInboxFailure({
        operation: "send-feedback-to-github",
        title: "Could not send to GitHub",
        fallback: "The feedback item could not be sent to GitHub.",
        error: err,
        metadata: { feedbackId: id },
      });
    } finally {
      setSendingToGitHub(false);
    }
  }

  // ---- Delete ----
  async function deleteItem(id: string) {
    const previousItems = items;
    const previousSelectedId = selectedId;

    setDeletingId(id);
    setItems((currentItems) => currentItems.filter((item) => item.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
    }

    try {
      await apiFetch("/api/admin/feedback", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      toast.success("Feedback item deleted");
      fetchItems();
    } catch (err) {
      setItems(previousItems);
      setSelectedId(previousSelectedId);
      notifyFeedbackInboxFailure({
        operation: "delete-feedback-item",
        title: "Could not delete feedback item",
        fallback: "The feedback item could not be deleted.",
        error: err,
        metadata: { feedbackId: id },
      });
    } finally {
      setDeletingId(null);
    }
  }

  async function deleteSelectedItems() {
    if (selectedIds.length === 0) return;

    const idsToDelete = [...selectedIds];
    const previousItems = items;
    const previousSelectedId = selectedId;

    setBulkDeleting(true);
    setItems((currentItems) =>
      currentItems.filter((item) => !idsToDelete.includes(item.id)),
    );
    setSelectedIds([]);
    if (selectedId && idsToDelete.includes(selectedId)) {
      setSelectedId(null);
    }

    try {
      await Promise.all(
        idsToDelete.map((id) =>
          apiFetch("/api/admin/feedback", {
            method: "DELETE",
            body: JSON.stringify({ id }),
          }),
        ),
      );
      toast.success(
        `Deleted ${idsToDelete.length} feedback item${idsToDelete.length === 1 ? "" : "s"}`,
      );
      fetchItems();
    } catch (err) {
      setItems(previousItems);
      setSelectedIds(idsToDelete);
      setSelectedId(previousSelectedId);
      notifyFeedbackInboxFailure({
        operation: "bulk-delete-feedback-items",
        title: "Could not delete selected feedback",
        fallback: "The selected feedback items could not be deleted.",
        error: err,
        metadata: { count: idsToDelete.length },
      });
    } finally {
      setBulkDeleting(false);
    }
  }

  function selectItem(id: string) {
    setSelectedId(id);
  }

  function toggleBulkSelected(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked
        ? [...new Set([...current, id])]
        : current.filter((value) => value !== id),
    );
  }

  function toggleSelectAllVisible(checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        return [...new Set([...current, ...visibleItemIds])];
      }
      return current.filter((id) => !visibleItemIds.includes(id));
    });
  }

  function selectItemFromBoard(id: string) {
    setSelectedId(id);
    setViewMode("split");
  }

  const handleInboxTabClick = useCallback((value: string) => {
    setActiveTab(value as FeedbackInboxTab);
    setSelectedId(null);
    setFocusedIndex(0);
  }, []);

  const handleFilterTabClick = useCallback((value: string) => {
    setFilter(value as StatusFilter);
    setSelectedId(null);
    setFocusedIndex(0);
  }, []);

  const handleResizeStart = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = leftWidth;

      function handleMove(moveEvent: MouseEvent) {
        const nextWidth = clampNumber(
          startWidth + moveEvent.clientX - startX,
          FEEDBACK_LEFT_MIN,
          FEEDBACK_LEFT_MAX,
        );
        setLeftWidth(nextWidth);
      }

      function handleUp() {
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleUp);
      }

      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleUp);
    },
    [leftWidth],
  );

  return (
    <PageShell
      variant="dashboard"
      title="Feedback Inbox"
      showHeader={false}
      className="bg-background px-0! py-0!"
      contentClassName="space-y-0 pt-0 pb-0"
      fillHeight
      description="Review feedback, assign tools, and sync issues to GitHub."
    >
      <VeltFeedbackComments
        documentId="feedback-inbox"
        documentName="Feedback Inbox"
      />
      <SplitPageFrame
        height="fill"
        className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-background"
      >
        {viewMode === "board" ? (
          <FeedbackBoardPane
            activeFilterCount={activeFilterCount}
            activeTab={activeTab}
            currentFilterLabel={currentFilterLabel}
            currentTabLabel={currentTabLabel}
            categoryFilter={categoryFilter}
            categoryOptions={categoryOptions}
            dateFilter={dateFilter}
            featureRequestCount={featureRequestItems.length}
            filter={filter}
            issueCount={issueItems.length}
            items={visibleItems}
            loading={loading}
            searchValue={searchValue}
            selectedId={selectedId}
            sortBy={sortBy}
            submitterFilter={submitterFilter}
            submitterOptions={submitterOptions}
            toolFilter={toolFilter}
            toolOptions={toolOptions}
            totalCount={dispatchScoped(items).length}
            onDateFilterChange={setDateFilter}
            onCategoryFilterChange={setCategoryFilter}
            onFilterChange={handleFilterTabClick}
            onInboxTabChange={handleInboxTabClick}
            onSearchChange={setSearchValue}
            onSelect={selectItemFromBoard}
            onSortChange={setSortBy}
            onSubmitterFilterChange={setSubmitterFilter}
            onToolFilterChange={setToolFilter}
            onViewModeChange={setViewMode}
            viewMode={viewMode}
          />
        ) : viewMode === "table" ? (
          <FeedbackTablePane
            activeFilterCount={activeFilterCount}
            activeTab={activeTab}
            allTools={allTools}
            allVisibleSelected={allVisibleSelected}
            categoryFilter={categoryFilter}
            categoryOptions={categoryOptions}
            commentInputRef={commentInputRef}
            currentFilterLabel={currentFilterLabel}
            currentTabLabel={currentTabLabel}
            dateFilter={dateFilter}
            deletingId={deletingId}
            featureRequestCount={featureRequestItems.length}
            filter={filter}
            issueCount={issueItems.length}
            items={visibleItems}
            loading={loading}
            searchValue={searchValue}
            selected={selected}
            selectedId={selectedId}
            selectedIds={selectedIds}
            sortBy={sortBy}
            submitterFilter={submitterFilter}
            submitterOptions={submitterOptions}
            toolFilter={toolFilter}
            toolOptions={toolOptions}
            totalCount={dispatchScoped(items).length}
            updatingId={updatingId}
            sendingToGitHub={sendingToGitHub}
            viewMode={viewMode}
            onCategoryFilterChange={setCategoryFilter}
            onCloseDetail={() => setSelectedId(null)}
            onDateFilterChange={setDateFilter}
            onDelete={deleteItem}
            onFilterChange={handleFilterTabClick}
            onInboxTabChange={handleInboxTabClick}
            onSearchChange={setSearchValue}
            onSelect={selectItem}
            onSendToGitHub={sendToGitHub}
            onSortChange={setSortBy}
            onSubmitterFilterChange={setSubmitterFilter}
            onToggleSelectAllVisible={toggleSelectAllVisible}
            onToggleBulkSelected={toggleBulkSelected}
            onToolFilterChange={setToolFilter}
            onUpdateCategory={updateCategory}
            onUpdateRequestType={updateRequestType}
            onUpdateSeverity={updateSeverity}
            onUpdateStatus={updateStatus}
            onUpdateTool={updateTool}
            onUpdateTitle={updateTitle}
            onRefresh={fetchItems}
            onViewModeChange={setViewMode}
            pathname={pathname}
            router={router}
            searchParams={searchParams}
          />
        ) : (
          <SplitPage
            variant="two-column"
            breakpoint="lg"
            defaultIsOpen={!selected}
            className="min-h-0 flex-1"
            firstPaneClassName={leftCollapsed ? "lg:w-14" : "lg:w-auto"}
            secondPaneClassName="bg-background"
          >
            <FeedbackListPane
              activeFilterCount={activeFilterCount}
              activeTab={activeTab}
              currentFilterLabel={currentFilterLabel}
              currentTabLabel={currentTabLabel}
              categoryFilter={categoryFilter}
              categoryOptions={categoryOptions}
              dateFilter={dateFilter}
              deletingId={deletingId}
              featureRequestCount={featureRequestItems.length}
              filter={filter}
              focusedIndex={focusedIndex}
              issueCount={issueItems.length}
              items={visibleItems}
              leftCollapsed={leftCollapsed}
              leftWidth={leftWidth}
              listPanelRef={listPanelRef}
              loading={loading}
              searchValue={searchValue}
              selectedIds={selectedIds}
              selectedId={selectedId}
              sortBy={sortBy}
              submitterFilter={submitterFilter}
              submitterOptions={submitterOptions}
              toolFilter={toolFilter}
              toolOptions={toolOptions}
              totalCount={dispatchScoped(items).length}
              viewMode={viewMode}
              onDelete={deleteItem}
              onDateFilterChange={setDateFilter}
              onCategoryFilterChange={setCategoryFilter}
              onFilterChange={handleFilterTabClick}
              onInboxTabChange={handleInboxTabClick}
              onResizeStart={handleResizeStart}
              onSearchChange={setSearchValue}
              onSelect={selectItem}
              onToggleBulkSelected={toggleBulkSelected}
              onToggleSelectAllVisible={toggleSelectAllVisible}
              onSendToGitHub={sendToGitHub}
              onBulkCategoryChange={setBulkCategory}
              onBulkPriorityChange={setBulkPriority}
              onBulkStatusChange={setBulkStatus}
              onBulkToolChange={setBulkToolId}
              onApplyBulkCategory={applyBulkCategory}
              onApplyBulkPriority={applyBulkPriority}
              onApplyBulkStatus={applyBulkStatus}
              onApplyBulkTool={applyBulkTool}
              onSortChange={setSortBy}
              onSubmitterFilterChange={setSubmitterFilter}
              onToggleCollapsed={() => setLeftCollapsed((value) => !value)}
              onToolFilterChange={setToolFilter}
              onUpdateStatus={updateStatus}
              onViewModeChange={setViewMode}
              allTools={allTools}
              allVisibleSelected={allVisibleSelected}
              bulkCategory={bulkCategory}
              bulkPriority={bulkPriority}
              bulkStatus={bulkStatus}
              bulkToolId={bulkToolId}
              bulkDeleting={bulkDeleting}
              bulkUpdating={bulkUpdating}
              onDeleteSelected={deleteSelectedItems}
            />
            <FeedbackDetailPane
              allTools={allTools}
              categoryOptions={categoryOptions}
              commentInputRef={commentInputRef}
              deletingId={deletingId}
              item={selected}
              sendingToGitHub={sendingToGitHub}
              updatingId={updatingId}
              onDelete={deleteItem}
              onSendToGitHub={sendToGitHub}
              onUpdateRequestType={updateRequestType}
              onUpdateSeverity={updateSeverity}
              onUpdateTool={updateTool}
              onUpdateTitle={updateTitle}
              onUpdateCategory={updateCategory}
              onUpdateStatus={updateStatus}
              onRefresh={fetchItems}
            />
          </SplitPage>
        )}
      </SplitPageFrame>
    </PageShell>
  );
}

function FeedbackListPane({
  activeFilterCount,
  activeTab,
  currentFilterLabel,
  currentTabLabel,
  categoryFilter,
  categoryOptions,
  dateFilter,
  deletingId,
  featureRequestCount,
  filter,
  issueCount,
  items,
  leftCollapsed,
  leftWidth,
  listPanelRef,
  loading,
  searchValue,
  selectedIds,
  selectedId,
  sortBy,
  submitterFilter,
  submitterOptions,
  toolFilter,
  toolOptions,
  totalCount,
  viewMode,
  allTools,
  allVisibleSelected,
  bulkCategory,
  bulkPriority,
  bulkStatus,
  bulkToolId,
  bulkDeleting,
  bulkUpdating,
  onDelete,
  onApplyBulkCategory,
  onApplyBulkPriority,
  onApplyBulkStatus,
  onApplyBulkTool,
  onBulkCategoryChange,
  onBulkPriorityChange,
  onBulkStatusChange,
  onBulkToolChange,
  onDeleteSelected,
  onCategoryFilterChange,
  onDateFilterChange,
  onFilterChange,
  onInboxTabChange,
  onResizeStart,
  onSearchChange,
  onSelect,
  onToggleBulkSelected,
  onToggleSelectAllVisible,
  onSendToGitHub,
  onSortChange,
  onSubmitterFilterChange,
  onToggleCollapsed,
  onToolFilterChange,
  onUpdateStatus,
  onViewModeChange,
}: {
  activeFilterCount: number;
  activeTab: FeedbackInboxTab;
  currentFilterLabel: string;
  currentTabLabel: string;
  categoryFilter: string;
  categoryOptions: { value: string; label: string }[];
  dateFilter: FeedbackDateFilter;
  deletingId: string | null;
  featureRequestCount: number;
  filter: StatusFilter;
  focusedIndex: number;
  issueCount: number;
  items: FeedbackItem[];
  leftCollapsed: boolean;
  leftWidth: number;
  listPanelRef: RefObject<HTMLDivElement | null>;
  loading: boolean;
  searchValue: string;
  selectedIds: string[];
  selectedId: string | null;
  sortBy: FeedbackSortValue;
  submitterFilter: string;
  submitterOptions: { value: string; label: string }[];
  toolFilter: string;
  toolOptions: { value: string; label: string }[];
  totalCount: number;
  viewMode: FeedbackViewMode;
  allTools: ToolOption[];
  allVisibleSelected: boolean;
  bulkCategory: string;
  bulkPriority: FeedbackSeverity | "none";
  bulkStatus: DisplayStatus | "none";
  bulkToolId: string;
  bulkDeleting: boolean;
  bulkUpdating: boolean;
  onDelete: (id: string) => void;
  onApplyBulkCategory: (clear?: boolean) => void;
  onApplyBulkPriority: () => void;
  onApplyBulkStatus: () => void;
  onApplyBulkTool: () => void;
  onBulkCategoryChange: (value: string) => void;
  onBulkPriorityChange: (value: FeedbackSeverity | "none") => void;
  onBulkStatusChange: (value: DisplayStatus | "none") => void;
  onBulkToolChange: (value: string) => void;
  onDeleteSelected: () => void;
  onCategoryFilterChange: (value: string) => void;
  onDateFilterChange: (value: FeedbackDateFilter) => void;
  onFilterChange: (value: string) => void;
  onInboxTabChange: (value: string) => void;
  onResizeStart: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
  onToggleBulkSelected: (id: string, checked: boolean) => void;
  onToggleSelectAllVisible: (checked: boolean) => void;
  onSendToGitHub: (id: string) => void;
  onSortChange: (value: FeedbackSortValue) => void;
  onSubmitterFilterChange: (value: string) => void;
  onToggleCollapsed: () => void;
  onToolFilterChange: (value: string) => void;
  onUpdateStatus: (id: string, status: DisplayStatus) => void;
  onViewModeChange: (value: FeedbackViewMode) => void;
}) {
  const splitPage = useSplitPage();
  function handleSelect(id: string) {
    onSelect(id);
    if (!splitPage.isDesktop) splitPage.onClose();
  }

  if (leftCollapsed && splitPage.isDesktop) {
    return (
      <div className="flex h-full w-14 flex-col items-center border-r border-border/70 bg-muted/30 py-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full text-muted-foreground"
          onClick={onToggleCollapsed}
          aria-label="Expand feedback list"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={listPanelRef}
      className="relative flex h-full min-h-0 w-full flex-col border-r border-border/70 bg-muted/30 lg:w-[var(--feedback-left-width)]"
      style={{ "--feedback-left-width": `${leftWidth}px` } as CSSProperties}
    >
      <div className="border-b border-border/70 bg-background px-4 py-4">
        <FeedbackWorkspaceHeader
          activeFilterCount={activeFilterCount}
          activeTab={activeTab}
          categoryFilter={categoryFilter}
          categoryOptions={categoryOptions}
          dateFilter={dateFilter}
          featureRequestCount={featureRequestCount}
          issueCount={issueCount}
          searchValue={searchValue}
          sortBy={sortBy}
          submitterFilter={submitterFilter}
          submitterOptions={submitterOptions}
          toolFilter={toolFilter}
          toolOptions={toolOptions}
          totalCount={totalCount}
          viewMode={viewMode}
          onCategoryFilterChange={onCategoryFilterChange}
          onDateFilterChange={onDateFilterChange}
          onInboxTabChange={onInboxTabChange}
          onSearchChange={onSearchChange}
          onSortChange={onSortChange}
          onSubmitterFilterChange={onSubmitterFilterChange}
          onToolFilterChange={onToolFilterChange}
          onViewModeChange={onViewModeChange}
          trailingActions={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden h-8 w-8 rounded-full text-muted-foreground lg:inline-flex"
              onClick={onToggleCollapsed}
              aria-label="Collapse feedback list"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          }
        />
        <div className="mt-4">
          <FeedbackStatusTabs
            value={filter}
            onValueChange={onFilterChange}
            allVisibleSelected={allVisibleSelected}
            onToggleSelectAllVisible={onToggleSelectAllVisible}
          />
        </div>
        {selectedIds.length > 0 && (
          <BulkEditBar
            allTools={allTools}
            bulkCategory={bulkCategory}
            bulkDeleting={bulkDeleting}
            bulkPriority={bulkPriority}
            bulkStatus={bulkStatus}
            bulkToolId={bulkToolId}
            bulkUpdating={bulkUpdating}
            selectedCount={selectedIds.length}
            onApplyBulkCategory={onApplyBulkCategory}
            onApplyBulkPriority={onApplyBulkPriority}
            onApplyBulkStatus={onApplyBulkStatus}
            onApplyBulkTool={onApplyBulkTool}
            onBulkCategoryChange={onBulkCategoryChange}
            onBulkPriorityChange={onBulkPriorityChange}
            onBulkStatusChange={onBulkStatusChange}
            onBulkToolChange={onBulkToolChange}
            onDeleteSelected={onDeleteSelected}
          />
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <FeedbackQueue
          items={items}
          selectedId={selectedId}
          selectedIds={selectedIds}
          loading={loading}
          currentFilterLabel={`${currentFilterLabel} ${currentTabLabel}`}
          onSelect={handleSelect}
          onToggleBulkSelected={onToggleBulkSelected}
          onUpdateStatus={onUpdateStatus}
          onSendToGitHub={onSendToGitHub}
          onDelete={onDelete}
        />
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Resize feedback list"
        className="absolute right-0 top-0 hidden h-full w-1 translate-x-1/2 cursor-col-resize rounded-none bg-transparent p-0 transition-colors hover:bg-primary/40 lg:block"
        onMouseDown={onResizeStart}
      />
    </div>
  );
}

function FeedbackBoardPane({
  activeFilterCount,
  activeTab,
  currentFilterLabel,
  currentTabLabel,
  categoryFilter,
  categoryOptions,
  dateFilter,
  featureRequestCount,
  filter,
  issueCount,
  items,
  loading,
  searchValue,
  selectedId,
  sortBy,
  submitterFilter,
  submitterOptions,
  toolFilter,
  toolOptions,
  totalCount,
  viewMode,
  onDateFilterChange,
  onCategoryFilterChange,
  onFilterChange,
  onInboxTabChange,
  onSearchChange,
  onSelect,
  onSortChange,
  onSubmitterFilterChange,
  onToolFilterChange,
  onViewModeChange,
}: {
  activeFilterCount: number;
  activeTab: FeedbackInboxTab;
  currentFilterLabel: string;
  currentTabLabel: string;
  categoryFilter: string;
  categoryOptions: { value: string; label: string }[];
  dateFilter: FeedbackDateFilter;
  featureRequestCount: number;
  filter: StatusFilter;
  issueCount: number;
  items: FeedbackItem[];
  loading: boolean;
  searchValue: string;
  selectedId: string | null;
  sortBy: FeedbackSortValue;
  submitterFilter: string;
  submitterOptions: { value: string; label: string }[];
  toolFilter: string;
  toolOptions: { value: string; label: string }[];
  totalCount: number;
  viewMode: FeedbackViewMode;
  onDateFilterChange: (value: FeedbackDateFilter) => void;
  onCategoryFilterChange: (value: string) => void;
  onFilterChange: (value: string) => void;
  onInboxTabChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
  onSortChange: (value: FeedbackSortValue) => void;
  onSubmitterFilterChange: (value: string) => void;
  onToolFilterChange: (value: string) => void;
  onViewModeChange: (value: FeedbackViewMode) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="shrink-0 border-b border-border/70 bg-background px-4 py-4">
        <FeedbackWorkspaceHeader
          activeFilterCount={activeFilterCount}
          activeTab={activeTab}
          categoryFilter={categoryFilter}
          categoryOptions={categoryOptions}
          dateFilter={dateFilter}
          featureRequestCount={featureRequestCount}
          issueCount={issueCount}
          searchValue={searchValue}
          sortBy={sortBy}
          submitterFilter={submitterFilter}
          submitterOptions={submitterOptions}
          toolFilter={toolFilter}
          toolOptions={toolOptions}
          totalCount={totalCount}
          viewMode={viewMode}
          onCategoryFilterChange={onCategoryFilterChange}
          onDateFilterChange={onDateFilterChange}
          onInboxTabChange={onInboxTabChange}
          onSearchChange={onSearchChange}
          onSortChange={onSortChange}
          onSubmitterFilterChange={onSubmitterFilterChange}
          onToolFilterChange={onToolFilterChange}
          onViewModeChange={onViewModeChange}
        />
        <div className="mt-4">
          <FeedbackStatusTabs
            value={filter}
            onValueChange={onFilterChange}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-full min-h-48 items-center justify-center px-6 text-center">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">No feedback items</p>
              <p className="text-sm text-muted-foreground">
                No {`${currentFilterLabel} ${currentTabLabel}`.toLowerCase()} items found.
              </p>
            </div>
          </div>
        ) : (
          <BoardView
            columns={FEEDBACK_BOARD_COLUMNS}
            items={items}
            getItemId={(item) => item.id}
            getColumnId={feedbackBoardColumnId}
            renderCard={(item) => (
              <FeedbackBoardCard
                item={item}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            )}
            className="min-w-full"
            columnsClassName="min-w-72"
          />
        )}
      </div>
    </div>
  );
}

function FeedbackTablePane({
  activeFilterCount,
  activeTab,
  allTools,
  allVisibleSelected,
  categoryFilter,
  categoryOptions,
  commentInputRef,
  currentFilterLabel,
  currentTabLabel,
  dateFilter,
  deletingId,
  featureRequestCount,
  filter,
  issueCount,
  items,
  loading,
  pathname,
  router,
  searchParams,
  searchValue,
  selected,
  selectedId,
  selectedIds,
  sendingToGitHub,
  sortBy,
  submitterFilter,
  submitterOptions,
  toolFilter,
  toolOptions,
  totalCount,
  updatingId,
  viewMode,
  onCategoryFilterChange,
  onCloseDetail,
  onDateFilterChange,
  onDelete,
  onFilterChange,
  onInboxTabChange,
  onRefresh,
  onSearchChange,
  onSelect,
  onSendToGitHub,
  onSortChange,
  onSubmitterFilterChange,
  onToggleBulkSelected,
  onToggleSelectAllVisible,
  onToolFilterChange,
  onUpdateCategory,
  onUpdateRequestType,
  onUpdateSeverity,
  onUpdateStatus,
  onUpdateTool,
  onUpdateTitle,
  onViewModeChange,
}: {
  activeFilterCount: number;
  activeTab: FeedbackInboxTab;
  allTools: ToolOption[];
  allVisibleSelected: boolean;
  categoryFilter: string;
  categoryOptions: { value: string; label: string }[];
  commentInputRef: RefObject<HTMLTextAreaElement | null>;
  currentFilterLabel: string;
  currentTabLabel: string;
  dateFilter: FeedbackDateFilter;
  deletingId: string | null;
  featureRequestCount: number;
  filter: StatusFilter;
  issueCount: number;
  items: FeedbackItem[];
  loading: boolean;
  pathname: string;
  router: ReturnType<typeof useRouter>;
  searchParams: ReturnType<typeof useSearchParams>;
  searchValue: string;
  selected: FeedbackItem | null;
  selectedId: string | null;
  selectedIds: string[];
  sendingToGitHub: boolean;
  sortBy: FeedbackSortValue;
  submitterFilter: string;
  submitterOptions: { value: string; label: string }[];
  toolFilter: string;
  toolOptions: { value: string; label: string }[];
  totalCount: number;
  updatingId: string | null;
  viewMode: FeedbackViewMode;
  onCategoryFilterChange: (value: string) => void;
  onCloseDetail: () => void;
  onDateFilterChange: (value: FeedbackDateFilter) => void;
  onDelete: (id: string) => void;
  onFilterChange: (value: string) => void;
  onInboxTabChange: (value: string) => void;
  onRefresh: () => void;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
  onSendToGitHub: (id: string) => void;
  onSortChange: (value: FeedbackSortValue) => void;
  onSubmitterFilterChange: (value: string) => void;
  onToggleBulkSelected: (id: string, checked: boolean) => void;
  onToggleSelectAllVisible: (checked: boolean) => void;
  onToolFilterChange: (value: string) => void;
  onUpdateCategory: (id: string, category: string | null) => void;
  onUpdateRequestType: (id: string, requestType: string) => void;
  onUpdateSeverity: (id: string, severity: "high" | "medium" | "low") => void;
  onUpdateStatus: (id: string, status: DisplayStatus) => void;
  onUpdateTool: (id: string, toolValue: string) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onViewModeChange: (value: FeedbackViewMode) => void;
}) {
  const tableState = useUnifiedTableState({
    entityKey: "feedback-inbox-table",
    searchParams,
    pathname,
    router: {
      replace: (url: string) => {
        router.replace(url);
      },
    },
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 50,
      search: "",
      sortBy: null,
      sortDirection: "desc",
      visibleColumns: [...FEEDBACK_TABLE_DEFAULT_VISIBLE_COLUMNS],
      filters: {},
    },
  });
  const tableColumns = useMemo(() => buildFeedbackTableColumns(), []);
  const hasFilters = activeFilterCount > 0 || searchValue.trim().length > 0;
  const totalPages = Math.max(1, Math.ceil(items.length / tableState.perPage));

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="shrink-0 border-b border-border/70 bg-background px-4 py-4">
        <FeedbackWorkspaceHeader
          activeFilterCount={activeFilterCount}
          activeTab={activeTab}
          categoryFilter={categoryFilter}
          categoryOptions={categoryOptions}
          dateFilter={dateFilter}
          featureRequestCount={featureRequestCount}
          issueCount={issueCount}
          searchValue={searchValue}
          sortBy={sortBy}
          submitterFilter={submitterFilter}
          submitterOptions={submitterOptions}
          toolFilter={toolFilter}
          toolOptions={toolOptions}
          totalCount={totalCount}
          viewMode={viewMode}
          onCategoryFilterChange={onCategoryFilterChange}
          onDateFilterChange={onDateFilterChange}
          onInboxTabChange={onInboxTabChange}
          onSearchChange={onSearchChange}
          onSortChange={onSortChange}
          onSubmitterFilterChange={onSubmitterFilterChange}
          onToolFilterChange={onToolFilterChange}
          onViewModeChange={onViewModeChange}
        />
        <div className="mt-4">
          <FeedbackStatusTabs
            value={filter}
            onValueChange={onFilterChange}
            allVisibleSelected={allVisibleSelected}
            selectedCount={selectedIds.length}
            onToggleSelectAllVisible={onToggleSelectAllVisible}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-4 py-4">
        <EmbeddedUnifiedTablePage
          title="Feedback Inbox"
          description="Dense table view for feedback triage."
          data={{
            items,
            isLoading: loading,
          }}
          toolbar={{
            totalItems: items.length,
            filteredItems: items.length,
            selectedCount: selectedIds.length,
            searchValue,
            onSearchChange,
            currentView: "table",
            onViewChange: () => undefined,
            enabledViews: ["table"],
            visibleColumns: tableState.visibleColumns,
            onColumnVisibilityChange: tableState.setVisibleColumns,
            savedViewsScope: "feedback-inbox-table",
            savedViewsDefaults: {
              visibleColumns: [...FEEDBACK_TABLE_DEFAULT_VISIBLE_COLUMNS],
              sortBy: null,
              sortDirection: "desc",
              filters: {},
            },
          }}
          table={{
            columns: tableColumns,
            getRowId: (item) => item.id,
            activeRowId: selectedId,
            onRowClick: (item) => onSelect(item.id),
            onView: (item) => onSelect(item.id),
            onDelete: (item) => onDelete(item.id),
            density: "compact",
          }}
          selection={{
            selectedIds,
            onSelectAll: onToggleSelectAllVisible,
            onSelectRow: onToggleBulkSelected,
          }}
          emptyState={{
            title: "No feedback items",
            description: "Feedback appears here when items are submitted.",
            filteredDescription: "No feedback matches the current search or filters.",
            isFiltered: hasFilters,
          }}
          pagination={{
            page: Math.min(tableState.page, totalPages),
            totalPages,
            perPage: tableState.perPage,
            onPageChange: tableState.setPage,
            onPerPageChange: (value) => tableState.setPerPage(Number(value)),
            clientSide: true,
          }}
          sidePanel={
                selected
              ? {
                  content: (
                    <FeedbackTableDetailPanel
                      allTools={allTools}
                      categoryOptions={categoryOptions}
                      commentInputRef={commentInputRef}
                      deletingId={deletingId}
                      item={selected}
                      sendingToGitHub={sendingToGitHub}
                      updatingId={updatingId}
                      onDelete={onDelete}
                      onRefresh={onRefresh}
                      onSendToGitHub={onSendToGitHub}
                      onUpdateCategory={onUpdateCategory}
                      onUpdateRequestType={onUpdateRequestType}
                      onUpdateSeverity={onUpdateSeverity}
                      onUpdateStatus={onUpdateStatus}
                      onUpdateTool={onUpdateTool}
                      onUpdateTitle={onUpdateTitle}
                    />
                  ),
                  onClose: onCloseDetail,
                  storageKey: "feedback-inbox-table-detail",
                  contentClassName: "pl-0 pr-0",
                }
              : undefined
          }
          layout={{
            containerPadding: false,
            removeTableFrame: false,
            fullBleedTable: true,
          }}
          features={{
            enableSearch: false,
            enableViews: false,
            enableFilters: false,
          }}
        />
      </div>
    </div>
  );
}

function BulkEditBar({
  allTools,
  bulkCategory,
  bulkDeleting,
  bulkPriority,
  bulkStatus,
  bulkToolId,
  bulkUpdating,
  selectedCount,
  onApplyBulkCategory,
  onApplyBulkPriority,
  onApplyBulkStatus,
  onApplyBulkTool,
  onBulkCategoryChange,
  onBulkPriorityChange,
  onBulkStatusChange,
  onBulkToolChange,
  onDeleteSelected,
}: {
  allTools: ToolOption[];
  bulkCategory: string;
  bulkDeleting: boolean;
  bulkPriority: FeedbackSeverity | "none";
  bulkStatus: DisplayStatus | "none";
  bulkToolId: string;
  bulkUpdating: boolean;
  selectedCount: number;
  onApplyBulkCategory: (clear?: boolean) => void;
  onApplyBulkPriority: () => void;
  onApplyBulkStatus: () => void;
  onApplyBulkTool: () => void;
  onBulkCategoryChange: (value: string) => void;
  onBulkPriorityChange: (value: FeedbackSeverity | "none") => void;
  onBulkStatusChange: (value: DisplayStatus | "none") => void;
  onBulkToolChange: (value: string) => void;
  onDeleteSelected: () => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTarget, setSettingsTarget] = useState<BulkEditTarget>("status");

  function openSettings(target: BulkEditTarget) {
    setSettingsTarget(target);
    setSettingsOpen(true);
  }

  return (
    <>
      <div className="mt-3 border-t border-border/60 pt-3">
        <div className="flex items-center justify-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="h-8 w-8 shrink-0"
                aria-label="Bulk edit selected feedback"
                title="Edit selected feedback"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Bulk edit</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => openSettings("status")}>
                <CircleDot className="h-4 w-4" />
                Change status
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openSettings("priority")}>
                <AlertCircle className="h-4 w-4" />
                Change priority
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openSettings("tool")}>
                <Shapes className="h-4 w-4" />
                Change tool
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => openSettings("category")}>
                <Tag className="h-4 w-4" />
                Change category
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="h-8 w-8 shrink-0"
            aria-label="Delete selected feedback"
            title="Delete selected feedback"
            onClick={onDeleteSelected}
            disabled={bulkDeleting || bulkUpdating}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <SidePanel open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SidePanelContent side="right" size="md">
          <SidePanelHeader className="space-y-1">
            <SidePanelTitle>Bulk edit selected feedback</SidePanelTitle>
            <SheetDescription>
              Choose one field, update it once, and apply it across {selectedCount} selected item
              {selectedCount === 1 ? "" : "s"}.
            </SheetDescription>
          </SidePanelHeader>

          <SidePanelBody className="space-y-8 px-6 py-6">
            <section className={cn("space-y-3", settingsTarget !== "status" && "opacity-60")}>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Status</h3>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={bulkStatus}
                    onValueChange={(value) =>
                      onBulkStatusChange(value as DisplayStatus | "none")
                    }
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Choose status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Choose status</SelectItem>
                      {STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      bulkUpdating || settingsTarget !== "status" || bulkStatus === "none"
                    }
                    onClick={onApplyBulkStatus}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </section>

            <section className={cn("space-y-3", settingsTarget !== "priority" && "opacity-60")}>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Priority</h3>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Priority</Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={bulkPriority}
                    onValueChange={(value) =>
                      onBulkPriorityChange(value as FeedbackSeverity | "none")
                    }
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Choose priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Choose priority</SelectItem>
                      {FEEDBACK_PRIORITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      bulkUpdating ||
                      settingsTarget !== "priority" ||
                      bulkPriority === "none"
                    }
                    onClick={onApplyBulkPriority}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </section>

            <section className={cn("space-y-3", settingsTarget !== "tool" && "opacity-60")}>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Tool</h3>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Tool</Label>
                <div className="flex items-center gap-2">
                  <Select value={bulkToolId} onValueChange={onBulkToolChange}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Choose tool" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Choose tool</SelectItem>
                      <SelectItem value="unassigned">Clear tool</SelectItem>
                      {allTools.map((tool) => (
                        <SelectItem key={tool.id} value={String(tool.id)}>
                          {tool.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    disabled={bulkUpdating || settingsTarget !== "tool" || bulkToolId === "none"}
                    onClick={onApplyBulkTool}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </section>

            <section className={cn("space-y-3", settingsTarget !== "category" && "opacity-60")}>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Category</h3>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Category</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={bulkCategory}
                    onChange={(event) => onBulkCategoryChange(event.target.value)}
                    placeholder="Set category"
                    className="h-9 text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      bulkUpdating ||
                      settingsTarget !== "category" ||
                      bulkCategory.trim().length === 0
                    }
                    onClick={() => onApplyBulkCategory(false)}
                  >
                    Apply
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={bulkUpdating || settingsTarget !== "category"}
                    onClick={() => onApplyBulkCategory(true)}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </section>
          </SidePanelBody>
        </SidePanelContent>
      </SidePanel>
    </>
  );
}

function FeedbackWorkspaceHeader({
  activeFilterCount,
  activeTab,
  categoryFilter,
  categoryOptions,
  dateFilter,
  featureRequestCount,
  issueCount,
  searchValue,
  sortBy,
  submitterFilter,
  submitterOptions,
  toolFilter,
  toolOptions,
  totalCount,
  viewMode,
  trailingActions,
  onCategoryFilterChange,
  onDateFilterChange,
  onInboxTabChange,
  onSearchChange,
  onSortChange,
  onSubmitterFilterChange,
  onToolFilterChange,
  onViewModeChange,
}: {
  activeFilterCount: number;
  activeTab: FeedbackInboxTab;
  categoryFilter: string;
  categoryOptions: { value: string; label: string }[];
  dateFilter: FeedbackDateFilter;
  featureRequestCount: number;
  issueCount: number;
  searchValue: string;
  sortBy: FeedbackSortValue;
  submitterFilter: string;
  submitterOptions: { value: string; label: string }[];
  toolFilter: string;
  toolOptions: { value: string; label: string }[];
  totalCount: number;
  viewMode: FeedbackViewMode;
  trailingActions?: ReactNode;
  onCategoryFilterChange: (value: string) => void;
  onDateFilterChange: (value: FeedbackDateFilter) => void;
  onInboxTabChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: FeedbackSortValue) => void;
  onSubmitterFilterChange: (value: string) => void;
  onToolFilterChange: (value: string) => void;
  onViewModeChange: (value: FeedbackViewMode) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold leading-7 text-foreground">
            Feedback
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ExpandableSearch
            value={searchValue}
            onChange={onSearchChange}
            placeholder="Search feedback"
            aria-label="Search feedback"
          />
          <FeedbackFilterPopover
            activeCount={activeFilterCount}
            activeTab={activeTab}
            categoryFilter={categoryFilter}
            categoryOptions={categoryOptions}
            dateFilter={dateFilter}
            featureRequestCount={featureRequestCount}
            issueCount={issueCount}
            submitterFilter={submitterFilter}
            submitterOptions={submitterOptions}
            toolFilter={toolFilter}
            toolOptions={toolOptions}
            totalCount={totalCount}
            onCategoryFilterChange={onCategoryFilterChange}
            onDateFilterChange={onDateFilterChange}
            onInboxTabChange={onInboxTabChange}
            onSubmitterFilterChange={onSubmitterFilterChange}
            onToolFilterChange={onToolFilterChange}
          />
          <FeedbackSortPopover
            sortBy={sortBy}
            onSortChange={onSortChange}
          />
          {trailingActions}
          <FeedbackViewMenu
            value={viewMode}
            onValueChange={onViewModeChange}
          />
        </div>
      </div>
    </div>
  );
}

function FeedbackBoardCard({
  item,
  selectedId,
  onSelect,
}: {
  item: FeedbackItem;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const displayStatus = toDisplayStatus(item.status);
  const meta = STATUS_META[displayStatus];
  const title = displayAdminFeedbackTitle({
    storedTitle: item.title,
    requestType: item.request_type,
    comment: item.comment,
    targetText: item.target_text,
    pageTitle: item.page_title,
  });
  const sourceLabel = toolLabelFromPath(item.page_path) ?? item.page_title ?? item.page_path;
  const showCommentPreview = !isCommentRedundantWithTitle(title, item.comment);
  const secondaryLabel = item.page_title ?? item.page_path;

  return (
    <Button
      type="button"
      variant="ghost"
      size="default"
      onClick={() => onSelect(item.id)}
      className={cn(
        "h-auto w-full min-w-0 flex-col items-start justify-start rounded-md border border-border/60 bg-background p-3 text-left shadow-none hover:bg-muted/40",
        selectedId === item.id && "border-primary/40 bg-primary/5",
      )}
    >
      <span className="flex w-full min-w-0 items-start justify-between gap-3">
        <span className="line-clamp-2 min-w-0 text-[13px] font-semibold leading-snug text-foreground">
          {title}
        </span>
        <span className="shrink-0 text-[11px] font-normal text-muted-foreground">
          {relativeTime(item.created_at)}
        </span>
      </span>
      {showCommentPreview ? (
        <span className="mt-1 line-clamp-2 text-[12px] font-normal leading-snug text-muted-foreground">
          {item.comment}
        </span>
      ) : null}
      <span className="mt-3 flex w-full min-w-0 items-center gap-2 text-[11px] leading-4 text-muted-foreground">
        <span
          className={cn("h-2 w-2 shrink-0 rounded-full", meta.dotClassName)}
          aria-label={meta.label}
          title={meta.label}
        />
        <span className="shrink-0">{meta.label}</span>
        {item.severity === "high" ? (
          <>
            <span aria-hidden className="text-border">
              /
            </span>
            <span className="shrink-0 font-medium text-status-error">High</span>
          </>
        ) : null}
        <span aria-hidden className="text-border">
          /
        </span>
        <span className="min-w-0 truncate">{secondaryLabel}</span>
      </span>
      <span className="mt-1 flex w-full min-w-0 items-center gap-2 text-[11px] leading-4 text-muted-foreground">
        <span className="min-w-0 truncate">{submitterLabel(item)}</span>
        {sourceLabel && sourceLabel !== secondaryLabel ? (
          <>
            <span aria-hidden className="text-border">
              /
            </span>
            <span className="min-w-0 truncate">{sourceLabel}</span>
          </>
        ) : null}
      </span>
    </Button>
  );
}

function FeedbackViewMenu({
  value,
  onValueChange,
}: {
  value: FeedbackViewMode;
  onValueChange: (value: FeedbackViewMode) => void;
}) {
  const TriggerIcon =
    value === "board" ? Columns3 : value === "table" ? Table2 : PanelRight;
  const options: {
    value: FeedbackViewMode;
    label: string;
    icon: typeof PanelRight;
  }[] = [
    { value: "split", label: "Split page", icon: PanelRight },
    { value: "board", label: "Board", icon: Columns3 },
    { value: "table", label: "Table", icon: Table2 },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Change feedback view"
          className="h-8 w-8 rounded-full text-muted-foreground shadow-none"
        >
          <TriggerIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onValueChange(option.value)}
              className={cn(
                "gap-2",
                value === option.value
                  ? "font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{option.label}</span>
              {value === option.value ? (
                <Check className="ml-auto h-3.5 w-3.5" />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FeedbackFilterPopover({
  activeCount,
  activeTab,
  categoryFilter,
  categoryOptions,
  dateFilter,
  featureRequestCount,
  issueCount,
  submitterFilter,
  submitterOptions,
  toolFilter,
  toolOptions,
  totalCount,
  onCategoryFilterChange,
  onDateFilterChange,
  onInboxTabChange,
  onSubmitterFilterChange,
  onToolFilterChange,
}: {
  activeCount: number;
  activeTab: FeedbackInboxTab;
  categoryFilter: string;
  categoryOptions: { value: string; label: string }[];
  dateFilter: FeedbackDateFilter;
  featureRequestCount: number;
  issueCount: number;
  submitterFilter: string;
  submitterOptions: { value: string; label: string }[];
  toolFilter: string;
  toolOptions: { value: string; label: string }[];
  totalCount: number;
  onCategoryFilterChange: (value: string) => void;
  onDateFilterChange: (value: FeedbackDateFilter) => void;
  onInboxTabChange: (value: string) => void;
  onSubmitterFilterChange: (value: string) => void;
  onToolFilterChange: (value: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Filter feedback"
          className={cn(
            "relative h-8 w-8 rounded-full text-muted-foreground shadow-none",
            activeCount > 0 && "text-foreground",
          )}
        >
          <Filter className="h-4 w-4" />
          {activeCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-4">
        <FeedbackScopePanel
          activeCount={activeCount}
          activeTab={activeTab}
          categoryFilter={categoryFilter}
          categoryOptions={categoryOptions}
          dateFilter={dateFilter}
          featureRequestCount={featureRequestCount}
          issueCount={issueCount}
          submitterFilter={submitterFilter}
          submitterOptions={submitterOptions}
          toolFilter={toolFilter}
          toolOptions={toolOptions}
          totalCount={totalCount}
          onClear={() => {
            onInboxTabChange("all");
            onDateFilterChange("all");
            onCategoryFilterChange("all");
            onToolFilterChange("all");
            onSubmitterFilterChange("all");
          }}
          onCategoryFilterChange={onCategoryFilterChange}
          onDateFilterChange={onDateFilterChange}
          onSubmitterFilterChange={onSubmitterFilterChange}
          onToolFilterChange={onToolFilterChange}
          onTypeChange={onInboxTabChange}
        />
      </PopoverContent>
    </Popover>
  );
}

function FeedbackScopePanel({
  activeCount,
  activeTab,
  categoryFilter,
  categoryOptions,
  dateFilter,
  featureRequestCount,
  issueCount,
  submitterFilter,
  submitterOptions,
  toolFilter,
  toolOptions,
  totalCount,
  onClear,
  onCategoryFilterChange,
  onDateFilterChange,
  onSubmitterFilterChange,
  onToolFilterChange,
  onTypeChange,
}: {
  activeCount: number;
  activeTab: FeedbackInboxTab;
  categoryFilter: string;
  categoryOptions: { value: string; label: string }[];
  dateFilter: FeedbackDateFilter;
  featureRequestCount: number;
  issueCount: number;
  submitterFilter: string;
  submitterOptions: { value: string; label: string }[];
  toolFilter: string;
  toolOptions: { value: string; label: string }[];
  totalCount: number;
  onClear: () => void;
  onCategoryFilterChange: (value: string) => void;
  onDateFilterChange: (value: FeedbackDateFilter) => void;
  onSubmitterFilterChange: (value: string) => void;
  onToolFilterChange: (value: string) => void;
  onTypeChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Filters</span>
        {activeCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-6 gap-1 px-1.5 text-xs text-muted-foreground"
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Type</span>
        <div className="inline-flex w-full items-center rounded-md border border-border/60 bg-muted/40 p-0.5">
          {FEEDBACK_INBOX_TABS.map((tab) => {
            const count =
              tab.value === "all"
                ? totalCount
                : tab.value === "feature_requests"
                  ? featureRequestCount
                  : issueCount;
            return (
              <Button
                key={tab.value}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onTypeChange(tab.value)}
                className={cn(
                  "h-7 flex-1 rounded-sm px-2 text-xs shadow-none",
                  activeTab === tab.value
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-transparent hover:text-foreground",
                )}
              >
                <span className="truncate">{tab.label}</span>
                <span className="ml-1 text-[10px] text-muted-foreground">
                  {count}
                </span>
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Submitted</span>
        <Select
          value={dateFilter}
          onValueChange={(value) => onDateFilterChange(value as FeedbackDateFilter)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FEEDBACK_DATE_FILTERS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Category</span>
        <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Any category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any category</SelectItem>
            {categoryOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Tool</span>
        <Select value={toolFilter} onValueChange={onToolFilterChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Any tool" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any tool</SelectItem>
            {toolOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Submitted by</span>
        <Select value={submitterFilter} onValueChange={onSubmitterFilterChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Anyone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Anyone</SelectItem>
            {submitterOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

    </div>
  );
}

function FeedbackStatusTabs({
  value,
  onValueChange,
  allVisibleSelected,
  onToggleSelectAllVisible,
}: {
  value: StatusFilter;
  onValueChange: (value: string) => void;
  allVisibleSelected?: boolean;
  onToggleSelectAllVisible?: (checked: boolean) => void;
}) {
  const showSelectionControl = typeof onToggleSelectAllVisible === "function";

  return (
    <div className="mt-2 flex items-center justify-between gap-4">
      {showSelectionControl ? (
        <label className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
          <Checkbox
            checked={allVisibleSelected}
            onCheckedChange={(checked) =>
              onToggleSelectAllVisible(checked === true)
            }
            aria-label="Select all visible feedback rows"
          />
        </label>
      ) : null}

      <div className="flex min-w-0 items-center gap-4">
        {FEEDBACK_STATUS_TABS.map((tab) => (
          <Button
            key={tab.value}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onValueChange(tab.value)}
            className={cn(
              "h-7 rounded-md px-2.5 text-[11px] font-medium shadow-none",
              value === tab.value
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <span className="truncate">{tab.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

function FeedbackSortPopover({
  sortBy,
  onSortChange,
}: {
  sortBy: FeedbackSortValue;
  onSortChange: (value: FeedbackSortValue) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Sort feedback"
          className="h-8 w-8 rounded-full text-muted-foreground shadow-none"
        >
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1">
        {FEEDBACK_SORT_OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSortChange(option.value)}
            className={cn(
              "flex h-auto w-full justify-start gap-2 rounded-sm px-3 py-1.5 text-sm shadow-none transition-colors hover:bg-muted",
              sortBy === option.value
                ? "font-medium text-foreground"
                : "text-muted-foreground",
            )}
          >
            {sortBy === option.value ? (
              <Check className="h-3.5 w-3.5 shrink-0" />
            ) : null}
            <span className={cn(sortBy !== option.value && "pl-[1.375rem]")}>
              {option.label}
            </span>
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function FeedbackDetailPane({
  allTools,
  categoryOptions,
  commentInputRef,
  deletingId,
  item,
  sendingToGitHub,
  updatingId,
  onDelete,
  onSendToGitHub,
  onUpdateRequestType,
  onUpdateSeverity,
  onUpdateTool,
  onUpdateTitle,
  onUpdateCategory,
  onUpdateStatus,
  onRefresh,
}: {
  allTools: ToolOption[];
  categoryOptions: { value: string; label: string }[];
  commentInputRef: RefObject<HTMLTextAreaElement | null>;
  deletingId: string | null;
  item: FeedbackItem | null;
  sendingToGitHub: boolean;
  updatingId: string | null;
  onDelete: (id: string) => void;
  onSendToGitHub: (id: string) => void;
  onUpdateRequestType: (id: string, requestType: string) => void;
  onUpdateSeverity: (id: string, severity: "high" | "medium" | "low") => void;
  onUpdateTool: (id: string, toolValue: string) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onUpdateCategory: (id: string, category: string | null) => void;
  onUpdateStatus: (id: string, status: DisplayStatus) => void;
  onRefresh: () => void;
}) {
  const splitPage = useSplitPage();

  if (!item) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Select feedback to review</p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background">
      <FeedbackDetail
        allTools={allTools}
        categoryOptions={categoryOptions}
        item={item}
        updatingId={updatingId}
        sendingToGitHub={sendingToGitHub}
        deletingId={deletingId}
        onUpdateStatus={onUpdateStatus}
        onUpdateSeverity={onUpdateSeverity}
        onUpdateRequestType={onUpdateRequestType}
        onUpdateTool={onUpdateTool}
        onUpdateTitle={onUpdateTitle}
        onUpdateCategory={onUpdateCategory}
        onSendToGitHub={onSendToGitHub}
        onDelete={onDelete}
        onRefresh={onRefresh}
        onBack={splitPage.isDesktop ? undefined : splitPage.onOpen}
        commentInputRef={commentInputRef}
      />
    </div>
  );
}

function FeedbackTableDetailPanel({
  allTools,
  categoryOptions,
  commentInputRef,
  deletingId,
  item,
  sendingToGitHub,
  updatingId,
  onDelete,
  onRefresh,
  onSendToGitHub,
  onUpdateRequestType,
  onUpdateSeverity,
  onUpdateTool,
  onUpdateCategory,
  onUpdateStatus,
  onUpdateTitle,
}: {
  allTools: ToolOption[];
  categoryOptions: { value: string; label: string }[];
  commentInputRef: RefObject<HTMLTextAreaElement | null>;
  deletingId: string | null;
  item: FeedbackItem;
  sendingToGitHub: boolean;
  updatingId: string | null;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  onSendToGitHub: (id: string) => void;
  onUpdateRequestType: (id: string, requestType: string) => void;
  onUpdateSeverity: (id: string, severity: "high" | "medium" | "low") => void;
  onUpdateTool: (id: string, toolValue: string) => void;
  onUpdateCategory: (id: string, category: string | null) => void;
  onUpdateStatus: (id: string, status: DisplayStatus) => void;
  onUpdateTitle: (id: string, title: string) => void;
}) {
  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background">
      <FeedbackDetail
        allTools={allTools}
        categoryOptions={categoryOptions}
        item={item}
        updatingId={updatingId}
        sendingToGitHub={sendingToGitHub}
        deletingId={deletingId}
        onUpdateStatus={onUpdateStatus}
        onUpdateSeverity={onUpdateSeverity}
        onUpdateRequestType={onUpdateRequestType}
        onUpdateTool={onUpdateTool}
        onUpdateTitle={onUpdateTitle}
        onUpdateCategory={onUpdateCategory}
        onSendToGitHub={onSendToGitHub}
        onDelete={onDelete}
        onRefresh={onRefresh}
        onBack={undefined}
        commentInputRef={commentInputRef}
      />
    </div>
  );
}

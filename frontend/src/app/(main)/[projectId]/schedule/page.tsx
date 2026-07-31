"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PageShell } from "@/components/layout";
import { GanttChart } from "@/components/scheduling/gantt-chart";
import { TaskEditModal } from "@/components/scheduling/task-edit-modal";
import { ImportExportModal } from "@/components/scheduling/import-export-modal";
import type { ScheduleRevisionControlItem } from "@/components/scheduling/schedule-revision-controls";
import {
  getScheduleWorkspace,
  SchedulePlanningWorkspace,
  ScheduleWorkspaceNavigation,
} from "@/components/scheduling/schedule-planning-workspace";
import { ResourceAvailabilityPanel } from "@/components/scheduling/resource-availability-panel";
import {
  CalendarSettingsDialog,
  type CalendarSettingsPayload,
} from "@/components/scheduling/calendar-settings-dialog";
import {
  TaskContextMenu,
  useTaskContextMenu,
} from "@/components/scheduling/task-context-menu";
import type { RelatedScheduleActionItem } from "@/components/scheduling/related-action-items";
import {
  ScheduleGridView,
  ScheduleBoardView,
  ScheduleCalendarView,
  ScheduleTimelineView,
} from "@/components/scheduling/schedule-views";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InfoAlert, EmptyState, ErrorState } from "@/components/ds";
import {
  TableToolbar,
  type FilterConfig,
  type ColumnConfig,
  type FilterValue,
} from "@/components/tables/unified";
import {
  Plus,
  Columns,
  Upload,
  Calendar,
  Table2,
  Kanban,
  CalendarDays,
  GanttChart as GanttIcon,
  ChevronDown,
  Trash2,
  X,
  Loader2,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import {
  ScheduleTask,
  ScheduleTaskWithHierarchy,
  ScheduleTaskCreate,
  ScheduleTaskUpdate,
  DependencyType,
  TaskStatus,
} from "@/types/scheduling";
import { useScheduleTasks } from "@/hooks/use-schedule-tasks";
import { useScheduleResources } from "@/hooks/use-schedule-resources";
import { appToast as toast } from "@/lib/toast/app-toast";
import { apiFetch } from "@/lib/api-client";
import {
  createScheduleDependency,
  removeScheduleDeadline,
  removeScheduleDependency,
  saveScheduleDeadline,
  scheduleApiErrorMessage,
  updateScheduleDependency,
} from "@/lib/scheduling/dependency-api";
import { reconcileEditingTask } from "@/lib/scheduling/reconcile-editing-task";
import {
  defaultScheduleCalendar,
  type ScheduleCalendar,
} from "@/lib/scheduling/schedule-calendar";
import {
  applyScheduleBaselineComparisonToGantt,
  type ScheduleBaseline,
  type ScheduleBaselineComparison,
} from "@/lib/scheduling/schedule-baselines";
import {
  filterScheduleTaskHierarchy,
  type ScheduleDateFilter,
} from "@/lib/scheduling/schedule-task-filters";
import { lastScheduleSiblingTaskId } from "@/lib/scheduling/schedule-task-ordering";

// =============================================================================
// TYPES
// =============================================================================

type ViewMode = "grid" | "board" | "schedule" | "timeline" | "calendar";
type QuickAddTaskInput = {
  name: string;
  afterTaskId?: string | null;
  parentId?: string | null;
  status?: TaskStatus;
  startDate?: string | null;
  finishDate?: string | null;
};

type BulkDeleteProgress = {
  phase: "deleting" | "complete";
  total: number;
  deleted: number;
  failed: number;
};

type RelatedActionItemsResponse = {
  data?: RelatedScheduleActionItem[];
};

type ScheduleCalendarResponse = ScheduleCalendar & {
  working_date_overrides: string[];
  source: "default" | "project";
};

const SCHEDULE_FILTERS: FilterConfig[] = [
  {
    id: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "not_started", label: "Not Started" },
      { value: "in_progress", label: "In Progress" },
      { value: "complete", label: "Complete" },
    ],
  },
  {
    id: "is_milestone",
    label: "Type",
    type: "select",
    options: [
      { value: "true", label: "Milestones" },
      { value: "false", label: "Tasks" },
    ],
  },
];

const SCHEDULE_COLUMNS: ColumnConfig[] = [
  { id: "name", label: "Task Name", alwaysVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "start_date", label: "Start Date", defaultVisible: true },
  { id: "finish_date", label: "Finish Date", defaultVisible: true },
  { id: "duration_days", label: "Duration", defaultVisible: true },
  { id: "percent_complete", label: "% Complete", defaultVisible: true },
  { id: "assigned_to", label: "Assigned To", defaultVisible: true },
  { id: "wbs_code", label: "WBS Code", defaultVisible: false },
  { id: "constraint_type", label: "Constraint", defaultVisible: false },
  { id: "predecessors", label: "Predecessors", defaultVisible: true },
  { id: "successors", label: "Successors", defaultVisible: true },
];

// =============================================================================
// DATE FILTER PILLS
// =============================================================================

const DATE_FILTER_OPTIONS: { value: ScheduleDateFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
];

function DateFilterPills({
  value,
  onChange,
}: {
  value: ScheduleDateFilter;
  onChange: (v: ScheduleDateFilter) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {DATE_FILTER_OPTIONS.map(({ value: v, label }) => (
        <Button
          key={v}
          type="button"
          size="sm"
          variant={value === v ? "default" : "ghost"}
          onClick={() => onChange(v)}
          className="h-7 rounded-full px-3 text-xs"
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

// =============================================================================
// VIEW MODE TABS (Microsoft Planner Style)
// =============================================================================

const viewModeConfig: {
  mode: ViewMode;
  label: string;
  icon: typeof Table2;
}[] = [
  { mode: "grid", label: "Gantt", icon: GanttIcon },
  { mode: "schedule", label: "Table", icon: Table2 },
  { mode: "board", label: "Board", icon: Kanban },
  { mode: "timeline", label: "Timeline", icon: Columns },
  { mode: "calendar", label: "Calendar", icon: CalendarDays },
];

function ViewModeTabs({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <nav
      className="flex overflow-x-auto overscroll-x-contain scrollbar-hide"
      aria-label="View mode"
    >
      <div className="flex min-w-max">
        {viewModeConfig.map(({ mode: viewMode, label, icon: Icon }) => (
          <Button
            key={viewMode}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(viewMode)}
            aria-label={`Switch to ${label} view`}
            className={cn(
              "gap-1.5 whitespace-nowrap rounded-none px-3 font-medium border-b-2 border-transparent transition-colors",
              mode === viewMode
                ? "border-[hsl(var(--schedule-view-active))] text-[hsl(var(--schedule-view-active))] hover:text-[hsl(var(--schedule-view-active))]"
                : "text-muted-foreground hover:text-foreground hover:bg-transparent",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Button>
        ))}
      </div>
    </nav>
  );
}

// =============================================================================
// BULK ACTION BAR
// =============================================================================

function BulkActionBar({
  selectedCount,
  deleteProgress,
  onUpdateStatus,
  onDelete,
  onClear,
}: {
  selectedCount: number;
  deleteProgress: BulkDeleteProgress | null;
  onUpdateStatus: (status: TaskStatus) => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  const isDeleting = deleteProgress?.phase === "deleting";
  const isDeleteProgressVisible = Boolean(deleteProgress);
  const progressValue = deleteProgress
    ? Math.min(
        100,
        Math.round(
          ((deleteProgress.deleted + deleteProgress.failed) /
            deleteProgress.total) *
            100,
        ),
      )
    : 0;

  return (
    <InfoAlert
      variant="info"
      role="status"
      className="animate-reveal text-foreground"
      icon={
        <span className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-primary" />
      }
    >
      <div className="flex w-full flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">{selectedCount} selected</span>
          <div className="hidden h-4 w-px bg-border sm:block" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isDeleteProgressVisible}
              >
                Update Status
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onUpdateStatus("not_started")}>
                Not Started
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onUpdateStatus("in_progress")}>
                In Progress
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onUpdateStatus("complete")}>
                Complete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            disabled={isDeleteProgressVisible}
          >
            {isDeleting ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 h-4 w-4" />
            )}
            {isDeleting
              ? "Deleting"
              : deleteProgress?.phase === "complete"
                ? "Deleted"
                : "Delete"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={isDeleteProgressVisible}
            className="ml-auto"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {deleteProgress && (
          <div className="space-y-2" role="status" aria-live="polite">
            <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
              <span>
                {deleteProgress.phase === "complete"
                  ? `Deleted ${deleteProgress.deleted} of ${deleteProgress.total} tasks`
                  : `Deleting ${deleteProgress.total} tasks`}
              </span>
              <span>{progressValue}%</span>
            </div>
            <Progress value={progressValue} className="h-1.5" />
          </div>
        )}
      </div>
    </InfoAlert>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function flattenIds(tasks: ScheduleTaskWithHierarchy[]): Set<string> {
  const ids = new Set<string>();
  const walk = (list: ScheduleTaskWithHierarchy[]) => {
    for (const t of list) {
      ids.add(t.id);
      if (t.children?.length) walk(t.children);
    }
  };
  walk(tasks);
  return ids;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ProjectSchedulePage() {
  const params = useParams()!;
  const projectId = params.projectId as string;
  const searchParams = useSearchParams()! ?? new URLSearchParams();
  const scheduleWorkspace = getScheduleWorkspace(searchParams);
  const isPlanningWorkspace = scheduleWorkspace === "planning";
  const router = useRouter();

  // State
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [dateFilter, setDateFilter] = useState<ScheduleDateFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<ScheduleTask | null>(null);
  const [linkedSubmittalState, setLinkedSubmittalState] = useState<{
    data: Array<{ id: string; number: string; title: string }>;
    risk: {
      status: "clear" | "at_risk";
      reason?: string;
      blocking_submittal_id?: string;
      dependency_context?: string[];
    } | null;
    error: string | null;
  }>({ data: [], risk: null, error: null });
  const [availableSubmittals, setAvailableSubmittals] = useState<
    Array<{ id: string; number: string; title: string }>
  >([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState(false);
  const [isCalendarSettingsOpen, setIsCalendarSettingsOpen] = useState(false);
  const [scheduleCalendarLoadError, setScheduleCalendarLoadError] = useState<
    string | null
  >(null);
  const [isScheduleCalendarLoading, setIsScheduleCalendarLoading] =
    useState(true);
  const [scheduleCalendarReloadKey, setScheduleCalendarReloadKey] = useState(0);
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [showBaseline, setShowBaseline] = useState(false);
  const [parentTaskIdForNew, setParentTaskIdForNew] = useState<string | null>(
    null,
  );
  const [afterTaskIdForNew, setAfterTaskIdForNew] = useState<string | null>(
    null,
  );
  const [copiedTask, setCopiedTask] = useState<ScheduleTask | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] =
    useState<BulkDeleteProgress | null>(null);
  const [relatedActionItemsByTaskId, setRelatedActionItemsByTaskId] = useState<
    Record<string, RelatedScheduleActionItem[]>
  >({});
  const [scheduleCalendar, setScheduleCalendar] = useState<ScheduleCalendar>(
    defaultScheduleCalendar,
  );
  const [scheduleRevisions, setScheduleRevisions] = useState<
    ScheduleRevisionControlItem[]
  >([]);
  const [scheduleBaselines, setScheduleBaselines] = useState<
    ScheduleBaseline[]
  >([]);
  const [baselineComparison, setBaselineComparison] =
    useState<ScheduleBaselineComparison | null>(null);
  const [canManageBaselines, setCanManageBaselines] = useState(false);
  const [isRevisionActionPending, setIsRevisionActionPending] = useState(false);
  const [revisionActionError, setRevisionActionError] = useState<string | null>(
    null,
  );
  const [baselineActionError, setBaselineActionError] = useState<string | null>(
    null,
  );
  const baselineRequestIdRef = useRef(0);
  const [lookaheadStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const applyViewport = () => setIsMobileViewport(mediaQuery.matches);
    applyViewport();
    mediaQuery.addEventListener("change", applyViewport);
    return () => mediaQuery.removeEventListener("change", applyViewport);
  }, []);

  useEffect(() => {
    if (!isMobileViewport) return;
    if (viewMode === "grid") {
      setViewMode("board");
    }
  }, [isMobileViewport, viewMode]);

  // Fetch data using the same pattern as other pages (commitments, companies, etc.)
  const { data, error, isLoading, refetch } = useScheduleTasks({
    projectId,
    enabled: true,
  });
  const {
    roster: scheduleResourceRoster,
    isLoading: isScheduleResourceLoading,
    error: scheduleResourceError,
    refetch: refetchScheduleResources,
    capacityRange: scheduleResourceCapacityRange,
    isCapacityRangeLoading: isScheduleResourceCapacityLoading,
    capacityRangeError: scheduleResourceCapacityError,
    selectedCapacityProfile,
    isCapacityProfileLoading,
    capacityProfileError,
    levelingPreview,
    isLevelingPreviewLoading,
    levelingPreviewError,
    loadCapacityRange,
    fetchCapacityProfilesForRange,
    loadCapacityProfile,
    replaceCapacityProfile,
    previewResourceLeveling,
    clearLevelingPreview,
    replaceTaskAssignments,
  } = useScheduleResources({ projectId, enabled: true });

  const fetchScheduleRevisions = useCallback(async () => {
    const payload = await apiFetch<{ data?: ScheduleRevisionControlItem[] }>(
      `/api/projects/${projectId}/scheduling/revisions`,
      { cache: "no-store" },
    );
    setScheduleRevisions(payload.data ?? []);
  }, [projectId]);

  const fetchScheduleBaselines = useCallback(async () => {
    const requestId = ++baselineRequestIdRef.current;
    const isCurrentRequest = () => baselineRequestIdRef.current === requestId;
    setBaselineComparison(null);
    try {
      const payload = await apiFetch<{
        data?: ScheduleBaseline[];
        can_manage?: boolean;
      }>(`/api/projects/${projectId}/scheduling/baselines`, {
        cache: "no-store",
      });
      if (!isCurrentRequest()) return;
      const baselines = payload.data ?? [];
      setScheduleBaselines(baselines);
      setCanManageBaselines(payload.can_manage === true);
      const activeBaseline = baselines.find((baseline) => baseline.is_active);
      if (!activeBaseline) {
        setShowBaseline(false);
        return;
      }
      const comparison = await apiFetch<{ data: ScheduleBaselineComparison }>(
        `/api/projects/${projectId}/scheduling/baselines/${activeBaseline.id}/comparison`,
        { cache: "no-store" },
      );
      if (isCurrentRequest()) setBaselineComparison(comparison.data);
    } catch (fetchError) {
      if (isCurrentRequest()) throw fetchError;
    }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    void fetchScheduleRevisions().catch((fetchError) => {
      if (!cancelled)
        setRevisionActionError(
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to load schedule revisions.",
        );
    });
    return () => {
      cancelled = true;
    };
  }, [fetchScheduleRevisions]);

  useEffect(() => {
    let cancelled = false;
    setBaselineActionError(null);
    void fetchScheduleBaselines().catch((fetchError) => {
      if (!cancelled) {
        setBaselineComparison(null);
        setShowBaseline(false);
        setBaselineActionError(
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to load schedule baselines.",
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [data?.ganttData, fetchScheduleBaselines]);

  const handleSnapshotSchedule = useCallback(async () => {
    setIsRevisionActionPending(true);
    setRevisionActionError(null);
    try {
      await apiFetch(`/api/projects/${projectId}/scheduling/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await fetchScheduleRevisions();
      toast.success("Schedule revision created");
    } catch (actionError) {
      const message =
        actionError instanceof Error
          ? actionError.message
          : "Unable to snapshot the schedule.";
      setRevisionActionError(message);
      toast.error("Schedule revision was not created", {
        description: message,
      });
    } finally {
      setIsRevisionActionPending(false);
    }
  }, [fetchScheduleRevisions, projectId]);

  const handleRevisionTransition = useCallback(
    async (revisionId: string, status: "review" | "published") => {
      setIsRevisionActionPending(true);
      setRevisionActionError(null);
      try {
        await apiFetch(`/api/projects/${projectId}/scheduling/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entity_type: "revision",
            action: "transition",
            entity_id: revisionId,
            payload: { status },
          }),
        });
        await fetchScheduleRevisions();
        toast.success(
          status === "review"
            ? "Schedule revision submitted for review"
            : "Schedule revision published",
        );
      } catch (actionError) {
        const message =
          actionError instanceof Error
            ? actionError.message
            : `Unable to move the revision to ${status}.`;
        setRevisionActionError(message);
        toast.error("Schedule revision was not updated", {
          description: message,
        });
      } finally {
        setIsRevisionActionPending(false);
      }
    },
    [fetchScheduleRevisions, projectId],
  );

  const handleCaptureBaseline = useCallback(
    async ({
      name,
      revisionId,
      activate,
    }: {
      name: string;
      revisionId: string;
      activate: boolean;
    }) => {
      setIsRevisionActionPending(true);
      setBaselineActionError(null);
      try {
        await apiFetch(`/api/projects/${projectId}/scheduling/baselines`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, revision_id: revisionId, activate }),
        });
        await fetchScheduleBaselines();
        toast.success("Schedule baseline captured");
      } catch (actionError) {
        const message =
          actionError instanceof Error
            ? actionError.message
            : "Unable to capture the schedule baseline.";
        setBaselineActionError(message);
        setBaselineComparison(null);
        setShowBaseline(false);
        toast.error("Schedule baseline was not captured", {
          description: message,
        });
      } finally {
        setIsRevisionActionPending(false);
      }
    },
    [fetchScheduleBaselines, projectId],
  );

  const handleActivateBaseline = useCallback(
    async (baselineId: string) => {
      setIsRevisionActionPending(true);
      setBaselineActionError(null);
      try {
        await apiFetch(`/api/projects/${projectId}/scheduling/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entity_type: "baseline",
            action: "activate",
            entity_id: baselineId,
          }),
        });
        await fetchScheduleBaselines();
        toast.success("Active schedule baseline updated");
      } catch (actionError) {
        const message =
          actionError instanceof Error
            ? actionError.message
            : "Unable to activate the schedule baseline.";
        setBaselineActionError(message);
        setBaselineComparison(null);
        setShowBaseline(false);
        toast.error("Schedule baseline was not activated", {
          description: message,
        });
      } finally {
        setIsRevisionActionPending(false);
      }
    },
    [fetchScheduleBaselines, projectId],
  );

  // Dependency/deadline mutations refetch the hierarchy. Replace the modal's
  // prior task object so its predecessor list and deadline reflect that result.
  const editingTaskId = editingTask?.id;
  useEffect(() => {
    if (!editingTaskId || !data?.tasks) return;

    setEditingTask((currentTask) =>
      currentTask ? reconcileEditingTask(currentTask, data.tasks) : currentTask,
    );
  }, [data?.tasks, editingTaskId]);

  const fetchRelatedActionItems = useCallback(async () => {
    try {
      const result = await apiFetch<RelatedActionItemsResponse>(
        `/api/projects/${projectId}/scheduling/related-action-items`,
        { cache: "no-store" },
      );
      const grouped: Record<string, RelatedScheduleActionItem[]> = {};
      for (const item of result.data ?? []) {
        grouped[item.schedule_task_id] = [
          ...(grouped[item.schedule_task_id] ?? []),
          item,
        ];
      }
      setRelatedActionItemsByTaskId(grouped);
    } catch (err) {
      toast.error("Failed to load related action items");
    }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    setIsScheduleCalendarLoading(true);
    setScheduleCalendarLoadError(null);
    apiFetch<ScheduleCalendarResponse>(
      `/api/projects/${projectId}/scheduling/calendar`,
    )
      .then((calendar) => {
        if (!cancelled) {
          setScheduleCalendar({
            working_weekdays: calendar.working_weekdays,
            non_working_dates: calendar.non_working_dates,
            working_date_overrides: calendar.working_date_overrides,
            exceptions: calendar.exceptions ?? [],
            timezone_name: calendar.timezone_name,
          });
          setScheduleCalendarLoadError(null);
        }
      })
      .catch((calendarError) => {
        if (!cancelled) {
          const message =
            calendarError instanceof Error
              ? calendarError.message
              : "Unable to load the saved schedule calendar.";
          setScheduleCalendar(defaultScheduleCalendar);
          setScheduleCalendarLoadError(message);
          toast.error("Schedule calendar could not be loaded", {
            description: `${message} Retry before editing the calendar.`,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setIsScheduleCalendarLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, scheduleCalendarReloadKey]);

  const saveScheduleCalendar = useCallback(
    async (payload: CalendarSettingsPayload) => {
      if (isScheduleCalendarLoading || scheduleCalendarLoadError) {
        throw new Error(
          "Reload the saved schedule calendar before making changes.",
        );
      }
      const calendar = await apiFetch<ScheduleCalendarResponse>(
        `/api/projects/${projectId}/scheduling/calendar`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
      );
      setScheduleCalendar({
        working_weekdays: calendar.working_weekdays,
        non_working_dates: calendar.non_working_dates,
        working_date_overrides: calendar.working_date_overrides,
        exceptions: calendar.exceptions ?? [],
        timezone_name: calendar.timezone_name,
      });
      refetch();
      toast.success("Schedule calendar saved");
    },
    [isScheduleCalendarLoading, projectId, refetch, scheduleCalendarLoadError],
  );

  useEffect(() => {
    void fetchRelatedActionItems();
  }, [fetchRelatedActionItems]);

  // Context menu
  const {
    contextMenu,
    openContextMenu,
    closeContextMenu,
    handleContextMenuAction,
  } = useTaskContextMenu({
    add_task: (task) => {
      setParentTaskIdForNew(task?.parent_task_id ?? null);
      setAfterTaskIdForNew(task?.id ?? null);
      setEditingTask(null);
      setIsModalOpen(true);
    },
    edit_task: (task) => {
      if (task) {
        setAfterTaskIdForNew(null);
        setEditingTask(task);
        setIsModalOpen(true);
      }
    },
    delete_task: async (task) => {
      if (task) {
        await handleDeleteTask(task.id);
      }
    },
    copy_task: (task) => {
      if (task) {
        setCopiedTask(task);
        toast.success("Task copied to clipboard");
      }
    },
    cut_task: (task) => {
      if (task) {
        setCopiedTask(task);
        toast.success("Task cut to clipboard");
      }
    },
    paste_task: async () => {
      if (copiedTask) {
        await handlePasteTask();
      }
    },
    indent_task: async (task) => {
      if (task) {
        await handleIndentTask(task.id);
      }
    },
    outdent_task: async (task) => {
      if (task) {
        await handleOutdentTask(task.id);
      }
    },
    convert_to_milestone: async (task) => {
      if (task) {
        await handleUpdateTask(task.id, { is_milestone: !task.is_milestone });
      }
    },
    set_deadline: (task) => {
      if (task) {
        setAfterTaskIdForNew(null);
        setEditingTask(task);
        setIsModalOpen(true);
      }
    },
    scroll_to_task: (task) => {
      if (task) {
        // Scroll to task in Gantt
        const element = document.getElementById(`gantt-task-${task.id}`);
        element?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
    import_schedule: () => {
      router.push(`/${projectId}/schedule/import`);
    },
    export_schedule: () => {
      setIsImportExportModalOpen(true);
    },
  });

  // Flatten all tasks for export
  const allFlatTasks = useMemo(() => {
    const result: ScheduleTask[] = [];
    const flatten = (tasks: ScheduleTaskWithHierarchy[]) => {
      for (const task of tasks) {
        const { children, ...taskData } = task;
        result.push(taskData as ScheduleTask);
        if (children?.length) {
          flatten(children);
        }
      }
    };
    if (data?.tasks) {
      flatten(data.tasks);
    }
    return result;
  }, [data?.tasks]);

  // Handlers
  const apiUrl = `/api/projects/${projectId}/scheduling/tasks`;

  const handleSaveTaskAssignments = useCallback(
    async (
      taskId: string,
      assignments: Array<{ person_id: string; allocation_percent: number }>,
      expectedAssignments: Array<{
        id: string;
        person_id: string;
        cost_version: number;
      }>,
    ) => {
      await replaceTaskAssignments(taskId, assignments, expectedAssignments);
      toast.success("Resource assignments saved");
    },
    [replaceTaskAssignments],
  );

  useEffect(() => {
    clearLevelingPreview();
  }, [allFlatTasks, clearLevelingPreview, scheduleCalendar]);

  const handleAddTask = useCallback((parentId: string | null = null) => {
    setParentTaskIdForNew(parentId);
    setAfterTaskIdForNew(null);
    setEditingTask(null);
    setIsModalOpen(true);
  }, []);

  const handleQuickAddTask = useCallback(
    async ({
      name,
      afterTaskId = null,
      parentId = null,
      status = "not_started",
      startDate = null,
      finishDate = null,
    }: QuickAddTaskInput) => {
      const taskName = name.trim() || "New task";
      const insertionAnchorId =
        parentId === null
          ? lastScheduleSiblingTaskId(allFlatTasks, null)
          : afterTaskId;

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: Number(projectId),
          name: taskName,
          after_task_id: insertionAnchorId,
          parent_task_id: parentId,
          status,
          start_date: startDate,
          finish_date: finishDate,
          percent_complete:
            status === "complete" ? 100 : status === "in_progress" ? 50 : 0,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create task");
      }

      await refetch();
    },
    [allFlatTasks, apiUrl, projectId, refetch],
  );

  const handleEditTask = useCallback((task: ScheduleTask) => {
    setAfterTaskIdForNew(null);
    setEditingTask(task);
    setIsModalOpen(true);
  }, []);

  const handleTaskClick = useCallback((task: ScheduleTask) => {
    // For now, just edit on click
    setAfterTaskIdForNew(null);
    setEditingTask(task);
    setIsModalOpen(true);
  }, []);

  const handleTaskModalOpenChange = useCallback((open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setAfterTaskIdForNew(null);
      setEditingTask(null);
    }
  }, []);

  const handleSaveTask = useCallback(
    async (taskData: ScheduleTaskCreate | ScheduleTaskUpdate) => {
      try {
        if (editingTask) {
          // Update existing task
          const expectedScheduleVersion = editingTask.schedule_version;
          if (
            typeof expectedScheduleVersion !== "number" ||
            !Number.isInteger(expectedScheduleVersion)
          ) {
            throw new Error(
              "This task has no editable schedule version. Refresh the schedule, then retry.",
            );
          }
          const res = await fetch(`${apiUrl}/${editingTask.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...taskData,
              expected_schedule_version: expectedScheduleVersion,
            }),
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => null);
            if (res.status === 409) {
              await refetch();
              setIsModalOpen(false);
              setEditingTask(null);
              setAfterTaskIdForNew(null);
            }
            throw new Error(
              scheduleApiErrorMessage(errorData, "Failed to update task"),
            );
          }

          toast.success("Task updated successfully");
        } else {
          // Create new task
          const res = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...taskData,
              after_task_id: afterTaskIdForNew,
            }),
          });

          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || "Failed to create task");
          }

          toast.success("Task created successfully");
        }

        // Refresh data
        await refetch();
        setIsModalOpen(false);
        setEditingTask(null);
        setAfterTaskIdForNew(null);
      } catch (err) {
        console.error("Failed to save task:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Failed to save task";

        // Show informative toast based on error type
        if (
          errorMessage.includes("permission") ||
          errorMessage.includes("don't have")
        ) {
          toast.error("Permission Denied", {
            description: errorMessage,
            duration: 8000,
          });
        } else if (
          errorMessage.includes("logged in") ||
          errorMessage.includes("sign in")
        ) {
          toast.error("Authentication Required", {
            description: errorMessage,
            duration: 8000,
          });
        } else {
          toast.error("Error Saving Task", {
            description: errorMessage,
            duration: 6000,
          });
        }
        throw err;
      }
    },
    [afterTaskIdForNew, apiUrl, editingTask, refetch],
  );

  const handleFieldUpdate = useCallback(
    async (taskId: string, input: Record<string, unknown>) => {
      const res = await fetch(`${apiUrl}/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "field_update", ...input }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to record field update");
      }
      toast.success("Field update recorded");
      await refetch();
    },
    [apiUrl, refetch],
  );

  const refreshLinkedSubmittals = useCallback(
    async (taskId: string) => {
      const response = await fetch(`${apiUrl}/${taskId}/submittals`);
      if (!response.ok) throw new Error("Unable to refresh linked submittals.");
      const payload = await response.json();
      setLinkedSubmittalState({
        data: payload.data ?? [],
        risk: payload.risk ?? null,
        error: null,
      });
    },
    [apiUrl],
  );

  useEffect(() => {
    if (!editingTaskId) {
      setLinkedSubmittalState({ data: [], risk: null, error: null });
      return;
    }
    setLinkedSubmittalState({ data: [], risk: null, error: null });
    void refreshLinkedSubmittals(editingTaskId).catch((error) => {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to refresh linked submittals.";
      setLinkedSubmittalState({ data: [], risk: null, error: message });
    });
  }, [editingTaskId, refreshLinkedSubmittals]);

  useEffect(() => {
    if (!editingTaskId) return;
    void (async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/submittals`);
        if (!response.ok) throw new Error("Unable to load project submittals.");
        const payload = await response.json();
        const submittals = Array.isArray(payload)
          ? payload
          : (payload.data ?? []);
        setAvailableSubmittals(
          submittals.map(
            (submittal: {
              id: string;
              submittal_number: string;
              title: string;
            }) => ({
              id: submittal.id,
              number: submittal.submittal_number,
              title: submittal.title,
            }),
          ),
        );
      } catch (error) {
        console.error("Failed to load project submittals", error);
      }
    })();
  }, [editingTaskId, projectId]);

  const handleLinkSubmittal = useCallback(
    async (taskId: string, submittalId: string) => {
      const res = await fetch(`${apiUrl}/${taskId}/submittals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submittal_id: submittalId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Unable to link submittal.");
      }
      await refreshLinkedSubmittals(taskId);
      toast.success("Submittal linked");
    },
    [apiUrl, refreshLinkedSubmittals],
  );

  const handleUnlinkSubmittal = useCallback(
    async (taskId: string, submittalId: string) => {
      const res = await fetch(
        `${apiUrl}/${taskId}/submittals?submittalId=${encodeURIComponent(submittalId)}`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Unable to unlink submittal.");
      }
      await refreshLinkedSubmittals(taskId);
      toast.success("Submittal unlinked");
    },
    [apiUrl, refreshLinkedSubmittals],
  );

  const handleUpdateTask = useCallback(
    async (taskId: string, updates: Partial<ScheduleTask>) => {
      try {
        const currentTask = allFlatTasks.find((task) => task.id === taskId);
        const expectedScheduleVersion = currentTask?.schedule_version;
        if (
          typeof expectedScheduleVersion !== "number" ||
          !Number.isInteger(expectedScheduleVersion)
        ) {
          throw new Error(
            "This task has no editable schedule version. Refresh the schedule, then retry.",
          );
        }
        const res = await fetch(`${apiUrl}/${taskId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...updates,
            expected_schedule_version: expectedScheduleVersion,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => null);
          if (res.status === 409) await refetch();
          throw new Error(
            scheduleApiErrorMessage(errorData, "Failed to update task"),
          );
        }

        await refetch();
      } catch (err) {
        console.error("Failed to update task:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update task";
        toast.error("Error Updating Task", {
          description: errorMessage,
          duration: 6000,
        });
        throw err;
      }
    },
    [allFlatTasks, apiUrl, refetch],
  );

  const handleCreateDependency = useCallback(
    async (
      taskId: string,
      input: {
        predecessor_task_id: string;
        dependency_type: DependencyType;
        lag_days: number;
      },
    ) => {
      await createScheduleDependency(projectId, taskId, input);
      toast.success("Predecessor added");
      await refetch();
    },
    [projectId, refetch],
  );

  const handleRemoveDependency = useCallback(
    async (taskId: string, dependencyId: string) => {
      await removeScheduleDependency(projectId, taskId, dependencyId);
      toast.success("Predecessor removed");
      await refetch();
    },
    [projectId, refetch],
  );

  const handleUpdateDependency = useCallback(
    async (
      taskId: string,
      dependencyId: string,
      input: {
        predecessor_task_id: string;
        dependency_type: DependencyType;
        lag_days: number;
      },
    ) => {
      await updateScheduleDependency(projectId, taskId, dependencyId, input);
      toast.success("Predecessor updated");
      await refetch();
    },
    [projectId, refetch],
  );

  const handleSaveDeadline = useCallback(
    async (taskId: string, deadlineDate: string) => {
      await saveScheduleDeadline(projectId, taskId, deadlineDate);
      toast.success("Deadline updated");
      await refetch();
    },
    [projectId, refetch],
  );

  const handleRemoveDeadline = useCallback(
    async (taskId: string) => {
      await removeScheduleDeadline(projectId, taskId);
      toast.success("Deadline removed");
      await refetch();
    },
    [projectId, refetch],
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      try {
        const res = await fetch(`${apiUrl}/${taskId}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to delete task");
        }

        toast.success("Task deleted successfully");
        await Promise.all([refetch(), refetchScheduleResources()]);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      } catch (err) {
        console.error("Failed to delete task:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Failed to delete task";
        toast.error("Error Deleting Task", {
          description: errorMessage,
          duration: 6000,
        });
      }
    },
    [apiUrl, refetch, refetchScheduleResources],
  );

  const handleIndentTask = useCallback(
    async (taskId: string) => {
      // Find the task and its previous sibling to make parent
      const findTaskAndPrevSibling = (
        tasks: ScheduleTaskWithHierarchy[],
      ): {
        task: ScheduleTaskWithHierarchy | null;
        prevSibling: ScheduleTaskWithHierarchy | null;
      } => {
        for (let i = 0; i < tasks.length; i++) {
          if (tasks[i].id === taskId) {
            return {
              task: tasks[i],
              prevSibling: i > 0 ? tasks[i - 1] : null,
            };
          }
          if (tasks[i].children?.length) {
            const result = findTaskAndPrevSibling(tasks[i].children);
            if (result.task) return result;
          }
        }
        return { task: null, prevSibling: null };
      };

      if (!data?.tasks) return;

      const { prevSibling } = findTaskAndPrevSibling(data.tasks);

      if (!prevSibling) {
        toast.error("Cannot indent - no previous sibling to become parent");
        return;
      }

      await handleUpdateTask(taskId, { parent_task_id: prevSibling.id });
      toast.success("Task indented");
    },
    [data?.tasks, handleUpdateTask],
  );

  const handleOutdentTask = useCallback(
    async (taskId: string) => {
      // Find the task and get its grandparent
      const findTaskParentAndGrandparent = (
        tasks: ScheduleTaskWithHierarchy[],
        parentId: string | null,
        grandparentId: string | null,
      ): {
        task: ScheduleTaskWithHierarchy | null;
        parentId: string | null;
        grandparentId: string | null;
      } => {
        for (const t of tasks) {
          if (t.id === taskId) {
            return { task: t, parentId, grandparentId };
          }
          if (t.children?.length) {
            const result = findTaskParentAndGrandparent(
              t.children,
              t.id,
              parentId,
            );
            if (result.task) return result;
          }
        }
        return { task: null, parentId: null, grandparentId: null };
      };

      if (!data?.tasks) return;

      const { parentId, grandparentId } = findTaskParentAndGrandparent(
        data.tasks,
        null,
        null,
      );

      if (!parentId) {
        toast.error("Cannot outdent - task is already at root level");
        return;
      }

      await handleUpdateTask(taskId, { parent_task_id: grandparentId });
      toast.success("Task outdented");
    },
    [data?.tasks, handleUpdateTask],
  );

  const handlePasteTask = useCallback(async () => {
    if (!copiedTask) return;

    try {
      const newTaskData: ScheduleTaskCreate = {
        project_id: Number(projectId),
        name: `${copiedTask.name} (Copy)`,
        parent_task_id: copiedTask.parent_task_id,
        start_date: copiedTask.start_date,
        finish_date: copiedTask.finish_date,
        duration_days: copiedTask.duration_days,
        percent_complete: 0,
        status: "not_started",
        is_milestone: copiedTask.is_milestone,
        constraint_type: copiedTask.constraint_type,
        constraint_date: copiedTask.constraint_date,
        wbs_code: copiedTask.wbs_code,
      };

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTaskData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to paste task");
      }

      toast.success("Task pasted successfully");
      refetch();
    } catch (err) {
      console.error("Failed to paste task:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to paste task";

      // Show informative toast based on error type
      if (
        errorMessage.includes("permission") ||
        errorMessage.includes("don't have")
      ) {
        toast.error("Permission Denied", {
          description: errorMessage,
          duration: 8000,
        });
      } else if (
        errorMessage.includes("logged in") ||
        errorMessage.includes("sign in")
      ) {
        toast.error("Authentication Required", {
          description: errorMessage,
          duration: 8000,
        });
      } else {
        toast.error("Error Pasting Task", {
          description: errorMessage,
          duration: 6000,
        });
      }
    }
  }, [projectId, copiedTask, apiUrl, refetch]);

  const handleBulkStatusUpdate = useCallback(
    async (status: TaskStatus) => {
      const percentComplete =
        status === "complete" ? 100 : status === "in_progress" ? 50 : 0;
      const promises = Array.from(selectedIds).map((id) =>
        handleUpdateTask(id, { status, percent_complete: percentComplete }),
      );
      try {
        await Promise.all(promises);
        toast.success(
          `Updated ${selectedIds.size} tasks to "${status.replace("_", " ")}"`,
        );
        setSelectedIds(new Set());
      } catch {
        toast.error("Some tasks failed to update");
      }
    },
    [selectedIds, handleUpdateTask],
  );

  const handleBulkDelete = useCallback(async () => {
    const taskIds = Array.from(selectedIds);
    if (taskIds.length === 0) return;

    setBulkDeleteProgress({
      phase: "deleting",
      total: taskIds.length,
      deleted: 0,
      failed: 0,
    });

    try {
      const res = await fetch(`${apiUrl}/bulk`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_ids: taskIds }),
      });

      const result = (await res.json().catch(() => null)) as {
        deleted?: number;
        failed?: number;
        error?: string;
        errors?: Array<{ taskId: string; error: string }>;
      } | null;

      if (!res.ok) {
        throw new Error(result?.error || "Failed to delete selected tasks");
      }

      const deleted = result?.deleted ?? 0;
      const failed = result?.failed ?? 0;

      setBulkDeleteProgress({
        phase: "complete",
        total: taskIds.length,
        deleted,
        failed,
      });

      if (failed > 0) {
        const firstError = result?.errors?.[0]?.error;
        toast.error(`Deleted ${deleted} tasks; ${failed} failed`, {
          description:
            firstError ?? "Review the remaining selected tasks and try again.",
          duration: 7000,
        });
        const failedIds = new Set(
          result?.errors?.map((item) => item.taskId) ?? [],
        );
        setSelectedIds(failedIds);
      } else {
        toast.success(`Deleted ${deleted} tasks`);
      }

      await Promise.all([refetch(), refetchScheduleResources()]);

      window.setTimeout(() => {
        if (failed === 0) {
          setSelectedIds(new Set());
        }
        setBulkDeleteProgress(null);
      }, 1800);
    } catch (err) {
      console.error("Failed to bulk delete tasks:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete selected tasks";
      setBulkDeleteProgress(null);
      toast.error("Error Deleting Tasks", {
        description: errorMessage,
        duration: 6000,
      });
    }
  }, [apiUrl, refetch, refetchScheduleResources, selectedIds]);

  // State for toolbar
  const [searchValue, setSearchValue] = useState("");
  const [activeFilters, setActiveFilters] = useState<
    Record<string, FilterValue>
  >({});
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    SCHEDULE_COLUMNS.filter(
      (c) => c.defaultVisible !== false || c.alwaysVisible,
    ).map((c) => c.id),
  );

  const totalTaskCount = useMemo(() => {
    const count = (tasks: ScheduleTaskWithHierarchy[]): number =>
      tasks.reduce(
        (acc, t) => acc + 1 + (t.children ? count(t.children) : 0),
        0,
      );
    return data?.tasks ? count(data.tasks) : 0;
  }, [data?.tasks]);

  const filteredTasks = useMemo(
    () =>
      filterScheduleTaskHierarchy(data?.tasks ?? [], {
        dateFilter,
        searchValue,
        activeFilters,
      }),
    [activeFilters, data?.tasks, dateFilter, searchValue],
  );

  const filteredTaskCount = useMemo(() => {
    const count = (tasks: ScheduleTaskWithHierarchy[]): number =>
      tasks.reduce(
        (acc, t) => acc + 1 + (t.children ? count(t.children) : 0),
        0,
      );
    return count(filteredTasks);
  }, [filteredTasks]);

  const filteredGanttData = useMemo(() => {
    const ids = flattenIds(filteredTasks);
    return applyScheduleBaselineComparisonToGantt(
      (data?.ganttData ?? []).filter((item) => ids.has(item.id)),
      baselineComparison?.tasks ?? [],
      showBaseline,
    );
  }, [baselineComparison?.tasks, data?.ganttData, filteredTasks, showBaseline]);

  const hasToolbarFilters =
    searchValue.trim().length > 0 ||
    Object.values(activeFilters).some((value) =>
      Array.isArray(value)
        ? value.length > 0
        : value !== null && value !== undefined && value !== "",
    );

  // Actions for header — just the primary action, like every other page
  const headerActions = (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <Button asChild size="sm" variant="outline" className="max-sm:min-h-11">
        <Link href={`/${projectId}/schedule/import`}>
          <Upload />
          Import Schedule
        </Link>
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="max-sm:min-h-11"
        onClick={() => setIsCalendarSettingsOpen(true)}
        disabled={
          isScheduleCalendarLoading || Boolean(scheduleCalendarLoadError)
        }
        title={
          scheduleCalendarLoadError
            ? "Retry the schedule calendar before editing it."
            : undefined
        }
      >
        <CalendarDays />
        Calendar
      </Button>
      <Button
        size="sm"
        className="max-sm:min-h-11"
        onClick={() => handleAddTask()}
      >
        <Plus />
        Add Task
      </Button>
    </div>
  );

  // All schedule views consume the same filtered hierarchy.
  const viewProps = {
    tasks: filteredTasks,
    selectedIds,
    onSelectionChange: setSelectedIds,
    visibleColumns,
    onTaskClick: handleTaskClick,
    onAddTask: handleAddTask,
    onQuickAddTask: handleQuickAddTask,
    onEditTask: handleEditTask,
    onDeleteTask: handleDeleteTask,
    onUpdateTask: handleUpdateTask,
    onCreateDependency: handleCreateDependency,
    onUpdateDependency: handleUpdateDependency,
    onRemoveDependency: handleRemoveDependency,
    isLoading,
  };

  const isAuthError = error
    ? error.message.includes("session") || error.message.includes("log in")
    : false;
  const isPermissionError = error
    ? error.message.includes("access") || error.message.includes("permission")
    : false;

  return (
    <PageShell
      variant="table"
      title={isPlanningWorkspace ? "Schedule planning" : "Schedule"}
      actions={isPlanningWorkspace ? undefined : headerActions}
    >
      <ScheduleWorkspaceNavigation
        projectId={projectId}
        workspace={scheduleWorkspace}
      />
      {/* Loading skeleton */}
      {!isPlanningWorkspace && isLoading && (
        <>
          <p className="sr-only" role="status">
            Loading schedule
          </p>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <ViewModeTabs mode={viewMode} onChange={setViewMode} />
            <div className="flex items-center gap-2 pb-2 animate-pulse">
              <div className="h-8 w-8 rounded bg-muted" />
              <div className="h-8 w-20 rounded bg-muted" />
              <div className="h-8 w-24 rounded bg-muted" />
              <div className="h-4 w-px bg-border mx-1" />
              <div className="h-4 w-16 rounded bg-muted" />
            </div>
          </div>
          <div className="mt-4 overflow-hidden">
            <div className="h-10 bg-muted/50 border-b" />
            {["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"].map((key) => (
              <div
                key={key}
                className="flex items-center gap-4 px-4 py-4 border-b last:border-0 animate-pulse"
              >
                <div className="h-4 w-4 rounded bg-muted" />
                <div className="h-4 flex-1 rounded bg-muted" />
                <div className="h-4 w-20 rounded bg-muted" />
                <div className="h-4 w-20 rounded bg-muted" />
                <div className="h-2 w-24 rounded-full bg-muted" />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Error state */}
      {!isPlanningWorkspace && !isLoading && error && (
        <>
          <ViewModeTabs mode={viewMode} onChange={setViewMode} />
          <ErrorState
            data-testid="error-state"
            title={
              isAuthError
                ? "Session Expired"
                : isPermissionError
                  ? "Access Denied"
                  : "Unable to Load Schedule"
            }
            error={error}
            onRetry={isAuthError ? undefined : () => refetch()}
          />
        </>
      )}

      {/* Main content */}
      {(isPlanningWorkspace || (!isLoading && !error)) && (
        <>
          {isPlanningWorkspace ? (
            <SchedulePlanningWorkspace
              projectId={projectId}
              revisions={scheduleRevisions}
              baselines={scheduleBaselines}
              baselineComparison={baselineComparison}
              canManageBaselines={canManageBaselines}
              onSnapshot={handleSnapshotSchedule}
              onTransition={handleRevisionTransition}
              onCaptureBaseline={handleCaptureBaseline}
              onActivateBaseline={handleActivateBaseline}
              disabled={isRevisionActionPending}
              revisionActionError={revisionActionError}
              baselineActionError={baselineActionError}
              lookaheadStartDate={lookaheadStartDate}
              resourceAvailability={
                <ResourceAvailabilityPanel
                  projectId={projectId}
                  roster={scheduleResourceRoster}
                  tasks={allFlatTasks}
                  calendar={scheduleCalendar}
                  defaultOpen
                  calendarReady={
                    !isScheduleCalendarLoading && !scheduleCalendarLoadError
                  }
                  isLoading={
                    isLoading ||
                    isScheduleResourceLoading ||
                    isScheduleCalendarLoading
                  }
                  error={
                    scheduleCalendarLoadError
                      ? `Resource load is unavailable until the saved calendar is restored: ${scheduleCalendarLoadError}`
                      : error
                        ? `Resource task context is unavailable: ${error.message}`
                        : (scheduleResourceError?.message ?? null)
                  }
                  onRetry={() => {
                    if (scheduleCalendarLoadError)
                      setScheduleCalendarReloadKey((key) => key + 1);
                    void refetch();
                    void refetchScheduleResources();
                  }}
                  capacityRange={scheduleResourceCapacityRange}
                  isCapacityRangeLoading={isScheduleResourceCapacityLoading}
                  capacityRangeError={
                    scheduleResourceCapacityError?.message ?? null
                  }
                  onLoadCapacityRange={loadCapacityRange}
                  selectedCapacityProfile={selectedCapacityProfile}
                  isCapacityProfileLoading={isCapacityProfileLoading}
                  capacityProfileError={capacityProfileError?.message ?? null}
                  onLoadCapacityProfile={loadCapacityProfile}
                  onSaveCapacityProfile={replaceCapacityProfile}
                  levelingPreview={levelingPreview}
                  isLevelingPreviewLoading={isLevelingPreviewLoading}
                  levelingPreviewError={levelingPreviewError?.message ?? null}
                  onPreviewLeveling={previewResourceLeveling}
                  onScheduleChanged={async () => {
                    await Promise.all([refetch(), refetchScheduleResources()]);
                  }}
                />
              }
            />
          ) : (
            <>
              {scheduleCalendarLoadError && (
                <InfoAlert variant="error" role="alert">
                  <div className="flex flex-wrap items-center gap-3">
                    <span>
                      The saved schedule calendar could not be loaded. Editing
                      is disabled to protect the existing calendar.
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setScheduleCalendarReloadKey((key) => key + 1)
                      }
                      disabled={isScheduleCalendarLoading}
                    >
                      {isScheduleCalendarLoading
                        ? "Retrying…"
                        : "Retry calendar"}
                    </Button>
                  </div>
                </InfoAlert>
              )}
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <ViewModeTabs mode={viewMode} onChange={setViewMode} />
                <div className="flex flex-wrap items-center gap-2">
                  <DateFilterPills
                    value={dateFilter}
                    onChange={setDateFilter}
                  />
                  {viewMode === "grid" && (
                    <>
                      <Button
                        type="button"
                        variant={showCriticalPath ? "secondary" : "outline"}
                        size="sm"
                        aria-pressed={showCriticalPath}
                        onClick={() =>
                          setShowCriticalPath((visible) => !visible)
                        }
                      >
                        <GitBranch />
                        Critical Path
                      </Button>
                      {scheduleBaselines.some(
                        (baseline) => baseline.is_active,
                      ) && (
                        <Button
                          type="button"
                          variant={showBaseline ? "secondary" : "outline"}
                          size="sm"
                          aria-pressed={showBaseline}
                          disabled={
                            !baselineComparison || Boolean(baselineActionError)
                          }
                          onClick={() => setShowBaseline((visible) => !visible)}
                        >
                          Baseline
                        </Button>
                      )}
                    </>
                  )}
                  <TableToolbar
                    className="w-full sm:w-auto"
                    totalItems={totalTaskCount}
                    filteredItems={filteredTaskCount}
                    selectedCount={selectedIds.size}
                    searchValue={searchValue}
                    onSearchChange={setSearchValue}
                    searchPlaceholder="Search tasks..."
                    currentView="table"
                    onViewChange={() => {}}
                    enableViews={false}
                    filters={SCHEDULE_FILTERS}
                    activeFilters={activeFilters}
                    onFilterChange={setActiveFilters}
                    onClearFilters={() => setActiveFilters({})}
                    columns={SCHEDULE_COLUMNS}
                    visibleColumns={visibleColumns}
                    onColumnVisibilityChange={setVisibleColumns}
                    onExport={() => setIsImportExportModalOpen(true)}
                    enableBulkDelete={false}
                  />
                </div>
              </div>

              {selectedIds.size > 0 && (
                <BulkActionBar
                  selectedCount={selectedIds.size}
                  deleteProgress={bulkDeleteProgress}
                  onUpdateStatus={handleBulkStatusUpdate}
                  onDelete={handleBulkDelete}
                  onClear={() => {
                    setBulkDeleteProgress(null);
                    setSelectedIds(new Set());
                  }}
                />
              )}

              {data && (!data.tasks || data.tasks.length === 0) && (
                <EmptyState
                  className="mt-4 animate-reveal"
                  icon={<Calendar />}
                  title="No tasks scheduled"
                  description="Create tasks, set milestones, and track dependencies with Gantt charts and multiple view modes."
                  action={
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleAddTask()}>
                        <Plus />
                        Add Task
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/${projectId}/schedule/import`}>
                          <Upload />
                          Import Schedule
                        </Link>
                      </Button>
                    </div>
                  }
                />
              )}

              {data?.tasks &&
                data.tasks.length > 0 &&
                filteredTasks.length === 0 && (
                  <EmptyState
                    className="mt-4 animate-reveal"
                    icon={<CalendarDays />}
                    title={
                      hasToolbarFilters
                        ? "No tasks match your filters"
                        : dateFilter === "today"
                          ? "No tasks scheduled for today"
                          : "No tasks scheduled this week"
                    }
                    description={
                      hasToolbarFilters
                        ? "Clear the search or filters to see more of the schedule."
                        : dateFilter === "today"
                          ? "No tasks have a start or finish date of today. Switch to All to see the full schedule."
                          : "No tasks are active this week. Switch to All to see the full schedule."
                    }
                    action={
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDateFilter("all");
                          setSearchValue("");
                          setActiveFilters({});
                        }}
                      >
                        {hasToolbarFilters ? "Clear Filters" : "Show All Tasks"}
                      </Button>
                    }
                  />
                )}

              {data?.tasks &&
                data.tasks.length > 0 &&
                filteredTasks.length > 0 && (
                  <div
                    key={viewMode}
                    className="flex-1 min-h-[600px] animate-reveal"
                  >
                    {viewMode === "grid" && (
                      <div className="-mx-4 sm:-mx-6 lg:-mx-8">
                        <GanttChart
                          data={filteredGanttData}
                          calendar={scheduleCalendar}
                          showCriticalPath={showCriticalPath}
                          showBaseline={showBaseline}
                          visibleColumns={visibleColumns}
                          onQuickAddTask={(name) =>
                            handleQuickAddTask({
                              name,
                            })
                          }
                          onUpdateTask={handleUpdateTask}
                          onTaskClick={(taskId) => {
                            const fullTask = data?.tasks
                              ? findTaskById(data.tasks, taskId)
                              : null;
                            if (fullTask) {
                              handleEditTask(fullTask);
                            }
                          }}
                        />
                      </div>
                    )}

                    {viewMode !== "grid" && (
                      <>
                        {viewMode === "board" && (
                          <ScheduleBoardView {...viewProps} />
                        )}
                        {viewMode === "calendar" && (
                          <ScheduleCalendarView {...viewProps} />
                        )}
                        {viewMode === "timeline" && (
                          <ScheduleTimelineView {...viewProps} />
                        )}
                        {viewMode === "schedule" && (
                          <ScheduleGridView {...viewProps} />
                        )}
                      </>
                    )}
                  </div>
                )}
            </>
          )}
        </>
      )}

      {/* Modals */}
      <TaskEditModal
        open={isModalOpen}
        onOpenChange={handleTaskModalOpenChange}
        task={editingTask}
        parentTaskId={parentTaskIdForNew}
        projectId={projectId}
        calendar={scheduleCalendar}
        availableTasks={allFlatTasks}
        relatedActionItems={
          editingTask ? (relatedActionItemsByTaskId[editingTask.id] ?? []) : []
        }
        deadlineActions={
          editingTask
            ? {
                onSave: (deadlineDate) =>
                  handleSaveDeadline(editingTask.id, deadlineDate),
                onRemove: () => handleRemoveDeadline(editingTask.id),
              }
            : undefined
        }
        dependencyActions={
          editingTask
            ? {
                onCreate: (input) =>
                  handleCreateDependency(editingTask.id, input),
                onRemove: (dependencyId) =>
                  handleRemoveDependency(editingTask.id, dependencyId),
                onUpdate: (dependencyId, input) =>
                  handleUpdateDependency(editingTask.id, dependencyId, input),
              }
            : undefined
        }
        resourceAssignmentActions={
          editingTask
            ? {
                roster: scheduleResourceRoster,
                isLoading:
                  isScheduleResourceLoading || isScheduleCalendarLoading,
                error: scheduleCalendarLoadError
                  ? `Resource availability is unavailable until the saved calendar is restored: ${scheduleCalendarLoadError}`
                  : (scheduleResourceError?.message ?? null),
                onRetry: () => {
                  if (scheduleCalendarLoadError)
                    setScheduleCalendarReloadKey((key) => key + 1);
                  void refetchScheduleResources();
                },
                onSave: (assignments, expectedAssignments) =>
                  handleSaveTaskAssignments(
                    editingTask.id,
                    assignments,
                    expectedAssignments,
                  ),
                loadCapacityProfiles: fetchCapacityProfilesForRange,
              }
            : undefined
        }
        onSave={handleSaveTask}
        onScheduleChanged={async () => {
          await Promise.all([refetch(), refetchScheduleResources()]);
        }}
        fieldUpdateAction={
          editingTask
            ? (input) => handleFieldUpdate(editingTask.id, input)
            : undefined
        }
        linkedSubmittals={linkedSubmittalState.data}
        linkedSubmittalsError={linkedSubmittalState.error ?? undefined}
        submittalRisk={linkedSubmittalState.risk}
        onUnlinkSubmittal={
          editingTask
            ? (submittalId) =>
                handleUnlinkSubmittal(editingTask.id, submittalId)
            : undefined
        }
        availableSubmittals={availableSubmittals}
        onLinkSubmittal={
          editingTask
            ? (submittalId) => handleLinkSubmittal(editingTask.id, submittalId)
            : undefined
        }
      />
      <CalendarSettingsDialog
        open={
          isCalendarSettingsOpen &&
          !scheduleCalendarLoadError &&
          !isScheduleCalendarLoading
        }
        onOpenChange={setIsCalendarSettingsOpen}
        calendar={scheduleCalendar}
        onSave={saveScheduleCalendar}
        saveDisabledReason={
          scheduleCalendarLoadError
            ? "Reload the saved schedule calendar before making changes."
            : null
        }
      />
      <TaskContextMenu
        task={contextMenu.task}
        position={contextMenu.position}
        onClose={closeContextMenu}
        onAction={handleContextMenuAction}
        hasCopiedTask={!!copiedTask}
        relatedActionItems={
          contextMenu.task
            ? (relatedActionItemsByTaskId[contextMenu.task.id] ?? [])
            : []
        }
      />
      <ImportExportModal
        open={isImportExportModalOpen}
        onOpenChange={setIsImportExportModalOpen}
        projectId={projectId}
        tasks={allFlatTasks}
      />
    </PageShell>
  );
}

// Helper to find task by ID in hierarchy
function findTaskById(
  tasks: ScheduleTaskWithHierarchy[],
  id: string,
): ScheduleTask | null {
  for (const task of tasks) {
    if (task.id === id) return task;
    if (task.children?.length) {
      const found = findTaskById(task.children, id);
      if (found) return found;
    }
  }
  return null;
}

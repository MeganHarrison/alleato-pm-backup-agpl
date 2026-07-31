"use client";

/**
 * =============================================================================
 * GANTT CHART COMPONENT
 * =============================================================================
 *
 * Custom SVG-based Gantt chart for project scheduling visualization.
 * Supports:
 * - Task bars with progress indicators
 * - Milestone diamonds
 * - Dependency arrows
 * - Timeline grid
 * - Zoom levels (day, week, month)
 * - Deadline indicators
 */

import {
  useMemo,
  useRef,
  useEffect,
  useCallback,
  useState,
  type KeyboardEvent,
} from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Circle,
  Clock,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  PanelLeftOpen,
  PanelLeftClose,
  GripVertical,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  format,
  differenceInDays,
  addDays,
  startOfMonth,
  startOfDay,
  endOfMonth,
  eachDayOfInterval,
  eachMonthOfInterval,
  parseISO,
} from "date-fns";
import type {
  TaskStatus,
  GanttChartItem,
  DependencyType,
} from "@/types/scheduling";
import type { ScheduleTask } from "@/types/scheduling";
import {
  defaultScheduleCalendar,
  isWorkingDay,
  type ScheduleCalendar,
} from "@/lib/scheduling/schedule-calendar";
import { localDateTimeParts } from "@/lib/scheduling/schedule-hourly-leveling";

// =============================================================================
// TYPES
// =============================================================================

type ZoomLevel = "day" | "week" | "month";

interface GanttChartProps {
  data: GanttChartItem[];
  showCriticalPath?: boolean;
  showBaseline?: boolean;
  onTaskClick?: (taskId: string) => void;
  onQuickAddTask?: (name: string) => Promise<void>;
  onUpdateTask?: (
    taskId: string,
    updates: Partial<ScheduleTask>,
  ) => Promise<void>;
  visibleColumns?: string[];
  calendar?: ScheduleCalendar;
  className?: string;
}

interface TimelineRange {
  start: Date;
  end: Date;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ROW_HEIGHT = 36;
const HEADER_ROW_1 = 30; // Month row
const HEADER_ROW_2 = 30; // Day row
const HEADER_HEIGHT = HEADER_ROW_1 + HEADER_ROW_2;
const TASK_BAR_HEIGHT = 20;
const MILESTONE_SIZE = 12;
const LEFT_PANEL_WIDTH = 340;
const LEFT_PANEL_MIN_WIDTH = 240;
const LEFT_PANEL_MAX_WIDTH = 560;

const ganttStatusConfig: Record<
  TaskStatus,
  { label: string; icon: typeof Circle; iconColor: string }
> = {
  not_started: {
    label: "Not started",
    icon: Circle,
    iconColor: "text-muted-foreground",
  },
  in_progress: {
    label: "In progress",
    icon: Clock,
    iconColor: "text-[hsl(var(--status-info))]",
  },
  complete: {
    label: "Complete",
    icon: CheckCircle2,
    iconColor: "text-[hsl(var(--status-success))]",
  },
};

const ZOOM_CONFIG: Record<ZoomLevel, { dayWidth: number; format: string }> = {
  day: { dayWidth: 40, format: "d" },
  week: { dayWidth: 36, format: "EEEEE d" },
  month: { dayWidth: 8, format: "MMM" },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const parseGanttDate = (value: string): Date => parseISO(value);

const formatVariancePhrase = (
  label: string,
  value: number | null | undefined,
): string => {
  if (value === null || value === undefined)
    return `${label} variance unavailable`;
  return `${value} ${Math.abs(value) === 1 ? "day" : "days"} ${label.toLowerCase()} variance`;
};

const formatVarianceShort = (value: number | null | undefined): string =>
  value === null || value === undefined ? "unavailable" : `${value}d`;

const getDateRange = (
  data: GanttChartItem[],
  showBaseline: boolean,
): TimelineRange => {
  if (data.length === 0) {
    const today = new Date();
    return {
      start: startOfMonth(today),
      end: endOfMonth(addDays(today, 60)),
    };
  }

  const dates = data.flatMap((item) => {
    const itemDates: Date[] = [];
    if (item.start_date) itemDates.push(parseGanttDate(item.start_date));
    if (item.finish_date) itemDates.push(parseGanttDate(item.finish_date));
    if (item.deadline) itemDates.push(parseGanttDate(item.deadline));
    if (showBaseline && item.baseline_start_date)
      itemDates.push(parseGanttDate(item.baseline_start_date));
    if (showBaseline && item.baseline_finish_date)
      itemDates.push(parseGanttDate(item.baseline_finish_date));
    return itemDates;
  });

  if (dates.length === 0) {
    const today = new Date();
    return {
      start: startOfMonth(today),
      end: endOfMonth(addDays(today, 60)),
    };
  }

  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

  // Add padding
  return {
    start: addDays(startOfMonth(minDate), -7),
    end: addDays(endOfMonth(maxDate), 14),
  };
};

const getBarColor = (
  percentComplete: number,
  isOverdue: boolean,
  isCriticalPath: boolean,
  showCriticalPath: boolean,
): string => {
  if (showCriticalPath && isCriticalPath) return "hsl(var(--destructive))";
  if (isOverdue) return "hsl(var(--destructive))";
  if (percentComplete === 100) return "hsl(var(--success, 142 71% 45%))";
  return "hsl(var(--primary))";
};

// =============================================================================
// DEPENDENCY ARROW COMPONENT
// =============================================================================

interface DependencyArrowProps {
  from: GanttChartItem;
  to: GanttChartItem;
  taskIndexMap: Map<string, number>;
  dayWidth: number;
  startDate: Date;
  dependencyType: DependencyType;
  lagDays: number;
}

function DependencyArrow({
  from,
  to,
  taskIndexMap,
  dayWidth,
  startDate,
  dependencyType,
  lagDays,
}: DependencyArrowProps) {
  const fromIndex = taskIndexMap.get(from.id);
  const toIndex = taskIndexMap.get(to.id);

  if (fromIndex === undefined || toIndex === undefined) return null;

  const getDateX = (dateStr: string) =>
    differenceInDays(parseGanttDate(dateStr), startDate) * dayWidth;

  let fromDate: string | null;
  let toDate: string | null;
  let fromUsesFinish = false;
  let toUsesFinish = false;

  switch (dependencyType) {
    case "finish_to_start": // Finish-to-Start
      fromDate = from.finish_date;
      toDate = to.start_date;
      fromUsesFinish = true;
      break;
    case "start_to_start": // Start-to-Start
      fromDate = from.start_date;
      toDate = to.start_date;
      break;
    case "finish_to_finish": // Finish-to-Finish
      fromDate = from.finish_date;
      toDate = to.finish_date;
      fromUsesFinish = true;
      toUsesFinish = true;
      break;
    case "start_to_finish": // Start-to-Finish
      fromDate = from.start_date;
      toDate = to.finish_date;
      toUsesFinish = true;
      break;
    default:
      fromDate = from.finish_date;
      toDate = to.start_date;
      fromUsesFinish = true;
  }

  if (!fromDate || !toDate) return null;

  const fromX = getDateX(fromDate) + (fromUsesFinish ? dayWidth : 0);
  const toX = getDateX(toDate) + (toUsesFinish ? dayWidth : 0);

  const fromY = HEADER_HEIGHT + fromIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
  const toY = HEADER_HEIGHT + toIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

  // Create path for the arrow
  const midX = (fromX + toX) / 2;
  const path =
    fromY === toY
      ? `M ${fromX} ${fromY} L ${toX - 6} ${toY}` // Horizontal line
      : `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX - 6} ${toY}`; // Stepped line

  return (
    <g
      className="dependency-arrow"
      data-testid={`gantt-dependency-${from.id}-${to.id}`}
    >
      <path
        d={path}
        fill="none"
        stroke="hsl(var(--muted-foreground))"
        strokeWidth={1.5}
        strokeDasharray={lagDays > 0 ? "4,2" : undefined}
        opacity={0.6}
      />
      {/* Arrow head */}
      <polygon
        points={`${toX - 6},${toY - 4} ${toX},${toY} ${toX - 6},${toY + 4}`}
        fill="hsl(var(--muted-foreground))"
        opacity={0.6}
      />
    </g>
  );
}

// =============================================================================
// TASK BAR COMPONENT
// =============================================================================

interface TaskBarProps {
  task: GanttChartItem;
  index: number;
  dayWidth: number;
  startDate: Date;
  showCriticalPath: boolean;
  showBaseline: boolean;
  timezoneName: string;
  /** Total scrollable timeline width — used to flip the task-name label to the left
   * of the bar when there isn't room to the right, matching Microsoft Project. */
  totalWidth: number;
  onTaskClick?: (taskId: string) => void;
}

// Rough text-width estimate (no DOM measurement available in this render pass) — a
// text-xs label averages ~6px/character at this font size, plus a small gap.
const LABEL_GAP = 6;
function estimateLabelWidth(label: string): number {
  return label.length * 6 + LABEL_GAP;
}

function TaskBar({
  task,
  index,
  dayWidth,
  startDate,
  showCriticalPath,
  showBaseline,
  timezoneName,
  totalWidth,
  onTaskClick,
}: TaskBarProps) {
  if (!task.start_date || !task.finish_date) return null;

  const taskStart = parseGanttDate(task.start_date);
  const taskEnd = parseGanttDate(task.finish_date);

  const startOffset = differenceInDays(taskStart, startDate);
  const duration = Math.max(1, differenceInDays(taskEnd, taskStart) + 1);

  const x = startOffset * dayWidth;
  const y =
    HEADER_HEIGHT + index * ROW_HEIGHT + (ROW_HEIGHT - TASK_BAR_HEIGHT) / 2;
  const width = duration * dayWidth;

  // Task-name label placement, matching Microsoft Project: to the right of the bar
  // by default, flipped to the left when it would run past the chart's right edge.
  const labelWidth = estimateLabelWidth(task.name);
  const labelFitsRight = x + width + LABEL_GAP + labelWidth <= totalWidth;
  const labelX = labelFitsRight ? x + width + LABEL_GAP : x - LABEL_GAP;
  const labelTextAnchor: "start" | "end" = labelFitsRight ? "start" : "end";

  const progressWidth = (width * task.percent_complete) / 100;
  const timestampPosition = (value: string) => {
    const local = localDateTimeParts(Date.parse(value), timezoneName);
    return (
      differenceInDays(parseGanttDate(local.date), startDate) +
      local.minute / 1440
    );
  };
  const segmentBars = (task.segments ?? []).map((segment) => {
    const segmentStart = timestampPosition(segment.starts_at);
    const segmentFinish = timestampPosition(segment.ends_at);
    const segmentX = segmentStart * dayWidth;
    const segmentWidth = Math.max(
      3,
      (segmentFinish - segmentStart) * dayWidth,
    );
    return { ...segment, x: segmentX, width: segmentWidth };
  });
  const barColor = getBarColor(
    task.percent_complete,
    task.is_overdue,
    task.is_critical_path ?? false,
    showCriticalPath,
  );
  const isVisibleCriticalTask = showCriticalPath && task.is_critical_path;
  const baselineStart =
    showBaseline && task.baseline_start_date
      ? parseGanttDate(task.baseline_start_date)
      : null;
  const baselineFinish =
    showBaseline && task.baseline_finish_date
      ? parseGanttDate(task.baseline_finish_date)
      : null;
  const baselineX = baselineStart
    ? differenceInDays(baselineStart, startDate) * dayWidth
    : null;
  const baselineWidth =
    baselineStart && baselineFinish
      ? Math.max(1, differenceInDays(baselineFinish, baselineStart) + 1) *
        dayWidth
      : null;
  const varianceDescription =
    baselineStart && baselineFinish
      ? `${formatVariancePhrase("Start", task.start_variance_days)}, ${formatVariancePhrase("Finish", task.finish_variance_days)}`
      : null;
  const segmentDescription =
    segmentBars.length > 0
      ? `split into ${segmentBars.length} segment${segmentBars.length === 1 ? "" : "s"}: ${segmentBars
          .map(
            (segment) =>
              `${new Intl.DateTimeFormat(undefined, { timeZone: timezoneName, dateStyle: "medium", timeStyle: "short" }).format(new Date(segment.starts_at))} to ${new Intl.DateTimeFormat(undefined, { timeZone: timezoneName, dateStyle: "medium", timeStyle: "short" }).format(new Date(segment.ends_at))}`,
          )
          .join("; ")}`
      : null;
  const taskAccessibleLabel = [
    task.name,
    isVisibleCriticalTask ? "critical task" : null,
    varianceDescription ? `baseline comparison: ${varianceDescription}` : null,
    segmentDescription,
  ]
    .filter(Boolean)
    .join(", ");
  const activateTask = () => onTaskClick?.(task.id);
  const handleTaskKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activateTask();
    }
  };

  if (task.is_milestone) {
    // Render milestone as diamond
    const cx = x + dayWidth / 2;
    const cy = y + TASK_BAR_HEIGHT / 2;
    const milestoneLabelFitsRight = cx + MILESTONE_SIZE + LABEL_GAP + labelWidth <= totalWidth;
    const milestoneLabelX = milestoneLabelFitsRight ? cx + MILESTONE_SIZE + LABEL_GAP : cx - MILESTONE_SIZE - LABEL_GAP;
    const milestoneLabelTextAnchor: "start" | "end" = milestoneLabelFitsRight ? "start" : "end";

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <g
              className="cursor-pointer"
              onClick={activateTask}
              onKeyDown={handleTaskKeyDown}
              role="button"
              tabIndex={0}
              aria-label={taskAccessibleLabel}
            >
              {baselineX !== null && (
                <rect
                  data-testid={`gantt-baseline-${task.id}`}
                  aria-hidden="true"
                  x={baselineX}
                  y={cy + MILESTONE_SIZE + 3}
                  width={Math.max(4, dayWidth / 2)}
                  height={3}
                  rx={1.5}
                  fill="hsl(var(--muted-foreground))"
                  opacity={0.65}
                />
              )}
              <polygon
                points={`${cx},${cy - MILESTONE_SIZE} ${cx + MILESTONE_SIZE},${cy} ${cx},${cy + MILESTONE_SIZE} ${cx - MILESTONE_SIZE},${cy}`}
                fill="hsl(var(--warning, 45 93% 47%))"
                stroke="hsl(var(--warning-foreground, 45 93% 27%))"
                strokeWidth={1}
              />
              <text
                x={milestoneLabelX}
                y={cy}
                dy="0.35em"
                textAnchor={milestoneLabelTextAnchor}
                className="text-xs fill-foreground pointer-events-none select-none"
              >
                {task.name}
              </text>
            </g>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <div className="font-medium">{task.name}</div>
              <div className="text-muted-foreground">
                Milestone: {format(taskStart, "MMM d, yyyy")}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <g
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={activateTask}
            onKeyDown={handleTaskKeyDown}
            role="button"
            tabIndex={0}
            aria-label={taskAccessibleLabel}
          >
            {baselineX !== null && baselineWidth !== null && (
              <rect
                data-testid={`gantt-baseline-${task.id}`}
                aria-hidden="true"
                x={baselineX}
                y={y + TASK_BAR_HEIGHT + 2}
                width={baselineWidth}
                height={4}
                rx={2}
                fill="hsl(var(--muted-foreground))"
                opacity={0.65}
              />
            )}
            {segmentBars.length > 0 ? (
              <>
                {segmentBars.slice(1).map((segment, segmentIndex) => {
                  const previous = segmentBars[segmentIndex];
                  return (
                    <line
                      key={`gap:${segment.segment_index}`}
                      x1={previous.x + previous.width}
                      x2={segment.x}
                      y1={y + TASK_BAR_HEIGHT / 2}
                      y2={y + TASK_BAR_HEIGHT / 2}
                      stroke={barColor}
                      strokeWidth={2}
                      strokeDasharray="3,3"
                      opacity={0.55}
                    />
                  );
                })}
                {segmentBars.map((segment) => (
                  <rect
                    key={segment.segment_index}
                    data-testid={`gantt-segment-${task.id}-${segment.segment_index}`}
                    x={segment.x}
                    y={y}
                    width={segment.width}
                    height={TASK_BAR_HEIGHT}
                    rx={3}
                    fill={barColor}
                    opacity={segment.lock_reason ? 0.75 : 1}
                  />
                ))}
              </>
            ) : (
              <>
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={TASK_BAR_HEIGHT}
                  rx={4}
                  fill={barColor}
                  opacity={0.3}
                />
                <rect
                  x={x}
                  y={y}
                  width={progressWidth}
                  height={TASK_BAR_HEIGHT}
                  rx={4}
                  fill={barColor}
                />
              </>
            )}
            <text
              x={labelX}
              y={y + TASK_BAR_HEIGHT / 2}
              dy="0.35em"
              textAnchor={labelTextAnchor}
              className="text-xs fill-foreground pointer-events-none select-none"
            >
              {task.name}
            </text>
            {/* Deadline indicator */}
            {task.deadline && (
              <line
                x1={
                  differenceInDays(parseGanttDate(task.deadline), startDate) *
                  dayWidth
                }
                y1={y - 4}
                x2={
                  differenceInDays(parseGanttDate(task.deadline), startDate) *
                  dayWidth
                }
                y2={y + TASK_BAR_HEIGHT + 4}
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                strokeDasharray="4,2"
              />
            )}
          </g>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm space-y-1">
            <div className="font-medium">{task.name}</div>
            <div className="text-muted-foreground">
              {format(taskStart, "MMM d")} - {format(taskEnd, "MMM d, yyyy")}
            </div>
            <div className="flex items-center gap-2">
              <span>Progress:</span>
              <Badge
                variant={
                  task.percent_complete === 100 ? "default" : "secondary"
                }
              >
                {task.percent_complete}%
              </Badge>
            </div>
            {isVisibleCriticalTask && (
              <div className="font-medium text-destructive">
                Critical path · {task.total_float_days ?? 0} days total float
              </div>
            )}
            {(task.schedule_warnings?.length ?? 0) > 0 && (
              <div className="text-destructive">
                {task.schedule_warnings?.length} schedule warning
                {task.schedule_warnings?.length === 1 ? "" : "s"}
              </div>
            )}
            {task.deadline && (
              <div className="text-destructive">
                Deadline: {format(parseGanttDate(task.deadline), "MMM d, yyyy")}
              </div>
            )}
            {baselineStart && baselineFinish && (
              <div className="text-muted-foreground">
                Baseline: {format(baselineStart, "MMM d")} -{" "}
                {format(baselineFinish, "MMM d, yyyy")}
                {` | Start ${formatVarianceShort(task.start_variance_days)} | Finish ${formatVarianceShort(task.finish_variance_days)} | Duration ${formatVarianceShort(task.duration_variance_days)}`}
              </div>
            )}
            {showBaseline &&
              task.comparison_status &&
              task.comparison_status !== "unchanged" && (
                <div className="capitalize text-muted-foreground">
                  Baseline status: {task.comparison_status}
                </div>
              )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function GanttChart({
  data,
  showCriticalPath = false,
  showBaseline = false,
  onTaskClick,
  onQuickAddTask,
  onUpdateTask,
  visibleColumns,
  calendar = defaultScheduleCalendar,
  className,
}: GanttChartProps) {
  const zoomLevel: ZoomLevel = "week";
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState(LEFT_PANEL_WIDTH);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [quickTaskName, setQuickTaskName] = useState("");
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTargetTaskId, setDropTargetTaskId] = useState<string | null>(null);

  const { dayWidth } = ZOOM_CONFIG[zoomLevel];
  const dateRange = useMemo(
    () => getDateRange(data, showBaseline),
    [data, showBaseline],
  );

  // Determine which tasks are parents (have children)
  const parentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const task of data) {
      if (task.parent_task_id) ids.add(task.parent_task_id);
    }
    return ids;
  }, [data]);

  // Filter out collapsed children
  const visibleData = useMemo(() => {
    if (collapsedIds.size === 0) return data;
    // Build a set of all collapsed ancestor IDs (transitive)
    const hiddenParents = new Set<string>();
    const isHidden = (task: GanttChartItem): boolean => {
      if (!task.parent_task_id) return false;
      if (collapsedIds.has(task.parent_task_id)) return true;
      if (hiddenParents.has(task.parent_task_id)) return true;
      // Check ancestors
      const parent = data.find((t) => t.id === task.parent_task_id);
      if (parent && isHidden(parent)) {
        hiddenParents.add(task.parent_task_id);
        return true;
      }
      return false;
    };
    return data.filter((task) => !isHidden(task));
  }, [data, collapsedIds]);

  const toggleCollapse = useCallback((taskId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  // Generate timeline days
  const timelineDays = useMemo(() => {
    return eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
  }, [dateRange]);

  const totalWidth = timelineDays.length * dayWidth;
  const totalHeight = HEADER_HEIGHT + visibleData.length * ROW_HEIGHT;
  const projectToday = useMemo(
    () => parseGanttDate(
      localDateTimeParts(
        Date.now(),
        calendar.timezone_name ?? "America/Indiana/Indianapolis",
      ).date,
    ),
    [calendar.timezone_name],
  );

  // Create task index map for dependency arrows
  const taskIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    visibleData.forEach((task, index) => {
      map.set(task.id, index);
    });
    return map;
  }, [visibleData]);

  // Scroll to today on mount
  useEffect(() => {
    const todayOffset = differenceInDays(projectToday, dateRange.start);
    const scrollTo = Math.max(0, todayOffset * dayWidth - 200);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollTo;
    }
  }, [dateRange.start, dayWidth, projectToday]);

  const handleScroll = useCallback(() => {}, []);
  const startResize = useCallback(() => {
    if (isPanelCollapsed) return;
    setIsResizing(true);
  }, [isPanelCollapsed]);

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (!containerRef.current) return;
      const bounds = containerRef.current.getBoundingClientRect();
      const nextWidth = event.clientX - bounds.left;
      setLeftPanelWidth(
        Math.max(
          LEFT_PANEL_MIN_WIDTH,
          Math.min(LEFT_PANEL_MAX_WIDTH, nextWidth),
        ),
      );
    };

    const stopResize = () => setIsResizing(false);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  // Generate timeline header (months + days for week zoom)
  const renderTimelineHeader = useMemo(() => {
    const months = eachMonthOfInterval({
      start: dateRange.start,
      end: dateRange.end,
    });

    return (
      <>
        {/* Months row */}
        <g className="months-header">
          {months.map((month, i) => {
            const monthStart = i === 0 ? dateRange.start : startOfMonth(month);
            const monthEnd =
              i === months.length - 1 ? dateRange.end : endOfMonth(month);
            const startOffset = differenceInDays(monthStart, dateRange.start);
            const monthDays = differenceInDays(monthEnd, monthStart) + 1;

            return (
              <g key={month.toISOString()}>
                <rect
                  x={startOffset * dayWidth}
                  y={0}
                  width={monthDays * dayWidth}
                  height={HEADER_ROW_1}
                  fill="hsl(var(--card))"
                  stroke="hsl(var(--border))"
                />
                <text
                  x={startOffset * dayWidth + (monthDays * dayWidth) / 2}
                  y={HEADER_ROW_1 - 10}
                  textAnchor="middle"
                  className="text-xs font-medium fill-foreground"
                >
                  {format(month, "MMMM yyyy")}
                </text>
              </g>
            );
          })}
        </g>

        {/* Days row — abbreviation + number (e.g., "M 3") */}
        <g className="days-header">
          {timelineDays.map((day, i) => {
            const isNonWorking = !isWorkingDay(
              format(day, "yyyy-MM-dd"),
              calendar,
            );
            return (
              <g key={day.toISOString()}>
                <rect
                  x={i * dayWidth}
                  y={HEADER_ROW_1}
                  width={dayWidth}
                  height={HEADER_ROW_2}
                  fill="transparent"
                  stroke="hsl(var(--border))"
                />
                <text
                  x={i * dayWidth + dayWidth / 2}
                  y={HEADER_ROW_1 + HEADER_ROW_2 - 10}
                  textAnchor="middle"
                  className="text-2xs"
                  fill={
                    isNonWorking
                      ? "hsl(var(--muted-foreground) / 0.6)"
                      : "hsl(var(--muted-foreground))"
                  }
                >
                  {format(day, "EEEEE d")}
                </text>
              </g>
            );
          })}
        </g>
      </>
    );
  }, [calendar, dateRange, dayWidth, timelineDays]);

  // Render grid lines
  const renderGridLines = useMemo(() => {
    return (
      <g className="grid-lines" opacity={0.3}>
        {/* Weekend column highlighting */}
        {timelineDays.map((day, i) => {
          if (isWorkingDay(format(day, "yyyy-MM-dd"), calendar)) return null;
          return (
            <rect
              key={`wknd-${day.toISOString()}`}
              x={i * dayWidth}
              y={HEADER_HEIGHT}
              width={dayWidth}
              height={totalHeight - HEADER_HEIGHT}
              fill="hsl(var(--muted))"
              opacity={0.4}
            />
          );
        })}
        {/* Vertical lines */}
        {timelineDays.map((day, i) => (
          <line
            key={`v-${day.toISOString()}`}
            x1={i * dayWidth}
            y1={HEADER_HEIGHT}
            x2={i * dayWidth}
            y2={totalHeight}
            stroke="hsl(var(--border))"
            strokeWidth={
              isWorkingDay(format(day, "yyyy-MM-dd"), calendar) ? 0.25 : 0.5
            }
          />
        ))}
        {/* Horizontal lines */}
        {visibleData.map((_, i) => (
          <line
            key={`h-${i}`}
            x1={0}
            y1={HEADER_HEIGHT + i * ROW_HEIGHT}
            x2={totalWidth}
            y2={HEADER_HEIGHT + i * ROW_HEIGHT}
            stroke="hsl(var(--border))"
            strokeWidth={0.25}
          />
        ))}
      </g>
    );
  }, [calendar, timelineDays, dayWidth, totalHeight, totalWidth, visibleData]);

  // Render today line
  const renderTodayLine = useMemo(() => {
    const todayOffset = differenceInDays(projectToday, dateRange.start);
    if (todayOffset < 0 || todayOffset > timelineDays.length) return null;

    return (
      <line
        x1={todayOffset * dayWidth}
        y1={HEADER_HEIGHT}
        x2={todayOffset * dayWidth}
        y2={totalHeight}
        stroke="hsl(var(--destructive))"
        strokeWidth={2}
        strokeDasharray="4,4"
      />
    );
  }, [dateRange.start, dayWidth, projectToday, totalHeight, timelineDays.length]);

  const handleQuickAdd = useCallback(async () => {
    if (!onQuickAddTask || isQuickAdding) return;
    setIsQuickAdding(true);
    try {
      await onQuickAddTask(quickTaskName);
      setQuickTaskName("");
    } finally {
      setIsQuickAdding(false);
    }
  }, [isQuickAdding, onQuickAddTask, quickTaskName]);

  const leftColumns = useMemo(() => {
    const all = [
      { id: "name", label: "Title", width: 260 },
      { id: "start_date", label: "Start", width: 96 },
      { id: "finish_date", label: "Finish", width: 96 },
      { id: "duration_days", label: "Duration", width: 88 },
      { id: "percent_complete", label: "%", width: 72 },
      { id: "status", label: "Status", width: 90 },
      { id: "assigned_to", label: "Assigned", width: 110 },
      { id: "wbs_code", label: "WBS", width: 90 },
      { id: "constraint_type", label: "Constraint", width: 120 },
    ];
    if (!visibleColumns || visibleColumns.length === 0) return all;
    const selected = all.filter((column) => visibleColumns.includes(column.id));
    if (!selected.some((column) => column.id === "name"))
      selected.unshift(all[0]);
    return selected;
  }, [visibleColumns]);

  const leftMinWidth = useMemo(
    () => leftColumns.reduce((sum, column) => sum + column.width, 0),
    [leftColumns],
  );

  return (
    <div className={cn("flex flex-col", className)} ref={containerRef}>
      {/* Chart Area */}
      <div
        className={cn(
          "relative flex flex-1 overflow-hidden",
          isResizing && "select-none",
        )}
      >
        {/* Left Panel - Task List */}
        <div
          className={cn(
            "flex-shrink-0 border-r bg-muted/20 transition-[width] duration-200 ease-out",
            isPanelCollapsed && "overflow-hidden",
          )}
          style={{ width: isPanelCollapsed ? 0 : leftPanelWidth }}
        >
          {/* Two-row header aligned with SVG timeline (total = HEADER_HEIGHT) */}
          {/* Row 1: aligned with month row — light bg to match SVG */}
          <div
            className="flex items-center bg-muted/20 pl-1.5"
            style={{ height: HEADER_ROW_1 }}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setIsPanelCollapsed((prev) => !prev)}
              aria-label={
                isPanelCollapsed ? "Expand task panel" : "Collapse task panel"
              }
              title={
                isPanelCollapsed ? "Expand task panel" : "Collapse task panel"
              }
            >
              {isPanelCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="overflow-x-auto overflow-y-hidden">
            <div style={{ minWidth: leftMinWidth }}>
              {/* Row 2: column headers aligned with day row */}
              <div
                className="border-b border-border bg-muted/20 flex items-center text-[11px] font-normal text-muted-foreground"
                style={{ height: HEADER_ROW_2 }}
              >
                {leftColumns.map((column) => (
                  <div
                    key={column.id}
                    className={cn(
                      "truncate px-2",
                      column.id === "name" && "pl-10",
                    )}
                    style={{ width: column.width }}
                  >
                    {column.label}
                  </div>
                ))}
              </div>

              {/* Task List */}
              <div className="overflow-hidden">
                {visibleData.map((task) => {
                  const isParent = parentIds.has(task.id);
                  const isCollapsed = collapsedIds.has(task.id);
                  const statusInfo = ganttStatusConfig[task.status];
                  const StatusIcon = statusInfo.icon;
                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "border-b border-border/50 flex items-center hover:bg-accent/50 transition-colors duration-100 cursor-pointer",
                        dropTargetTaskId === task.id && "bg-primary/5",
                      )}
                      style={{ height: ROW_HEIGHT }}
                      draggable
                      onClick={() => onTaskClick?.(task.id)}
                      onDragStart={() => setDraggedTaskId(task.id)}
                      onDragEnd={() => {
                        setDraggedTaskId(null);
                        setDropTargetTaskId(null);
                      }}
                      onDragOver={(event) => {
                        if (
                          !draggedTaskId ||
                          draggedTaskId === task.id ||
                          !onUpdateTask
                        )
                          return;
                        event.preventDefault();
                        setDropTargetTaskId(task.id);
                      }}
                      onDragLeave={() => {
                        if (dropTargetTaskId === task.id) {
                          setDropTargetTaskId(null);
                        }
                      }}
                      onDrop={async (event) => {
                        event.preventDefault();
                        if (
                          !draggedTaskId ||
                          draggedTaskId === task.id ||
                          !onUpdateTask
                        )
                          return;
                        setDropTargetTaskId(null);
                        await onUpdateTask(draggedTaskId, {
                          parent_task_id: task.id,
                        });
                      }}
                    >
                      {leftColumns.map((column) => (
                        <div
                          key={column.id}
                          className="px-2"
                          style={{ width: column.width }}
                        >
                          {column.id === "name" ? (
                            <div
                              className="flex items-center gap-1 min-w-0"
                              style={{
                                paddingLeft: `${2 + task.level * 16}px`,
                              }}
                            >
                              {isParent ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="flex-shrink-0 h-5 w-5 p-0.5 hover:bg-muted"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleCollapse(task.id);
                                  }}
                                  aria-label={
                                    isCollapsed ? "Expand" : "Collapse"
                                  }
                                >
                                  {isCollapsed ? (
                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                  )}
                                </Button>
                              ) : (
                                <span className="w-[18px] flex-shrink-0" />
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                className="flex-shrink-0 rounded-sm hover:border-foreground/40 transition-colors h-3.5 w-3.5 p-0 flex items-center justify-center"
                                onClick={() => onTaskClick?.(task.id)}
                                aria-label={`Select ${task.name}`}
                              >
                                {task.percent_complete === 100 && (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="link"
                                className={cn(
                                  "text-[13px] truncate text-left p-0 ml-1.5 h-auto hover:underline decoration-0",
                                  isParent
                                    ? "font-semibold text-foreground"
                                    : "font-normal text-foreground",
                                )}
                                onClick={() => onTaskClick?.(task.id)}
                              >
                                {task.name}
                              </Button>
                              {showCriticalPath && task.is_critical_path && (
                                <Badge
                                  variant="destructive"
                                  className="h-5 px-1.5 text-[10px]"
                                >
                                  Critical
                                </Badge>
                              )}
                              {(task.schedule_warnings?.length ?? 0) > 0 && (
                                <span
                                  role="img"
                                  aria-label={`${task.schedule_warnings?.length} schedule warnings for ${task.name}`}
                                  title={`${task.schedule_warnings?.length} schedule warnings`}
                                  className="shrink-0 text-destructive"
                                >
                                  <TriangleAlert className="h-3.5 w-3.5" />
                                </span>
                              )}
                            </div>
                          ) : column.id === "start_date" ? (
                            <span className="text-[12px] text-muted-foreground">
                              {task.start_date
                                ? format(parseGanttDate(task.start_date), "MMM d")
                                : "Unscheduled"}
                            </span>
                          ) : column.id === "finish_date" ? (
                            <span className="text-[12px] text-muted-foreground">
                              {task.finish_date
                                ? format(
                                    parseGanttDate(task.finish_date),
                                    "MMM d",
                                  )
                                : "—"}
                            </span>
                          ) : column.id === "duration_days" ? (
                            <span className="text-[12px] text-muted-foreground">
                              {task.duration_days === null
                                ? "—"
                                : `${task.duration_days}d`}
                            </span>
                          ) : column.id === "percent_complete" ? (
                            <span className="text-[12px] text-muted-foreground">
                              {task.percent_complete}%
                            </span>
                          ) : column.id === "status" ? (
                            <div className="flex items-center">
                              <StatusIcon
                                className={cn("h-4 w-4", statusInfo.iconColor)}
                              />
                            </div>
                          ) : column.id === "assigned_to" ? (
                            <span className="text-[12px] text-muted-foreground">
                              {task.assignee || "-"}
                            </span>
                          ) : column.id === "wbs_code" ? (
                            <span className="text-[12px] text-muted-foreground">
                              -
                            </span>
                          ) : (
                            <span className="text-[12px] text-muted-foreground">
                              -
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
                <div className="border-b border-border/50 px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={quickTaskName}
                      onChange={(event) => setQuickTaskName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleQuickAdd();
                        }
                      }}
                      placeholder="Add task and press Enter"
                      className="h-7 text-xs border-dashed"
                      disabled={!onQuickAddTask || isQuickAdding}
                    />
                    <button
                      type="button"
                      className="inline-flex h-7 items-center justify-center rounded px-2 text-xs text-primary hover:bg-muted disabled:opacity-50"
                      disabled={!onQuickAddTask || isQuickAdding}
                      onClick={() => void handleQuickAdd()}
                    >
                      {isQuickAdding ? "..." : "Add"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {!isPanelCollapsed && (
          <button
            type="button"
            aria-label="Resize task panel"
            title="Drag to resize task panel"
            className="group relative hidden w-2 cursor-col-resize border-r border-border/70 bg-background/20 transition-colors hover:bg-muted/80 md:block"
            onPointerDown={startResize}
          >
            <GripVertical className="pointer-events-none absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        )}

        {/* Right Panel - Gantt Chart */}
        <div
          className="flex-1 overflow-auto"
          ref={scrollContainerRef}
          onScroll={handleScroll}
        >
          <svg
            width={totalWidth}
            height={totalHeight}
            style={{ transition: "all 250ms cubic-bezier(0.16, 1, 0.3, 1)" }}
          >
            {/* Timeline Header */}
            {renderTimelineHeader}

            {/* Grid Lines */}
            {renderGridLines}

            {/* Dependency Arrows */}
            {visibleData.map((task) =>
              task.dependencies?.map((dep) => {
                const predecessor = visibleData.find(
                  (t) => t.id === dep.predecessor_id,
                );
                if (!predecessor) return null;
                return (
                  <DependencyArrow
                    key={`${dep.predecessor_id}-${task.id}`}
                    from={predecessor}
                    to={task}
                    taskIndexMap={taskIndexMap}
                    dayWidth={dayWidth}
                    startDate={dateRange.start}
                    dependencyType={dep.type as DependencyType}
                    lagDays={dep.lag_days}
                  />
                );
              }),
            )}

            {/* Task Bars */}
            {visibleData.map((task, index) => (
              <TaskBar
                key={task.id}
                task={task}
                index={index}
                dayWidth={dayWidth}
                startDate={dateRange.start}
                showCriticalPath={showCriticalPath}
                showBaseline={showBaseline}
                timezoneName={calendar.timezone_name ?? "America/Indiana/Indianapolis"}
                totalWidth={totalWidth}
                onTaskClick={onTaskClick}
              />
            ))}

            {/* Today Line */}
            {renderTodayLine}
          </svg>
        </div>

        {isPanelCollapsed && (
          <button
            type="button"
            className="absolute left-2 top-1.5 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md bg-background text-muted-foreground shadow-sm ring-1 ring-border transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => setIsPanelCollapsed(false)}
            aria-label="Expand task panel"
            title="Expand task panel"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

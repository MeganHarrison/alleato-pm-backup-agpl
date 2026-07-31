"use client";
/* eslint-disable design-system/no-raw-heading */

/**
 * =============================================================================
 * SCHEDULE VIEWS COMPONENTS
 * =============================================================================
 *
 * Multiple view modes for the scheduling module, inspired by Microsoft Planner:
 * - Grid View: Detailed table with all task properties
 * - Board View: Kanban-style grouped by status/bucket
 * - Calendar View: Monthly calendar with tasks on dates
 * - Timeline View: Gantt chart timeline
 */

import { useMemo, useState, useCallback } from "react";
import { InfoAlert, InlineEditField } from "@/components/ds";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
  parseISO,
} from "date-fns";
import { cn } from "@/lib/utils";
import {
  DependencyType,
  ScheduleDependency,
  ScheduleTask,
  ScheduleTaskWithHierarchy,
  TaskStatus,
} from "@/types/scheduling";
import {
  applyPredecessorShorthandEdit,
  applySuccessorShorthandEdit,
  formatDependencyShorthand,
} from "@/lib/scheduling/schedule-dependency-shorthand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Flag,
  Calendar,
  Circle,
  CheckCircle2,
  Clock,
  X,
  GripVertical,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Loader2,
} from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// =============================================================================
// TYPES
// =============================================================================

// Priority levels for tasks (matching Planner style)
type Priority = "low" | "medium" | "important" | "urgent";

// Label colors (matching Planner style)
type LabelColor = "pink" | "yellow" | "green" | "blue" | "purple" | "red";

interface BaseViewProps {
  tasks: ScheduleTaskWithHierarchy[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  visibleColumns?: string[];
  onTaskClick: (task: ScheduleTask) => void;
  onAddTask: (parentId?: string | null) => void;
  onQuickAddTask: (input: {
    name: string;
    parentId?: string | null;
    status?: TaskStatus;
    startDate?: string | null;
    finishDate?: string | null;
  }) => Promise<void>;
  onEditTask: (task: ScheduleTask) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateTask: (
    taskId: string,
    updates: Partial<ScheduleTask>,
  ) => Promise<void>;
  isLoading?: boolean;
  /** Only consumed by ScheduleGridView's Predecessor/Successor columns. */
  onCreateDependency?: (
    taskId: string,
    input: { predecessor_task_id: string; dependency_type: DependencyType; lag_days: number },
  ) => Promise<void>;
  onUpdateDependency?: (
    taskId: string,
    dependencyId: string,
    input: { predecessor_task_id: string; dependency_type: DependencyType; lag_days: number },
  ) => Promise<void>;
  onRemoveDependency?: (taskId: string, dependencyId: string) => Promise<void>;
}

// =============================================================================
// HELPERS
// =============================================================================

const statusConfig: Record<
  TaskStatus,
  { label: string; icon: typeof Circle; color: string }
> = {
  not_started: {
    label: "Not started",
    icon: Circle,
    color: "text-muted-foreground",
  },
  in_progress: {
    label: "In Progress",
    icon: Clock,
    color: "text-[hsl(var(--status-info))]",
  },
  complete: {
    label: "Complete",
    icon: CheckCircle2,
    color: "text-[hsl(var(--status-success))]",
  },
};

const priorityConfig: Record<
  Priority,
  { label: string; color: string; dotColor: string }
> = {
  low: {
    label: "Low",
    color: "text-muted-foreground",
    dotColor: "bg-muted-foreground",
  },
  medium: {
    label: "Medium",
    color: "text-foreground",
    dotColor: "bg-foreground",
  },
  important: {
    label: "Important",
    color: "text-destructive",
    dotColor: "bg-destructive",
  },
  urgent: {
    label: "Urgent",
    color: "text-destructive",
    dotColor: "bg-destructive",
  },
};

const labelColors: Record<LabelColor, string> = {
  pink: "bg-pink-500",
  yellow: "bg-yellow-500",
  green: "bg-green-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  red: "bg-red-500",
};

// Flatten hierarchical tasks to a flat array
function flattenTasks(
  tasks: ScheduleTaskWithHierarchy[],
): ScheduleTaskWithHierarchy[] {
  const result: ScheduleTaskWithHierarchy[] = [];
  const flatten = (list: ScheduleTaskWithHierarchy[]) => {
    for (const task of list) {
      result.push(task);
      if (task.children?.length) {
        flatten(task.children);
      }
    }
  };
  flatten(tasks);
  return result;
}

// Get priority from percent_complete or a derived field
function getTaskPriority(task: ScheduleTask): Priority {
  // For now, use a simple heuristic based on milestone status
  if (task.is_milestone) return "important";
  return "medium";
}

// Get a pseudo-random label color based on task WBS code
function getTaskLabel(task: ScheduleTask): LabelColor | null {
  if (!task.wbs_code) return null;
  const colors: LabelColor[] = [
    "pink",
    "yellow",
    "green",
    "blue",
    "purple",
    "red",
  ];
  const hash = task.wbs_code
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

// Group tasks by status for board view
function groupTasksByStatus(
  tasks: ScheduleTaskWithHierarchy[],
): Record<TaskStatus, ScheduleTaskWithHierarchy[]> {
  const flatList = flattenTasks(tasks);
  return {
    not_started: flatList.filter((t) => t.status === "not_started"),
    in_progress: flatList.filter((t) => t.status === "in_progress"),
    complete: flatList.filter((t) => t.status === "complete"),
  };
}

const formatDate = (date: string | null): string => {
  if (!date) return "-";
  try {
    return format(new Date(date), "MMM dd");
  } catch {
    return "-";
  }
};

// =============================================================================
// SORT HELPERS (shared by Grid View)
// =============================================================================

type GridSortField =
  | "name"
  | "start_date"
  | "finish_date"
  | "status"
  | "percent_complete";
type SortDirection = "asc" | "desc";
interface GridSortConfig {
  field: GridSortField;
  direction: SortDirection;
}

function sortFlatTasks(
  tasks: ScheduleTaskWithHierarchy[],
  sort: GridSortConfig | null,
): ScheduleTaskWithHierarchy[] {
  if (!sort) return tasks;
  return [...tasks].sort((a, b) => {
    const dir = sort.direction === "asc" ? 1 : -1;
    const av = a[sort.field];
    const bv = b[sort.field];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "string" && typeof bv === "string")
      return av.localeCompare(bv) * dir;
    if (typeof av === "number" && typeof bv === "number")
      return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });
}

function GridSortableHeader({
  label,
  field,
  sort,
  onToggle,
}: {
  label: string;
  field: GridSortField;
  sort: GridSortConfig | null;
  onToggle: (field: GridSortField) => void;
}) {
  const isActive = sort?.field === field;
  const Icon = isActive
    ? sort.direction === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <button
      type="button"
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={() => onToggle(field)}
    >
      {label}
      <Icon
        className={cn(
          "h-3 w-3",
          isActive ? "text-foreground" : "text-muted-foreground/50",
        )}
      />
    </button>
  );
}

function InlineQuickAddRow({
  placeholder,
  onSubmit,
  className,
}: {
  placeholder: string;
  onSubmit: (name: string) => Promise<void>;
  className?: string;
}) {
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSubmit(name);
      setName("");
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, name, onSubmit]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Plus className="h-4 w-4 text-primary shrink-0" />
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void handleSubmit();
          }
        }}
        placeholder={placeholder}
        className="h-8 border-dashed"
        disabled={isSaving}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        disabled={isSaving}
        onClick={() => void handleSubmit()}
      >
        {isSaving ? "Adding..." : "Add"}
      </Button>
    </div>
  );
}

// =============================================================================
// GRID VIEW (Microsoft Planner Style Table)
// =============================================================================

export function ScheduleGridView({
  tasks,
  selectedIds,
  onSelectionChange,
  visibleColumns,
  onTaskClick,
  onAddTask,
  onQuickAddTask,
  onEditTask,
  onDeleteTask,
  onUpdateTask,
  onCreateDependency,
  onUpdateDependency,
  onRemoveDependency,
  isLoading,
}: BaseViewProps) {
  const flatTasks = useMemo(() => flattenTasks(tasks), [tasks]);
  const [gridSort, setGridSort] = useState<GridSortConfig | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTargetTaskId, setDropTargetTaskId] = useState<string | null>(null);
  const [savingTaskIds, setSavingTaskIds] = useState<Set<string>>(new Set());

  const toggleGridSort = useCallback((field: GridSortField) => {
    setGridSort((prev) => {
      if (!prev || prev.field !== field) return { field, direction: "asc" };
      if (prev.direction === "asc") return { field, direction: "desc" };
      return null;
    });
  }, []);

  const sortedFlatTasks = useMemo(
    () => sortFlatTasks(flatTasks, gridSort),
    [flatTasks, gridSort],
  );

  // Row numbers are the grid's 1-based display position (Microsoft Project's "ID"
  // column) — display-only, not persisted, and only stable for the current sort.
  // Predecessor/Successor shorthand entries refer to this number.
  const rowNumberByTaskId = useMemo(() => {
    const map = new Map<string, number>();
    sortedFlatTasks.forEach((task, index) => map.set(task.id, index + 1));
    return map;
  }, [sortedFlatTasks]);
  const taskIdByRowNumber = useMemo(() => {
    const map = new Map<number, string>();
    rowNumberByTaskId.forEach((rowNumber, taskId) => map.set(rowNumber, taskId));
    return map;
  }, [rowNumberByTaskId]);
  const resolveRowNumber = useCallback((rowNumber: number) => taskIdByRowNumber.get(rowNumber), [taskIdByRowNumber]);
  const rowNumberForTaskId = useCallback((taskId: string) => rowNumberByTaskId.get(taskId), [rowNumberByTaskId]);

  // Task.dependencies only carries a task's own predecessors — the Successors
  // column needs the reverse: every dependency whose predecessor_task_id is this
  // task, computed client-side from the same data rather than a new fetch.
  const successorDependenciesByTaskId = useMemo(() => {
    const map = new Map<string, ScheduleDependency[]>();
    for (const task of flatTasks) {
      for (const dependency of task.dependencies ?? []) {
        map.set(
          dependency.predecessor_task_id,
          [...(map.get(dependency.predecessor_task_id) ?? []), dependency],
        );
      }
    }
    return map;
  }, [flatTasks]);

  const applyPredecessorCellEdit = useCallback(
    async (task: ScheduleTaskWithHierarchy, text: string) => {
      if (!onCreateDependency || !onUpdateDependency || !onRemoveDependency) return;
      // Only diff against predecessors currently visible in this filtered view — a
      // hidden predecessor has no row number for the user to reference in `text`, so
      // it must stay untouched rather than get diffed away as "removed". This mirrors
      // the same visibility filter `formatDependencyShorthand` applies below when
      // prefilling the cell, so what's diffed matches what was actually shown/editable.
      const current = (task.dependencies ?? [])
        .filter((dependency) => rowNumberForTaskId(dependency.predecessor_task_id) !== undefined)
        .map((dependency) => ({
          id: dependency.id,
          predecessor_task_id: dependency.predecessor_task_id,
          dependency_type: dependency.dependency_type,
          lag_days: dependency.lag_days,
        }));
      await applyPredecessorShorthandEdit(task.id, current, text, resolveRowNumber, {
        onCreateDependency,
        onUpdateDependency,
        onRemoveDependency,
      });
    },
    [onCreateDependency, onUpdateDependency, onRemoveDependency, resolveRowNumber, rowNumberForTaskId],
  );

  const applySuccessorCellEdit = useCallback(
    async (task: ScheduleTaskWithHierarchy, text: string) => {
      if (!onCreateDependency || !onUpdateDependency || !onRemoveDependency) return;
      const successorDependencies = successorDependenciesByTaskId.get(task.id) ?? [];
      await applySuccessorShorthandEdit(task.id, successorDependencies, text, resolveRowNumber, {
        onCreateDependency,
        onUpdateDependency,
        onRemoveDependency,
      });
    },
    [onCreateDependency, onUpdateDependency, onRemoveDependency, resolveRowNumber, successorDependenciesByTaskId],
  );

  const handleToggleSelect = useCallback(
    (taskId: string, checked: boolean) => {
      const newSelection = new Set(selectedIds);
      if (checked) {
        newSelection.add(taskId);
      } else {
        newSelection.delete(taskId);
      }
      onSelectionChange(newSelection);
    },
    [selectedIds, onSelectionChange],
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        onSelectionChange(new Set(flatTasks.map((t) => t.id)));
      } else {
        onSelectionChange(new Set());
      }
    },
    [flatTasks, onSelectionChange],
  );

  const isAllSelected =
    flatTasks.length > 0 && selectedIds.size === flatTasks.length;

  const setSavingState = useCallback((taskId: string, saving: boolean) => {
    setSavingTaskIds((prev) => {
      const next = new Set(prev);
      if (saving) {
        next.add(taskId);
      } else {
        next.delete(taskId);
      }
      return next;
    });
  }, []);

  const saveTaskUpdate = useCallback(
    async (task: ScheduleTaskWithHierarchy, updates: Partial<ScheduleTask>) => {
      setSavingState(task.id, true);
      try {
        await onUpdateTask(task.id, updates);
      } finally {
        setSavingState(task.id, false);
      }
    },
    [onUpdateTask, setSavingState],
  );

  const columns = useMemo(() => {
    const all = [
      { id: "name", label: "Task Name", width: "minmax(220px, 2fr)" },
      { id: "start_date", label: "Start Date", width: "140px" },
      { id: "finish_date", label: "Finish Date", width: "140px" },
      { id: "duration_days", label: "Duration", width: "110px" },
      { id: "percent_complete", label: "% Complete", width: "120px" },
      { id: "status", label: "Status", width: "170px" },
      { id: "assigned_to", label: "Assigned To", width: "140px" },
      { id: "wbs_code", label: "WBS Code", width: "120px" },
      { id: "constraint_type", label: "Constraint", width: "160px" },
      { id: "predecessors", label: "Predecessors", width: "160px" },
      { id: "successors", label: "Successors", width: "160px" },
    ];

    if (!visibleColumns || visibleColumns.length === 0) {
      return all;
    }

    const selected = all.filter((column) => visibleColumns.includes(column.id));
    if (!selected.some((column) => column.id === "name")) {
      selected.unshift(all[0]);
    }
    return selected;
  }, [visibleColumns]);

  const gridTemplateColumns = useMemo(
    () => `40px 48px ${columns.map((column) => column.width).join(" ")}`,
    [columns],
  );

  return (
    <div className="overflow-x-auto">
      {/* Header */}
      <div
        className="grid gap-1.5 px-3 py-1.5 border-b bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        style={{ gridTemplateColumns }}
      >
        <div className="flex items-center justify-center">
          <Checkbox
            checked={isAllSelected}
            onCheckedChange={handleSelectAll}
            aria-label="Select all"
            className="h-3.5 w-3.5"
          />
        </div>
        {/* Row number ("ID" in Microsoft Project) — always shown, not part of the
            optional visibleColumns toggle, since Predecessor/Successor shorthand
            entries refer to it. */}
        <div className="flex items-center justify-center">#</div>
        {columns.map((column) => (
          <div key={column.id} className="flex items-center gap-1">
            {column.id === "name" ? (
              <GridSortableHeader
                label={column.label}
                field="name"
                sort={gridSort}
                onToggle={toggleGridSort}
              />
            ) : column.id === "start_date" ? (
              <GridSortableHeader
                label={column.label}
                field="start_date"
                sort={gridSort}
                onToggle={toggleGridSort}
              />
            ) : column.id === "finish_date" ? (
              <GridSortableHeader
                label={column.label}
                field="finish_date"
                sort={gridSort}
                onToggle={toggleGridSort}
              />
            ) : column.id === "duration_days" ? (
              <GridSortableHeader
                label={column.label}
                field="percent_complete"
                sort={gridSort}
                onToggle={toggleGridSort}
              />
            ) : column.id === "status" ? (
              <GridSortableHeader
                label={column.label}
                field="status"
                sort={gridSort}
                onToggle={toggleGridSort}
              />
            ) : column.id === "percent_complete" ? (
              <GridSortableHeader
                label={column.label}
                field="percent_complete"
                sort={gridSort}
                onToggle={toggleGridSort}
              />
            ) : (
              <span>{column.label}</span>
            )}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y">
        {sortedFlatTasks.map((task) => {
          const priority = getTaskPriority(task);
          const label = getTaskLabel(task);
          const statusInfo = statusConfig[task.status];
          const priorityInfo = priorityConfig[priority];

          return (
            <div
              key={task.id}
              draggable
              className={cn(
                "grid gap-1.5 px-3 py-2.5 hover:bg-accent cursor-pointer group transition-colors duration-150",
                selectedIds.has(task.id) && "bg-primary/10",
                dropTargetTaskId === task.id &&
                  "ring-1 ring-primary/50 bg-primary/5",
              )}
              style={{ gridTemplateColumns }}
              onDragStart={() => setDraggedTaskId(task.id)}
              onDragEnd={() => {
                setDraggedTaskId(null);
                setDropTargetTaskId(null);
              }}
              onDragOver={(event) => {
                if (!draggedTaskId || draggedTaskId === task.id) return;
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
                if (!draggedTaskId || draggedTaskId === task.id) return;
                setDropTargetTaskId(null);
                await onUpdateTask(draggedTaskId, { parent_task_id: task.id });
              }}
            >
              <div
                className="flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={selectedIds.has(task.id)}
                  onCheckedChange={(checked) =>
                    handleToggleSelect(task.id, !!checked)
                  }
                  aria-label={`Select ${task.name}`}
                  className="h-3.5 w-3.5"
                />
              </div>

              <div
                className="flex items-center justify-center text-xs text-muted-foreground tabular-nums"
                onClick={(e) => e.stopPropagation()}
              >
                {rowNumberByTaskId.get(task.id)}
              </div>

              {columns.map((column) => (
                <div key={column.id} className="flex items-center">
                  {column.id === "name" && (
                    <div className="flex min-w-0 w-full items-center gap-1.5">
                      {task.is_milestone && (
                        <Flag className="h-3.5 w-3.5 shrink-0 text-destructive" />
                      )}
                      <InlineEditField
                        value={task.name}
                        label="Task name"
                        className="text-xs"
                        onSave={async (nextName) => {
                          const trimmedName = nextName.trim();
                          if (!trimmedName) {
                            throw new Error("Task name cannot be empty.");
                          }
                          await saveTaskUpdate(task, { name: trimmedName });
                        }}
                      />
                    </div>
                  )}

                  {column.id === "start_date" && (
                    <InlineEditField
                      value={task.start_date ?? ""}
                      display={formatDate(task.start_date)}
                      type="date"
                      emptyLabel="No start date"
                      label="Start date"
                      className="text-xs"
                      onSave={async (nextStartDate) => {
                        await saveTaskUpdate(task, {
                          start_date: nextStartDate || null,
                        });
                      }}
                    />
                  )}

                  {column.id === "finish_date" && (
                    <InlineEditField
                      value={task.finish_date ?? ""}
                      display={formatDate(task.finish_date)}
                      type="date"
                      emptyLabel="No finish date"
                      label="Finish date"
                      className="text-xs"
                      onSave={async (nextFinishDate) => {
                        await saveTaskUpdate(task, {
                          finish_date: nextFinishDate || null,
                        });
                      }}
                    />
                  )}

                  {column.id === "status" && (
                    <InlineEditField
                      value={task.status}
                      display={statusConfig[task.status].label}
                      type="select"
                      label="Status"
                      className="text-xs"
                      options={[
                        { value: "not_started", label: "Not Started" },
                        { value: "in_progress", label: "In Progress" },
                        { value: "complete", label: "Complete" },
                      ]}
                      onSave={async (nextStatus) =>
                        saveTaskUpdate(task, {
                          status: nextStatus as TaskStatus,
                          percent_complete:
                            nextStatus === "complete"
                              ? 100
                              : nextStatus === "in_progress"
                                ? 50
                                : 0,
                        })
                      }
                    />
                  )}

                  {column.id === "duration_days" && (
                    <span className="text-xs text-muted-foreground">
                      {task.duration_days !== null
                        ? `${task.duration_days}d`
                        : "-"}
                    </span>
                  )}

                  {column.id === "percent_complete" && (
                    <InlineEditField
                      type="number"
                      value={String(task.percent_complete)}
                      display={`${task.percent_complete}%`}
                      label="Percent complete"
                      className="text-xs tabular-nums"
                      onSave={async (nextPercent) => {
                        const parsed = Number(nextPercent);
                        if (!Number.isFinite(parsed)) {
                          throw new Error("Percent complete must be a number.");
                        }
                        await saveTaskUpdate(task, {
                          percent_complete: Math.min(100, Math.max(0, parsed)),
                        });
                      }}
                    />
                  )}

                  {column.id === "assigned_to" && (
                    <span className="text-xs text-muted-foreground">{task.assignee || "-"}</span>
                  )}

                  {column.id === "wbs_code" && (
                    <span className="text-xs text-muted-foreground truncate">
                      {task.wbs_code || "-"}
                    </span>
                  )}

                  {column.id === "constraint_type" && (
                    <span className="text-xs text-muted-foreground truncate">
                      {task.constraint_type || "-"}
                    </span>
                  )}

                  {column.id === "predecessors" && (
                    <InlineEditField
                      value={formatDependencyShorthand(task.dependencies ?? [], rowNumberForTaskId)}
                      label="Predecessors"
                      placeholder="e.g. 3FS+2"
                      emptyLabel="No predecessors"
                      className="text-xs"
                      disabled={!onCreateDependency}
                      onSave={(nextText) => applyPredecessorCellEdit(task, nextText)}
                    />
                  )}

                  {column.id === "successors" && (
                    <InlineEditField
                      value={formatDependencyShorthand(
                        (successorDependenciesByTaskId.get(task.id) ?? []).map((dependency) => ({
                          predecessor_task_id: dependency.task_id,
                          dependency_type: dependency.dependency_type,
                          lag_days: dependency.lag_days,
                        })),
                        rowNumberForTaskId,
                      )}
                      label="Successors"
                      placeholder="e.g. 5FS+2"
                      emptyLabel="No successors"
                      className="text-xs"
                      disabled={!onCreateDependency}
                      onSave={(nextText) => applySuccessorCellEdit(task, nextText)}
                    />
                  )}
                </div>
              ))}

              <div
                className="hidden items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                {priority === "important" && (
                  <AlertTriangle className="h-3 w-3 text-destructive" />
                )}
                {label && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "h-6 px-2 text-xs text-white",
                      labelColors[label],
                    )}
                  >
                    {label.charAt(0).toUpperCase() + label.slice(1)}
                    <X className="h-3 w-3 ml-1 cursor-pointer hover:opacity-70" />
                  </Badge>
                )}
              </div>
              {savingTaskIds.has(task.id) && (
                <div className="absolute right-3 top-3">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Task Row */}
      <div className="px-4 py-3 border-t border-dashed bg-muted/10">
        <InlineQuickAddRow
          placeholder="Type task name and press Enter"
          onSubmit={(name) => onQuickAddTask({ name })}
        />
      </div>
    </div>
  );
}

// =============================================================================
// BOARD VIEW (Kanban Style with Drag & Drop)
// =============================================================================

type CardField =
  | "labels"
  | "status"
  | "dates"
  | "progress"
  | "priority"
  | "subtask_count";

interface DraggableTaskCardProps {
  task: ScheduleTaskWithHierarchy;
  onTaskClick: (task: ScheduleTask) => void;
  onUpdateTask: (
    taskId: string,
    updates: Partial<ScheduleTask>,
  ) => Promise<void>;
  visibleFields: Set<CardField>;
}

function DraggableTaskCard({
  task,
  onTaskClick,
  onUpdateTask,
  visibleFields,
}: DraggableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: "task",
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const label = getTaskLabel(task);
  const priority = getTaskPriority(task);
  const statusInfo = statusConfig[task.status];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-schedule-task-card="true"
      className={cn(
        "group cursor-grab rounded-md bg-background px-3 py-2.5 ring-1 ring-border/70 transition-colors duration-150 hover:bg-accent/30 active:cursor-grabbing",
        isDragging && "opacity-90 scale-[1.02] rotate-1 ring-2 ring-primary",
      )}
      onClick={() => onTaskClick(task)}
    >
      <div className="space-y-2">
        <div className="flex items-start gap-2.5">
          <GripVertical className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-30 transition-opacity duration-150 group-hover:opacity-70" />
          <Checkbox
            checked={task.status === "complete"}
            onCheckedChange={async (checked) => {
              await onUpdateTask(task.id, {
                status: checked ? "complete" : "not_started",
                percent_complete: checked ? 100 : 0,
              });
            }}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 h-5 w-5 shrink-0"
          />
          <span
            className={cn(
              "line-clamp-2 min-w-0 flex-1 text-sm leading-snug",
              task.status === "complete" &&
                "line-through text-muted-foreground",
            )}
          >
            {task.name}
          </span>
        </div>

        <div className="ml-10 space-y-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {visibleFields.has("status") && (
              <div className="flex min-w-0 items-center gap-1">
                <statusInfo.icon className={cn("h-3 w-3", statusInfo.color)} />
                <span className="truncate text-xs text-muted-foreground">
                  {statusInfo.label}
                </span>
              </div>
            )}
            {visibleFields.has("priority") && priority === "important" && (
              <AlertTriangle className="h-3 w-3 text-destructive" />
            )}
            {visibleFields.has("labels") && label && (
              <Badge
                variant="secondary"
                className={cn(
                  "h-5 px-1.5 text-2xs text-white",
                  labelColors[label],
                )}
              >
                {label.charAt(0).toUpperCase() + label.slice(1)}
              </Badge>
            )}
          </div>

          <div className="flex min-w-0 items-center gap-2">
            {visibleFields.has("dates") && (
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                {formatDate(task.start_date)} — {formatDate(task.finish_date)}
              </span>
            )}
            {visibleFields.has("subtask_count") &&
              task.children &&
              task.children.length > 0 && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {task.children.filter((c) => c.status === "complete").length}/
                  {task.children.length} subtasks
                </span>
              )}
          </div>

          {visibleFields.has("progress") && (
            <div className="flex items-center gap-2">
              <Progress
                value={task.percent_complete}
                className="h-1.5 flex-1"
              />
              <span className="text-xs text-muted-foreground">
                {task.percent_complete}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskCardOverlay({ task }: { task: ScheduleTaskWithHierarchy }) {
  const label = getTaskLabel(task);
  const priority = getTaskPriority(task);

  return (
    <div className="w-72 cursor-grabbing rounded-md bg-background p-3 ring-1 ring-primary/30">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          {label && (
            <Badge
              variant="secondary"
              className={cn("h-5 px-2 text-xs text-white", labelColors[label])}
            >
              {label.charAt(0).toUpperCase() + label.slice(1)}
            </Badge>
          )}
        </div>
        <div className="flex items-start gap-2">
          <Checkbox
            checked={task.status === "complete"}
            disabled
            className="mt-0.5"
          />
          <span
            className={cn(
              "text-sm font-medium",
              task.status === "complete" &&
                "line-through text-muted-foreground",
            )}
          >
            {task.name}
          </span>
        </div>
        {priority === "important" && (
          <div className="flex items-center gap-1 text-destructive">
            <AlertTriangle className="h-3 w-3" />
          </div>
        )}
      </div>
    </div>
  );
}

interface BoardColumnProps {
  title: string;
  status: TaskStatus;
  tasks: ScheduleTaskWithHierarchy[];
  onTaskClick: (task: ScheduleTask) => void;
  onAddTask: () => void;
  onQuickAddTask: (name: string, status: TaskStatus) => Promise<void>;
  onUpdateTask: (
    taskId: string,
    updates: Partial<ScheduleTask>,
  ) => Promise<void>;
  visibleFields: Set<CardField>;
}

function BoardColumn({
  title,
  status,
  tasks,
  onTaskClick,
  onAddTask,
  onQuickAddTask,
  onUpdateTask,
  visibleFields,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const [isInlineAddOpen, setIsInlineAddOpen] = useState(false);

  return (
    <div
      className={cn(
        "flex min-w-full shrink-0 flex-col rounded-lg bg-muted/20 p-3 transition-all duration-200 sm:min-w-[280px] sm:w-80 sm:p-4",
        isOver && "ring-2 ring-primary/30 bg-primary/5",
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-1 py-2 mb-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full border">
          {tasks.length}
        </span>
      </div>

      {/* Add Task Button */}
      <Button
        variant="ghost"
        className="mb-4 min-h-11 w-full justify-start gap-2 text-primary hover:bg-background hover:text-primary"
        onClick={() => setIsInlineAddOpen((prev) => !prev)}
      >
        <Plus />
        {isInlineAddOpen ? "Hide quick add" : "Quick add task"}
      </Button>

      {isInlineAddOpen && (
        <div className="mb-3 rounded-md border border-dashed bg-background p-2">
          <InlineQuickAddRow
            placeholder="Task name"
            onSubmit={(name) => onQuickAddTask(name, status)}
            className="gap-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 h-7 px-2 text-xs text-muted-foreground"
            onClick={onAddTask}
          >
            Open full task form
          </Button>
        </div>
      )}

      {/* Cards - Droppable Area */}
      <div ref={setNodeRef} className="flex-1">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <ScrollArea className="flex-1">
            <div className="min-h-[200px] space-y-2 pr-0 sm:pr-2">
              {tasks.map((task) => (
                <DraggableTaskCard
                  key={task.id}
                  task={task}
                  onTaskClick={onTaskClick}
                  onUpdateTask={onUpdateTask}
                  visibleFields={visibleFields}
                />
              ))}
              {tasks.length === 0 && (
                <div className="border border-dashed border-muted-foreground/20 rounded-lg p-8 text-center">
                  <span className="text-sm text-muted-foreground">
                    Drop tasks here
                  </span>
                </div>
              )}
            </div>
          </ScrollArea>
        </SortableContext>
      </div>
    </div>
  );
}

export function ScheduleBoardView({
  tasks,
  selectedIds,
  onSelectionChange,
  onTaskClick,
  onAddTask,
  onQuickAddTask,
  onEditTask,
  onDeleteTask,
  onUpdateTask,
  isLoading,
}: BaseViewProps) {
  const [activeTask, setActiveTask] =
    useState<ScheduleTaskWithHierarchy | null>(null);
  const [visibleCardFields] = useState<Set<CardField>>(
    new Set(["status", "dates", "progress", "subtask_count"]),
  );
  const groupedTasks = useMemo(() => groupTasksByStatus(tasks), [tasks]);

  // All flat tasks for finding by ID
  const flatTasks = useMemo(() => flattenTasks(tasks), [tasks]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 2 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 6 },
    }),
    useSensor(KeyboardSensor),
  );

  const columns: { status: TaskStatus; title: string }[] = [
    { status: "not_started", title: "Not Started" },
    { status: "in_progress", title: "In Progress" },
    { status: "complete", title: "Complete" },
  ];

  // Find which column a task belongs to
  const findTaskColumn = (taskId: UniqueIdentifier): TaskStatus | null => {
    for (const status of Object.keys(groupedTasks) as TaskStatus[]) {
      if (groupedTasks[status].some((t) => t.id === taskId)) {
        return status;
      }
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = flatTasks.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // If dropped on a column (detect by checking if overId matches a status)
    const isColumn = columns.some((c) => c.status === overId);
    const isTaskCard = flatTasks.some((t) => t.id === overId);

    // Find the source column
    const sourceColumn = findTaskColumn(activeId);

    // Find the destination column
    let destColumn: TaskStatus | null = null;
    if (isColumn) {
      destColumn = overId as TaskStatus;
    } else {
      destColumn = findTaskColumn(overId);
    }

    if (!sourceColumn || !destColumn) return;

    // Drop on task card => convert dragged task to subtask of target card.
    if (isTaskCard && overId !== activeId) {
      await onUpdateTask(activeId, {
        parent_task_id: overId,
        status: destColumn,
        percent_complete:
          destColumn === "complete"
            ? 100
            : destColumn === "in_progress"
              ? 50
              : 0,
      });
      return;
    }

    // Drop on column => status move only.
    if (sourceColumn !== destColumn) {
      await onUpdateTask(activeId, {
        parent_task_id: null,
        status: destColumn,
        percent_complete:
          destColumn === "complete"
            ? 100
            : destColumn === "in_progress"
              ? 50
              : 0,
      });
    }
  };

  return (
    <div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex min-h-[500px] gap-4 overflow-x-auto px-0 py-3 sm:p-4">
          {columns.map(({ status, title }) => (
            <BoardColumn
              key={status}
              title={title}
              status={status}
              tasks={groupedTasks[status]}
              onTaskClick={onTaskClick}
              onAddTask={() => onAddTask(null)}
              onQuickAddTask={(name, status) =>
                onQuickAddTask({ name, status })
              }
              onUpdateTask={onUpdateTask}
              visibleFields={visibleCardFields}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// =============================================================================
// CALENDAR VIEW
// =============================================================================

export function ScheduleCalendarView({
  tasks,
  selectedIds,
  onSelectionChange,
  onTaskClick,
  onAddTask,
  onQuickAddTask,
  onEditTask,
  onDeleteTask,
  onUpdateTask,
  isLoading,
}: BaseViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const flatTasks = useMemo(() => flattenTasks(tasks), [tasks]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Group tasks by date.
  // Use the raw "yyyy-MM-dd" date string directly as the map key instead of
  // going through parseISO → format, which shifts date-only strings to UTC
  // midnight and then formats them in local time — causing tasks stored as
  // "2026-05-21" to map to "2026-05-20" in negative-offset timezones and
  // never match any day in the calendar grid.
  const tasksByDate = useMemo(() => {
    const map = new Map<string, ScheduleTaskWithHierarchy[]>();

    flatTasks.forEach((task) => {
      const startKey = task.start_date ? task.start_date.slice(0, 10) : null;
      const finishKey = task.finish_date ? task.finish_date.slice(0, 10) : null;

      if (startKey) {
        if (!map.has(startKey)) map.set(startKey, []);
        map.get(startKey)!.push(task);
      }

      // Also show on finish date if different from start
      if (finishKey && startKey && finishKey !== startKey) {
        if (!map.has(finishKey)) map.set(finishKey, []);
        const existing = map.get(finishKey)!;
        if (!existing.find((t) => t.id === task.id)) {
          existing.push(task);
        }
      }
    });

    return map;
  }, [flatTasks]);

  const undatedTaskCount = useMemo(
    () => flatTasks.filter((t) => !t.start_date && !t.finish_date).length,
    [flatTasks],
  );

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="rounded-lg border bg-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="transition-colors duration-150"
          >
            <ChevronLeft />
          </Button>
          <h2 className="text-lg font-semibold min-w-[180px] text-center">
            {format(currentDate, "MMMM yyyy")}
          </h2>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="transition-colors duration-150"
          >
            <ChevronRight />
          </Button>
        </div>
        <Button variant="outline" onClick={() => setCurrentDate(new Date())}>
          Today
        </Button>
      </div>

      <div className="mb-4 rounded-md border border-dashed bg-muted/20 p-2">
        <InlineQuickAddRow
          placeholder={`Add task in ${format(currentDate, "MMMM")}`}
          onSubmit={(name) => onQuickAddTask({ name })}
        />
      </div>

      {undatedTaskCount > 0 && tasksByDate.size === 0 && (
        <InfoAlert variant="info" className="mb-4">
          {undatedTaskCount} task{undatedTaskCount !== 1 ? "s" : ""} have no
          start or finish date and cannot be shown on the calendar. Open each
          task to set dates, or use the{" "}
          <span className="font-medium text-foreground">Table</span> or{" "}
          <span className="font-medium text-foreground">Board</span> view to see
          all tasks.
        </InfoAlert>
      )}

      {/* Week day headers */}
      <div className="grid grid-cols-7 gap-px bg-muted mb-px">
        {weekDays.map((day) => (
          <div
            key={day}
            className="bg-card px-2 py-2 text-center text-sm font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-muted">
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayTasks = tasksByDate.get(dateKey) || [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "bg-card min-h-[120px] p-2 hover:bg-accent/30 transition-colors duration-150",
                !isCurrentMonth && "opacity-40",
              )}
            >
              <div
                className={cn(
                  "text-sm font-medium mb-1 w-8 h-8 flex items-center justify-center rounded-full shadow-sm",
                  isCurrentDay && "bg-primary text-primary-foreground",
                )}
              >
                {format(day, "d")}
              </div>

              <div className="space-y-1">
                {dayTasks.slice(0, 3).map((task) => {
                  const label = getTaskLabel(task);
                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "text-xs font-medium px-1.5 py-0.5 rounded-md truncate cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all duration-150",
                        label
                          ? cn("text-white", labelColors[label])
                          : "bg-muted",
                      )}
                      onClick={() => onTaskClick(task)}
                      title={task.name}
                    >
                      {task.name}
                    </div>
                  );
                })}
                {dayTasks.length > 3 && (
                  <div className="text-xs text-muted-foreground px-1.5">
                    +{dayTasks.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// TIMELINE VIEW (Simplified Gantt)
// =============================================================================

export function ScheduleTimelineView({
  tasks,
  selectedIds,
  onSelectionChange,
  onTaskClick,
  onAddTask,
  onQuickAddTask,
  onEditTask,
  onDeleteTask,
  onUpdateTask,
  isLoading,
}: BaseViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const flatTasks = useMemo(() => flattenTasks(tasks), [tasks]);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTargetTaskId, setDropTargetTaskId] = useState<string | null>(null);

  // Generate weeks for the timeline (12 weeks)
  const weeks = useMemo(() => {
    const result: Date[] = [];
    const start = startOfWeek(subMonths(currentDate, 1));
    for (let i = 0; i < 16; i++) {
      result.push(new Date(start.getTime() + i * 7 * 24 * 60 * 60 * 1000));
    }
    return result;
  }, [currentDate]);

  const timelineStart = weeks[0];
  const timelineEnd = weeks[weeks.length - 1];
  const totalDays = Math.ceil(
    (timelineEnd.getTime() - timelineStart.getTime()) / (24 * 60 * 60 * 1000),
  );

  // Calculate bar position and width for each task
  const getTaskBarStyle = (task: ScheduleTaskWithHierarchy) => {
    if (!task.start_date || !task.finish_date) return null;

    const startDate = parseISO(task.start_date);
    const finishDate = parseISO(task.finish_date);

    const startOffset = Math.max(
      0,
      (startDate.getTime() - timelineStart.getTime()) / (24 * 60 * 60 * 1000),
    );
    const duration = Math.max(
      1,
      (finishDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
    );

    const left = (startOffset / totalDays) * 100;
    const width = (duration / totalDays) * 100;

    return { left: `${left}%`, width: `${Math.min(width, 100 - left)}%` };
  };

  return (
    <div className="rounded-lg border bg-card">
      {/* Header with navigation */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          >
            <ChevronLeft />
          </Button>
          <Button variant="outline" onClick={() => setCurrentDate(new Date())}>
            Go to date
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Zoom</span>
          <div className="w-24 h-1 bg-muted rounded-full">
            <div className="w-12 h-1 bg-primary rounded-full" />
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Task list sidebar */}
        <div className="w-64 border-r shrink-0">
          <div className="h-10 border-b px-4 flex items-center text-sm font-medium bg-muted/30">
            {format(currentDate, "yyyy")}
          </div>
          <div className="divide-y">
            {flatTasks.map((task, index) => (
              <div
                key={task.id}
                className="h-10 px-4 flex items-center gap-2 hover:bg-accent transition-colors duration-150 cursor-pointer"
                draggable
                onClick={() => onTaskClick(task)}
                onDragStart={() => setDraggedTaskId(task.id)}
                onDragEnd={() => {
                  setDraggedTaskId(null);
                  setDropTargetTaskId(null);
                }}
                onDragOver={(event) => {
                  if (!draggedTaskId || draggedTaskId === task.id) return;
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
                  if (!draggedTaskId || draggedTaskId === task.id) return;
                  setDropTargetTaskId(null);
                  await onUpdateTask(draggedTaskId, {
                    parent_task_id: task.id,
                  });
                }}
                style={
                  dropTargetTaskId === task.id
                    ? { backgroundColor: "hsl(var(--primary) / 0.08)" }
                    : undefined
                }
              >
                <span className="text-xs text-muted-foreground w-6">
                  {index + 1}
                </span>
                <Checkbox
                  checked={task.status === "complete"}
                  onClick={(e) => e.stopPropagation()}
                  onCheckedChange={async (checked) => {
                    await onUpdateTask(task.id, {
                      status: checked ? "complete" : "not_started",
                      percent_complete: checked ? 100 : 0,
                    });
                  }}
                />
                <span className="text-sm truncate flex-1">{task.name}</span>
              </div>
            ))}
            <div className="px-3 py-2 border-b border-border/50 bg-muted/10">
              <InlineQuickAddRow
                placeholder="Add task and press Enter"
                onSubmit={(name) => onQuickAddTask({ name })}
              />
            </div>
          </div>
        </div>

        {/* Timeline area */}
        <ScrollArea className="flex-1">
          <div className="min-w-[800px]">
            {/* Timeline header */}
            <div className="h-10 border-b flex bg-muted/30">
              {weeks.map((week) => {
                const dayOfWeek = week.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                return (
                  <div
                    key={week.toISOString()}
                    className={cn(
                      "flex-1 px-2 border-r text-xs text-muted-foreground flex items-center justify-center",
                      isWeekend && "bg-muted/30",
                    )}
                  >
                    {format(week, "MMM d")}
                  </div>
                );
              })}
            </div>

            {/* Task bars */}
            <div className="divide-y relative">
              {/* Today indicator */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-destructive opacity-70 z-10"
                style={{
                  left: `${((new Date().getTime() - timelineStart.getTime()) / (totalDays * 24 * 60 * 60 * 1000)) * 100}%`,
                }}
              >
                <div className="w-2 h-2 rounded-full bg-destructive -translate-x-[3px] -translate-y-1" />
              </div>

              {flatTasks.map((task) => {
                const barStyle = getTaskBarStyle(task);
                const label = getTaskLabel(task);

                return (
                  <div key={task.id} className="h-10 relative">
                    {/* Week grid lines */}
                    <div className="absolute inset-0 flex">
                      {weeks.map((week) => {
                        const dayOfWeek = week.getDay();
                        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                        return (
                          <div
                            key={week.toISOString()}
                            className={cn(
                              "flex-1 border-r",
                              isWeekend && "bg-muted/30",
                            )}
                          />
                        );
                      })}
                    </div>

                    {/* Task bar */}
                    {barStyle && (
                      <div
                        className={cn(
                          "absolute top-2 h-6 rounded cursor-pointer hover:opacity-80",
                          task.status === "complete"
                            ? "bg-[hsl(var(--status-success))]"
                            : task.status === "in_progress"
                              ? "bg-[hsl(var(--status-info))]"
                              : label
                                ? labelColors[label]
                                : "bg-muted-foreground",
                        )}
                        style={barStyle}
                        onClick={() => onTaskClick(task)}
                        title={task.name}
                      />
                    )}
                  </div>
                );
              })}

              {/* Empty row for add task */}
              <div className="h-10 relative">
                <div className="absolute inset-0 flex">
                  {weeks.map((week) => {
                    const dayOfWeek = week.getDay();
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    return (
                      <div
                        key={week.toISOString()}
                        className={cn(
                          "flex-1 border-r",
                          isWeekend && "bg-muted/30",
                        )}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  );
}

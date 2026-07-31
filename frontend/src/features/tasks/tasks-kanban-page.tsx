"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  CalendarClock,
  GripVertical,
  Loader2,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import type { UniqueIdentifier } from "@dnd-kit/core";

import { TaskFeedbackButtons } from "@/components/ai/TaskFeedbackButtons";
import { SectionRuleHeading } from "@/components/layout/spacing";
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
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnHandle,
  KanbanItem,
  KanbanItemHandle,
  KanbanOverlay,
} from "@/components/ui/kanban";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  InspectorRail,
  InspectorSection,
  PropertyList,
  PropertyRow,
  StatusBadge,
} from "@/components/ds";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  type TasksRow,
  getTaskCategory,
  getTaskSourceLabel,
  getTaskSourceTarget,
  getTaskSourceTitle,
} from "@/features/tasks/task-utils";
import {
  TASK_PRIORITY_VALUES,
  TASK_STATUS_VALUES,
  type TaskPriorityValue,
} from "@/features/tasks/task-values";
import {
  buildTaskFeedbackSnapshot,
  getTaskProjectId,
  isAiGeneratedTask,
} from "@/features/tasks/tasks-table-config";

type TaskKanbanStatus = "open" | "in_progress" | "blocked" | "done";

type TaskColumns = Record<TaskKanbanStatus, TasksRow[]>;

type TaskPatch = {
  title?: string | null;
  description?: string;
  status?: string;
  due_date?: string | null;
  project_id?: number | null;
  category?: string | null;
  priority?: string | null;
  assignee_person_id?: string | null;
};

type EmployeeOption = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  job_title?: string | null;
};

type ProjectOption = {
  id: number;
  name: string | null;
  "job number"?: string | null;
  project_number?: string | null;
};

const COLUMN_DEFINITIONS: Array<{
  id: TaskKanbanStatus;
  label: string;
  emptyLabel: string;
}> = [
  { id: "open", label: "Open", emptyLabel: "No open tasks" },
  {
    id: "in_progress",
    label: "In Progress",
    emptyLabel: "Nothing in progress",
  },
  { id: "blocked", label: "Blocked", emptyLabel: "No blocked tasks" },
  { id: "done", label: "Done", emptyLabel: "Nothing done yet" },
];

const DEFAULT_COLUMN_ORDER = COLUMN_DEFINITIONS.map((column) => column.id);
const COLUMN_BY_ID = Object.fromEntries(
  COLUMN_DEFINITIONS.map((column) => [column.id, column]),
) as Record<TaskKanbanStatus, (typeof COLUMN_DEFINITIONS)[number]>;

const EMPTY_COLUMNS: TaskColumns = {
  open: [],
  in_progress: [],
  blocked: [],
  done: [],
};

const DONE_STATUSES = new Set(["complete", "closed", "done", "cancelled"]);
const IN_PROGRESS_STATUSES = new Set(["in_progress", "started", "active"]);
const BLOCKED_STATUSES = new Set(["blocked", "stuck", "waiting"]);
const UNASSIGNED = "__unassigned__";
const NO_PROJECT = "__no_project__";
const NO_CATEGORY = "__no_category__";
const NO_PRIORITY = "__no_priority__";
const TASK_CATEGORIES = [
  "Accounting",
  "Compliance",
  "Design",
  "Estimating",
  "General",
  "Operations",
];

function toKanbanStatus(status: string | null): TaskKanbanStatus {
  const normalized = (status ?? "").toLowerCase();
  if (DONE_STATUSES.has(normalized)) return "done";
  if (BLOCKED_STATUSES.has(normalized)) return "blocked";
  if (IN_PROGRESS_STATUSES.has(normalized)) return "in_progress";
  return "open";
}

function findColumnForTask(
  columns: TaskColumns,
  taskId: UniqueIdentifier,
): TaskKanbanStatus | null {
  const normalizedTaskId = String(taskId);
  for (const column of COLUMN_DEFINITIONS) {
    if (columns[column.id].some((task) => task.id === normalizedTaskId)) {
      return column.id;
    }
  }
  return null;
}

function buildColumns(tasks: TasksRow[]): TaskColumns {
  const columns: TaskColumns = {
    open: [],
    in_progress: [],
    blocked: [],
    done: [],
  };

  for (const task of tasks) {
    if (!task.id) continue;
    columns[toKanbanStatus(task.status)].push(task);
  }

  for (const column of COLUMN_DEFINITIONS) {
    columns[column.id].sort((left, right) => {
      const leftDue = left.due_date
        ? new Date(left.due_date).getTime()
        : Number.POSITIVE_INFINITY;
      const rightDue = right.due_date
        ? new Date(right.due_date).getTime()
        : Number.POSITIVE_INFINITY;
      if (leftDue !== rightDue) return leftDue - rightDue;

      const leftCreated = left.created_at
        ? new Date(left.created_at).getTime()
        : Number.POSITIVE_INFINITY;
      const rightCreated = right.created_at
        ? new Date(right.created_at).getTime()
        : Number.POSITIVE_INFINITY;
      return leftCreated - rightCreated;
    });
  }

  return columns;
}

function orderedColumns(
  columns: TaskColumns,
  order: TaskKanbanStatus[],
): TaskColumns {
  return order.reduce((next, columnId) => {
    next[columnId] = columns[columnId] ?? [];
    return next;
  }, {} as TaskColumns);
}

function normalizeColumnOrder(
  columnIds: UniqueIdentifier[],
): TaskKanbanStatus[] {
  const seen = new Set<TaskKanbanStatus>();
  const next: TaskKanbanStatus[] = [];

  for (const columnId of columnIds) {
    if (
      typeof columnId === "string" &&
      columnId in COLUMN_BY_ID &&
      !seen.has(columnId as TaskKanbanStatus)
    ) {
      seen.add(columnId as TaskKanbanStatus);
      next.push(columnId as TaskKanbanStatus);
    }
  }

  for (const columnId of DEFAULT_COLUMN_ORDER) {
    if (!seen.has(columnId)) next.push(columnId);
  }

  return next;
}

function updateTaskInColumns(
  columns: TaskColumns,
  taskId: string,
  updater: (task: TasksRow) => TasksRow,
): TaskColumns {
  const next: TaskColumns = {
    open: [],
    in_progress: [],
    blocked: [],
    done: [],
  };

  for (const column of COLUMN_DEFINITIONS) {
    for (const task of columns[column.id]) {
      if (task.id !== taskId) {
        next[column.id].push(task);
        continue;
      }

      const updated = updater(task);
      next[toKanbanStatus(updated.status)].push(updated);
    }
  }

  return next;
}

function removeTaskFromColumns(
  columns: TaskColumns,
  taskId: string,
): TaskColumns {
  return {
    open: columns.open.filter((task) => task.id !== taskId),
    in_progress: columns.in_progress.filter((task) => task.id !== taskId),
    blocked: columns.blocked.filter((task) => task.id !== taskId),
    done: columns.done.filter((task) => task.id !== taskId),
  };
}

function formatShortDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatLongDate(value: string | null): string {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function isOverdue(value: string | null, status: string | null): boolean {
  if (!value || toKanbanStatus(status) === "done") return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < Date.now();
}

function getTaskTitle(task: TasksRow): string {
  return task.title || task.description || "Untitled task";
}

function employeeLabel(employee: EmployeeOption): string {
  const name = [employee.first_name, employee.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || employee.email || "Unnamed employee";
}

function projectLabel(project: ProjectOption): string {
  const number = project.project_number ?? project["job number"];
  return number
    ? `${number} - ${project.name || `Project ${project.id}`}`
    : project.name || `Project ${project.id}`;
}

function metadataRecord(task: TasksRow): Record<string, unknown> {
  return task.extraction_metadata &&
    typeof task.extraction_metadata === "object" &&
    !Array.isArray(task.extraction_metadata)
    ? (task.extraction_metadata as Record<string, unknown>)
    : {};
}

function mergeTaskPatch(
  task: TasksRow,
  patch: TaskPatch,
  employees: EmployeeOption[],
  projects: ProjectOption[],
): TasksRow {
  const next: TasksRow = { ...task };

  if (patch.title !== undefined) next.title = patch.title;
  if (patch.description !== undefined) next.description = patch.description;
  if (patch.status !== undefined) next.status = patch.status;
  if (patch.due_date !== undefined) next.due_date = patch.due_date;
  if (patch.priority !== undefined) next.priority = patch.priority;

  if (patch.project_id !== undefined) {
    const project =
      patch.project_id === null
        ? null
        : projects.find((item) => item.id === patch.project_id);
    next.project_id = patch.project_id;
    next.project_ids = patch.project_id === null ? [] : [patch.project_id];
    next.project_name = project ? projectLabel(project) : next.project_name;
  }

  if (patch.assignee_person_id !== undefined) {
    const employee =
      patch.assignee_person_id === null
        ? null
        : employees.find((item) => item.id === patch.assignee_person_id);
    next.assignee_person_id = patch.assignee_person_id;
    next.assignee_name = employee ? employeeLabel(employee) : null;
    next.assignee_email = employee?.email ?? null;
  }

  if (patch.category !== undefined) {
    const metadata = metadataRecord(next);
    if (patch.category === null) {
      delete metadata.task_category;
    } else {
      metadata.task_category = patch.category;
    }
    next.extraction_metadata = metadata;
  }

  next.updated_at = new Date().toISOString();
  return next;
}

function TaskCard({
  task,
  overlay = false,
  onOpen,
}: {
  task: TasksRow;
  overlay?: boolean;
  onOpen?: (task: TasksRow) => void;
}) {
  const title = getTaskTitle(task);
  const assignee = task.assignee_name || task.assignee_email || "Unassigned";
  const dueLabel = formatShortDate(task.due_date);
  const overdue = isOverdue(task.due_date, task.status);
  const sourceLabel = getTaskSourceLabel(task);

  return (
    <KanbanItem value={task.id ?? title} disabled={!task.id}>
      <article
        className={cn(
          "rounded-md border border-border/70 bg-background p-3 shadow-xs transition-colors",
          "hover:border-border hover:bg-muted/20",
          overlay && "w-80 shadow-md",
        )}
      >
        <div className="flex items-start gap-2">
          {!overlay ? (
            <KanbanItemHandle
              aria-label={`Move task: ${title}`}
              className="-ml-1 mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <GripVertical className="h-4 w-4" />
            </KanbanItemHandle>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-w-0 flex-1 flex-col items-stretch justify-start p-0 text-left font-normal hover:bg-transparent"
            onClick={() => onOpen?.(task)}
            disabled={overlay}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="line-clamp-3 text-sm font-medium leading-5 text-foreground">
                {title}
              </p>
              {task.priority ? (
                <StatusBadge
                  status={task.priority}
                  className="pointer-events-none h-5 shrink-0 px-1.5 text-[11px] capitalize"
                />
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{assignee}</span>
              </span>
              {dueLabel ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5",
                    overdue && "font-medium text-destructive",
                  )}
                >
                  <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                  {dueLabel}
                </span>
              ) : null}
            </div>

            {sourceLabel ? (
              <p className="mt-3 truncate text-xs text-muted-foreground">
                {sourceLabel}
              </p>
            ) : null}
          </Button>
        </div>
      </article>
    </KanbanItem>
  );
}

function TaskColumn({
  column,
  tasks,
  onOpenTask,
}: {
  column: (typeof COLUMN_DEFINITIONS)[number];
  tasks: TasksRow[];
  onOpenTask?: (task: TasksRow) => void;
}) {
  return (
    <KanbanColumn
      value={column.id}
      className="min-h-96 w-80 shrink-0 gap-3 rounded-lg border border-border/70 bg-muted/30 p-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {column.label}
          </span>
          <span className="inline-flex min-w-6 items-center justify-center rounded-sm bg-background px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground ring-1 ring-inset ring-border/70">
            {tasks.length}
          </span>
        </div>
        <KanbanColumnHandle asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <GripVertical className="h-4 w-4" />
            <span className="sr-only">Move {column.label} column</span>
          </Button>
        </KanbanColumnHandle>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onOpen={onOpenTask} />
          ))
        ) : (
          <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-border/70 px-4 text-center text-sm text-muted-foreground">
            {column.emptyLabel}
          </div>
        )}
      </div>
    </KanbanColumn>
  );
}

function TaskDetailDialog({
  projectId,
  task,
  open,
  loading,
  saving,
  deleting,
  employees,
  projects,
  onOpenChange,
  onPatch,
  onDelete,
}: {
  projectId: string;
  task: TasksRow | null;
  open: boolean;
  loading: boolean;
  saving: boolean;
  deleting: boolean;
  employees: EmployeeOption[];
  projects: ProjectOption[];
  onOpenChange: (open: boolean) => void;
  onPatch: (task: TasksRow, patch: TaskPatch) => Promise<void>;
  onDelete: (task: TasksRow) => Promise<void>;
}) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [draft, setDraft] = React.useState({
    title: "",
    description: "",
    status: "open",
    priority: NO_PRIORITY,
    assigneePersonId: UNASSIGNED,
    projectId: NO_PROJECT,
    category: NO_CATEGORY,
    dueDate: "",
  });

  React.useEffect(() => {
    if (!task) return;
    setDraft({
      title: task.title ?? "",
      description: task.description ?? "",
      status: task.status ?? "open",
      priority: task.priority ?? NO_PRIORITY,
      assigneePersonId: task.assignee_person_id ?? UNASSIGNED,
      projectId: task.project_id ? String(task.project_id) : NO_PROJECT,
      category: getTaskCategory(task) || NO_CATEGORY,
      dueDate: task.due_date ?? "",
    });
  }, [task]);

  if (!task) {
    return (
      <Modal open={open} onOpenChange={onOpenChange}>
        <ModalContent size="form">
          <div className="flex min-h-56 items-center justify-center text-sm text-muted-foreground">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading task...
              </>
            ) : (
              "Task not found."
            )}
          </div>
        </ModalContent>
      </Modal>
    );
  }

  const sourceTarget = getTaskSourceTarget(task, projectId);
  const sourceTitle = getTaskSourceTitle(task);
  const sourceLabel = getTaskSourceLabel(task);
  const category = draft.category === NO_CATEGORY ? null : draft.category;
  const priority =
    draft.priority === NO_PRIORITY
      ? null
      : (draft.priority as TaskPriorityValue);
  const selectedProjectId =
    draft.projectId === NO_PROJECT
      ? null
      : Number.parseInt(draft.projectId, 10);
  const selectedAssigneeId =
    draft.assigneePersonId === UNASSIGNED ? null : draft.assigneePersonId;

  const saveTask = async () => {
    const title = draft.title.trim() || null;
    const description = draft.description.trim();
    if (!description) {
      toast.error("Task description is required");
      return;
    }

    await onPatch(task, {
      title,
      description,
      status: draft.status,
      priority,
      assignee_person_id: selectedAssigneeId,
      project_id: selectedProjectId,
      category,
      due_date: draft.dueDate || null,
    });
  };

  const sourceHref = sourceTarget?.href;

  return (
    <>
      <Modal open={open} onOpenChange={onOpenChange}>
        <ModalContent
          size="form"
          className="max-h-[calc(100svh-2rem)] gap-0 overflow-hidden p-0 lg:max-w-5xl"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <ModalHeader className="border-b border-border/60 px-6 py-4">
            <div className="flex min-w-0 items-center gap-2 pr-8">
              <StatusBadge
                status={draft.status}
                className="h-5 px-1.5 text-[11px] capitalize"
              />
              <ModalTitle className="truncate text-base font-semibold">
                Task details
              </ModalTitle>
            </div>
            <ModalDescription className="sr-only">
              Edit the task and review source evidence.
            </ModalDescription>
          </ModalHeader>

          <div className="max-h-[calc(100svh-11rem)] overflow-y-auto">
            <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="min-w-0 space-y-7 px-6 py-5">
                <section className="space-y-3">
                  <Input
                    variant="inline"
                    value={draft.title}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Task title"
                    disabled={saving || deleting}
                    className="-mx-2 h-auto rounded-md px-2 py-1 text-xl font-semibold leading-7 tracking-normal md:text-xl"
                  />

                  <Textarea
                    value={draft.description}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Add description..."
                    disabled={saving || deleting}
                    className="-mx-2 min-h-28 resize-none rounded-md border-0 bg-transparent px-2 py-2 text-sm leading-6 shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <SectionRuleHeading
                      label="Source context"
                      className="mb-0 pb-0"
                    />
                    {sourceHref ? (
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                      >
                        <a
                          href={sourceHref}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ArrowUpRight />
                          Open source
                        </a>
                      </Button>
                    ) : null}
                  </div>
                  {loading ? (
                    <div className="flex min-h-24 items-center text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading source context...
                    </div>
                  ) : task.source_context ? (
                    <div className="max-h-80 overflow-y-auto whitespace-pre-wrap border-l border-border/70 pl-4 text-sm leading-6 text-muted-foreground">
                      {task.source_context}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No source context is available for this task.
                    </p>
                  )}
                </section>
              </div>

              <InspectorRail className="border-t border-border/60 bg-muted/20 px-6 py-4 lg:border-l lg:border-t-0">
                <InspectorSection title="Properties" variant="plain">
                  <PropertyList>
                    <PropertyRow label="Status">
                      <Select
                        value={draft.status}
                        onValueChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            status: value,
                          }))
                        }
                        disabled={saving || deleting}
                      >
                        <SelectTrigger
                          variant="inline"
                          size="sm"
                          className="h-7 px-0 capitalize"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TASK_STATUS_VALUES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {value.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </PropertyRow>

                    <PropertyRow label="Priority">
                      <Select
                        value={draft.priority}
                        onValueChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            priority: value,
                          }))
                        }
                        disabled={saving || deleting}
                      >
                        <SelectTrigger
                          variant="inline"
                          size="sm"
                          className="h-7 px-0 capitalize"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_PRIORITY}>Not set</SelectItem>
                          {TASK_PRIORITY_VALUES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </PropertyRow>

                    <PropertyRow label="Assignee">
                      <Select
                        value={draft.assigneePersonId}
                        onValueChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            assigneePersonId: value,
                          }))
                        }
                        disabled={saving || deleting}
                      >
                        <SelectTrigger
                          variant="inline"
                          size="sm"
                          className="h-7 px-0"
                        >
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                          {employees.map((employee) => (
                            <SelectItem key={employee.id} value={employee.id}>
                              {employeeLabel(employee)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </PropertyRow>

                    <PropertyRow label="Project">
                      <Select
                        value={draft.projectId}
                        onValueChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            projectId: value,
                          }))
                        }
                        disabled={saving || deleting}
                      >
                        <SelectTrigger
                          variant="inline"
                          size="sm"
                          className="h-7 px-0"
                        >
                          <SelectValue placeholder="No project" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_PROJECT}>No project</SelectItem>
                          {projects.map((project) => (
                            <SelectItem
                              key={project.id}
                              value={String(project.id)}
                            >
                              {projectLabel(project)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </PropertyRow>

                    <PropertyRow label="Category">
                      <Select
                        value={draft.category}
                        onValueChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            category: value,
                          }))
                        }
                        disabled={saving || deleting}
                      >
                        <SelectTrigger
                          variant="inline"
                          size="sm"
                          className="h-7 px-0"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_CATEGORY}>Not set</SelectItem>
                          {TASK_CATEGORIES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </PropertyRow>

                    <PropertyRow label="Due date">
                      <Input
                        variant="inline"
                        type="date"
                        value={draft.dueDate}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            dueDate: event.target.value,
                          }))
                        }
                        disabled={saving || deleting}
                        className="h-7 px-0"
                      />
                    </PropertyRow>

                    <PropertyRow label="Source">
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-xs text-muted-foreground">
                          {sourceLabel}
                        </span>
                        {sourceHref ? (
                          <Button
                            asChild
                            variant="link"
                            className="h-auto justify-start p-0 text-left"
                          >
                            <a
                              href={sourceHref}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ArrowUpRight />
                              <span className="truncate">{sourceTitle}</span>
                            </a>
                          </Button>
                        ) : (
                          <span className="truncate">{sourceTitle}</span>
                        )}
                      </div>
                    </PropertyRow>
                  </PropertyList>
                </InspectorSection>

                {task.id && isAiGeneratedTask(task) ? (
                  <InspectorSection title="AI feedback" variant="plain">
                    <TaskFeedbackButtons
                      projectId={getTaskProjectId(task)}
                      taskId={task.id}
                      taskSnapshot={buildTaskFeedbackSnapshot(task)}
                      onRemove={() => {
                        void onDelete(task);
                      }}
                    />
                  </InspectorSection>
                ) : null}

                <InspectorSection
                  title="Trace"
                  defaultOpen={false}
                  variant="plain"
                >
                  <PropertyList>
                    <PropertyRow label="Created">
                      {formatLongDate(task.created_at)}
                    </PropertyRow>
                    <PropertyRow label="Updated">
                      {formatLongDate(task.updated_at)}
                    </PropertyRow>
                    <PropertyRow label="Source date">
                      {formatLongDate(task.source_date)}
                    </PropertyRow>
                    <PropertyRow label="Generated">
                      {task.extraction_model ||
                        task.extraction_source ||
                        task.extraction_prompt_version ||
                        "Not tracked"}
                    </PropertyRow>
                    <PropertyRow label="Task ID">
                      <span className="break-all text-xs text-muted-foreground">
                        {task.id}
                      </span>
                    </PropertyRow>
                    {task.metadata_id ? (
                      <PropertyRow label="Source ID">
                        <span className="break-all text-xs text-muted-foreground">
                          {task.metadata_id}
                        </span>
                      </PropertyRow>
                    ) : null}
                    {task.source_chunk_id ? (
                      <PropertyRow label="Chunk ID">
                        <span className="break-all text-xs text-muted-foreground">
                          {task.source_chunk_id}
                        </span>
                      </PropertyRow>
                    ) : null}
                    {task.segment_id ? (
                      <PropertyRow label="Segment ID">
                        <span className="break-all text-xs text-muted-foreground">
                          {task.segment_id}
                        </span>
                      </PropertyRow>
                    ) : null}
                  </PropertyList>
                </InspectorSection>
              </InspectorRail>
            </div>
          </div>

          <ModalFooter className="border-t border-border/60 px-6 py-4">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={saving || deleting}
              className="sm:mr-auto"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving || deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                void saveTask();
              }}
              disabled={saving || deleting}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the task from the project Kanban board. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void onDelete(task).then(() => setDeleteConfirmOpen(false));
              }}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface TasksKanbanPageProps {
  projectId: string;
}

export function TasksKanbanPage({ projectId }: TasksKanbanPageProps) {
  const [columns, setColumns] = React.useState<TaskColumns>(EMPTY_COLUMNS);
  const [columnOrder, setColumnOrder] =
    React.useState<TaskKanbanStatus[]>(DEFAULT_COLUMN_ORDER);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [savingTaskId, setSavingTaskId] = React.useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(
    null,
  );
  const [selectedTask, setSelectedTask] = React.useState<TasksRow | null>(null);
  const [selectedTaskLoading, setSelectedTaskLoading] = React.useState(false);
  const [deletingTaskId, setDeletingTaskId] = React.useState<string | null>(
    null,
  );
  const [employees, setEmployees] = React.useState<EmployeeOption[]>([]);
  const [projects, setProjects] = React.useState<ProjectOption[]>([]);
  const columnsRef = React.useRef(columns);
  const dragStartRef = React.useRef<{
    columns: TaskColumns;
    taskId: string;
    column: TaskKanbanStatus | null;
  } | null>(null);

  React.useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadTasks() {
      setLoading(true);
      setError(null);
      try {
        const payload = await apiFetch<{ data?: TasksRow[] }>(
          `/api/tasks?project_id=${projectId}&scope=all`,
        );
        if (cancelled) return;
        const nextColumns = buildColumns(payload.data ?? []);
        columnsRef.current = nextColumns;
        setColumns(nextColumns);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load project tasks.";
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadTasks();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      try {
        const [employeePayload, projectPayload] = await Promise.all([
          apiFetch<EmployeeOption[]>("/api/employees"),
          apiFetch<{ data?: ProjectOption[] }>(
            "/api/projects?fields=id,name,project_number,job_number&limit=500&includeClient=false",
          ),
        ]);
        if (cancelled) return;
        setEmployees(employeePayload);
        setProjects(projectPayload.data ?? []);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Task edit options did not load.";
        toast.error("Could not load task edit options", {
          description: message,
        });
      }
    }

    void loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!selectedTaskId) {
      setSelectedTask(null);
      return;
    }

    const taskId = selectedTaskId;
    let cancelled = false;
    async function loadTaskDetail() {
      setSelectedTaskLoading(true);
      try {
        const payload = await apiFetch<{ task: TasksRow }>(
          `/api/tasks/${taskId}`,
        );
        if (cancelled) return;
        setSelectedTask(payload.task);
        setColumns((current) =>
          updateTaskInColumns(current, taskId, () => payload.task),
        );
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Task details did not load.";
        toast.error("Could not open task", { description: message });
      } finally {
        if (!cancelled) setSelectedTaskLoading(false);
      }
    }

    void loadTaskDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedTaskId]);

  function handleColumnsChange(
    nextColumns: Record<UniqueIdentifier, TasksRow[]>,
  ) {
    const nextOrder = normalizeColumnOrder(Object.keys(nextColumns));
    const typedColumns = orderedColumns(
      {
        open: nextColumns.open ?? [],
        in_progress: nextColumns.in_progress ?? [],
        blocked: nextColumns.blocked ?? [],
        done: nextColumns.done ?? [],
      },
      nextOrder,
    );
    setColumnOrder(nextOrder);
    columnsRef.current = typedColumns;
    setColumns(typedColumns);
  }

  async function persistTaskStatus(taskId: string, status: TaskKanbanStatus) {
    setSavingTaskId(taskId);
    try {
      await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setColumns((current) =>
        updateTaskInColumns(current, taskId, (task) => ({ ...task, status })),
      );
      setSelectedTask((current) =>
        current?.id === taskId ? { ...current, status } : current,
      );
      toast.success("Task status updated");
    } catch (err) {
      const previousColumns = dragStartRef.current?.columns;
      if (previousColumns) {
        columnsRef.current = previousColumns;
        setColumns(previousColumns);
      }
      const message =
        err instanceof Error ? err.message : "The task move did not save.";
      toast.error("Could not move task", { description: message });
    } finally {
      setSavingTaskId(null);
    }
  }

  async function patchTask(task: TasksRow, patch: TaskPatch) {
    if (!task.id) return;
    setSavingTaskId(task.id);
    try {
      await apiFetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      const nextTask = mergeTaskPatch(task, patch, employees, projects);
      setColumns((current) =>
        updateTaskInColumns(current, task.id!, () => nextTask),
      );
      setSelectedTask(nextTask);
      toast.success("Task updated");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "The task update did not save.";
      toast.error("Could not update task", { description: message });
    } finally {
      setSavingTaskId(null);
    }
  }

  async function deleteTask(task: TasksRow) {
    if (!task.id) return;

    setDeletingTaskId(task.id);
    try {
      await apiFetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      setColumns((current) => removeTaskFromColumns(current, task.id!));
      setSelectedTaskId(null);
      setSelectedTask(null);
      toast.success("Task deleted");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "The task was not deleted.";
      toast.error("Could not delete task", { description: message });
    } finally {
      setDeletingTaskId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-96 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading task board...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-center">
        <AlertCircle className="h-5 w-5 text-destructive" />
        <div>
          <p className="text-sm font-medium text-foreground">
            Could not load task board
          </p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{error}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/${projectId}/tasks`}>Open task inbox</Link>
        </Button>
      </div>
    );
  }

  const kanbanValue = orderedColumns(columns, columnOrder);

  return (
    <div className="min-w-0 space-y-3">
      {savingTaskId ? (
        <div className="text-xs text-muted-foreground">Saving task...</div>
      ) : null}
      <Kanban
        value={kanbanValue}
        onValueChange={handleColumnsChange}
        getItemValue={(item) => item.id ?? getTaskTitle(item)}
        autoScroll
        onDragStart={(event) => {
          const taskId = String(event.active.id);
          dragStartRef.current = {
            columns: columnsRef.current,
            taskId,
            column: findColumnForTask(columnsRef.current, taskId),
          };
        }}
        onDragEnd={(event) => {
          const taskId = String(event.active.id);
          const start = dragStartRef.current;
          const nextColumn = findColumnForTask(columnsRef.current, taskId);
          if (
            start?.taskId === taskId &&
            nextColumn &&
            start.column !== nextColumn
          ) {
            void persistTaskStatus(taskId, nextColumn);
          }
          dragStartRef.current = null;
        }}
        onDragCancel={() => {
          const previousColumns = dragStartRef.current?.columns;
          if (previousColumns) {
            columnsRef.current = previousColumns;
            setColumns(previousColumns);
          }
          dragStartRef.current = null;
        }}
      >
        <div className="w-full overflow-x-auto pb-4">
          <KanbanBoard className="min-w-max items-start">
            {columnOrder.map((columnId) => (
              <TaskColumn
                key={columnId}
                column={COLUMN_BY_ID[columnId]}
                tasks={columns[columnId]}
                onOpenTask={(task) => {
                  if (!task.id) return;
                  setSelectedTask(task);
                  setSelectedTaskId(task.id);
                }}
              />
            ))}
          </KanbanBoard>
        </div>
        <KanbanOverlay>
          {({ value, variant }) => {
            if (variant === "column") {
              const column = COLUMN_BY_ID[value as TaskKanbanStatus];
              if (!column) return null;
              return <TaskColumn column={column} tasks={columns[column.id]} />;
            }

            const task = Object.values(columns)
              .flat()
              .find((item) => item.id === value);
            if (!task) return null;
            return <TaskCard task={task} overlay />;
          }}
        </KanbanOverlay>
      </Kanban>

      <TaskDetailDialog
        projectId={projectId}
        task={selectedTask}
        open={Boolean(selectedTaskId)}
        loading={selectedTaskLoading}
        saving={Boolean(savingTaskId && savingTaskId === selectedTask?.id)}
        deleting={Boolean(
          deletingTaskId && deletingTaskId === selectedTask?.id,
        )}
        employees={employees}
        projects={projects}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTaskId(null);
            setSelectedTask(null);
          }
        }}
        onPatch={patchTask}
        onDelete={deleteTask}
      />
    </div>
  );
}

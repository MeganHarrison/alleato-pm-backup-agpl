import type { FilterValue } from "@/components/tables/unified";

export type TasksWorkSurfaceView = "list" | "board";

export interface TasksWorkSurfaceFilters
  extends Record<string, FilterValue> {
  status: "open" | "done";
  assignee_person_id: string | undefined;
  priority: "low" | "medium" | "high" | "urgent" | undefined;
  due_date_from: string | undefined;
  due_date_to: string | undefined;
}

export interface TasksWorkSurfaceState {
  view: TasksWorkSurfaceView;
  filters: TasksWorkSurfaceFilters;
}

export interface TaskWorkSurfaceFilterCandidate {
  status?: string | null;
  assignee_person_id?: string | null;
  assignee_email?: string | null;
  priority?: string | null;
  due_date?: string | null;
}

const TASK_PRIORITIES = new Set([
  "low",
  "medium",
  "high",
  "urgent",
]);
const DONE_STATUSES = new Set(["complete", "closed", "done", "cancelled"]);
const IN_PROGRESS_STATUSES = new Set(["in_progress", "started", "active"]);

function nonEmptyParam(value: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function dateParam(value: string | null): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;

  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
    ? undefined
    : value;
}

function taskDateKey(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function taskDisplayStatus(status: string | null): "open" | "in_progress" | "done" {
  const normalized = (status ?? "").toLowerCase();
  if (DONE_STATUSES.has(normalized)) return "done";
  if (IN_PROGRESS_STATUSES.has(normalized)) return "in_progress";
  return "open";
}

export function parseTasksWorkSurfaceState(
  searchParams: Pick<URLSearchParams, "get">,
): TasksWorkSurfaceState {
  const rawView = searchParams.get("view");
  const rawStatus = searchParams.get("status");
  const rawPriority = searchParams.get("priority");

  return {
    view: rawView === "board" ? "board" : "list",
    filters: {
      status: rawStatus === "done" ? "done" : "open",
      assignee_person_id: nonEmptyParam(searchParams.get("assignee")),
      priority:
        rawPriority && TASK_PRIORITIES.has(rawPriority)
          ? (rawPriority as TasksWorkSurfaceFilters["priority"])
          : undefined,
      due_date_from: dateParam(searchParams.get("due_from")),
      due_date_to: dateParam(searchParams.get("due_to")),
    },
  };
}

function filterString(value: FilterValue): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function serializeTaskFilterParams(
  filters: Record<string, FilterValue>,
): Record<string, string | null> {
  return {
    status: filters.status === "done" ? "done" : null,
    assignee: filterString(filters.assignee_person_id),
    priority: filterString(filters.priority),
    due_from: filterString(filters.due_date_from),
    due_to: filterString(filters.due_date_to),
  };
}

export function taskMatchesWorkSurfaceFilters(
  task: TaskWorkSurfaceFilterCandidate,
  filters: Record<string, FilterValue>,
): boolean {
  const status = taskDisplayStatus(task.status);
  const statusFilter = filters.status === "done" ? "done" : "open";

  if (statusFilter === "done" ? status !== "done" : status === "done") {
    return false;
  }

  const assigneeFilter = filterString(filters.assignee_person_id);
  if (assigneeFilter === "__unassigned__") {
    if (task.assignee_person_id || task.assignee_email) return false;
  } else if (
    assigneeFilter &&
    task.assignee_person_id !== assigneeFilter
  ) {
    return false;
  }

  const priorityFilter = filterString(filters.priority)?.toLowerCase();
  if (
    priorityFilter &&
    (task.priority ?? "").toLowerCase() !== priorityFilter
  ) {
    return false;
  }

  const dueDateFrom = filterString(filters.due_date_from);
  const dueDateTo = filterString(filters.due_date_to);
  if (dueDateFrom || dueDateTo) {
    const dueDate = taskDateKey(task.due_date);
    if (!dueDate) return false;
    if (dueDateFrom && dueDate < dueDateFrom) return false;
    if (dueDateTo && dueDate > dueDateTo) return false;
  }

  return true;
}

export function taskViewParam(view: TasksWorkSurfaceView): "list" | "board" {
  return view;
}

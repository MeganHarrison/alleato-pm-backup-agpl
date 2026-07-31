import type {
  DependencyType,
  ScheduleDeadline,
  ScheduleDependency,
  ScheduleTask,
  ScheduleWarningCode,
} from "@/types/scheduling";
import { addWorkingDays, defaultScheduleCalendar, workingDayDuration, type ScheduleCalendar } from "./schedule-calendar";

const MILLISECONDS_PER_DAY = 86_400_000;

export interface ScheduleTaskAnalysis {
  early_start_day: number;
  early_finish_day: number;
  late_start_day: number;
  late_finish_day: number;
  total_float_days: number;
  is_critical_path: boolean;
  schedule_warnings: ScheduleWarningCode[];
}

export interface ScheduleNetworkAnalysis {
  has_cycle: boolean;
  project_duration_days: number;
  tasks: Record<string, ScheduleTaskAnalysis>;
}

interface ScheduleNetworkInput {
  tasks: ScheduleTask[];
  dependencies: ScheduleDependency[];
  deadlines: ScheduleDeadline[];
  calendar?: ScheduleCalendar;
}

interface NetworkEdge {
  successorId: string;
  startOffset: number;
}

function toUtcDay(value: string | null | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return Math.floor(timestamp / MILLISECONDS_PER_DAY);
}

/**
 * A task is only genuinely "missing dates" if there isn't enough information to
 * derive both a start and a finish — matching what `getTaskDuration` below can
 * already compute from `duration_days` alone. Requiring both `start_date` AND
 * `finish_date` to be literally populated (the previous check) wrongly flagged any
 * task with only a start date + duration — e.g. a schedule anchor whose own finish
 * date is never written by the auto-scheduler (it only writes successors' dates) —
 * which then excluded it from `is_critical_path` even at zero float.
 */
function hasMissingDates(task: ScheduleTask): boolean {
  const hasStart = toUtcDay(task.start_date) !== null;
  const hasFinish = toUtcDay(task.finish_date) !== null;
  const hasDuration = Number.isFinite(task.duration_days) && (task.duration_days ?? 0) > 0;
  return !((hasStart && hasFinish) || (hasStart && hasDuration) || (hasFinish && hasDuration));
}

function getTaskDuration(task: ScheduleTask, calendar: ScheduleCalendar): number {
  if (task.is_milestone) return 0;
  if (Number.isFinite(task.duration_days) && (task.duration_days ?? 0) >= 0) {
    return Math.max(1, Math.round(task.duration_days ?? 1));
  }
  const start = toUtcDay(task.start_date);
  const finish = toUtcDay(task.finish_date);
  if (start !== null && finish !== null && finish >= start) {
    return workingDayDuration(task.start_date!, task.finish_date!, calendar);
  }
  return 1;
}

export function getDependencyStartOffset(
  dependencyType: DependencyType,
  predecessorDuration: number,
  successorDuration: number,
  lagDays: number,
): number {
  switch (dependencyType) {
    case "start_to_start":
      return lagDays;
    case "finish_to_finish":
      return predecessorDuration - successorDuration + lagDays;
    case "start_to_finish":
      return -successorDuration + lagDays;
    case "finish_to_start":
    default:
      return predecessorDuration + lagDays;
  }
}

function hasConstraintViolation(task: ScheduleTask): boolean {
  if (!task.constraint_type || task.constraint_type === "none") return false;
  const constraintDay = toUtcDay(task.constraint_date);
  const startDay = toUtcDay(task.start_date);
  const finishDay = toUtcDay(task.finish_date);
  if (constraintDay === null) return true;

  switch (task.constraint_type) {
    case "start_no_earlier_than":
      return startDay === null || startDay < constraintDay;
    case "finish_no_later_than":
      return finishDay === null || finishDay > constraintDay;
    case "must_start_on":
      return startDay !== constraintDay;
    case "must_finish_on":
      return finishDay !== constraintDay;
    default:
      return false;
  }
}

function hasDependencyViolation(
  dependency: ScheduleDependency,
  predecessor: ScheduleTask,
  successor: ScheduleTask,
  calendar: ScheduleCalendar,
): boolean {
  const requiredDate = (anchor: string | null, offset: number): string | null =>
    anchor && toUtcDay(anchor) !== null ? addWorkingDays(anchor, offset, calendar) : null;

  switch (dependency.dependency_type) {
    case "start_to_start":
      return successor.start_date !== null && requiredDate(predecessor.start_date, dependency.lag_days) !== null
        ? successor.start_date < requiredDate(predecessor.start_date, dependency.lag_days)!
        : false;
    case "finish_to_finish":
      return successor.finish_date !== null && requiredDate(predecessor.finish_date, dependency.lag_days) !== null
        ? successor.finish_date < requiredDate(predecessor.finish_date, dependency.lag_days)!
        : false;
    case "start_to_finish":
      return successor.finish_date !== null && requiredDate(predecessor.start_date, dependency.lag_days) !== null
        ? successor.finish_date < requiredDate(predecessor.start_date, dependency.lag_days)!
        : false;
    case "finish_to_start":
    default:
      return successor.start_date !== null && requiredDate(predecessor.finish_date, dependency.lag_days + 1) !== null
        ? successor.start_date < requiredDate(predecessor.finish_date, dependency.lag_days + 1)!
        : false;
  }
}

export function analyzeScheduleNetwork({
  tasks,
  dependencies,
  deadlines,
  calendar = defaultScheduleCalendar,
}: ScheduleNetworkInput): ScheduleNetworkAnalysis {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const durationById = new Map(tasks.map((task) => [task.id, getTaskDuration(task, calendar)]));
  const outgoingById = new Map<string, NetworkEdge[]>();
  const indegreeById = new Map(tasks.map((task) => [task.id, 0]));
  const warningsById = new Map<string, Set<ScheduleWarningCode>>();

  for (const task of tasks) {
    const warnings = new Set<ScheduleWarningCode>();
    if (hasMissingDates(task)) {
      warnings.add("missing_dates");
    }
    warningsById.set(task.id, warnings);
  }

  for (const dependency of dependencies) {
    const predecessor = taskById.get(dependency.predecessor_task_id);
    const successor = taskById.get(dependency.task_id);
    if (!predecessor || !successor) continue;

    const startOffset = getDependencyStartOffset(
      dependency.dependency_type,
      durationById.get(predecessor.id) ?? 1,
      durationById.get(successor.id) ?? 1,
      dependency.lag_days,
    );
    outgoingById.set(predecessor.id, [
      ...(outgoingById.get(predecessor.id) ?? []),
      { successorId: successor.id, startOffset },
    ]);
    indegreeById.set(successor.id, (indegreeById.get(successor.id) ?? 0) + 1);

    if (hasDependencyViolation(dependency, predecessor, successor, calendar)) {
      warningsById.get(successor.id)?.add("dependency_violation");
    }
  }

  const deadlineByTaskId = new Map(deadlines.map((deadline) => [deadline.task_id, deadline]));
  for (const task of tasks) {
    const finishDay = toUtcDay(task.finish_date);
    const deadlineDay = toUtcDay(deadlineByTaskId.get(task.id)?.deadline_date);
    if (finishDay !== null && deadlineDay !== null && finishDay > deadlineDay) {
      warningsById.get(task.id)?.add("deadline_missed");
    }
    if (hasConstraintViolation(task)) {
      warningsById.get(task.id)?.add("constraint_violation");
    }
  }

  const queue = tasks
    .filter((task) => (indegreeById.get(task.id) ?? 0) === 0)
    .map((task) => task.id);
  const topologicalOrder: string[] = [];
  const earliestStartById = new Map(tasks.map((task) => [task.id, 0]));

  while (queue.length > 0) {
    const taskId = queue.shift();
    if (!taskId) continue;
    topologicalOrder.push(taskId);
    const predecessorStart = earliestStartById.get(taskId) ?? 0;
    for (const edge of outgoingById.get(taskId) ?? []) {
      earliestStartById.set(
        edge.successorId,
        Math.max(
          earliestStartById.get(edge.successorId) ?? 0,
          predecessorStart + edge.startOffset,
        ),
      );
      const nextIndegree = (indegreeById.get(edge.successorId) ?? 0) - 1;
      indegreeById.set(edge.successorId, nextIndegree);
      if (nextIndegree === 0) queue.push(edge.successorId);
    }
  }

  const hasCycle = topologicalOrder.length !== tasks.length;
  if (hasCycle) {
    for (const task of tasks) {
      if ((indegreeById.get(task.id) ?? 0) > 0) {
        warningsById.get(task.id)?.add("circular_dependency");
      }
    }
  }

  const projectDurationDays = tasks.reduce((projectDuration, task) => {
    const earlyStart = earliestStartById.get(task.id) ?? 0;
    return Math.max(projectDuration, earlyStart + (durationById.get(task.id) ?? 1));
  }, 0);
  const latestStartById = new Map(
    tasks.map((task) => [
      task.id,
      projectDurationDays - (durationById.get(task.id) ?? 1),
    ]),
  );

  for (const taskId of [...topologicalOrder].reverse()) {
    for (const edge of outgoingById.get(taskId) ?? []) {
      latestStartById.set(
        taskId,
        Math.min(
          latestStartById.get(taskId) ?? 0,
          (latestStartById.get(edge.successorId) ?? 0) - edge.startOffset,
        ),
      );
    }
  }

  const taskAnalysis: Record<string, ScheduleTaskAnalysis> = {};
  for (const task of tasks) {
    const duration = durationById.get(task.id) ?? 1;
    const earlyStart = earliestStartById.get(task.id) ?? 0;
    const lateStart = latestStartById.get(task.id) ?? earlyStart;
    const totalFloat = Math.max(0, lateStart - earlyStart);
    const warnings = [...(warningsById.get(task.id) ?? [])];
    taskAnalysis[task.id] = {
      early_start_day: earlyStart,
      early_finish_day: earlyStart + duration,
      late_start_day: lateStart,
      late_finish_day: lateStart + duration,
      total_float_days: totalFloat,
      is_critical_path:
        totalFloat === 0 &&
        !warnings.includes("missing_dates") &&
        !warnings.includes("circular_dependency"),
      schedule_warnings: warnings,
    };
  }

  return {
    has_cycle: hasCycle,
    project_duration_days: projectDurationDays,
    tasks: taskAnalysis,
  };
}

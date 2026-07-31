import type { ConstraintType, ScheduleDependency, ScheduleTask, ScheduleTaskUpdate } from "@/types/scheduling";
import {
  addWorkingDays as addCalendarWorkingDays,
  defaultScheduleCalendar,
  workingDayDuration,
  type ScheduleCalendar,
} from "./schedule-calendar";

type PreviewReason =
  | "missing_dates"
  | "circular_dependency"
  | "invalid_anchor_set";

export interface AffectedScheduleTask {
  task_id: string;
  name: string;
  previous_start: string;
  next_start: string;
  previous_finish: string;
  next_finish: string;
}

export interface ConstraintConflict {
  task_id: string;
  constraint_type: Exclude<ConstraintType, "none">;
  constraint_date: string;
  calculated_date: string;
  message: string;
}

export type ScheduleImpactPreview =
  | { status: "available"; affected: AffectedScheduleTask[]; constraint_conflicts: ConstraintConflict[] }
  | { status: "unavailable"; reason: PreviewReason; affected: []; constraint_conflicts: [] };

interface CalculatedDates {
  start: Date;
  finish: Date;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addWorkingDays(value: Date, days: number, calendar: ScheduleCalendar): Date {
  return parseDate(addCalendarWorkingDays(formatDate(value), days, calendar))!;
}

function taskDuration(task: ScheduleTask, calendar: ScheduleCalendar): number | null {
  if (task.is_milestone) return 1;
  if (Number.isFinite(task.duration_days) && (task.duration_days ?? 0) > 0) return Math.round(task.duration_days ?? 1);
  const start = parseDate(task.start_date);
  const finish = parseDate(task.finish_date);
  return start && finish && finish >= start ? workingDayDuration(formatDate(start), formatDate(finish), calendar) : null;
}

function dateForFinish(start: Date, duration: number, calendar: ScheduleCalendar): Date {
  return addWorkingDays(start, Math.max(0, duration - 1), calendar);
}

function dateForStart(finish: Date, duration: number, calendar: ScheduleCalendar): Date {
  return addWorkingDays(finish, -Math.max(0, duration - 1), calendar);
}

function later(left: Date, right: Date): Date {
  return left > right ? left : right;
}

export function collectAffectedTaskIds(
  taskIds: string | readonly string[],
  dependencies: ScheduleDependency[],
): Set<string> {
  const successors = new Map<string, string[]>();
  for (const dependency of dependencies) {
    successors.set(dependency.predecessor_task_id, [...(successors.get(dependency.predecessor_task_id) ?? []), dependency.task_id]);
  }
  const anchors = typeof taskIds === "string" ? [taskIds] : [...new Set(taskIds)];
  const ids = new Set(anchors);
  const queue = [...anchors];
  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    for (const successor of successors.get(current) ?? []) {
      if (!ids.has(successor)) {
        ids.add(successor);
        queue.push(successor);
      }
    }
  }
  return ids;
}

function topologicalOrder(taskIds: Set<string>, dependencies: ScheduleDependency[]): string[] | null {
  const indegree = new Map([...taskIds].map((id) => [id, 0]));
  const successors = new Map<string, string[]>();
  for (const dependency of dependencies) {
    if (!taskIds.has(dependency.task_id) || !taskIds.has(dependency.predecessor_task_id)) continue;
    indegree.set(dependency.task_id, (indegree.get(dependency.task_id) ?? 0) + 1);
    successors.set(dependency.predecessor_task_id, [...(successors.get(dependency.predecessor_task_id) ?? []), dependency.task_id]);
  }
  const queue = [...taskIds].filter((id) => (indegree.get(id) ?? 0) === 0).sort();
  const ordered: string[] = [];
  while (queue.length) {
    const id = queue.shift();
    if (!id) continue;
    ordered.push(id);
    for (const successor of successors.get(id) ?? []) {
      const next = (indegree.get(successor) ?? 0) - 1;
      indegree.set(successor, next);
      if (next === 0) queue.push(successor);
    }
  }
  return ordered.length === taskIds.size ? ordered : null;
}

function dependencyStart(
  dependency: ScheduleDependency,
  predecessor: CalculatedDates,
  successorDuration: number,
  calendar: ScheduleCalendar,
): Date {
  const lag = dependency.lag_days;
  switch (dependency.dependency_type) {
    case "start_to_start":
      return addWorkingDays(predecessor.start, lag, calendar);
    case "finish_to_finish":
      return dateForStart(addWorkingDays(predecessor.finish, lag, calendar), successorDuration, calendar);
    case "start_to_finish":
      return dateForStart(addWorkingDays(predecessor.start, lag, calendar), successorDuration, calendar);
    case "finish_to_start":
    default:
      return addWorkingDays(predecessor.finish, lag + 1, calendar);
  }
}

function calculateDates(
  tasks: ScheduleTask[],
  dependencies: ScheduleDependency[],
  taskIds: string | readonly string[],
  calendar: ScheduleCalendar,
  fixedTaskIds: ReadonlySet<string> = new Set(),
  relevantTaskIds?: ReadonlySet<string>,
): { dates: Map<string, CalculatedDates>; reason?: PreviewReason } {
  const anchorIds = new Set(
    typeof taskIds === "string" ? [taskIds] : taskIds,
  );
  const relevantIds = new Set(
    relevantTaskIds ?? collectAffectedTaskIds(taskIds, dependencies),
  );
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const relevantTasks = [...relevantIds].map((id) => taskById.get(id));
  if (relevantTasks.some((task) => !task || !parseDate(task.start_date) || !parseDate(task.finish_date) || !taskDuration(task, calendar))) {
    return { dates: new Map(), reason: "missing_dates" };
  }
  const ordered = topologicalOrder(relevantIds, dependencies);
  if (!ordered) return { dates: new Map(), reason: "circular_dependency" };
  const incoming = new Map<string, ScheduleDependency[]>();
  for (const dependency of dependencies) {
    if (relevantIds.has(dependency.task_id)) {
      incoming.set(dependency.task_id, [...(incoming.get(dependency.task_id) ?? []), dependency]);
    }
  }
  const externalPredecessorIds = new Set(
    [...incoming.values()]
      .flat()
      .map((dependency) => dependency.predecessor_task_id)
      .filter((id) => !relevantIds.has(id)),
  );
  if (
    [...externalPredecessorIds].some((id) => {
      const predecessor = taskById.get(id);
      return (
        !predecessor ||
        !parseDate(predecessor.start_date) ||
        !parseDate(predecessor.finish_date)
      );
    })
  ) {
    return { dates: new Map(), reason: "missing_dates" };
  }

  const dates = new Map<string, CalculatedDates>();
  for (const id of ordered) {
    const task = taskById.get(id)!;
    if (fixedTaskIds.has(id) || anchorIds.has(id)) {
      dates.set(id, {
        start: parseDate(task.start_date)!,
        finish: parseDate(task.finish_date)!,
      });
      continue;
    }
    const duration = taskDuration(task, calendar)!;
    const taskDependencies = incoming.get(id) ?? [];
    let start = parseDate(task.start_date)!;
    let dependencyDrivenStart: Date | null = null;
    for (const dependency of taskDependencies) {
      const predecessorTask = taskById.get(dependency.predecessor_task_id);
      const externalStart = predecessorTask
        ? parseDate(predecessorTask.start_date)
        : null;
      const externalFinish = predecessorTask
        ? parseDate(predecessorTask.finish_date)
        : null;
      const predecessor =
        dates.get(dependency.predecessor_task_id) ??
        (externalStart && externalFinish
          ? {
              start: externalStart,
              finish: externalFinish,
            }
          : null);
      if (predecessor) {
        const candidate = dependencyStart(
          dependency,
          predecessor,
          duration,
          calendar,
        );
        dependencyDrivenStart = dependencyDrivenStart
          ? later(dependencyDrivenStart, candidate)
          : candidate;
      }
    }
    if (dependencyDrivenStart) start = dependencyDrivenStart;
    if (task.constraint_type === "start_no_earlier_than" && task.constraint_date) {
      const constraint = parseDate(task.constraint_date);
      if (constraint) start = later(start, constraint);
    }
    dates.set(id, { start, finish: dateForFinish(start, duration, calendar) });
  }
  return { dates };
}

function constraintConflicts(tasks: ScheduleTask[], dates: Map<string, CalculatedDates>): ConstraintConflict[] {
  return tasks.flatMap((task) => {
    const calculated = dates.get(task.id);
    const target = parseDate(task.constraint_date);
    if (!calculated || !target || !task.constraint_type || task.constraint_type === "none") return [];
    const actual = task.constraint_type.includes("start") ? calculated.start : calculated.finish;
    const violated =
      (task.constraint_type === "start_no_earlier_than" && actual < target) ||
      (task.constraint_type === "finish_no_later_than" && actual > target) ||
      (task.constraint_type === "must_start_on" && actual.getTime() !== target.getTime()) ||
      (task.constraint_type === "must_finish_on" && actual.getTime() !== target.getTime());
    if (!violated) return [];
    return [{
      task_id: task.id,
      constraint_type: task.constraint_type,
      constraint_date: formatDate(target),
      calculated_date: formatDate(actual),
      message: `${task.name} conflicts with its ${task.constraint_type.replaceAll("_", " ")} constraint.`,
    }];
  });
}

function diffCalculatedDates(
  excludeTaskId: string,
  tasksForConflictCheck: ScheduleTask[],
  baseline: ReturnType<typeof calculateDates>,
  preview: ReturnType<typeof calculateDates>,
): ScheduleImpactPreview {
  const reason = preview.reason ?? baseline.reason;
  if (reason) return { status: "unavailable", reason, affected: [], constraint_conflicts: [] };

  const affected = tasksForConflictCheck.flatMap((task): AffectedScheduleTask[] => {
    if (task.id === excludeTaskId) return [];
    const before = baseline.dates.get(task.id);
    const after = preview.dates.get(task.id);
    if (!before || !after || (before.start.getTime() === after.start.getTime() && before.finish.getTime() === after.finish.getTime())) return [];
    return [{
      task_id: task.id,
      name: task.name,
      previous_start: formatDate(before.start),
      next_start: formatDate(after.start),
      previous_finish: formatDate(before.finish),
      next_finish: formatDate(after.finish),
    }];
  });

  return { status: "available", affected, constraint_conflicts: constraintConflicts(tasksForConflictCheck, preview.dates) };
}

export function previewScheduleImpact({
  taskId,
  tasks,
  dependencies,
  update,
  calendar = defaultScheduleCalendar,
  fixedTaskIds = new Set(),
}: {
  taskId: string;
  tasks: ScheduleTask[];
  dependencies: ScheduleDependency[];
  update: Pick<
    ScheduleTaskUpdate,
    | "start_date"
    | "finish_date"
    | "duration_days"
    | "is_milestone"
    | "constraint_type"
    | "constraint_date"
  >;
  calendar?: ScheduleCalendar;
  fixedTaskIds?: ReadonlySet<string>;
}): ScheduleImpactPreview {
  const changedTasks = tasks.map((task) => task.id === taskId ? { ...task, ...update } : task);
  const baseline = calculateDates(tasks, dependencies, taskId, calendar, fixedTaskIds);
  const preview = calculateDates(changedTasks, dependencies, taskId, calendar, fixedTaskIds);
  return diffCalculatedDates(
    taskId,
    changedTasks.filter((task) => !fixedTaskIds.has(task.id)),
    baseline,
    preview,
  );
}

/**
 * Same date math as `previewScheduleImpact`, but for the other kind of change that
 * moves dates: the dependency GRAPH itself changing (a predecessor link created,
 * edited, or removed) rather than a task's own fields changing. The walk is anchored
 * at `predecessorTaskId` (its own position is unchanged; the edge to its successor is
 * what's new/changed/removed) and diffs `dependenciesBefore` against
 * `dependenciesAfter`.
 *
 * Unlike `previewScheduleImpact`, the two closures being compared can have different
 * membership — e.g. creating a brand-new dependency means the successor is reachable
 * from the predecessor only in the "after" graph, not "before". Where a task is
 * missing from one side's calculated-dates map, its own persisted start/finish stands
 * in for that side (it wasn't part of the affected chain yet, so its stored dates
 * *are* its correct position at that point).
 */
export function previewDependencyChangeImpact({
  predecessorTaskId,
  predecessorTaskIds,
  tasks,
  dependenciesBefore,
  dependenciesAfter,
  calendar = defaultScheduleCalendar,
  fixedTaskIds = new Set(),
}: {
  predecessorTaskId?: string;
  predecessorTaskIds?: readonly string[];
  tasks: ScheduleTask[];
  dependenciesBefore: ScheduleDependency[];
  dependenciesAfter: ScheduleDependency[];
  calendar?: ScheduleCalendar;
  fixedTaskIds?: ReadonlySet<string>;
}): ScheduleImpactPreview {
  const anchors = [
    ...new Set([
      ...(predecessorTaskIds ?? []),
      ...(predecessorTaskId ? [predecessorTaskId] : []),
    ]),
  ];
  if (anchors.length === 0) {
    return {
      status: "unavailable",
      reason: "invalid_anchor_set",
      affected: [],
      constraint_conflicts: [],
    };
  }
  const anchorIds = new Set(anchors);
  const relevantIds = new Set([
    ...collectAffectedTaskIds(anchors, dependenciesBefore),
    ...collectAffectedTaskIds(anchors, dependenciesAfter),
  ]);
  const baseline = calculateDates(
    tasks,
    dependenciesBefore,
    anchors,
    calendar,
    fixedTaskIds,
    relevantIds,
  );
  const preview = calculateDates(
    tasks,
    dependenciesAfter,
    anchors,
    calendar,
    fixedTaskIds,
    relevantIds,
  );
  const reason = preview.reason ?? baseline.reason;
  if (reason) return { status: "unavailable", reason, affected: [], constraint_conflicts: [] };

  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const rawDates = (task: ScheduleTask): CalculatedDates | null => {
    const start = parseDate(task.start_date);
    const finish = parseDate(task.finish_date);
    return start && finish ? { start, finish } : null;
  };
  const consideredIds = new Set([...baseline.dates.keys(), ...preview.dates.keys()]);

  const affected = [...consideredIds].flatMap((id): AffectedScheduleTask[] => {
    if (anchorIds.has(id) || fixedTaskIds.has(id)) return [];
    const task = taskById.get(id);
    if (!task) return [];
    const before = baseline.dates.get(id) ?? rawDates(task);
    const after = preview.dates.get(id) ?? rawDates(task);
    if (!before || !after || (before.start.getTime() === after.start.getTime() && before.finish.getTime() === after.finish.getTime())) return [];
    return [{
      task_id: id,
      name: task.name,
      previous_start: formatDate(before.start),
      next_start: formatDate(after.start),
      previous_finish: formatDate(before.finish),
      next_finish: formatDate(after.finish),
    }];
  });

  return {
    status: "available",
    affected,
    constraint_conflicts: constraintConflicts(
      tasks.filter((task) => !fixedTaskIds.has(task.id)),
      preview.dates,
    ),
  };
}

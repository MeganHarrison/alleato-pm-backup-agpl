import type { ScheduleDependency, ScheduleTask, ScheduleTaskUpdate } from "@/types/scheduling";
import {
  addWorkingDays,
  defaultScheduleCalendar,
  type ScheduleCalendar,
} from "./schedule-calendar";
import {
  collectAffectedTaskIds,
  previewDependencyChangeImpact,
  previewScheduleImpact,
  type ConstraintConflict,
  type ScheduleImpactPreview,
} from "./schedule-impact-preview";

export type AutoScheduleSkipReason = "manual_mode" | "actual_dates_set" | "has_segments";

export interface AutoScheduleUpdate {
  task_id: string;
  start_date: string;
  finish_date: string;
}

export interface AutoScheduleSkip {
  task_id: string;
  reason: AutoScheduleSkipReason;
}

export type AutoScheduleUnavailableReason =
  Extract<ScheduleImpactPreview, { status: "unavailable" }>["reason"];

export type AutoScheduleResult =
  | { status: "applied"; updates: AutoScheduleUpdate[]; skipped: AutoScheduleSkip[] }
  | { status: "no_change"; updates: []; skipped: AutoScheduleSkip[] }
  | { status: "blocked"; constraint_conflicts: ConstraintConflict[] }
  | {
      status: "unavailable";
      reason: AutoScheduleUnavailableReason;
      updates: [];
      skipped: [];
    };

function isExcludedFromAutoSchedule(task: ScheduleTask): AutoScheduleSkipReason | null {
  if (task.schedule_mode === "manual") return "manual_mode";
  if (task.actual_start_date || task.actual_finish_date) return "actual_dates_set";
  if (task.segments && task.segments.length > 0) return "has_segments";
  return null;
}

// Arbitrarily early — only ever used as a placeholder for a date a task doesn't
// actually have yet, so a real value (the anchor's own start, or a dependency-driven
// date) always wins the `later()` comparison in calculateDates, and so it always
// fails the same "in the past" checks a genuinely-missing date would.
const UNSCHEDULED_PLACEHOLDER_DATE = "1900-01-01";

function isValidScheduleDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * `calculateDates` (schedule-impact-preview.ts) requires every task in the affected
 * closure to have a parseable `start_date` AND `finish_date` before it will compute
 * anything, or it aborts the whole computation with `reason: "missing_dates"`.
 * That guard is stricter than the actual math needs: `finish_date` is never read by
 * the computation itself
 * (every task's finish is recomputed fresh as `dateForFinish(start, duration)`), and
 * a non-anchor task's `start_date` is only a fallback that a real dependency edge
 * always overrides via `later()` (every non-anchor task in the closure has at least
 * one incoming edge, by construction of `affectedTaskIds`). The anchor must provide
 * at least one endpoint; its other endpoint can be derived from duration.
 *
 * So: any task with a valid `duration_days` can have its missing date(s) seeded with
 * a deliberately-ancient placeholder purely to satisfy the guard. If the anchor has
 * neither endpoint, `missing_dates` remains the correct, honest result.
 *
 * Discovered live: a freshly created task typically has only a name + duration (no
 * start/finish yet) — exactly the state auto-scheduling exists to fill in — and even
 * an explicitly-dated predecessor commonly has only a start date, with finish left
 * for the app to derive. Both silently no-opped before this fix.
 */
function seedMissingDatesForCascade(
  tasks: ScheduleTask[],
  anchorTaskIds: string | readonly string[],
  calendar: ScheduleCalendar,
  seedableTaskIds: ReadonlySet<string>,
): ScheduleTask[] {
  const anchors = new Set(
    typeof anchorTaskIds === "string" ? [anchorTaskIds] : anchorTaskIds,
  );
  return tasks.map((task) => {
    if (task.start_date && task.finish_date) return task;
    const isAnchor = anchors.has(task.id);
    if (!isAnchor && !seedableTaskIds.has(task.id)) return task;
    if (!isAnchor && isExcludedFromAutoSchedule(task)) return task;
    const duration = task.is_milestone ? 1 : Math.round(task.duration_days ?? 0);
    if (!Number.isFinite(duration) || duration <= 0) return task;
    if (isAnchor && !task.start_date && !task.finish_date) return task;
    if (
      isAnchor &&
      ((task.start_date && !isValidScheduleDate(task.start_date)) ||
        (task.finish_date && !isValidScheduleDate(task.finish_date)))
    ) {
      return task;
    }
    const anchorStart =
      isAnchor && !task.start_date && task.finish_date
        ? addWorkingDays(task.finish_date, -Math.max(0, duration - 1), calendar)
        : task.start_date;
    const anchorFinish =
      isAnchor && !task.finish_date && anchorStart
        ? addWorkingDays(anchorStart, Math.max(0, duration - 1), calendar)
        : task.finish_date;
    return {
      ...task,
      start_date: anchorStart ?? UNSCHEDULED_PLACEHOLDER_DATE,
      finish_date: anchorFinish ?? UNSCHEDULED_PLACEHOLDER_DATE,
    };
  });
}

/**
 * Computes the successor date cascade for a task change (a new/edited/removed
 * dependency, or a date/duration edit on a task with no predecessors), reusing the
 * same graph math as `previewScheduleImpact` so the "what would change" preview and
 * the applied result can never disagree.
 *
 * Any constraint conflict in the affected set blocks the whole cascade (nothing is
 * written) rather than partially applying it — `previewScheduleImpact` computes dates
 * for the full transitive closure as if every task moved, so once one task's
 * calculated date is known to be invalid it is not safe to trust dates computed
 * downstream of it.
 *
 * Tasks excluded via `manual_mode`/`actual_dates_set`/`has_segments` are fixed
 * scheduling boundaries. They remain in the preview graph at their persisted dates,
 * so downstream tasks still respect their outgoing constraints while upstream changes
 * cannot move through them. When a protected task is itself the trigger/anchor, its
 * explicit update can still drive eligible successors.
 */
function resolveAutoScheduleResult(
  preview: ScheduleImpactPreview,
  tasks: ScheduleTask[],
  protectedPreview?: ScheduleImpactPreview,
): AutoScheduleResult {
  if (preview.status === "unavailable") {
    return {
      status: "unavailable",
      reason: preview.reason,
      updates: [],
      skipped: [],
    };
  }
  if (preview.constraint_conflicts.length > 0) {
    return { status: "blocked", constraint_conflicts: preview.constraint_conflicts };
  }

  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const updates: AutoScheduleUpdate[] = [];
  const skipped: AutoScheduleSkip[] = [];

  for (const affected of protectedPreview?.status === "available" ? protectedPreview.affected : []) {
    const task = taskById.get(affected.task_id);
    if (!task) continue;
    const skipReason = isExcludedFromAutoSchedule(task);
    if (skipReason) {
      skipped.push({ task_id: affected.task_id, reason: skipReason });
    }
  }

  for (const affected of preview.affected) {
    const task = taskById.get(affected.task_id);
    if (!task) continue;
    updates.push({
      task_id: affected.task_id,
      start_date: affected.next_start,
      finish_date: affected.next_finish,
    });
  }

  return updates.length > 0
    ? { status: "applied", updates, skipped }
    : { status: "no_change", updates: [], skipped };
}

function protectedTaskBoundaries(
  tasks: ScheduleTask[],
  anchorTaskIds: string | readonly string[],
): ReadonlySet<string> {
  const anchors = new Set(
    typeof anchorTaskIds === "string" ? [anchorTaskIds] : anchorTaskIds,
  );
  return new Set(
    tasks
      .filter((task) => !anchors.has(task.id) && isExcludedFromAutoSchedule(task))
      .map((task) => task.id),
  );
}

export function computeAutoScheduleUpdates({
  taskId,
  tasks,
  dependencies,
  update,
  calendar = defaultScheduleCalendar,
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
}): AutoScheduleResult {
  const currentTask = tasks.find((task) => task.id === taskId);
  const updatedTask = currentTask ? { ...currentTask, ...update } : null;
  const incomingDependencies = dependencies.filter(
    (dependency) => dependency.task_id === taskId,
  );
  const wasFullyUndated =
    currentTask !== undefined &&
    !currentTask.start_date &&
    !currentTask.finish_date;
  const hasDraftDuration =
    updatedTask !== null &&
    (updatedTask.is_milestone ||
      (Number.isFinite(updatedTask.duration_days) &&
        (updatedTask.duration_days ?? 0) > 0));

  if (
    wasFullyUndated &&
    updatedTask &&
    !updatedTask.start_date &&
    !updatedTask.finish_date &&
    hasDraftDuration
  ) {
    if (
      incomingDependencies.length === 0 ||
      isExcludedFromAutoSchedule(updatedTask)
    ) {
      return { status: "no_change", updates: [], skipped: [] };
    }

    const tasksWithDraft = tasks.map((task) =>
      task.id === taskId ? updatedTask : task,
    );
    const incomingDependencyIds = new Set(
      incomingDependencies.map((dependency) => dependency.id),
    );
    return computeAutoScheduleUpdatesForDependencyReassignment({
      predecessorTaskIds: incomingDependencies.map(
        (dependency) => dependency.predecessor_task_id,
      ),
      tasks: tasksWithDraft,
      dependenciesBefore: dependencies.filter(
        (dependency) => !incomingDependencyIds.has(dependency.id),
      ),
      dependenciesAfter: dependencies,
      calendar,
    });
  }

  const seededTasks = seedMissingDatesForCascade(
    tasks,
    taskId,
    calendar,
    collectAffectedTaskIds(taskId, dependencies),
  );
  const protectedPreview = previewScheduleImpact({
    taskId,
    tasks: seededTasks,
    dependencies,
    update,
    calendar,
  });
  const preview = previewScheduleImpact({
    taskId,
    tasks: seededTasks,
    dependencies,
    update,
    calendar,
    fixedTaskIds: protectedTaskBoundaries(tasks, taskId),
  });
  return resolveAutoScheduleResult(preview, tasks, protectedPreview);
}

export function previewAutoScheduleUpdates({
  taskId,
  tasks,
  dependencies,
  update,
  calendar = defaultScheduleCalendar,
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
}): ScheduleImpactPreview {
  const result = computeAutoScheduleUpdates({
    taskId,
    tasks,
    dependencies,
    update,
    calendar,
  });

  if (result.status === "unavailable") {
    return {
      status: "unavailable",
      reason: result.reason,
      affected: [],
      constraint_conflicts: [],
    };
  }
  if (result.status === "blocked") {
    return {
      status: "available",
      affected: [],
      constraint_conflicts: result.constraint_conflicts,
    };
  }

  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  return {
    status: "available",
    affected: result.updates.map((scheduledTask) => {
      const task = tasksById.get(scheduledTask.task_id);
      return {
        task_id: scheduledTask.task_id,
        name: task?.name ?? "Schedule task",
        previous_start: task?.start_date ?? "Unscheduled",
        next_start: scheduledTask.start_date,
        previous_finish: task?.finish_date ?? "Unscheduled",
        next_finish: scheduledTask.finish_date,
      };
    }),
    constraint_conflicts: [],
  };
}

/**
 * Same as `computeAutoScheduleUpdates`, but for the dependency-graph-changed trigger
 * (a predecessor link created, edited, or removed) instead of a task-field edit —
 * see `previewDependencyChangeImpact`. Anchored at `predecessorTaskId`, not the
 * successor: the predecessor's own position is unchanged, but the new/changed/
 * removed edge to its successor is what ripples forward.
 */
export function computeAutoScheduleUpdatesForDependencyChange({
  predecessorTaskId,
  tasks,
  dependenciesBefore,
  dependenciesAfter,
  calendar = defaultScheduleCalendar,
}: {
  predecessorTaskId: string;
  tasks: ScheduleTask[];
  dependenciesBefore: ScheduleDependency[];
  dependenciesAfter: ScheduleDependency[];
  calendar?: ScheduleCalendar;
}): AutoScheduleResult {
  const seededTasks = seedMissingDatesForCascade(
    tasks,
    predecessorTaskId,
    calendar,
    new Set([
      ...collectAffectedTaskIds(predecessorTaskId, dependenciesBefore),
      ...collectAffectedTaskIds(predecessorTaskId, dependenciesAfter),
    ]),
  );
  const protectedPreview = previewDependencyChangeImpact({
    predecessorTaskId,
    tasks: seededTasks,
    dependenciesBefore,
    dependenciesAfter,
    calendar,
  });
  const preview = previewDependencyChangeImpact({
    predecessorTaskId,
    tasks: seededTasks,
    dependenciesBefore,
    dependenciesAfter,
    calendar,
    fixedTaskIds: protectedTaskBoundaries(tasks, predecessorTaskId),
  });
  return resolveAutoScheduleResult(preview, tasks, protectedPreview);
}

/**
 * Reconciles a dependency edit that changes predecessor ownership against both
 * the removed and added anchor in one graph calculation. A union closure is
 * required because either side can have independent downstream work, and all
 * incoming relationships to their shared successor must participate together.
 */
export function computeAutoScheduleUpdatesForDependencyReassignment({
  predecessorTaskIds,
  tasks,
  dependenciesBefore,
  dependenciesAfter,
  calendar = defaultScheduleCalendar,
}: {
  predecessorTaskIds: readonly string[];
  tasks: ScheduleTask[];
  dependenciesBefore: ScheduleDependency[];
  dependenciesAfter: ScheduleDependency[];
  calendar?: ScheduleCalendar;
}): AutoScheduleResult {
  const anchors = [...new Set(predecessorTaskIds)];
  const seededTasks = seedMissingDatesForCascade(
    tasks,
    anchors,
    calendar,
    new Set([
      ...collectAffectedTaskIds(anchors, dependenciesBefore),
      ...collectAffectedTaskIds(anchors, dependenciesAfter),
    ]),
  );
  const protectedPreview = previewDependencyChangeImpact({
    predecessorTaskIds: anchors,
    tasks: seededTasks,
    dependenciesBefore,
    dependenciesAfter,
    calendar,
  });
  const preview = previewDependencyChangeImpact({
    predecessorTaskIds: anchors,
    tasks: seededTasks,
    dependenciesBefore,
    dependenciesAfter,
    calendar,
    fixedTaskIds: protectedTaskBoundaries(tasks, anchors),
  });
  return resolveAutoScheduleResult(preview, tasks, protectedPreview);
}

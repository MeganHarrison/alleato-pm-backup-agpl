import type { ScheduleDependency, ScheduleTask, ScheduleTaskUpdate } from "@/types/scheduling";
import { defaultScheduleCalendar, type ScheduleCalendar } from "./schedule-calendar";
import {
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

export type AutoScheduleResult =
  | { status: "applied"; updates: AutoScheduleUpdate[]; skipped: AutoScheduleSkip[] }
  | { status: "no_change"; updates: []; skipped: AutoScheduleSkip[] }
  | { status: "blocked"; constraint_conflicts: ConstraintConflict[] };

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

/**
 * `calculateDates` (schedule-impact-preview.ts) requires every task in the affected
 * closure to have a parseable `start_date` AND `finish_date` before it will compute
 * anything, or it aborts the whole computation with `reason: "missing_dates"` — which
 * `resolveAutoScheduleResult` below treats as a silent no-op. That guard is stricter
 * than the actual math needs: `finish_date` is never read by the computation itself
 * (every task's finish is recomputed fresh as `dateForFinish(start, duration)`), and
 * a non-anchor task's `start_date` is only a fallback that a real dependency edge
 * always overrides via `later()` (every non-anchor task in the closure has at least
 * one incoming edge, by construction of `affectedTaskIds`). The only date that must
 * be real is the ANCHOR's own `start_date` — that's the one fixed point nothing can
 * derive for it.
 *
 * So: any task with a valid `duration_days` can have its missing date(s) seeded with
 * a deliberately-ancient placeholder purely to satisfy the guard, EXCEPT the anchor's
 * `start_date` — if that's missing there is genuinely nothing to cascade from, and
 * `missing_dates` remains the correct, honest result.
 *
 * Discovered live: a freshly created task typically has only a name + duration (no
 * start/finish yet) — exactly the state auto-scheduling exists to fill in — and even
 * an explicitly-dated predecessor commonly has only a start date, with finish left
 * for the app to derive. Both silently no-opped before this fix.
 */
function seedMissingDatesForCascade(tasks: ScheduleTask[], anchorTaskId: string): ScheduleTask[] {
  return tasks.map((task) => {
    if (task.start_date && task.finish_date) return task;
    if (!Number.isFinite(task.duration_days) || (task.duration_days ?? 0) <= 0) return task;
    if (task.id === anchorTaskId && !task.start_date) return task;
    return {
      ...task,
      start_date: task.start_date ?? UNSCHEDULED_PLACEHOLDER_DATE,
      finish_date: task.finish_date ?? UNSCHEDULED_PLACEHOLDER_DATE,
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
 * Known limitation: a task excluded via `manual_mode`/`actual_dates_set`/
 * `has_segments` is never written, but any of its OWN successors are still computed
 * assuming it moved (since that exclusion is not known to `previewScheduleImpact`).
 * In practice this only matters for a successor of an excluded task that is itself
 * eligible for auto-scheduling — a rare multi-hop case. Flagged for follow-up rather
 * than solved here.
 */
function resolveAutoScheduleResult(preview: ScheduleImpactPreview, tasks: ScheduleTask[]): AutoScheduleResult {
  if (preview.status === "unavailable") {
    return { status: "no_change", updates: [], skipped: [] };
  }
  if (preview.constraint_conflicts.length > 0) {
    return { status: "blocked", constraint_conflicts: preview.constraint_conflicts };
  }

  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const updates: AutoScheduleUpdate[] = [];
  const skipped: AutoScheduleSkip[] = [];

  for (const affected of preview.affected) {
    const task = taskById.get(affected.task_id);
    if (!task) continue;
    const skipReason = isExcludedFromAutoSchedule(task);
    if (skipReason) {
      skipped.push({ task_id: affected.task_id, reason: skipReason });
      continue;
    }
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
  update: Pick<ScheduleTaskUpdate, "start_date" | "finish_date" | "duration_days" | "constraint_type" | "constraint_date">;
  calendar?: ScheduleCalendar;
}): AutoScheduleResult {
  const seededTasks = seedMissingDatesForCascade(tasks, taskId);
  const preview = previewScheduleImpact({ taskId, tasks: seededTasks, dependencies, update, calendar });
  return resolveAutoScheduleResult(preview, tasks);
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
  const seededTasks = seedMissingDatesForCascade(tasks, predecessorTaskId);
  const preview = previewDependencyChangeImpact({
    predecessorTaskId,
    tasks: seededTasks,
    dependenciesBefore,
    dependenciesAfter,
    calendar,
  });
  return resolveAutoScheduleResult(preview, tasks);
}

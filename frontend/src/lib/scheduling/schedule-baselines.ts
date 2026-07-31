import { workingDayDelta, type ScheduleCalendar } from "./schedule-calendar";
import type { GanttChartItem } from "@/types/scheduling";

export type ScheduleBaseline = {
  id: string;
  project_id: number;
  revision_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  activated_at: string | null;
};

export type BaselineTaskSnapshot = {
  source_task_id: string;
  name: string;
  start_date: string | null;
  finish_date: string | null;
  duration_days: number | null;
};

export type CurrentScheduleTask = BaselineTaskSnapshot & {
  actual_start_date?: string | null;
  actual_finish_date?: string | null;
  forecast_start_date?: string | null;
  forecast_finish_date?: string | null;
};

export type ScheduleBaselineComparisonTask = {
  source_task_id: string;
  name: string;
  comparison_status: "unchanged" | "changed" | "added" | "removed";
  baseline_start_date: string | null;
  baseline_finish_date: string | null;
  baseline_duration_days: number | null;
  current_start_date: string | null;
  current_finish_date: string | null;
  current_duration_days: number | null;
  start_variance_days: number | null;
  finish_variance_days: number | null;
  duration_variance_days: number | null;
};

export type ScheduleBaselineComparison = {
  baseline: ScheduleBaseline;
  provenance: "captured" | "reconstructed";
  target: { type: "live" | "revision"; revision_id: string | null };
  tasks: ScheduleBaselineComparisonTask[];
};

function effectiveStart(task: CurrentScheduleTask): string | null {
  return task.actual_start_date ?? task.forecast_start_date ?? task.start_date;
}

function effectiveFinish(task: CurrentScheduleTask): string | null {
  return task.actual_finish_date ?? task.forecast_finish_date ?? task.finish_date;
}

function dateVariance(
  baselineDate: string | null,
  currentDate: string | null,
  calendar: ScheduleCalendar,
): number | null {
  return baselineDate && currentDate ? workingDayDelta(baselineDate, currentDate, calendar) : null;
}

function durationVariance(baselineDuration: number | null, currentDuration: number | null): number | null {
  return baselineDuration !== null && currentDuration !== null
    ? currentDuration - baselineDuration
    : null;
}

export function compareScheduleBaselineTasks(
  baselineTasks: BaselineTaskSnapshot[],
  currentTasks: CurrentScheduleTask[],
  calendar: ScheduleCalendar,
): ScheduleBaselineComparisonTask[] {
  const baselineById = new Map(baselineTasks.map((task) => [task.source_task_id, task]));
  const currentById = new Map(currentTasks.map((task) => [task.source_task_id, task]));
  const orderedIds = [
    ...baselineTasks.map((task) => task.source_task_id),
    ...currentTasks.filter((task) => !baselineById.has(task.source_task_id)).map((task) => task.source_task_id),
  ];

  return orderedIds.map((sourceTaskId) => {
    const baseline = baselineById.get(sourceTaskId);
    const current = currentById.get(sourceTaskId);
    if (!baseline && current) {
      return {
        source_task_id: sourceTaskId,
        name: current.name,
        comparison_status: "added" as const,
        baseline_start_date: null,
        baseline_finish_date: null,
        baseline_duration_days: null,
        current_start_date: effectiveStart(current),
        current_finish_date: effectiveFinish(current),
        current_duration_days: current.duration_days,
        start_variance_days: null,
        finish_variance_days: null,
        duration_variance_days: null,
      };
    }
    if (baseline && !current) {
      return {
        source_task_id: sourceTaskId,
        name: baseline.name,
        comparison_status: "removed" as const,
        baseline_start_date: baseline.start_date,
        baseline_finish_date: baseline.finish_date,
        baseline_duration_days: baseline.duration_days,
        current_start_date: null,
        current_finish_date: null,
        current_duration_days: null,
        start_variance_days: null,
        finish_variance_days: null,
        duration_variance_days: null,
      };
    }

    const baselineTask = baseline!;
    const currentTask = current!;
    const currentStart = effectiveStart(currentTask);
    const currentFinish = effectiveFinish(currentTask);
    const startVariance = dateVariance(baselineTask.start_date, currentStart, calendar);
    const finishVariance = dateVariance(baselineTask.finish_date, currentFinish, calendar);
    const durationDelta = durationVariance(baselineTask.duration_days, currentTask.duration_days);
    const changed = baselineTask.name !== currentTask.name
      || baselineTask.start_date !== currentStart
      || baselineTask.finish_date !== currentFinish
      || baselineTask.duration_days !== currentTask.duration_days;
    return {
      source_task_id: sourceTaskId,
      name: currentTask.name,
      comparison_status: changed ? "changed" : "unchanged",
      baseline_start_date: baselineTask.start_date,
      baseline_finish_date: baselineTask.finish_date,
      baseline_duration_days: baselineTask.duration_days,
      current_start_date: currentStart,
      current_finish_date: currentFinish,
      current_duration_days: currentTask.duration_days,
      start_variance_days: startVariance,
      finish_variance_days: finishVariance,
      duration_variance_days: durationDelta,
    };
  });
}

/** Adds comparison-only fields without mutating the live authoring payload. */
export function applyScheduleBaselineComparisonToGantt(
  items: GanttChartItem[],
  comparisons: ScheduleBaselineComparisonTask[],
  trackingEnabled: boolean,
): GanttChartItem[] {
  const comparisonByTaskId = new Map(comparisons.map((comparison) => [comparison.source_task_id, comparison]));
  return items.map((item) => {
    const comparison = comparisonByTaskId.get(item.id);
    if (!comparison) return item;
    return {
      ...item,
      start_date: trackingEnabled && comparison.current_start_date ? comparison.current_start_date : item.start_date,
      finish_date: trackingEnabled && comparison.current_finish_date ? comparison.current_finish_date : item.finish_date,
      duration_days: trackingEnabled && comparison.current_duration_days !== null ? comparison.current_duration_days : item.duration_days,
      baseline_start_date: comparison.baseline_start_date,
      baseline_finish_date: comparison.baseline_finish_date,
      baseline_duration_days: comparison.baseline_duration_days,
      start_variance_days: comparison.start_variance_days,
      finish_variance_days: comparison.finish_variance_days,
      duration_variance_days: comparison.duration_variance_days,
      comparison_status: comparison.comparison_status,
    };
  });
}

import type { ScheduleDependency } from "@/types/scheduling";
import {
  addWorkingDays,
  isWorkingDay,
  workingDayDelta,
  workingDayDuration,
  type ScheduleCalendar,
} from "./schedule-calendar";

const DAY_MS = 86_400_000;

export interface SchedulePlacementDates {
  start: string;
  finish: string;
}

export function parseScheduleDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
    ? parsed
    : null;
}

export function formatScheduleDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function addScheduleCalendarDays(value: string, days: number): string | null {
  const parsed = parseScheduleDate(value);
  if (!parsed || !Number.isSafeInteger(days)) return null;
  return formatScheduleDate(new Date(parsed.getTime() + days * DAY_MS));
}

export function workingDateAtOrAfter(value: string, calendar: ScheduleCalendar): string | null {
  if (!parseScheduleDate(value)) return null;
  if (isWorkingDay(value, calendar)) return value;
  let cursor = value;
  do {
    cursor = addScheduleCalendarDays(cursor, 1)!;
  } while (!isWorkingDay(cursor, calendar));
  return cursor;
}

export function workingDateAtOrBefore(value: string, calendar: ScheduleCalendar): string | null {
  if (!parseScheduleDate(value)) return null;
  if (isWorkingDay(value, calendar)) return value;
  let cursor = value;
  do {
    cursor = addScheduleCalendarDays(cursor, -1)!;
  } while (!isWorkingDay(cursor, calendar));
  return cursor;
}

export function placementFromStart(
  start: string,
  duration: number,
  calendar: ScheduleCalendar,
): SchedulePlacementDates | null {
  const workingStart = workingDateAtOrAfter(start, calendar);
  if (!workingStart || !Number.isSafeInteger(duration) || duration < 1) return null;
  return {
    start: workingStart,
    finish: addWorkingDays(workingStart, duration - 1, calendar),
  };
}

export function placementFromFinish(
  finish: string,
  duration: number,
  calendar: ScheduleCalendar,
): SchedulePlacementDates | null {
  const workingFinish = workingDateAtOrBefore(finish, calendar);
  if (!workingFinish || !Number.isSafeInteger(duration) || duration < 1) return null;
  return {
    start: addWorkingDays(workingFinish, -(duration - 1), calendar),
    finish: workingFinish,
  };
}

export function effectiveTaskDates(task: {
  start_date: string | null;
  finish_date: string | null;
  forecast_start_date?: string | null;
  forecast_finish_date?: string | null;
}): SchedulePlacementDates | null {
  const start = task.forecast_start_date ?? task.start_date;
  const finish = task.forecast_finish_date ?? task.finish_date;
  if (!parseScheduleDate(start) || !parseScheduleDate(finish) || start! > finish!) return null;
  return { start: start!, finish: finish! };
}

export function effectiveTaskDuration(
  task: Parameters<typeof effectiveTaskDates>[0],
  calendar: ScheduleCalendar,
): number | null {
  const dates = effectiveTaskDates(task);
  if (!dates) return null;
  try {
    return workingDayDuration(dates.start, dates.finish, calendar);
  } catch {
    return null;
  }
}

/** Returns every project working date in an inclusive placement span. */
export function placementWorkingDates(
  placement: SchedulePlacementDates,
  calendar: ScheduleCalendar,
): string[] {
  const duration = workingDayDuration(placement.start, placement.finish, calendar);
  const first = workingDateAtOrAfter(placement.start, calendar);
  if (!first || first > placement.finish) return [];
  return Array.from({ length: duration }, (_, index) => addWorkingDays(first, index, calendar))
    .filter((date) => date <= placement.finish);
}

export function scheduleWorkingDayDelay(
  previousStart: string,
  proposedStart: string,
  calendar: ScheduleCalendar,
): number {
  return Math.max(0, workingDayDelta(previousStart, proposedStart, calendar));
}

/**
 * Calculates the minimum successor start for all supported dependency kinds.
 * The predecessor placement and returned successor placement are working dates.
 */
export function dependencyMinimumStart(
  dependency: Pick<ScheduleDependency, "dependency_type" | "lag_days">,
  predecessor: SchedulePlacementDates,
  successorDuration: number,
  calendar: ScheduleCalendar,
): string | null {
  if (!Number.isSafeInteger(dependency.lag_days)) return null;
  switch (dependency.dependency_type) {
    case "start_to_start":
      return addWorkingDays(predecessor.start, dependency.lag_days, calendar);
    case "finish_to_finish":
      return placementFromFinish(
        addWorkingDays(predecessor.finish, dependency.lag_days, calendar),
        successorDuration,
        calendar,
      )?.start ?? null;
    case "start_to_finish":
      return placementFromFinish(
        addWorkingDays(predecessor.start, dependency.lag_days, calendar),
        successorDuration,
        calendar,
      )?.start ?? null;
    case "finish_to_start":
      return addWorkingDays(predecessor.finish, dependency.lag_days + 1, calendar);
  }
}

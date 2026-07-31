export interface ScheduleCalendarException {
  date: string;
  is_working: boolean;
  reason?: string;
}

export interface ScheduleCalendar {
  working_weekdays: number[];
  non_working_dates: string[];
  working_date_overrides?: string[];
  exceptions?: ScheduleCalendarException[];
  timezone_name?: string;
}

export const defaultScheduleCalendar: ScheduleCalendar = {
  working_weekdays: [1, 2, 3, 4, 5],
  non_working_dates: [],
  exceptions: [],
  timezone_name: "America/Indiana/Indianapolis",
};

const DAY_MS = 86_400_000;

export function formatLocalScheduleDate(value: Date = new Date()): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid schedule date: ${value}`);
  const [year, month, day] = value.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day));
  if (result.getUTCFullYear() !== year || result.getUTCMonth() !== month - 1 || result.getUTCDate() !== day) {
    throw new Error(`Invalid schedule date: ${value}`);
  }
  return result;
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addCalendarDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MS);
}

export function isWorkingDay(value: string, calendar: ScheduleCalendar = defaultScheduleCalendar): boolean {
  const date = parseDate(value);
  if (calendar.working_date_overrides?.includes(value)) return true;
  return calendar.working_weekdays.includes(date.getUTCDay()) && !calendar.non_working_dates.includes(value);
}

export function addWorkingDays(value: string, days: number, calendar: ScheduleCalendar = defaultScheduleCalendar): string {
  let cursor = parseDate(value);
  const direction = Math.sign(days);
  let remaining = Math.abs(days);
  while (remaining > 0) {
    cursor = addCalendarDays(cursor, direction);
    if (isWorkingDay(formatDate(cursor), calendar)) remaining -= 1;
  }
  return formatDate(cursor);
}

export function workingDayDuration(start: string, finish: string, calendar: ScheduleCalendar = defaultScheduleCalendar): number {
  let cursor = parseDate(start);
  const end = parseDate(finish);
  if (cursor > end) throw new Error("Schedule finish must not be before its start.");
  let count = 0;
  while (cursor <= end) {
    if (isWorkingDay(formatDate(cursor), calendar)) count += 1;
    cursor = addCalendarDays(cursor, 1);
  }
  return Math.max(1, count);
}

/**
 * Returns signed schedule movement in project working days. The origin day is
 * excluded and the destination day is included, so it is the inverse of
 * addWorkingDays for dates that land on a working day.
 */
export function workingDayDelta(
  from: string,
  to: string,
  calendar: ScheduleCalendar = defaultScheduleCalendar,
): number {
  const origin = parseDate(from);
  const destination = parseDate(to);
  if (origin.getTime() === destination.getTime()) return 0;
  if (origin > destination) {
    const reverseDelta = workingDayDelta(to, from, calendar);
    return reverseDelta === 0 ? 0 : -reverseDelta;
  }

  let cursor = origin;
  let count = 0;
  while (cursor.getTime() !== destination.getTime()) {
    cursor = addCalendarDays(cursor, 1);
    if (isWorkingDay(formatDate(cursor), calendar)) count += 1;
  }
  return count;
}

import {
  isWorkingDay,
  type ScheduleCalendar,
} from "@/lib/scheduling/schedule-calendar";

const DEFAULT_SLOT_MINUTES = 15;
const MINUTES_PER_DAY = 1_440;

export type SegmentLockReason = "fixed" | "progressed" | null;

export interface WeeklyWorkIntervalInput {
  weekday: number;
  start_minute: number;
  end_minute: number;
  capacity_percent: number;
}

export interface WeeklyWorkInterval extends WeeklyWorkIntervalInput {}

export interface TaskScheduleSegment {
  id: string;
  task_id: string;
  segment_index: number;
  starts_at: string;
  ends_at: string;
  planned_minutes: number;
  lock_reason: SegmentLockReason;
}

export interface EnterpriseBusySource {
  project_id: number | null;
  task_id: string | null;
  project_name: string | null;
  task_name: string | null;
  redacted: boolean;
}

export interface EnterpriseCapacitySlot {
  person_id: string;
  starts_at: string;
  ends_at: string;
  capacity_minutes: number;
  occupied_minutes: number;
  available_minutes: number;
  busy_sources: EnterpriseBusySource[];
}

export interface ProjectWorkingSlot {
  starts_at: string;
  ends_at: string;
}

export interface EnterpriseReservation {
  person_id: string;
  project_id: number | null;
  task_id: string | null;
  project_name: string | null;
  task_name: string | null;
  redacted?: boolean;
  starts_at: string;
  ends_at: string;
  allocation_percent: number;
}

export interface PersonWorkCalendarInput {
  person_id: string;
  calendar_id?: string | null;
  timezone_name: string;
  slot_minutes: number;
  weekly_intervals: WeeklyWorkInterval[];
  date_intervals: Array<{
    local_date: string;
    start_minute: number;
    end_minute: number;
    capacity_percent: number;
  }>;
}

export interface HourlyLevelingTask {
  task_id: string;
  task_name: string;
  earliest_start_at: string;
  current_start_at?: string | null;
  current_finish_at?: string | null;
  latest_finish_at?: string | null;
  work_minutes: number;
  allow_split: boolean;
  fixed: boolean;
  leveling_priority?: number;
  predecessors?: Array<{
    task_id: string;
    dependency_type:
      | "finish_to_start"
      | "start_to_start"
      | "finish_to_finish"
      | "start_to_finish";
    lag_minutes: number;
    current_start_at: string;
    current_finish_at: string;
  }>;
  assignments: Array<{
    person_id: string;
    allocation_percent: number;
  }>;
}

export interface HourlyLevelingProposal {
  task_id: string;
  task_name: string;
  previous_start_at: string | null;
  previous_finish_at: string | null;
  segments: TaskScheduleSegment[];
}

export interface HourlyLevelingDiagnostic {
  code:
    | "fixed_task"
    | "invalid_task"
    | "no_capacity"
    | "dependency_cycle"
    | "constraint_blocked";
  task_id: string;
  message: string;
}

export interface HourlyLevelingResult {
  proposals: HourlyLevelingProposal[];
  diagnostics: HourlyLevelingDiagnostic[];
}

function requireInteger(value: number, message: string): void {
  if (!Number.isSafeInteger(value)) throw new Error(message);
}

function requirePercent(value: number): void {
  requireInteger(value, "Capacity percent must be a whole number");
  if (value < 0 || value > 100)
    throw new Error("Capacity percent must be between 0 and 100");
}

function nextWeekday(weekday: number): number {
  return (weekday + 1) % 7;
}

/**
 * Converts a caller-friendly overnight interval into the same-day rows used by
 * the database. The database never stores start > finish, which keeps overlap
 * constraints and DST-aware expansion deterministic.
 */
export function normalizeWeeklyWorkIntervals(
  intervals: WeeklyWorkIntervalInput[],
): WeeklyWorkInterval[] {
  const normalized: WeeklyWorkInterval[] = [];
  for (const interval of intervals) {
    requireInteger(interval.weekday, "Weekday must be a whole number");
    if (interval.weekday < 0 || interval.weekday > 6)
      throw new Error("Weekday must be between 0 and 6");
    requireInteger(interval.start_minute, "Shift start must be a whole minute");
    requireInteger(interval.end_minute, "Shift finish must be a whole minute");
    requirePercent(interval.capacity_percent);
    if (
      interval.start_minute < 0 ||
      interval.start_minute >= MINUTES_PER_DAY ||
      interval.end_minute < 0 ||
      interval.end_minute > MINUTES_PER_DAY ||
      interval.start_minute === interval.end_minute
    ) {
      throw new Error(
        "Shift minutes must define a non-zero interval inside one day",
      );
    }

    if (interval.end_minute > interval.start_minute) {
      normalized.push({ ...interval });
      continue;
    }

    normalized.push({
      weekday: interval.weekday,
      start_minute: interval.start_minute,
      end_minute: MINUTES_PER_DAY,
      capacity_percent: interval.capacity_percent,
    });
    if (interval.end_minute > 0) {
      normalized.push({
        weekday: nextWeekday(interval.weekday),
        start_minute: 0,
        end_minute: interval.end_minute,
        capacity_percent: interval.capacity_percent,
      });
    }
  }

  return normalized.sort(
    (left, right) =>
      left.weekday - right.weekday ||
      left.start_minute - right.start_minute ||
      left.end_minute - right.end_minute ||
      left.capacity_percent - right.capacity_percent,
  );
}

function parseTimestamp(value: string, label: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp))
    throw new Error(`${label} must be an ISO timestamp`);
  return timestamp;
}

export function validateTaskScheduleSegments(
  segments: TaskScheduleSegment[],
  slotMinutes = DEFAULT_SLOT_MINUTES,
): TaskScheduleSegment[] {
  requireInteger(slotMinutes, "Slot size must be a whole number of minutes");
  if (slotMinutes <= 0 || MINUTES_PER_DAY % slotMinutes !== 0) {
    throw new Error("Slot size must divide one day evenly");
  }
  if (segments.length === 0) return [];

  const taskId = segments[0].task_id;
  const slotMilliseconds = slotMinutes * 60_000;
  let previousFinish = Number.NEGATIVE_INFINITY;
  const normalized = [...segments].sort(
    (left, right) => left.segment_index - right.segment_index,
  );

  normalized.forEach((segment, index) => {
    if (segment.task_id !== taskId)
      throw new Error("Task segments must belong to one task");
    if (segment.segment_index !== index)
      throw new Error("Task segment indexes must be contiguous from zero");
    const startsAt = parseTimestamp(segment.starts_at, "Segment start");
    const endsAt = parseTimestamp(segment.ends_at, "Segment finish");
    if (startsAt % slotMilliseconds !== 0 || endsAt % slotMilliseconds !== 0) {
      throw new Error(
        `Task segment boundaries must align to the ${slotMinutes}-minute grid`,
      );
    }
    if (endsAt <= startsAt)
      throw new Error("Task segments must have positive duration");
    if (startsAt < previousFinish)
      throw new Error("Task segments must not overlap");
    requireInteger(
      segment.planned_minutes,
      "Task segment work must be a whole number of minutes",
    );
    if (
      segment.planned_minutes <= 0 ||
      segment.planned_minutes % slotMinutes !== 0
    ) {
      throw new Error(
        `Task segment work must align to the ${slotMinutes}-minute grid`,
      );
    }
    if (
      segment.lock_reason !== null &&
      segment.lock_reason !== "fixed" &&
      segment.lock_reason !== "progressed"
    ) {
      throw new Error("Task segment lock reason is invalid");
    }
    previousFinish = endsAt;
  });

  return normalized;
}

function intervalsOverlap(
  leftStart: string,
  leftFinish: string,
  rightStart: string,
  rightFinish: string,
): boolean {
  return (
    parseTimestamp(leftStart, "Interval start") <
      parseTimestamp(rightFinish, "Interval finish") &&
    parseTimestamp(rightStart, "Interval start") <
      parseTimestamp(leftFinish, "Interval finish")
  );
}

function busySource(
  reservation: EnterpriseReservation,
  authorizedProjectIds: Set<number>,
): EnterpriseBusySource {
  if (
    reservation.redacted ||
    reservation.project_id === null ||
    !authorizedProjectIds.has(reservation.project_id)
  ) {
    return {
      project_id: null,
      task_id: null,
      project_name: null,
      task_name: null,
      redacted: true,
    };
  }
  return {
    project_id: reservation.project_id,
    task_id: reservation.task_id,
    project_name: reservation.project_name,
    task_name: reservation.task_name,
    redacted: false,
  };
}

export function localDateParts(
  timestamp: number,
  timezone: string,
): { date: string; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(new Date(timestamp));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    part("weekday"),
  );
  return { date: `${part("year")}-${part("month")}-${part("day")}`, weekday };
}

export function localDateTimeParts(
  timestamp: number,
  timezone: string,
): { date: string; weekday: number; minute: number } {
  const date = localDateParts(timestamp, timezone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const number = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);
  return { ...date, minute: number("hour") * 60 + number("minute") };
}

export function zonedLocalTimestamp(
  localDate: string,
  minute: number,
  timezone: string,
): number {
  const [year, month, day] = localDate.split("-").map(Number);
  const hour = Math.floor(minute / 60);
  const minutes = minute % 60;
  const target = Date.UTC(year, month - 1, day, hour, minutes);
  let estimate = target;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  for (let index = 0; index < 3; index += 1) {
    const parts = formatter.formatToParts(new Date(estimate));
    const number = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((item) => item.type === type)?.value);
    const represented = Date.UTC(
      number("year"),
      number("month") - 1,
      number("day"),
      number("hour"),
      number("minute"),
    );
    estimate += target - represented;
  }
  return estimate;
}

export function formatTimestampInTimezoneForInput(
  value: string,
  timezone: string,
): string {
  const timestamp = parseTimestamp(value, "Timestamp");
  const local = localDateTimeParts(timestamp, timezone);
  return `${local.date}T${String(Math.floor(local.minute / 60)).padStart(2, "0")}:${String(local.minute % 60).padStart(2, "0")}`;
}

export function timestampFromTimezoneInput(
  value: string,
  timezone: string,
): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Timestamp input is invalid");
  const minute = Number(match[2]) * 60 + Number(match[3]);
  if (Number(match[2]) > 23 || Number(match[3]) > 59)
    throw new Error("Timestamp input is invalid");
  const timestamp = zonedLocalTimestamp(match[1], minute, timezone);
  const roundTrip = localDateTimeParts(timestamp, timezone);
  if (roundTrip.date !== match[1] || roundTrip.minute !== minute)
    throw new Error("Timestamp does not exist in the project time zone");
  return new Date(timestamp).toISOString();
}

export function expandProjectWorkingCalendarSlots(input: {
  calendar: ScheduleCalendar;
  timezone_name: string;
  range_start: string;
  range_finish: string;
  slot_minutes?: number;
}): ProjectWorkingSlot[] {
  const start = parseTimestamp(input.range_start, "Project calendar range start");
  const finish = parseTimestamp(input.range_finish, "Project calendar range finish");
  if (finish <= start) throw new Error("Project calendar range must be ascending");
  const slotMinutes = input.slot_minutes ?? DEFAULT_SLOT_MINUTES;
  requireInteger(slotMinutes, "Project calendar slot size must be a whole number");
  if (slotMinutes <= 0 || MINUTES_PER_DAY % slotMinutes !== 0)
    throw new Error("Project calendar slot size must divide one day evenly");

  const localDates = new Set<string>();
  const dayStart = Math.floor(start / 86_400_000) * 86_400_000;
  for (
    let cursor = dayStart - 2 * 86_400_000;
    cursor <= finish + 2 * 86_400_000;
    cursor += 86_400_000
  ) {
    localDates.add(localDateParts(cursor + 43_200_000, input.timezone_name).date);
  }

  const slots: ProjectWorkingSlot[] = [];
  for (const date of [...localDates].sort()) {
    if (!isWorkingDay(date, input.calendar)) continue;
    for (const [intervalStart, intervalFinish] of [[480, 720], [780, 1020]]) {
      for (let minute = intervalStart; minute < intervalFinish; minute += slotMinutes) {
        const slotStart = zonedLocalTimestamp(date, minute, input.timezone_name);
        const slotFinish = zonedLocalTimestamp(date, minute + slotMinutes, input.timezone_name);
        if (
          slotStart >= start &&
          slotFinish <= finish &&
          slotFinish - slotStart === slotMinutes * 60_000
        ) {
          slots.push({
            starts_at: new Date(slotStart).toISOString(),
            ends_at: new Date(slotFinish).toISOString(),
          });
        }
      }
    }
  }
  return slots.sort((left, right) => left.starts_at.localeCompare(right.starts_at));
}

const DEFAULT_PERSON_WEEK: WeeklyWorkInterval[] = [1, 2, 3, 4, 5].flatMap(
  (weekday) => [
    { weekday, start_minute: 480, end_minute: 720, capacity_percent: 100 },
    { weekday, start_minute: 780, end_minute: 1020, capacity_percent: 100 },
  ],
);

/** Expands a person's local shift calendar into UTC 15-minute capacity slots. */
export function expandPersonWorkCalendarSlots(input: {
  calendar: PersonWorkCalendarInput;
  range_start: string;
  range_finish: string;
}): EnterpriseCapacitySlot[] {
  const start = parseTimestamp(input.range_start, "Capacity range start");
  const finish = parseTimestamp(input.range_finish, "Capacity range finish");
  if (finish <= start) throw new Error("Capacity range must be ascending");
  const slotMinutes = input.calendar.slot_minutes;
  requireInteger(slotMinutes, "Calendar slot size must be a whole number");
  if (slotMinutes !== DEFAULT_SLOT_MINUTES)
    throw new Error("Only 15-minute person calendars are supported");

  const localDates = new Map<string, number>();
  const dayStart = Math.floor(start / 86_400_000) * 86_400_000;
  for (
    let cursor = dayStart - 2 * 86_400_000;
    cursor <= finish + 2 * 86_400_000;
    cursor += 86_400_000
  ) {
    const local = localDateParts(
      cursor + 43_200_000,
      input.calendar.timezone_name,
    );
    localDates.set(local.date, local.weekday);
  }
  const weekly =
    input.calendar.calendar_id == null
      ? DEFAULT_PERSON_WEEK
      : input.calendar.weekly_intervals;
  const slots: EnterpriseCapacitySlot[] = [];
  for (const [date, weekday] of [...localDates].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const dated = input.calendar.date_intervals.filter(
      (interval) => interval.local_date === date,
    );
    const intervals =
      dated.length > 0
        ? dated
        : weekly.filter((interval) => interval.weekday === weekday);
    for (const interval of intervals) {
      requirePercent(interval.capacity_percent);
      for (
        let minute = interval.start_minute;
        minute < interval.end_minute;
        minute += slotMinutes
      ) {
        const slotStart = zonedLocalTimestamp(
          date,
          minute,
          input.calendar.timezone_name,
        );
        const slotFinish = zonedLocalTimestamp(
          date,
          minute + slotMinutes,
          input.calendar.timezone_name,
        );
        if (
          slotStart < start ||
          slotFinish > finish ||
          slotFinish - slotStart !== slotMinutes * 60_000
        )
          continue;
        slots.push({
          person_id: input.calendar.person_id,
          starts_at: new Date(slotStart).toISOString(),
          ends_at: new Date(slotFinish).toISOString(),
          capacity_minutes: (slotMinutes * interval.capacity_percent) / 100,
          occupied_minutes: 0,
          available_minutes: (slotMinutes * interval.capacity_percent) / 100,
          busy_sources: [],
        });
      }
    }
  }
  return slots.sort((left, right) =>
    left.starts_at.localeCompare(right.starts_at),
  );
}

export function buildEnterpriseCapacitySlots(input: {
  base_slots: EnterpriseCapacitySlot[];
  reservations: EnterpriseReservation[];
  authorized_project_ids: number[];
}): EnterpriseCapacitySlot[] {
  const authorizedProjectIds = new Set(input.authorized_project_ids);
  return input.base_slots.map((slot) => {
    const reservations = input.reservations.filter(
      (reservation) =>
        reservation.person_id === slot.person_id &&
        intervalsOverlap(
          slot.starts_at,
          slot.ends_at,
          reservation.starts_at,
          reservation.ends_at,
        ),
    );
    const reservationMinutes = reservations.reduce((sum, reservation) => {
      requirePercent(reservation.allocation_percent);
      return (
        sum + (slot.capacity_minutes * reservation.allocation_percent) / 100
      );
    }, 0);
    const occupiedMinutes = slot.occupied_minutes + reservationMinutes;
    return {
      ...slot,
      occupied_minutes: occupiedMinutes,
      available_minutes: Math.max(0, slot.capacity_minutes - occupiedMinutes),
      busy_sources: [
        ...slot.busy_sources,
        ...reservations.map((reservation) =>
          busySource(reservation, authorizedProjectIds),
        ),
      ],
    };
  });
}

function slotKey(personId: string, startsAt: string): string {
  return `${personId}\u0000${startsAt}`;
}

function shiftByProjectWorkingMinutes(
  anchor: number,
  minutes: number,
  workingSlots: ProjectWorkingSlot[],
): number | null {
  if (minutes === 0) return anchor;
  let remaining = Math.abs(minutes);
  const candidates = minutes > 0
    ? workingSlots.filter((slot) => parseTimestamp(slot.starts_at, "Working slot start") >= anchor)
    : [...workingSlots]
        .reverse()
        .filter((slot) => parseTimestamp(slot.ends_at, "Working slot finish") <= anchor);
  for (const slot of candidates) {
    const start = parseTimestamp(slot.starts_at, "Working slot start");
    const finish = parseTimestamp(slot.ends_at, "Working slot finish");
    const duration = (finish - start) / 60_000;
    if (remaining <= duration) {
      return minutes > 0
        ? start + remaining * 60_000
        : finish - remaining * 60_000;
    }
    remaining -= duration;
  }
  return null;
}

function groupSelectedSlots(
  task: HourlyLevelingTask,
  slots: EnterpriseCapacitySlot[],
  slotMinutes: number,
): TaskScheduleSegment[] {
  const groups: EnterpriseCapacitySlot[][] = [];
  for (const slot of slots) {
    const current = groups.at(-1);
    if (!current || current.at(-1)!.ends_at !== slot.starts_at)
      groups.push([slot]);
    else current.push(slot);
  }
  return groups.map((group, index) => ({
    id: `${task.task_id}:proposal:${index}`,
    task_id: task.task_id,
    segment_index: index,
    starts_at: group[0].starts_at,
    ends_at: group.at(-1)!.ends_at,
    planned_minutes: group.length * slotMinutes,
    lock_reason: null,
  }));
}

function assignmentNeed(
  slotMinutes: number,
  allocationPercent: number,
): number {
  requirePercent(allocationPercent);
  if (allocationPercent <= 0)
    throw new Error("Task allocation must be greater than zero");
  return (slotMinutes * allocationPercent) / 100;
}

export function previewHourlyResourceLeveling(input: {
  tasks: HourlyLevelingTask[];
  capacity_slots: EnterpriseCapacitySlot[];
  project_working_slots?: ProjectWorkingSlot[];
  slot_minutes?: number;
}): HourlyLevelingResult {
  const slotMinutes = input.slot_minutes ?? DEFAULT_SLOT_MINUTES;
  requireInteger(slotMinutes, "Slot size must be a whole number of minutes");
  if (slotMinutes <= 0) throw new Error("Slot size must be positive");

  const mutableAvailability = new Map<string, number>();
  for (const slot of input.capacity_slots) {
    mutableAvailability.set(
      slotKey(slot.person_id, slot.starts_at),
      slot.available_minutes,
    );
  }
  const starts = [
    ...new Set(input.capacity_slots.map((slot) => slot.starts_at)),
  ].sort();
  const byPersonAndStart = new Map(
    input.capacity_slots.map((slot) => [
      slotKey(slot.person_id, slot.starts_at),
      slot,
    ]),
  );
  const proposals: HourlyLevelingProposal[] = [];
  const diagnostics: HourlyLevelingDiagnostic[] = [];

  const taskIds = new Set(input.tasks.map((task) => task.task_id));
  const pending = new Map(input.tasks.map((task) => [task.task_id, task]));
  const placedBounds = new Map<
    string,
    { starts_at: string; ends_at: string }
  >();

  while (pending.size > 0) {
    const ready = [...pending.values()]
      .filter((task) =>
        (task.predecessors ?? []).every(
          (predecessor) =>
            !taskIds.has(predecessor.task_id) ||
            placedBounds.has(predecessor.task_id),
        ),
      )
      .sort(
        (left, right) =>
          (right.leveling_priority ?? 500) - (left.leveling_priority ?? 500) ||
          left.earliest_start_at.localeCompare(right.earliest_start_at) ||
          left.task_id.localeCompare(right.task_id),
      );

    if (ready.length === 0) {
      for (const task of pending.values()) {
        diagnostics.push({
          code: "dependency_cycle",
          task_id: task.task_id,
          message:
            "Task could not be leveled because its dependency chain is circular or unresolved.",
        });
      }
      break;
    }

    for (const task of ready) {
      pending.delete(task.task_id);
      if (task.fixed) {
        diagnostics.push({
          code: "fixed_task",
          task_id: task.task_id,
          message: "Fixed or progressed work was not moved.",
        });
        if (task.current_start_at && task.current_finish_at) {
          placedBounds.set(task.task_id, {
            starts_at: task.current_start_at,
            ends_at: task.current_finish_at,
          });
        }
        continue;
      }
      if (
        !Number.isSafeInteger(task.work_minutes) ||
        task.work_minutes <= 0 ||
        task.work_minutes % slotMinutes !== 0 ||
        task.assignments.length === 0 ||
        !Number.isFinite(
          parseTimestamp(task.earliest_start_at, "Task earliest start"),
        )
      ) {
        diagnostics.push({
          code: "invalid_task",
          task_id: task.task_id,
          message:
            "Task work, start, and assignments must form a valid hour-slot request.",
        });
        continue;
      }

      let earliestStart = parseTimestamp(
        task.earliest_start_at,
        "Task earliest start",
      );
      let minimumFinish = Number.NEGATIVE_INFINITY;
      let dependencyCalendarBlocked = false;
      for (const predecessor of task.predecessors ?? []) {
        const placed = placedBounds.get(predecessor.task_id);
        const predecessorStart = parseTimestamp(
          placed?.starts_at ?? predecessor.current_start_at,
          "Predecessor start",
        );
        const predecessorFinish = parseTimestamp(
          placed?.ends_at ?? predecessor.current_finish_at,
          "Predecessor finish",
        );
        const usesPredecessorFinish =
          predecessor.dependency_type === "finish_to_start" ||
          predecessor.dependency_type === "finish_to_finish";
        const shiftedAnchor = shiftByProjectWorkingMinutes(
          usesPredecessorFinish ? predecessorFinish : predecessorStart,
          predecessor.lag_minutes,
          input.project_working_slots ?? [],
        );
        if (shiftedAnchor === null) {
          dependencyCalendarBlocked = true;
          break;
        }
        if (predecessor.dependency_type === "finish_to_start") {
          earliestStart = Math.max(earliestStart, shiftedAnchor);
        } else if (predecessor.dependency_type === "start_to_start") {
          earliestStart = Math.max(earliestStart, shiftedAnchor);
        } else if (predecessor.dependency_type === "finish_to_finish") {
          minimumFinish = Math.max(minimumFinish, shiftedAnchor);
        } else {
          minimumFinish = Math.max(minimumFinish, shiftedAnchor);
        }
      }
      if (dependencyCalendarBlocked) {
        diagnostics.push({
          code: "constraint_blocked",
          task_id: task.task_id,
          message: "Task could not be leveled because its dependency lead or lag extends beyond the project working calendar preview.",
        });
        continue;
      }
      const latestFinish = task.latest_finish_at
        ? parseTimestamp(task.latest_finish_at, "Task latest finish")
        : Number.POSITIVE_INFINITY;

      const requiredSlots = task.work_minutes / slotMinutes;
      const candidateSlots = starts
        .filter(
          (startsAt) =>
            parseTimestamp(startsAt, "Capacity slot start") >= earliestStart,
        )
        .filter((startsAt) =>
          task.assignments.every((assignment) => {
            const slot = byPersonAndStart.get(
              slotKey(assignment.person_id, startsAt),
            );
            if (!slot) return false;
            const available =
              mutableAvailability.get(
                slotKey(assignment.person_id, startsAt),
              ) ?? 0;
            return (
              available >=
              assignmentNeed(slotMinutes, assignment.allocation_percent)
            );
          }),
        );

      let selectedStarts: string[] = [];
      if (task.allow_split) {
        for (
          let index = 0;
          index <= candidateSlots.length - requiredSlots;
          index += 1
        ) {
          const candidate = candidateSlots.slice(index, index + requiredSlots);
          const finalSlot = byPersonAndStart.get(
            slotKey(task.assignments[0].person_id, candidate.at(-1)!),
          );
          if (
            finalSlot &&
            parseTimestamp(finalSlot.ends_at, "Candidate finish") >=
              minimumFinish
          ) {
            selectedStarts = candidate;
            break;
          }
        }
      } else {
        for (
          let index = 0;
          index <= candidateSlots.length - requiredSlots;
          index += 1
        ) {
          const candidate = candidateSlots.slice(index, index + requiredSlots);
          const contiguous = candidate.every((startsAt, offset) => {
            if (offset === 0) return true;
            const previous = byPersonAndStart.get(
              slotKey(task.assignments[0].person_id, candidate[offset - 1]),
            );
            return previous?.ends_at === startsAt;
          });
          const finalSlot = byPersonAndStart.get(
            slotKey(task.assignments[0].person_id, candidate.at(-1)!),
          );
          if (
            contiguous &&
            finalSlot &&
            parseTimestamp(finalSlot.ends_at, "Candidate finish") >=
              minimumFinish
          ) {
            selectedStarts = candidate;
            break;
          }
        }
      }

      if (selectedStarts.length < requiredSlots) {
        diagnostics.push({
          code: "no_capacity",
          task_id: task.task_id,
          message:
            "No feasible enterprise-capacity placement exists in the supplied horizon.",
        });
        continue;
      }

      const selectedFinish = byPersonAndStart.get(
        slotKey(task.assignments[0].person_id, selectedStarts.at(-1)!),
      )!.ends_at;
      if (parseTimestamp(selectedFinish, "Leveled finish") > latestFinish) {
        diagnostics.push({
          code: "constraint_blocked",
          task_id: task.task_id,
          message:
            "No capacity placement satisfies the task's latest-finish constraint.",
        });
        continue;
      }

      for (const startsAt of selectedStarts) {
        for (const assignment of task.assignments) {
          const key = slotKey(assignment.person_id, startsAt);
          const available = mutableAvailability.get(key) ?? 0;
          mutableAvailability.set(
            key,
            available -
              assignmentNeed(slotMinutes, assignment.allocation_percent),
          );
        }
      }
      const representativePerson = task.assignments[0].person_id;
      const selectedSlots = selectedStarts.map(
        (startsAt) =>
          byPersonAndStart.get(slotKey(representativePerson, startsAt))!,
      );
      const segments = groupSelectedSlots(task, selectedSlots, slotMinutes);
      proposals.push({
        task_id: task.task_id,
        task_name: task.task_name,
        previous_start_at: task.current_start_at ?? null,
        previous_finish_at: task.current_finish_at ?? null,
        segments,
      });
      placedBounds.set(task.task_id, {
        starts_at: segments[0].starts_at,
        ends_at: segments.at(-1)!.ends_at,
      });
    }
  }

  return { proposals, diagnostics };
}

export function assertLevelingUndoSafe(
  recordedAfterStateHash: string,
  currentAffectedStateHash: string,
): void {
  if (recordedAfterStateHash !== currentAffectedStateHash) {
    throw new Error(
      "Leveling undo conflict: affected schedule state changed after apply",
    );
  }
}

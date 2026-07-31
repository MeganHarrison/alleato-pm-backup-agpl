// Canonical schedule policy for the Project Intelligence runner.
export const DEFAULT_DAILY_BRIEF_TIMEZONE = "America/New_York";
export const DEFAULT_DAILY_BRIEF_LOCAL_TIME = "06:00";
export const DEFAULT_DAILY_BRIEF_WEEKDAYS = [1, 2, 3, 4, 5];
export const DEFAULT_DAILY_BRIEF_RECOVERY_WINDOW_MINUTES = 180;

const WEEKDAY_NUMBER = new Map([
  ["Mon", 1],
  ["Tue", 2],
  ["Wed", 3],
  ["Thu", 4],
  ["Fri", 5],
  ["Sat", 6],
  ["Sun", 7],
]);

function formatter(timezone, options) {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: timezone, ...options });
  } catch (error) {
    throw new Error(
      `Invalid Executive Daily Brief timezone '${timezone}': ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function parseWeekdays(value, fallback = DEFAULT_DAILY_BRIEF_WEEKDAYS) {
  if (!value?.trim()) return [...fallback];
  const weekdays = value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 7);
  if (weekdays.length === 0) {
    throw new Error(
      `EXECUTIVE_DAILY_BRIEF_TARGET_WEEKDAYS must contain weekday numbers 1-7; received '${value}'.`,
    );
  }
  return [...new Set(weekdays)];
}

export function localScheduleParts(now, timezone) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error("Executive Daily Brief schedule received an invalid date.");
  }
  const parts = formatter(timezone, {
    hourCycle: "h23",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = WEEKDAY_NUMBER.get(get("weekday"));
  if (!weekday) {
    throw new Error(`Could not resolve local weekday for timezone '${timezone}'.`);
  }
  return {
    localDate: `${get("year")}-${get("month")}-${get("day")}`,
    localTime: `${get("hour")}:${get("minute")}`,
    weekday,
  };
}

export function localScheduleDecision(
  now,
  {
    timezone = DEFAULT_DAILY_BRIEF_TIMEZONE,
    targetLocalTime = DEFAULT_DAILY_BRIEF_LOCAL_TIME,
    weekdays = DEFAULT_DAILY_BRIEF_WEEKDAYS,
  } = {},
) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(targetLocalTime)) {
    throw new Error(
      `EXECUTIVE_DAILY_BRIEF_TARGET_LOCAL_TIME must be HH:MM; received '${targetLocalTime}'.`,
    );
  }
  const current = localScheduleParts(now, timezone);
  return {
    shouldRun: current.localTime === targetLocalTime && weekdays.includes(current.weekday),
    timezone,
    targetLocalTime,
    targetWeekdays: weekdays,
    currentLocalDate: current.localDate,
    currentLocalTime: current.localTime,
    currentLocalWeekday: current.weekday,
  };
}

export function recoveryWindowDecision(
  now,
  {
    timezone = DEFAULT_DAILY_BRIEF_TIMEZONE,
    targetLocalTime = DEFAULT_DAILY_BRIEF_LOCAL_TIME,
    recoveryWindowMinutes = DEFAULT_DAILY_BRIEF_RECOVERY_WINDOW_MINUTES,
    weekdays = DEFAULT_DAILY_BRIEF_WEEKDAYS,
  } = {},
) {
  const schedule = localScheduleDecision(now, { timezone, targetLocalTime, weekdays });
  const [targetHour, targetMinute] = targetLocalTime.split(":").map(Number);
  const [currentHour, currentMinute] = schedule.currentLocalTime.split(":").map(Number);
  const delta = currentHour * 60 + currentMinute - (targetHour * 60 + targetMinute);
  return { ...schedule, inRecoveryWindow: weekdays.includes(schedule.currentLocalWeekday) && delta >= 0 && delta <= recoveryWindowMinutes };
}

export function previousBusinessDateInTimeZone(
  now,
  timezone = DEFAULT_DAILY_BRIEF_TIMEZONE,
) {
  const { localDate } = localScheduleParts(now, timezone);
  const candidate = new Date(`${localDate}T12:00:00.000Z`);
  do {
    candidate.setUTCDate(candidate.getUTCDate() - 1);
  } while (candidate.getUTCDay() === 0 || candidate.getUTCDay() === 6);
  return candidate.toISOString().slice(0, 10);
}

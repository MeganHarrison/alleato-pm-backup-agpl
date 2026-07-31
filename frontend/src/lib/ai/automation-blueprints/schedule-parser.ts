export type ParsedSchedule =
  | {
      status: "ok";
      cadence: "daily" | "weekdays" | "weekly" | "hourly";
      cronExpression: string;
      timezone: string;
      display: string;
      localTime?: string;
      weekday?: string;
      intervalHours?: number;
    }
  | {
      status: "ambiguous";
      reason: "missing_cadence" | "missing_time" | "unsupported_schedule";
      message: string;
    };

const WEEKDAYS: Record<string, string> = {
  sunday: "0",
  monday: "1",
  tuesday: "2",
  wednesday: "3",
  thursday: "4",
  friday: "5",
  saturday: "6",
};

function validTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function assertValidTimezone(timezone: string): void {
  if (!validTimezone(timezone)) {
    throw new Error(`Unsupported timezone: ${timezone}`);
  }
}

function normalizeTime(hourText: string, minuteText: string | undefined, meridiem: string | undefined): string {
  let hour = Number(hourText);
  const minute = Number(minuteText ?? "0");
  const suffix = meridiem?.toLowerCase();

  if (suffix === "pm" && hour < 12) hour += 12;
  if (suffix === "am" && hour === 12) hour = 0;

  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid time: ${hourText}${minuteText ? `:${minuteText}` : ""}`);
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseTime(input: string): string | null {
  const lower = input.toLowerCase();
  if (lower.includes("noon")) return "12:00";
  if (lower.includes("midnight")) return "00:00";
  if (lower.includes("morning")) return "08:00";
  if (lower.includes("evening")) return "17:00";

  const match = lower.match(/\b([01]?\d|2[0-3])(?::([0-5]\d))?\s*(am|pm)?\b/);
  if (!match) return null;
  return normalizeTime(match[1], match[2], match[3]);
}

function cronTimeParts(time: string): { minute: string; hour: string } {
  const [hour, minute] = time.split(":");
  return {
    minute: String(Number(minute)),
    hour: String(Number(hour)),
  };
}

function weekdayFromInput(input: string): { name: string; dow: string } | null {
  const lower = input.toLowerCase();
  for (const [name, dow] of Object.entries(WEEKDAYS)) {
    if (lower.includes(name)) return { name, dow };
  }
  return null;
}

export function parseNaturalLanguageSchedule(params: {
  input: string;
  timezone: string;
}): ParsedSchedule {
  assertValidTimezone(params.timezone);

  const lower = params.input.toLowerCase();
  const intervalMatch = lower.match(/\bevery\s+(\d+)\s+hours?\b/);
  if (intervalMatch) {
    const intervalHours = Number(intervalMatch[1]);
    if (!Number.isInteger(intervalHours) || intervalHours < 1 || intervalHours > 12) {
      return {
        status: "ambiguous",
        reason: "unsupported_schedule",
        message: "Hourly schedules must use an interval between 1 and 12 hours.",
      };
    }

    const weekdaysOnly = lower.includes("weekday") || lower.includes("workday");
    return {
      status: "ok",
      cadence: "hourly",
      cronExpression: `0 */${intervalHours} * * ${weekdaysOnly ? "1-5" : "*"}`,
      timezone: params.timezone,
      display:
        intervalHours === 1
          ? `Every hour${weekdaysOnly ? " on weekdays" : ""}`
          : `Every ${intervalHours} hours${weekdaysOnly ? " on weekdays" : ""}`,
      intervalHours,
    };
  }

  const time = parseTime(lower);
  const timeParts = time ? cronTimeParts(time) : null;
  const weekday = weekdayFromInput(lower);

  const daily = lower.includes("daily") || lower.includes("every day");
  const weekdays = lower.includes("weekday") || lower.includes("workday");
  const weekly = lower.includes("weekly") || Boolean(weekday);

  if (!daily && !weekdays && !weekly) {
    return {
      status: "ambiguous",
      reason: "missing_cadence",
      message: "Add a cadence such as daily, weekdays, weekly, or every Monday.",
    };
  }

  if (!time || !timeParts) {
    return {
      status: "ambiguous",
      reason: "missing_time",
      message: "Add a time such as 8am, 14:30, morning, or evening.",
    };
  }

  if (weekdays) {
    return {
      status: "ok",
      cadence: "weekdays",
      cronExpression: `${timeParts.minute} ${timeParts.hour} * * 1-5`,
      timezone: params.timezone,
      display: `Weekdays at ${time} ${params.timezone}`,
      localTime: time,
    };
  }

  if (weekly) {
    const resolved = weekday ?? { name: "monday", dow: "1" };
    return {
      status: "ok",
      cadence: "weekly",
      cronExpression: `${timeParts.minute} ${timeParts.hour} * * ${resolved.dow}`,
      timezone: params.timezone,
      display: `Every ${resolved.name} at ${time} ${params.timezone}`,
      localTime: time,
      weekday: resolved.name,
    };
  }

  return {
    status: "ok",
    cadence: "daily",
    cronExpression: `${timeParts.minute} ${timeParts.hour} * * *`,
    timezone: params.timezone,
    display: `Daily at ${time} ${params.timezone}`,
    localTime: time,
  };
}

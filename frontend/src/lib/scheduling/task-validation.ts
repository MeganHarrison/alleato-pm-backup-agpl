import type { TaskStatus } from "@/types/scheduling";

export const SCHEDULE_TASK_STATUSES: readonly TaskStatus[] = [
  "not_started",
  "in_progress",
  "complete",
];

export type ScheduleTaskValidationInput = {
  name?: unknown;
  start_date?: unknown;
  finish_date?: unknown;
  duration_days?: unknown;
  percent_complete?: unknown;
  status?: unknown;
  is_milestone?: unknown;
};

export type ScheduleTaskValidationError = {
  field: string;
  error: string;
};

function isNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseOptionalDate(value: unknown): Date | null | "invalid" {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return "invalid";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "invalid" : parsed;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function validateScheduleTaskCreateInput(
  input: ScheduleTaskValidationInput,
): ScheduleTaskValidationError[] {
  const errors: ScheduleTaskValidationError[] = [];

  if (!isNonEmptyText(input.name)) {
    errors.push({ field: "name", error: "Task name is required" });
  } else if (/^\/[A-Za-z]/.test(input.name.trim()) || input.name.includes("<<") || input.name.includes(">>")) {
    errors.push({ field: "name", error: "Task name contains invalid characters" });
  }

  if (input.status != null && input.status !== "") {
    if (
      typeof input.status !== "string" ||
      !SCHEDULE_TASK_STATUSES.includes(input.status as TaskStatus)
    ) {
      errors.push({
        field: "status",
        error: "Status must be one of: not_started, in_progress, complete",
      });
    }
  }

  const startDate = parseOptionalDate(input.start_date);
  const finishDate = parseOptionalDate(input.finish_date);

  if (startDate === "invalid") {
    errors.push({ field: "start_date", error: "Start date must be a valid date" });
  }

  if (finishDate === "invalid") {
    errors.push({ field: "finish_date", error: "Finish date must be a valid date" });
  }

  if (startDate instanceof Date && finishDate instanceof Date && startDate > finishDate) {
    errors.push({
      field: "finish_date",
      error: "Start date cannot be after finish date",
    });
  }

  if (
    input.is_milestone === true &&
    input.duration_days != null &&
    input.duration_days !== "" &&
    input.duration_days !== 0
  ) {
    errors.push({
      field: "duration_days",
      error: "Milestones must have zero duration",
    });
  }

  if (input.percent_complete != null && input.percent_complete !== "") {
    if (
      !isFiniteNumber(input.percent_complete) ||
      input.percent_complete < 0 ||
      input.percent_complete > 100
    ) {
      errors.push({
        field: "percent_complete",
        error: "Percent complete must be between 0 and 100",
      });
    }
  }

  return errors;
}

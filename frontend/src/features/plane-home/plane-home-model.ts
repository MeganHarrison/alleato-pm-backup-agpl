import type { TasksRow } from "@/features/tasks/task-utils";
import type { Database } from "@/types/database.types";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

export type PlaneHomeProject = Pick<
  ProjectRow,
  | "id"
  | "name"
  | "project_number"
  | "job number"
  | "summary"
  | "address"
  | "phase"
  | "stage"
  | "work_scope"
  | "start date"
  | "est completion"
>;

export interface PlaneHomeMeeting {
  id: number | string;
  title: string | null;
  file_name: string | null;
  date: string | null;
  created_at: string | null;
  summary: string | null;
  overview: string | null;
  description: string | null;
  notes: string | null;
}

export interface PlaneHomeDailyLog {
  id: number | string;
  log_date: string;
  general_notes: string | null;
  status: string | null;
  weather_conditions: string | null;
}

export interface PlaneHomeActivity {
  id: string;
  kind: "meeting" | "daily-log";
  title: string;
  description: string | null;
  occurredAt: string;
  href: string;
}

const CLOSED_TASK_STATUSES = new Set([
  "cancelled",
  "closed",
  "complete",
  "completed",
  "done",
]);

const PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function timestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function dueDateTimestamp(value: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = timestamp(value);
  return parsed || Number.POSITIVE_INFINITY;
}

function taskIsClosed(task: TasksRow): boolean {
  return CLOSED_TASK_STATUSES.has((task.status ?? "").trim().toLowerCase());
}

export function selectHomeTasks(
  tasks: TasksRow[],
  limit = 6,
): TasksRow[] {
  return tasks
    .filter((task) => !taskIsClosed(task))
    .sort((left, right) => {
      const dueDifference =
        dueDateTimestamp(left.due_date) - dueDateTimestamp(right.due_date);
      if (dueDifference !== 0) return dueDifference;

      const priorityDifference =
        (PRIORITY_WEIGHT[(right.priority ?? "").toLowerCase()] ?? 0) -
        (PRIORITY_WEIGHT[(left.priority ?? "").toLowerCase()] ?? 0);
      if (priorityDifference !== 0) return priorityDifference;

      return (
        timestamp(right.updated_at ?? right.created_at) -
        timestamp(left.updated_at ?? left.created_at)
      );
    })
    .slice(0, limit);
}

function compactText(value: string | null | undefined): string | null {
  const compacted = value?.replace(/\s+/g, " ").trim();
  return compacted || null;
}

export function taskHomeTitle(task: TasksRow): string {
  return (
    compactText(task.title) ??
    compactText(task.description) ??
    "Untitled work item"
  );
}

export function buildHomeActivity(
  projectId: string,
  meetings: PlaneHomeMeeting[],
  dailyLogs: PlaneHomeDailyLog[],
  limit = 6,
): PlaneHomeActivity[] {
  const meetingActivity: PlaneHomeActivity[] = meetings
    .map((meeting) => {
      const occurredAt = meeting.date ?? meeting.created_at;
      if (!occurredAt) return null;

      return {
        id: `meeting-${meeting.id}`,
        kind: "meeting" as const,
        title:
          compactText(meeting.title) ??
          compactText(meeting.file_name) ??
          "Meeting",
        description:
          compactText(meeting.summary) ??
          compactText(meeting.overview) ??
          compactText(meeting.description) ??
          compactText(meeting.notes),
        occurredAt,
        href: `/${projectId}/meetings/${meeting.id}`,
      };
    })
    .filter((activity): activity is PlaneHomeActivity => Boolean(activity));

  const dailyLogActivity: PlaneHomeActivity[] = dailyLogs.map((dailyLog) => ({
    id: `daily-log-${dailyLog.id}`,
    kind: "daily-log",
    title: `Daily log · ${formatHomeDate(dailyLog.log_date)}`,
    description:
      compactText(dailyLog.general_notes) ??
      compactText(dailyLog.weather_conditions) ??
      compactText(dailyLog.status),
    occurredAt: dailyLog.log_date,
    href: `/${projectId}/daily-log/${dailyLog.id}/edit`,
  }));

  return [...meetingActivity, ...dailyLogActivity]
    .sort(
      (left, right) =>
        timestamp(right.occurredAt) - timestamp(left.occurredAt),
    )
    .slice(0, limit);
}

export function formatHomeDate(value: string | null | undefined): string {
  if (!value) return "No date";
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T12:00:00`
    : value;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return "No date";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}


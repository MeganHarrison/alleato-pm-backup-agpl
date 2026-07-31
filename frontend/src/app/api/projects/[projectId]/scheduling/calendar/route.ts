import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { defaultScheduleCalendar } from "@/lib/scheduling/schedule-calendar";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type CalendarRow = { working_weekdays: number[]; timezone_name: string };
type ExceptionRow = { exception_date: string; is_working: boolean; reason: string | null };
type CalendarExceptionInput = { date: string; is_working: boolean; reason?: string };

function serializeExceptions(exceptions: ExceptionRow[] | CalendarExceptionInput[]) {
  return exceptions.map((exception) => ({
    date: "exception_date" in exception ? exception.exception_date : exception.date,
    is_working: exception.is_working,
    ...(exception.reason ? { reason: exception.reason } : {}),
  }));
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validateCalendarPayload(value: unknown): { value?: { workingWeekdays: number[]; exceptions: CalendarExceptionInput[] }; error?: string } {
  if (!value || typeof value !== "object") return { error: "Provide calendar settings." };
  const payload = value as Record<string, unknown>;
  const weekdays = payload.working_weekdays;
  if (!Array.isArray(weekdays) || weekdays.length === 0) return { error: "Choose at least one working weekday." };
  if (!weekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) || new Set(weekdays).size !== weekdays.length) {
    return { error: "Working weekdays must be unique values from Sunday (0) through Saturday (6)." };
  }

  const rawExceptions = payload.exceptions ?? [];
  if (!Array.isArray(rawExceptions)) return { error: "Calendar exceptions must be a list." };
  if (rawExceptions.length > 1000) return { error: "A schedule calendar can contain at most 1000 dated exceptions." };
  const exceptions: CalendarExceptionInput[] = [];
  for (const item of rawExceptions) {
    if (!item || typeof item !== "object") return { error: "Each calendar exception must include a date and working status." };
    const exception = item as Record<string, unknown>;
    if (!isIsoDate(exception.date) || typeof exception.is_working !== "boolean") {
      return { error: "Each calendar exception needs a valid date and working status." };
    }
    if (exception.reason !== undefined && (typeof exception.reason !== "string" || exception.reason.length > 240)) {
      return { error: "Calendar exception reasons must be 240 characters or fewer." };
    }
    exceptions.push({ date: exception.date, is_working: exception.is_working, ...(exception.reason ? { reason: exception.reason.trim() } : {}) });
  }
  if (new Set(exceptions.map((exception) => exception.date)).size !== exceptions.length) {
    return { error: "Use each exception date only once." };
  }
  return { value: { workingWeekdays: [...weekdays].sort((a, b) => a - b), exceptions } };
}

export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/scheduling/calendar#GET",
  async ({ params }) => {
    const { projectId } = await params;
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/scheduling/calendar#GET",
        message: "Authentication required.",
      });
    }

    const supabase = await createClient();
    const calendarResult = await supabase
      .from("project_schedule_calendars")
      .select("working_weekdays,timezone_name")
      .eq("project_id", Number(projectId))
      .maybeSingle() as { data: CalendarRow | null; error: { message: string } | null };
    if (calendarResult.error) throw new Error(`Unable to load schedule calendar: ${calendarResult.error.message}`);

    const exceptionResult = await supabase
      .from("project_schedule_calendar_exceptions")
      .select("exception_date,is_working,reason")
      .eq("project_id", Number(projectId)) as { data: ExceptionRow[] | null; error: { message: string } | null };
    if (exceptionResult.error) throw new Error(`Unable to load schedule calendar exceptions: ${exceptionResult.error.message}`);

    const workingWeekdays = calendarResult.data?.working_weekdays ?? defaultScheduleCalendar.working_weekdays;
    const exceptions = exceptionResult.data ?? [];
    return NextResponse.json({
      working_weekdays: workingWeekdays,
      non_working_dates: exceptions.filter((item) => !item.is_working).map((item) => item.exception_date),
      working_date_overrides: exceptions.filter((item) => item.is_working).map((item) => item.exception_date),
      exceptions: serializeExceptions(exceptions),
      timezone_name: calendarResult.data?.timezone_name ?? defaultScheduleCalendar.timezone_name,
      source: calendarResult.data ? "project" : "default",
    });
  },
);

export const PUT = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/scheduling/calendar#PUT",
  async ({ request, params }) => {
    const { projectId } = await params;
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/scheduling/calendar#PUT",
        message: "Authentication required.",
      });
    }
    const parsed = validateCalendarPayload(await request.json().catch(() => null));
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const supabase = await createClient();
    const rpcClient = supabase as unknown as {
      rpc: (
        functionName: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>;
    };
    const { error } = await rpcClient.rpc("replace_project_schedule_calendar", {
      p_project_id: Number(projectId),
      p_working_weekdays: parsed.value!.workingWeekdays,
      p_exceptions: parsed.value!.exceptions.map((exception) => ({
        exception_date: exception.date,
        is_working: exception.is_working,
        ...(exception.reason ? { reason: exception.reason } : {}),
      })),
    });
    if (error) throw new Error(`Unable to save schedule calendar: ${error.message}`);

    const timezoneResult = await supabase
      .from("project_schedule_calendars")
      .select("timezone_name")
      .eq("project_id", Number(projectId))
      .maybeSingle();
    if (timezoneResult.error) throw new Error(`Unable to reload schedule calendar time zone: ${timezoneResult.error.message}`);

    return NextResponse.json({
      working_weekdays: parsed.value!.workingWeekdays,
      non_working_dates: parsed.value!.exceptions.filter((exception) => !exception.is_working).map((exception) => exception.date),
      working_date_overrides: parsed.value!.exceptions.filter((exception) => exception.is_working).map((exception) => exception.date),
      exceptions: serializeExceptions(parsed.value!.exceptions),
      timezone_name: timezoneResult.data?.timezone_name ?? defaultScheduleCalendar.timezone_name,
      source: "project",
    });
  },
);

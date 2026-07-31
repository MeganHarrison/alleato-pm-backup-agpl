import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { throwScheduleDatabaseError, throwScheduleRequestError } from "@/lib/scheduling/schedule-route-errors";
import {
  compareScheduleBaselineTasks,
  type BaselineTaskSnapshot,
  type CurrentScheduleTask,
  type ScheduleBaseline,
} from "@/lib/scheduling/schedule-baselines";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({ target_revision_id: z.string().uuid().optional() });
type CalendarException = { date: string; is_working: boolean; reason?: string | null };

export const GET = withApiGuardrails<{ projectId: string; baselineId: string }>(
  "projects/[projectId]/scheduling/baselines/[baselineId]/comparison#GET",
  async ({ request, params }) => {
    const { projectId, baselineId } = await params;
    if (!await getApiRouteUser()) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/scheduling/baselines/[baselineId]/comparison#GET", message: "Authentication required." });
    }
    if (!z.string().uuid().safeParse(baselineId).success) {
      throwScheduleRequestError("projects/[projectId]/scheduling/baselines/[baselineId]/comparison#GET", "Baseline identifier is invalid.");
    }
    const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) throwScheduleRequestError("projects/[projectId]/scheduling/baselines/[baselineId]/comparison#GET", "Target revision identifier is invalid.");

    const supabase = await createClient();
    const { data: baseline, error: baselineError } = await supabase
      .from("schedule_baselines")
      .select("id,project_id,revision_id,name,is_active,created_at,activated_at")
      .eq("id", baselineId)
      .eq("project_id", Number(projectId))
      .maybeSingle();
    if (baselineError) throwScheduleDatabaseError("projects/[projectId]/scheduling/baselines/[baselineId]/comparison#GET", baselineError);
    if (!baseline) throwScheduleRequestError("projects/[projectId]/scheduling/baselines/[baselineId]/comparison#GET", "Baseline not found in this project.", { code: "NOT_FOUND", status: 404 });

    const [
      { data: baselineTasks, error: baselineTaskError },
      { data: calendarSnapshot, error: calendarError },
      { data: baselineRevision, error: baselineRevisionError },
    ] = await Promise.all([
      supabase
        .from("schedule_revision_task_snapshots")
        .select("source_task_id,name,start_date,finish_date,duration_days")
        .eq("revision_id", baseline.revision_id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("schedule_revision_calendar_snapshots")
        .select("working_weekdays,exceptions")
        .eq("revision_id", baseline.revision_id)
        .maybeSingle(),
      supabase
        .from("schedule_revisions")
        .select("snapshot_context_provenance")
        .eq("id", baseline.revision_id)
        .eq("project_id", Number(projectId))
        .maybeSingle(),
    ]);
    if (baselineTaskError) throwScheduleDatabaseError("projects/[projectId]/scheduling/baselines/[baselineId]/comparison#GET", baselineTaskError);
    if (calendarError) throwScheduleDatabaseError("projects/[projectId]/scheduling/baselines/[baselineId]/comparison#GET", calendarError);
    if (baselineRevisionError) throwScheduleDatabaseError("projects/[projectId]/scheduling/baselines/[baselineId]/comparison#GET", baselineRevisionError);
    if (!calendarSnapshot) throwScheduleRequestError("projects/[projectId]/scheduling/baselines/[baselineId]/comparison#GET", "The baseline calendar snapshot is missing; comparison was not calculated.", { code: "PRECONDITION_FAILED", status: 409 });
    if (!baselineRevision) throwScheduleRequestError("projects/[projectId]/scheduling/baselines/[baselineId]/comparison#GET", "The baseline revision is missing; comparison was not calculated.", { code: "PRECONDITION_FAILED", status: 409 });

    let currentTasks: CurrentScheduleTask[];
    if (parsed.data.target_revision_id) {
      const { data: targetRevision, error: targetRevisionError } = await supabase
        .from("schedule_revisions")
        .select("id")
        .eq("id", parsed.data.target_revision_id)
        .eq("project_id", Number(projectId))
        .maybeSingle();
      if (targetRevisionError) throwScheduleDatabaseError("projects/[projectId]/scheduling/baselines/[baselineId]/comparison#GET", targetRevisionError);
      if (!targetRevision) throwScheduleRequestError("projects/[projectId]/scheduling/baselines/[baselineId]/comparison#GET", "Target revision not found in this project.", { code: "NOT_FOUND", status: 404 });
      const { data, error } = await supabase
        .from("schedule_revision_task_snapshots")
        .select("source_task_id,name,start_date,finish_date,duration_days,actual_start_date,actual_finish_date,forecast_start_date,forecast_finish_date")
        .eq("revision_id", targetRevision.id)
        .order("sort_order", { ascending: true });
      if (error) throwScheduleDatabaseError("projects/[projectId]/scheduling/baselines/[baselineId]/comparison#GET", error);
      currentTasks = (data ?? []) as CurrentScheduleTask[];
    } else {
      const { data, error } = await supabase
        .from("schedule_tasks")
        .select("id,name,start_date,finish_date,duration_days,actual_start_date,actual_finish_date,forecast_start_date,forecast_finish_date")
        .eq("project_id", Number(projectId))
        .order("sort_order", { ascending: true });
      if (error) throwScheduleDatabaseError("projects/[projectId]/scheduling/baselines/[baselineId]/comparison#GET", error);
      currentTasks = (data ?? []).map((task) => ({ ...task, source_task_id: task.id }));
    }

    const exceptions = Array.isArray(calendarSnapshot.exceptions)
      ? calendarSnapshot.exceptions.filter((item): item is CalendarException => Boolean(item && typeof item === "object" && "date" in item && "is_working" in item))
      : [];
    const calendar = {
      working_weekdays: calendarSnapshot.working_weekdays,
      non_working_dates: exceptions.filter((item) => !item.is_working).map((item) => item.date),
      working_date_overrides: exceptions.filter((item) => item.is_working).map((item) => item.date),
      exceptions: exceptions.map((item) => ({ date: item.date, is_working: item.is_working, ...(item.reason ? { reason: item.reason } : {}) })),
    };
    return NextResponse.json({
      data: {
        baseline: baseline as ScheduleBaseline,
        provenance: baselineRevision.snapshot_context_provenance === "reconstructed" ? "reconstructed" : "captured",
        target: { type: parsed.data.target_revision_id ? "revision" : "live", revision_id: parsed.data.target_revision_id ?? null },
        tasks: compareScheduleBaselineTasks((baselineTasks ?? []) as BaselineTaskSnapshot[], currentTasks, calendar),
      },
    });
  },
);

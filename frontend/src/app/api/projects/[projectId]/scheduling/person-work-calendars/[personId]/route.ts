import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { ScheduleResourceService, ScheduleResourceServiceError } from "@/lib/services/schedule-resource-service";
import { normalizeWeeklyWorkIntervals } from "@/lib/scheduling/schedule-hourly-leveling";
import { requireScheduleApiUser, rethrowPhase4cServiceError } from "@/lib/scheduling/schedule-phase4c-route";
import { throwScheduleRequestError } from "@/lib/scheduling/schedule-route-errors";
import { createClient } from "@/lib/supabase/server";

const WHERE = "projects/[projectId]/scheduling/person-work-calendars/[personId]#PUT";
const paramsSchema = z.object({ projectId: z.coerce.number().int().positive(), personId: z.string().uuid() });
const weeklySchema = z.object({
  weekday: z.number().int().min(0).max(6),
  start_minute: z.number().int().min(0).max(1439),
  end_minute: z.number().int().min(0).max(1440),
  capacity_percent: z.number().int().min(0).max(100),
}).strict();
const datedSchema = z.object({
  local_date: z.iso.date(),
  start_minute: z.number().int().min(0).max(1439),
  end_minute: z.number().int().min(1).max(1440),
  capacity_percent: z.number().int().min(0).max(100),
  reason: z.string().trim().max(500).nullable().default(null),
}).strict();
const bodySchema = z.object({
  timezone_name: z.string().trim().min(1).max(100),
  expected_version: z.number().int().positive().nullable(),
  weekly_intervals: z.array(weeklySchema).max(100),
  date_intervals: z.array(datedSchema).max(2000),
}).strict();

export const PUT = withApiGuardrails<{ projectId: string; personId: string }>(WHERE, async ({ request, params }) => {
  await requireScheduleApiUser(WHERE);
  const parsedParams = paramsSchema.safeParse(await params);
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedParams.success || !parsedBody.success) {
    throwScheduleRequestError(WHERE, "Provide valid 15-minute weekly shifts and dated work exceptions.");
  }
  try {
    const service = new ScheduleResourceService(await createClient());
    const data = await service.replacePersonWorkCalendar(parsedParams.data.projectId, parsedParams.data.personId, {
      ...parsedBody.data,
      weekly_intervals: normalizeWeeklyWorkIntervals(parsedBody.data.weekly_intervals),
    });
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof ScheduleResourceServiceError) rethrowPhase4cServiceError(WHERE, error);
    if (error instanceof Error) throwScheduleRequestError(WHERE, error.message, { cause: error });
    throw error;
  }
});

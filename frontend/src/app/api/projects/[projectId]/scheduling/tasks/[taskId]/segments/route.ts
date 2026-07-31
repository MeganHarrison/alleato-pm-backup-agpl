import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { ScheduleResourceService, ScheduleResourceServiceError } from "@/lib/services/schedule-resource-service";
import { validateTaskScheduleSegments } from "@/lib/scheduling/schedule-hourly-leveling";
import { requireScheduleApiUser, rethrowPhase4cServiceError } from "@/lib/scheduling/schedule-phase4c-route";
import { throwScheduleRequestError } from "@/lib/scheduling/schedule-route-errors";
import { createClient } from "@/lib/supabase/server";

const GET_WHERE = "projects/[projectId]/scheduling/tasks/[taskId]/segments#GET";
const PUT_WHERE = "projects/[projectId]/scheduling/tasks/[taskId]/segments#PUT";
const paramsSchema = z.object({ projectId: z.coerce.number().int().positive(), taskId: z.string().uuid() });
const segmentSchema = z.object({
  segment_index: z.number().int().min(0),
  starts_at: z.iso.datetime({ offset: true }),
  ends_at: z.iso.datetime({ offset: true }),
  planned_minutes: z.number().int().positive().multipleOf(15),
  lock_reason: z.enum(["fixed", "progressed"]).nullable().default(null),
}).strict();
const bodySchema = z.object({
  expected_task_version: z.number().int().positive(),
  segments: z.array(segmentSchema).max(1000),
}).strict();

export const GET = withApiGuardrails<{ projectId: string; taskId: string }>(GET_WHERE, async ({ params }) => {
  await requireScheduleApiUser(GET_WHERE);
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) throwScheduleRequestError(GET_WHERE, "Select a valid project task before loading segments.");
  try {
    const service = new ScheduleResourceService(await createClient());
    return NextResponse.json({ data: await service.getTaskSegments(parsed.data.projectId, parsed.data.taskId) });
  } catch (error) {
    if (error instanceof ScheduleResourceServiceError) rethrowPhase4cServiceError(GET_WHERE, error);
    throw error;
  }
});

export const PUT = withApiGuardrails<{ projectId: string; taskId: string }>(PUT_WHERE, async ({ request, params }) => {
  await requireScheduleApiUser(PUT_WHERE);
  const parsedParams = paramsSchema.safeParse(await params);
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedParams.success || !parsedBody.success) {
    throwScheduleRequestError(PUT_WHERE, "Provide ordered, non-overlapping task segments on the 15-minute grid.");
  }
  try {
    validateTaskScheduleSegments(parsedBody.data.segments.map((segment, index) => ({
      id: `request:${index}`,
      task_id: parsedParams.data.taskId,
      ...segment,
    })));
    const service = new ScheduleResourceService(await createClient());
    const data = await service.replaceTaskSegments(parsedParams.data.projectId, parsedParams.data.taskId, parsedBody.data);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof ScheduleResourceServiceError) rethrowPhase4cServiceError(PUT_WHERE, error);
    if (error instanceof Error) throwScheduleRequestError(PUT_WHERE, error.message, { cause: error });
    throw error;
  }
});

import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { ScheduleResourceService, ScheduleResourceServiceError } from "@/lib/services/schedule-resource-service";
import { requireScheduleApiUser, rethrowPhase4cServiceError } from "@/lib/scheduling/schedule-phase4c-route";
import { throwScheduleRequestError } from "@/lib/scheduling/schedule-route-errors";
import { createClient } from "@/lib/supabase/server";

const WHERE = "projects/[projectId]/scheduling/enterprise-capacity#GET";
const paramsSchema = z.object({ projectId: z.coerce.number().int().positive() });
const querySchema = z.object({
  person_ids: z.string().min(1),
  start: z.iso.datetime({ offset: true }),
  finish: z.iso.datetime({ offset: true }),
});

export const GET = withApiGuardrails<{ projectId: string }>(WHERE, async ({ request, params }) => {
  await requireScheduleApiUser(WHERE);
  const parsedParams = paramsSchema.safeParse(await params);
  const parsedQuery = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsedParams.success || !parsedQuery.success) {
    throwScheduleRequestError(WHERE, "Choose a project, people, and a valid timestamp range of no more than 92 days.");
  }
  const personIds = parsedQuery.data.person_ids.split(",").map((value) => value.trim()).filter(Boolean);
  if (personIds.length > 100 || personIds.some((value) => !z.string().uuid().safeParse(value).success)) {
    throwScheduleRequestError(WHERE, "Enterprise capacity accepts at most 100 valid person identifiers.");
  }
  try {
    const service = new ScheduleResourceService(await createClient());
    const data = await service.getEnterpriseCapacity(
      parsedParams.data.projectId,
      personIds,
      parsedQuery.data.start,
      parsedQuery.data.finish,
    );
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof ScheduleResourceServiceError) rethrowPhase4cServiceError(WHERE, error);
    throw error;
  }
});

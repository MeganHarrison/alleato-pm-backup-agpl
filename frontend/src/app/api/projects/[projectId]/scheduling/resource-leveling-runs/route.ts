import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiGuardrails } from "@/lib/guardrails/api";
import {
  ScheduleResourceService,
  ScheduleResourceServiceError,
} from "@/lib/services/schedule-resource-service";
import {
  requireScheduleApiUser,
  rethrowPhase4cServiceError,
} from "@/lib/scheduling/schedule-phase4c-route";
import { throwScheduleRequestError } from "@/lib/scheduling/schedule-route-errors";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const GET_WHERE = "projects/[projectId]/scheduling/resource-leveling-runs#GET";
const POST_WHERE =
  "projects/[projectId]/scheduling/resource-leveling-runs#POST";
const paramsSchema = z.object({
  projectId: z.coerce.number().int().positive(),
});
const bodySchema = z
  .object({
    range_start: z.string().datetime({ offset: true }),
    range_finish: z.string().datetime({ offset: true }),
  })
  .strict();

export const GET = withApiGuardrails<{ projectId: string }>(
  GET_WHERE,
  async ({ request, params }) => {
    await requireScheduleApiUser(GET_WHERE);
    const parsed = paramsSchema.safeParse(await params);
    const limit = z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(25)
      .safeParse(request.nextUrl.searchParams.get("limit") ?? 25);
    if (!parsed.success || !limit.success)
      throwScheduleRequestError(
        GET_WHERE,
        "Select a valid project and history limit.",
      );
    try {
      const service = new ScheduleResourceService(await createClient());
      return NextResponse.json({
        data: await service.getLevelingHistory(
          parsed.data.projectId,
          limit.data,
        ),
      });
    } catch (error) {
      if (error instanceof ScheduleResourceServiceError)
        rethrowPhase4cServiceError(GET_WHERE, error);
      throw error;
    }
  },
);

export const POST = withApiGuardrails<{ projectId: string }>(
  POST_WHERE,
  async ({ request, params }) => {
    const actor = await requireScheduleApiUser(POST_WHERE);
    const parsedParams = paramsSchema.safeParse(await params);
    const parsedBody = bodySchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsedParams.success || !parsedBody.success) {
      throwScheduleRequestError(
        POST_WHERE,
        "Choose a valid timestamp range for the leveling preview.",
      );
    }
    try {
      const service = new ScheduleResourceService(await createClient());
      return NextResponse.json(
        {
          data: await service.createLevelingRun(
            parsedParams.data.projectId,
            parsedBody.data,
            {
              client: createServiceClient(),
              actorUserId: actor.id,
            },
          ),
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof ScheduleResourceServiceError)
        rethrowPhase4cServiceError(POST_WHERE, error);
      throw error;
    }
  },
);

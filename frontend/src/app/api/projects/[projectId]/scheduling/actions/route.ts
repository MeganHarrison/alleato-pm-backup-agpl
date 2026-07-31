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
import {
  throwScheduleRequestError,
  throwScheduleRpcError,
} from "@/lib/scheduling/schedule-route-errors";
import { createClient } from "@/lib/supabase/server";

const WHERE = "projects/[projectId]/scheduling/actions#POST";
const paramsSchema = z.object({ projectId: z.coerce.number().int().positive() });
const reasonSchema = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .nullable()
  .default(null);

const actionSchema = z.discriminatedUnion("entity_type", [
  z
    .object({
      entity_type: z.literal("baseline"),
      action: z.literal("activate"),
      entity_id: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      entity_type: z.literal("revision"),
      action: z.literal("transition"),
      entity_id: z.string().uuid(),
      payload: z.object({ status: z.enum(["review", "published"]) }).strict(),
    })
    .strict(),
  z
    .object({
      entity_type: z.literal("resource_leveling_run"),
      action: z.literal("apply"),
      entity_id: z.string().uuid(),
      payload: z.object({ reason: reasonSchema }).strict().default({ reason: null }),
    })
    .strict(),
  z
    .object({
      entity_type: z.literal("resource_leveling_event"),
      action: z.literal("undo"),
      entity_id: z.string().uuid(),
      payload: z.object({ reason: reasonSchema }).strict().default({ reason: null }),
    })
    .strict(),
]);

/**
 * Generic action dispatcher for single-entity scheduling verbs (activate a
 * baseline, transition a revision, apply/undo a leveling run). Consolidates
 * what used to be one Vercel route per verb into one dynamic route file —
 * see docs/architecture (Vercel route budget) for why this exists.
 */
export const POST = withApiGuardrails<{ projectId: string }>(
  WHERE,
  async ({ request, params }) => {
    await requireScheduleApiUser(WHERE);
    const parsedParams = paramsSchema.safeParse(await params);
    if (!parsedParams.success) throwScheduleRequestError(WHERE, "Select a valid project.");
    const parsedBody = actionSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
      throwScheduleRequestError(
        WHERE,
        "Provide a valid entity_type, entity_id, and action.",
      );
    }
    const { projectId } = parsedParams.data;
    const body = parsedBody.data;

    switch (body.entity_type) {
      case "baseline": {
        const supabase = await createClient();
        const { data, error } = await supabase.rpc("activate_schedule_baseline", {
          p_project_id: projectId,
          p_baseline_id: body.entity_id,
        });
        if (error) throwScheduleRpcError(WHERE, error);
        return NextResponse.json({ data });
      }
      case "revision": {
        const supabase = await createClient();
        const { data, error } = await supabase.rpc("transition_schedule_revision", {
          p_project_id: projectId,
          p_revision_id: body.entity_id,
          p_to_status: body.payload.status,
        });
        if (error) throwScheduleRpcError(WHERE, error);
        return NextResponse.json({ data });
      }
      case "resource_leveling_run": {
        try {
          const service = new ScheduleResourceService(await createClient());
          const data = await service.applyLevelingRun(
            projectId,
            body.entity_id,
            body.payload.reason,
          );
          return NextResponse.json({ data });
        } catch (error) {
          if (error instanceof ScheduleResourceServiceError) rethrowPhase4cServiceError(WHERE, error);
          throw error;
        }
      }
      case "resource_leveling_event": {
        try {
          const service = new ScheduleResourceService(await createClient());
          const data = await service.undoLevelingEvent(
            projectId,
            body.entity_id,
            body.payload.reason,
          );
          return NextResponse.json({ data });
        } catch (error) {
          if (error instanceof ScheduleResourceServiceError) rethrowPhase4cServiceError(WHERE, error);
          throw error;
        }
      }
    }
  },
);

export const dynamic = "force-dynamic";

import { z } from "zod";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { recordPacketCardFeedback } from "@/lib/ai/services/feedback-event-service";
import { getApiRouteUser } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

const packetCardFeedbackSchema = z.object({
  projectId: z.number().int().positive().nullable().optional(),
  sessionId: z.string().nullable().optional(),
  insightCardId: z.string().uuid(),
  signal: z.enum(["useful", "wrong", "stale"]),
  reason: z.string().trim().max(1000).nullable().optional(),
  correction: z.string().trim().max(2000).nullable().optional(),
  cardSnapshot: z.unknown().optional(),
  metadata: z.unknown().optional(),
});

function toJson(value: unknown): Json {
  return value === undefined ? {} : (value as Json);
}

export const POST = withApiGuardrails(
  "api.ai-assistant.packet-card-feedback.POST",
  async ({ request }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "api.ai-assistant.packet-card-feedback.POST",
        message: "Authentication required.",
        status: 401,
      });
    }

    const body = await parseJsonBody(
      request,
      packetCardFeedbackSchema,
      "api.ai-assistant.packet-card-feedback.POST",
    );

    const result = await recordPacketCardFeedback({
      userId: user.id,
      projectId: body.projectId ?? null,
      sessionId: body.sessionId ?? null,
      insightCardId: body.insightCardId,
      signal: body.signal,
      reason: body.reason ?? null,
      correction: body.correction ?? null,
      cardSnapshot: toJson(body.cardSnapshot),
      metadata: toJson(body.metadata),
    });

    return Response.json({
      success: true,
      reviewId: result.review.id,
      eventId: result.event.id,
      status: result.review.status,
    });
  },
);

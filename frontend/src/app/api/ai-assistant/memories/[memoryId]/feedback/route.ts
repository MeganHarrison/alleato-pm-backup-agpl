import { z } from "zod";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  createLearningPromotion,
  recordAiFeedbackEvent,
} from "@/lib/ai/services/feedback-event-service";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { getApiRouteUser } from "@/lib/supabase/server";

const feedbackSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
  reasonCategory: z
    .enum(["wrong", "outdated", "private", "too_broad", "duplicate", "other"])
    .default("wrong"),
  source: z
    .object({
      surface: z
        .enum(["memory_center", "assistant_answer_memory_trace"])
        .default("memory_center"),
      route: z.string().trim().max(300).optional(),
      messageId: z.string().trim().max(200).optional(),
      sessionId: z.string().trim().max(200).optional(),
    })
    .optional(),
});

export const POST = withApiGuardrails(
  "ai-assistant/memories/[memoryId]/feedback#POST",
  async ({ request, params }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "ai-assistant/memories/[memoryId]/feedback#POST",
        message: "Authentication required.",
      });
    }

    const { memoryId } = params as { memoryId: string };
    const body = await parseJsonBody(
      request,
      feedbackSchema,
      "ai-assistant/memories/[memoryId]/feedback#POST",
    );

    const supabase = createServiceClient();
    const { data: memory, error: memoryError } = await serviceDb.from("ai_memories")
      .select(
        "id, type, content, confidence, importance, project_id, meeting_id, source, visibility, created_at, last_accessed_at, access_count",
      )
      .eq("id", memoryId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (memoryError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "ai-assistant/memories/[memoryId]/feedback#POST",
        message: "Failed to load memory before recording feedback.",
        details: memoryError.message,
      });
    }

    if (!memory) {
      throw new GuardrailError({
        code: "ROUTE_BINDING_MISSING",
        where: "ai-assistant/memories/[memoryId]/feedback#POST",
        message: "Memory was not found or is no longer active.",
        status: 404,
      });
    }

    const source = body.source;
    const surface = source?.surface ?? "memory_center";
    const sourceRoute =
      source?.route ??
      (surface === "assistant_answer_memory_trace"
        ? "/ai"
        : "/settings/memory");

    const event = await recordAiFeedbackEvent({
      userId: user.id,
      projectId: memory.project_id,
      sourceTable: "ai_memories",
      sourceRecordId: memory.id,
      eventType: "ai_memory_marked_wrong",
      eventFamily: "user_preference",
      surface,
      subjectType: "ai_memory",
      subjectId: memory.id,
      signal: "corrected",
      reasonCategory: body.reasonCategory,
      freeText: body.reason,
      beforeSnapshot: memory,
      sourceContext: {
        route: sourceRoute,
        memoryId: memory.id,
        messageId: source?.messageId ?? null,
      },
      sessionId: source?.sessionId ?? null,
      metadata: {
        requestedAction: "review_memory",
        visibility: memory.visibility ?? "private",
      },
    });

    const promotion = await createLearningPromotion({
      promotionType: "workflow_rule",
      projectId: memory.project_id,
      sourceEventIds: [event.id],
      destinationTable: "ai_memories",
      destinationRecordId: memory.id,
      confidence: 0.85,
      riskLevel: memory.visibility === "team" || memory.project_id ? "medium" : "low",
      proposedLearning: {
        action: "review_memory",
        title: "Review memory marked wrong",
        content: memory.content,
        memoryId: memory.id,
        memoryType: memory.type,
        visibility: memory.visibility ?? "private",
        projectId: memory.project_id,
        reasonCategory: body.reasonCategory,
        reason: body.reason,
        sourceSurface: surface,
        sourceRoute,
        sourceMessageId: source?.messageId ?? null,
        recommendedResolution:
          "Review whether this memory should be edited, expired, deactivated, or converted into a more precise skill or preference.",
      },
      reviewNotes:
        surface === "assistant_answer_memory_trace"
          ? "Created from assistant answer memory trace feedback."
          : "Created from Memory Center wrong-memory feedback.",
    });

    return Response.json({
      success: true,
      event,
      promotion,
    });
  },
);

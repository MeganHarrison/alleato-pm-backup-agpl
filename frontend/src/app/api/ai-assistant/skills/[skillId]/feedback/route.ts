import { z } from "zod";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  createLearningPromotion,
  recordAiFeedbackEvent,
  type AiLearningRiskLevel,
} from "@/lib/ai/services/feedback-event-service";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { getApiRouteUser } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

const WHERE = "ai-assistant/skills/[skillId]/feedback#POST";

const feedbackSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
  reasonCategory: z
    .enum(["wrong", "outdated", "too_broad", "too_narrow", "unsafe", "other"])
    .default("wrong"),
  source: z
    .object({
      surface: z
        .enum(["assistant_answer_skill_trace", "skill_library"])
        .default("assistant_answer_skill_trace"),
      route: z.string().trim().max(300).optional(),
      messageId: z.string().trim().max(200).optional(),
      sessionId: z.string().trim().max(200).optional(),
    })
    .optional(),
});

function normalizeRiskLevel(value: string | null): AiLearningRiskLevel {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "medium";
}

function toJsonSnapshot(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export const POST = withApiGuardrails(WHERE, async ({ request, params }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: WHERE,
      message: "Authentication required.",
      status: 401,
    });
  }

  const { skillId } = params as { skillId: string };
  const body = await parseJsonBody(request, feedbackSchema, WHERE);

  const supabase = createServiceClient();
  const { data: skill, error: skillError } = await serviceDb.from("ai_skills")
    .select(
      "id, title, slug, summary, body, instructions, category, scope_type, project_id, owner_user_id, reviewer_user_id, status, version, risk_level, examples, source_event_ids, metadata, created_at, updated_at",
    )
    .eq("id", skillId)
    .maybeSingle();

  if (skillError) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: WHERE,
      message: "Failed to load skill before recording feedback.",
      details: skillError.message,
    });
  }

  if (!skill) {
    throw new GuardrailError({
      code: "ROUTE_BINDING_MISSING",
      where: WHERE,
      message: "Skill was not found.",
      status: 404,
    });
  }

  const source = body.source;
  const surface = source?.surface ?? "assistant_answer_skill_trace";
  const sourceRoute =
    source?.route ??
    (surface === "assistant_answer_skill_trace" ? "/ai" : "/ai/skills");

  const event = await recordAiFeedbackEvent({
    userId: user.id,
    projectId: skill.project_id,
    sourceTable: "ai_skills",
    sourceRecordId: skill.id,
    eventType: "ai_skill_marked_wrong",
    eventFamily: "workflow_outcome",
    surface,
    subjectType: "ai_skill",
    subjectId: skill.id,
    signal: "corrected",
    reasonCategory: body.reasonCategory,
    freeText: body.reason,
    beforeSnapshot: toJsonSnapshot(skill),
    sourceContext: {
      route: sourceRoute,
      skillId: skill.id,
      messageId: source?.messageId ?? null,
    },
    sessionId: source?.sessionId ?? null,
    metadata: {
      requestedAction: "review_skill",
      skillSlug: skill.slug,
      skillVersion: skill.version,
      skillCategory: skill.category,
      skillScope: skill.scope_type,
    },
  });

  const promotion = await createLearningPromotion({
    promotionType: "workflow_rule",
    projectId: skill.project_id,
    sourceEventIds: [event.id],
    destinationTable: "ai_skills",
    destinationRecordId: skill.id,
    confidence: 0.85,
    riskLevel: normalizeRiskLevel(skill.risk_level),
    proposedLearning: {
      action: "review_skill",
      title: "Review skill marked wrong",
      content: skill.summary ?? skill.title,
      skillId: skill.id,
      skillTitle: skill.title,
      skillSlug: skill.slug,
      skillVersion: skill.version,
      skillCategory: skill.category,
      skillScope: skill.scope_type,
      projectId: skill.project_id,
      reasonCategory: body.reasonCategory,
      reason: body.reason,
      sourceSurface: surface,
      sourceRoute,
      sourceMessageId: source?.messageId ?? null,
      recommendedResolution:
        "Review whether this skill should be edited, paused, superseded, narrowed in scope, or converted into a more precise field workflow.",
    },
    reviewNotes:
      surface === "assistant_answer_skill_trace"
        ? "Created from assistant answer skill trace feedback."
        : "Created from Skill Library feedback.",
  });

  return Response.json({
    success: true,
    event,
    promotion,
  });
});

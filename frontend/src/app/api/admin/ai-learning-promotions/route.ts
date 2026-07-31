import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { ingestAdminFeedbackLearning } from "@/lib/ai/services/agent-learning-service";
import {
  applyAgentPreventionPromotion,
  applyAttributionRulePromotion,
  applyMemoryPromotion,
  applyPositiveTaskExamplePromotion,
  applyRetrievalWeightPromotion,
  applySkillLibraryPromotion,
  recordAiFeedbackEvent,
  updateRetrievalWeightStatus,
} from "@/lib/ai/services/feedback-event-service";
import { serviceDb } from "@/lib/supabase/service-db";
import {
  isSkillLibraryPromotion,
  promotionMatchesKind,
  type PromotionKind,
} from "@/lib/ai/learning-promotion-view-model";
import { requireAiLearningPromotionsAdmin } from "./_shared";

const reviewSchema = z
  .object({
    promotionId: z.string().uuid(),
    action: z.enum([
      "approve",
      "reject",
      "apply",
      "retry_feedback",
      "pause",
      "resume",
      "supersede",
    ]),
    reviewNotes: z.string().trim().max(2000).optional(),
  })
  .superRefine((value, context) => {
    if (
      value.action === "reject" &&
      (value.reviewNotes?.trim().length ?? 0) < 10
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reviewNotes"],
        message:
          "Explain what is wrong and how the agent should behave instead (at least 10 characters).",
      });
    }
  });

type ReviewPromotion = {
  id: string;
  status: string;
  project_id: number | null;
  promotion_type: string;
  proposed_learning: unknown;
  confidence: number;
  risk_level: string;
  review_notes: string | null;
};

async function activateRejectedPromotionCorrection(params: {
  promotion: ReviewPromotion;
  reviewNotes: string;
}) {
  const proposedLearning =
    params.promotion.proposed_learning &&
    typeof params.promotion.proposed_learning === "object" &&
    !Array.isArray(params.promotion.proposed_learning)
      ? (params.promotion.proposed_learning as Record<string, unknown>)
      : {};
  const proposedTitle =
    typeof proposedLearning.title === "string" && proposedLearning.title.trim()
      ? proposedLearning.title.trim()
      : params.promotion.promotion_type;
  const sourceRoute =
    typeof proposedLearning.sourceRoute === "string" &&
    proposedLearning.sourceRoute.trim()
      ? proposedLearning.sourceRoute.trim()
      : "/ai/learning-promotions";
  const learning = await ingestAdminFeedbackLearning({
    feedbackItemId: params.promotion.id,
    title: `Rejected learning: ${proposedTitle}`.slice(0, 160),
    comment: params.reviewNotes,
    pagePath: sourceRoute,
    projectId: params.promotion.project_id,
    status: "active",
    resolutionSummary: params.reviewNotes,
  });

  if (!learning) {
    throw new Error("agent learning writer returned no row");
  }

  return learning;
}

async function linkRejectedPromotionLearning(params: {
  promotionId: string;
  learningId: string;
}) {
  const { data, error } = await serviceDb
    .from("ai_learning_promotions")
    .update({
      destination_table: "agent_learnings",
      destination_record_id: params.learningId,
    })
    .eq("id", params.promotionId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ?? "promotion learning link update returned no row",
    );
  }

  return data;
}

export const GET = withApiGuardrails(
  "api.admin.ai-learning-promotions.GET",
  async ({ request }) => {
    await requireAiLearningPromotionsAdmin(
      "api.admin.ai-learning-promotions.GET",
    );

    const status = request.nextUrl.searchParams.get("status") ?? "candidate";
    const limit = Math.min(
      500,
      Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 100)),
    );
    const requestedKind = request.nextUrl.searchParams.get("kind") ?? "all";
    const kind: PromotionKind = [
      "all",
      "teach",
      "skill",
      "memory",
      "retrieval",
      "attribution",
      "agent_prevention",
      "workflow",
    ].includes(requestedKind)
      ? (requestedKind as PromotionKind)
      : "all";

    const { data, error } = await serviceDb
      .from("ai_learning_promotions")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(kind === "all" ? limit : 500);

    if (error) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "api.admin.ai-learning-promotions.GET",
        message: "Failed to load AI learning promotions.",
        details: error.message,
      });
    }

    const promotions = (data ?? [])
      .filter((promotion) => promotionMatchesKind(promotion, kind))
      .slice(0, limit);
    const promotionIds = promotions.map((promotion) => promotion.id);
    const sourceEventIds = Array.from(
      new Set(
        promotions.flatMap((promotion) => promotion.source_event_ids ?? []),
      ),
    );
    const retrievalWeightsByPromotionId = new Map<string, unknown>();
    const sourceEventsById = new Map<string, unknown>();

    if (promotionIds.length > 0) {
      const { data: retrievalWeights, error: retrievalWeightsError } =
        await serviceDb
          .from("ai_retrieval_weights")
          .select("*")
          .in("promotion_id", promotionIds);

      if (retrievalWeightsError) {
        throw new GuardrailError({
          code: "UPSTREAM_FAILURE",
          where: "api.admin.ai-learning-promotions.GET",
          message: "Failed to load applied retrieval weights.",
          details: retrievalWeightsError.message,
        });
      }

      for (const retrievalWeight of retrievalWeights ?? []) {
        retrievalWeightsByPromotionId.set(
          retrievalWeight.promotion_id,
          retrievalWeight,
        );
      }
    }

    if (sourceEventIds.length > 0) {
      const { data: sourceEvents, error: sourceEventsError } = await serviceDb
        .from("ai_feedback_events")
        .select("*")
        .in("id", sourceEventIds);

      if (sourceEventsError) {
        throw new GuardrailError({
          code: "UPSTREAM_FAILURE",
          where: "api.admin.ai-learning-promotions.GET",
          message: "Failed to load AI learning promotion source events.",
          details: sourceEventsError.message,
        });
      }

      for (const sourceEvent of sourceEvents ?? []) {
        sourceEventsById.set(sourceEvent.id, sourceEvent);
      }
    }

    return NextResponse.json({
      promotions: promotions.map((promotion) => ({
        ...promotion,
        retrievalWeight:
          retrievalWeightsByPromotionId.get(promotion.id) ?? null,
        sourceEvents: (promotion.source_event_ids ?? [])
          .map((eventId) => sourceEventsById.get(eventId))
          .filter(Boolean),
      })),
    });
  },
);

export const POST = withApiGuardrails(
  "api.admin.ai-learning-promotions.POST",
  async ({ request }) => {
    const user = await requireAiLearningPromotionsAdmin(
      "api.admin.ai-learning-promotions.POST",
    );
    const body = await parseJsonBody(
      request,
      reviewSchema,
      "api.admin.ai-learning-promotions.POST",
    );

    if (body.action === "apply") {
      const { data: promotion, error: promotionError } = await serviceDb
        .from("ai_learning_promotions")
        .select("*")
        .eq("id", body.promotionId)
        .single();

      if (promotionError || !promotion) {
        throw new GuardrailError({
          code: "ROUTE_BINDING_MISSING",
          where: "api.admin.ai-learning-promotions.POST",
          message: "AI learning promotion was not found.",
          status: 404,
          details: promotionError?.message,
        });
      }

      if (promotion.promotion_type === "retrieval_weight") {
        const result = await applyRetrievalWeightPromotion({
          promotionId: body.promotionId,
          reviewedBy: user.id,
          reviewNotes: body.reviewNotes,
        });

        return NextResponse.json({
          ok: true,
          action: body.action,
          promotion: result.promotion,
          retrievalWeight: result.retrievalWeight,
        });
      }

      if (promotion.promotion_type === "agent_prevention_prompt") {
        const result = await applyAgentPreventionPromotion({
          promotionId: body.promotionId,
          reviewedBy: user.id,
          reviewNotes: body.reviewNotes,
        });

        return NextResponse.json({
          ok: true,
          action: body.action,
          promotion: result.promotion,
          agentLearning: result.agentLearning,
        });
      }

      if (promotion.promotion_type === "positive_task_example") {
        const result = await applyPositiveTaskExamplePromotion({
          promotionId: body.promotionId,
          reviewedBy: user.id,
          reviewNotes: body.reviewNotes,
        });

        return NextResponse.json({
          ok: true,
          action: body.action,
          promotion: result.promotion,
          taskFeedback: result.taskFeedback,
        });
      }

      if (
        promotion.promotion_type === "user_preference" ||
        promotion.promotion_type === "project_lesson"
      ) {
        const result = await applyMemoryPromotion({
          promotionId: body.promotionId,
          reviewedBy: user.id,
          reviewNotes: body.reviewNotes,
        });

        return NextResponse.json({
          ok: true,
          action: body.action,
          promotion: result.promotion,
          memory: result.memory,
        });
      }

      if (promotion.promotion_type === "attribution_rule") {
        const result = await applyAttributionRulePromotion({
          promotionId: body.promotionId,
          reviewedBy: user.id,
          reviewNotes: body.reviewNotes,
        });

        return NextResponse.json({
          ok: true,
          action: body.action,
          promotion: result.promotion,
          attributionCandidate: result.attributionCandidate ?? null,
          attributionRule: result.attributionRule ?? null,
        });
      }

      if (isSkillLibraryPromotion(promotion)) {
        const result = await applySkillLibraryPromotion({
          promotionId: body.promotionId,
          reviewedBy: user.id,
          reviewNotes: body.reviewNotes,
        });

        return NextResponse.json({
          ok: true,
          action: body.action,
          promotion: result.promotion,
          skill: result.skill,
        });
      }

      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "api.admin.ai-learning-promotions.POST",
        message:
          "This AI learning promotion type does not have an apply writer yet.",
        status: 409,
        details: { promotionType: promotion.promotion_type },
      });
    }

    if (
      body.action === "pause" ||
      body.action === "resume" ||
      body.action === "supersede"
    ) {
      const result = await updateRetrievalWeightStatus({
        promotionId: body.promotionId,
        status:
          body.action === "pause"
            ? "paused"
            : body.action === "resume"
              ? "active"
              : "superseded",
        reviewedBy: user.id,
        reviewNotes: body.reviewNotes,
      });

      return NextResponse.json({
        ok: true,
        action: body.action,
        promotion: result.promotion,
        retrievalWeight: result.retrievalWeight,
      });
    }

    const { data: promotion, error: promotionError } = await serviceDb
      .from("ai_learning_promotions")
      .select(
        "id, status, project_id, promotion_type, proposed_learning, confidence, risk_level, review_notes",
      )
      .eq("id", body.promotionId)
      .single();

    if (promotionError || !promotion) {
      throw new GuardrailError({
        code: "ROUTE_BINDING_MISSING",
        where: "api.admin.ai-learning-promotions.POST",
        message: "AI learning promotion was not found.",
        status: 404,
        details: promotionError?.message,
      });
    }

    if (body.action === "retry_feedback") {
      if (promotion.status !== "rejected") {
        throw new GuardrailError({
          code: "INVALID_PAYLOAD",
          where: "api.admin.ai-learning-promotions.POST",
          message:
            "Only rejected learning promotions can retry corrective teaching.",
          status: 409,
          details: { status: promotion.status },
        });
      }

      const reviewNotes = body.reviewNotes ?? promotion.review_notes;
      if (!reviewNotes || reviewNotes.trim().length < 10) {
        throw new GuardrailError({
          code: "INVALID_PAYLOAD",
          where: "api.admin.ai-learning-promotions.POST",
          message:
            "Corrective feedback is required before retrying agent teaching.",
          status: 409,
          details: { promotionId: promotion.id },
        });
      }

      let learning;
      try {
        learning = await activateRejectedPromotionCorrection({
          promotion,
          reviewNotes,
        });
      } catch (learningError) {
        throw new GuardrailError({
          code: "UPSTREAM_FAILURE",
          where: "api.admin.ai-learning-promotions.POST",
          message: "The corrective agent learning could not be activated.",
          status: 502,
          details: {
            promotionId: promotion.id,
            cause:
              learningError instanceof Error
                ? learningError.message
                : "Unknown learning activation failure",
          },
        });
      }

      let linkedPromotion;
      try {
        linkedPromotion = await linkRejectedPromotionLearning({
          promotionId: promotion.id,
          learningId: learning.id,
        });
      } catch (linkError) {
        throw new GuardrailError({
          code: "UPSTREAM_FAILURE",
          where: "api.admin.ai-learning-promotions.POST",
          message:
            "The corrective agent learning was activated, but the review record could not be linked.",
          status: 502,
          details: {
            promotionId: promotion.id,
            agentLearningId: learning.id,
            cause:
              linkError instanceof Error
                ? linkError.message
                : "Unknown promotion link failure",
          },
        });
      }

      let auditWarning: string | undefined;
      try {
        await recordAiFeedbackEvent({
          userId: user.id,
          projectId: promotion.project_id,
          sourceTable: "ai_learning_promotions",
          sourceRecordId: promotion.id,
          eventType: "learning_promotion_feedback_retried",
          eventFamily: "eval_failure",
          surface: "admin_ai_learning_promotions",
          subjectType: "agent_learning",
          subjectId: learning.id,
          signal: "corrected",
          reasonCategory: "learning_promotion_reject_retry",
          freeText: reviewNotes,
          sourceContext: {
            promotionId: promotion.id,
            promotionType: promotion.promotion_type,
          },
          metadata: { action: "retry_feedback" },
        });
      } catch (eventError) {
        auditWarning =
          "Corrective teaching was activated and linked, but its audit event could not be recorded.";
      }

      return NextResponse.json({
        ok: true,
        action: body.action,
        promotion: linkedPromotion,
        agentLearning: learning,
        auditWarning,
      });
    }

    if (promotion.status !== "candidate") {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "api.admin.ai-learning-promotions.POST",
        message: "Only candidate AI learning promotions can be reviewed.",
        status: 409,
        details: { status: promotion.status },
      });
    }

    const status = body.action === "approve" ? "approved" : "rejected";
    const { data: updated, error: updateError } = await serviceDb
      .from("ai_learning_promotions")
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        review_notes: body.reviewNotes ?? null,
      })
      .eq("id", body.promotionId)
      .select("*")
      .single();

    if (updateError || !updated) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "api.admin.ai-learning-promotions.POST",
        message: `Failed to ${body.action} AI learning promotion.`,
        details: updateError?.message,
      });
    }

    let auditWarning: string | undefined;
    try {
      await recordAiFeedbackEvent({
        userId: user.id,
        projectId: promotion.project_id,
        sourceTable: "ai_learning_promotions",
        sourceRecordId: promotion.id,
        eventType: "learning_promotion_reviewed",
        eventFamily:
          promotion.promotion_type === "retrieval_weight"
            ? "retrieval"
            : "workflow_outcome",
        surface: "admin_ai_learning_promotions",
        subjectType: "ai_learning_promotion",
        subjectId: promotion.id,
        signal: body.action === "approve" ? "accepted" : "needs_review",
        reasonCategory: `learning_promotion_${body.action}`,
        freeText: body.reviewNotes ?? null,
        beforeSnapshot: {
          status: promotion.status,
          confidence: promotion.confidence,
          riskLevel: promotion.risk_level,
        },
        afterSnapshot: {
          status: updated.status,
          confidence: updated.confidence,
          riskLevel: updated.risk_level,
        },
        sourceContext: {
          promotionId: promotion.id,
          promotionType: promotion.promotion_type,
          proposedLearning: promotion.proposed_learning,
        },
        metadata: {
          action: body.action,
          previousStatus: promotion.status,
          newStatus: updated.status,
        },
      });
    } catch (eventError) {
      if (body.action === "approve") throw eventError;
      auditWarning =
        "The rejection was saved, but its review audit event could not be recorded.";
    }

    let responsePromotion = updated;
    if (body.action === "reject") {
      try {
        const learning = await activateRejectedPromotionCorrection({
          promotion,
          reviewNotes: body.reviewNotes!,
        });
        responsePromotion = await linkRejectedPromotionLearning({
          promotionId: promotion.id,
          learningId: learning.id,
        });
      } catch (learningError) {
        throw new GuardrailError({
          code: "UPSTREAM_FAILURE",
          where: "api.admin.ai-learning-promotions.POST",
          message:
            "The rejection was saved, but the corrective agent learning was not activated.",
          status: 502,
          details: {
            promotionId: promotion.id,
            recovery:
              "Open the Rejected tab and use Retry teaching after the agent learning writer is restored.",
            cause:
              learningError instanceof Error
                ? learningError.message
                : "Unknown learning activation failure",
          },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      action: body.action,
      promotion: responsePromotion,
      auditWarning,
    });
  },
);

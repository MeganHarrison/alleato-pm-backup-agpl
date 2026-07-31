import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { serviceDb } from "@/lib/supabase/service-db";
import { requireAiLearningPromotionsAdmin } from "../_shared";

type PromotionStatus = "candidate" | "approved" | "applied" | "rejected" | "superseded";
type RetrievalWeightStatus = "active" | "paused" | "superseded";

async function countRows(
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>,
  label: string,
): Promise<number> {
  const { count, error } = await query;
  if (error) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "api.admin.ai-learning-promotions.stats.GET",
      message: `Failed to count ${label}.`,
      details: error.message,
    });
  }
  return count ?? 0;
}

export const GET = withApiGuardrails(
  "api.admin.ai-learning-promotions.stats.GET",
  async () => {
    await requireAiLearningPromotionsAdmin(
      "api.admin.ai-learning-promotions.stats.GET",
    );

        const promotionStatuses: PromotionStatus[] = [
      "candidate",
      "approved",
      "applied",
      "rejected",
      "superseded",
    ];
    const retrievalWeightStatuses: RetrievalWeightStatus[] = [
      "active",
      "paused",
      "superseded",
    ];

    const promotionCounts = await Promise.all(
      promotionStatuses.map(async (status) => [
        status,
        await countRows(
          serviceDb.from("ai_learning_promotions")
            .select("id", { count: "exact", head: true })
            .eq("status", status),
          `${status} promotions`,
        ),
      ] as const),
    );
    const retrievalWeightCounts = await Promise.all(
      retrievalWeightStatuses.map(async (status) => [
        status,
        await countRows(
          serviceDb.from("ai_retrieval_weights")
            .select("id", { count: "exact", head: true })
            .eq("status", status),
          `${status} retrieval weights`,
        ),
      ] as const),
    );
    const recentActivityCount = await countRows(
      serviceDb.from("ai_feedback_events")
        .select("id", { count: "exact", head: true })
        .eq("surface", "admin_ai_learning_promotions"),
      "learning activity events",
    );

    return NextResponse.json({
      promotions: Object.fromEntries(promotionCounts),
      retrievalWeights: Object.fromEntries(retrievalWeightCounts),
      recentActivityCount,
    });
  },
);

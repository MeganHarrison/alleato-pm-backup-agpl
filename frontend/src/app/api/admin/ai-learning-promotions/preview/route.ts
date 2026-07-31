import { NextResponse } from "next/server";
import { z } from "zod";

import { previewRetrievalWeightPromotionImpact } from "@/lib/ai/services/feedback-event-service";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { requireAiLearningPromotionsAdmin } from "../_shared";

const previewSchema = z.object({
  promotionId: z.string().uuid(),
  limit: z.number().int().min(5).max(25).optional(),
});

export const POST = withApiGuardrails(
  "api.admin.ai-learning-promotions.preview.POST",
  async ({ request }) => {
    await requireAiLearningPromotionsAdmin(
      "api.admin.ai-learning-promotions.preview.POST",
    );
    const body = await parseJsonBody(
      request,
      previewSchema,
      "api.admin.ai-learning-promotions.preview.POST",
    );

    const preview = await previewRetrievalWeightPromotionImpact({
      promotionId: body.promotionId,
      limit: body.limit,
    });

    return NextResponse.json(preview);
  },
);

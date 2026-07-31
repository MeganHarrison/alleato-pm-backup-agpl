export const dynamic = "force-dynamic";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  submitTeachAlleatoIntake,
  teachAlleatoIntakeSchema,
} from "@/lib/ai/services/teach-alleato-intake-service";
import { getApiRouteUser } from "@/lib/supabase/server";

const WHERE = "/api/ai-assistant/teach#POST";

export const POST = withApiGuardrails(WHERE, async ({ request }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: WHERE,
      message: "Authentication required.",
      status: 401,
    });
  }

  const body = await parseJsonBody(request, teachAlleatoIntakeSchema, WHERE);
  const result = await submitTeachAlleatoIntake({
    userId: user.id,
    intake: body,
  });

  return Response.json({
    success: true,
    eventId: result.event.id,
    promotionIds: result.promotions.map((promotion) => promotion.id),
    storedIn: {
      event: "ai_feedback_events",
      promotions: "ai_learning_promotions",
    },
  });
});

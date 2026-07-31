export const dynamic = "force-dynamic";

import { z } from "zod";
import { withApiGuardrails, parseJsonBody } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { updateMarketingCalendarItem } from "@/lib/ai/services/marketing-service";
import { marketingError } from "../../_utils";

type RouteParams = { calendarItemId: string };

const WHERE_PATCH = "ai-assistant/marketing/calendar/[calendarItemId]#PATCH";

const updateCalendarSchema = z.object({
  status: z.enum(["draft", "needs_review", "approved", "scheduled", "published", "archived"]).optional(),
  reviewNotes: z.string().optional(),
});

export const PATCH = withApiGuardrails<RouteParams>(
  WHERE_PATCH,
  async ({ request, params }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: WHERE_PATCH,
        message: "Authentication required to update marketing calendar items.",
      });
    }

    const body = await parseJsonBody(request, updateCalendarSchema, WHERE_PATCH);
    if (!body.status && body.reviewNotes === undefined) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: WHERE_PATCH,
        message: "At least one calendar update field is required.",
      });
    }

    try {
      const metadata = body.reviewNotes
        ? { reviewNotes: body.reviewNotes, reviewedBy: user.id, reviewedAt: new Date().toISOString() }
        : undefined;
      const item = await updateMarketingCalendarItem(params.calendarItemId, {
        ...(body.status ? { status: body.status } : {}),
        ...(metadata ? { metadata } : {}),
        owner_user_id: user.id,
      });
      return Response.json({ item });
    } catch (error) {
      throw marketingError(error, WHERE_PATCH);
    }
  },
);

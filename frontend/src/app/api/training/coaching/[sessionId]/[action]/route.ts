import { NextResponse } from "next/server";

import {
  publishCoachingSessionSchema,
  shareAssessmentSchema,
} from "@/features/training/coaching-session";
import { createCoachingDataAccess } from "@/features/training/coaching-session-server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient } from "@/lib/supabase/server";

const WHERE = "training/coaching/[sessionId]/[action]";

type RouteParams = { sessionId: string; action: string };

const ACTION_MESSAGES: Record<string, string> = {
  confirm: "Sign in again to confirm this plan.",
  publish: "Sign in again to publish this plan.",
  share: "Sign in again to share your assessment.",
};

export const POST = withApiGuardrails<RouteParams>(
  `${WHERE}#POST`,
  async ({ request, params }) => {
    const where = `${WHERE}#POST:${params.action}`;
    const user = await getCurrentUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where,
        message: ACTION_MESSAGES[params.action] ?? "Sign in again to continue.",
      });
    }
    const dal = createCoachingDataAccess(await createClient(), user.id);

    switch (params.action) {
      case "confirm": {
        const view = await dal.confirmPlan(params.sessionId);
        return NextResponse.json({ view });
      }
      case "publish": {
        const input = await parseJsonBody(
          request,
          publishCoachingSessionSchema,
          where,
        );
        const session = await dal.publish(params.sessionId, input);
        return NextResponse.json({ session });
      }
      case "share": {
        const input = await parseJsonBody(request, shareAssessmentSchema, where);
        const view = await dal.shareAssessment(params.sessionId, input.checkinId);
        return NextResponse.json({ view });
      }
      default:
        throw new GuardrailError({
          code: "NOT_FOUND",
          where,
          message: "Unknown coaching session action.",
        });
    }
  },
);

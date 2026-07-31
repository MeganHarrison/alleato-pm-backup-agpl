import { NextResponse } from "next/server";

import { saveCoachingDraftSchema } from "@/features/training/coaching-session";
import { createCoachingDataAccess } from "@/features/training/coaching-session-server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient } from "@/lib/supabase/server";

const WHERE = "training/coaching/[sessionId]";

type RouteParams = { sessionId: string };

async function requireCoachingAccess(where: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Sign in again to use coaching sessions.",
    });
  }
  return createCoachingDataAccess(await createClient(), user.id);
}

export const GET = withApiGuardrails<RouteParams>(
  `${WHERE}#GET`,
  async ({ params }) => {
    const dal = await requireCoachingAccess(`${WHERE}#GET`);
    const view = await dal.getView(params.sessionId);
    return NextResponse.json({ view });
  },
);

export const PUT = withApiGuardrails<RouteParams>(
  `${WHERE}#PUT`,
  async ({ request, params }) => {
    const dal = await requireCoachingAccess(`${WHERE}#PUT`);
    const input = await parseJsonBody(
      request,
      saveCoachingDraftSchema,
      `${WHERE}#PUT`,
    );
    const view = await dal.saveDraft(params.sessionId, input);
    return NextResponse.json({ view });
  },
);

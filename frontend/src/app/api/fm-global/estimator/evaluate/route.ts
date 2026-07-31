import { NextResponse } from "next/server";

import { asrsEstimatorRequestSchema } from "@/lib/fmds/asrs-estimator";
import { evaluateAsrsConfiguration } from "@/lib/fmds/asrs-estimator.server";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";

const WHERE = "fm-global/estimator/evaluate#POST";

export const dynamic = "force-dynamic";

export const POST = withApiGuardrails(WHERE, async ({ request }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: WHERE,
      message: "Authentication required.",
    });
  }

  const input = await parseJsonBody(request, asrsEstimatorRequestSchema, WHERE);
  const result = await evaluateAsrsConfiguration(input);
  return NextResponse.json(result);
});

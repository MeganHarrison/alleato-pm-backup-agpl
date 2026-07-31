/**
 * Company-level estimates API — cross-project list
 * GET /api/estimates?type=asrs|design_build|all
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { EstimateService } from "@/lib/services/estimate-service";

export const GET = withApiGuardrails(
  "estimates#GET",
  async ({ request }) => {
  
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "estimates#GET", message: "Authentication required." });
    }

    const { searchParams } = new URL(request.url);
    const estimateType = searchParams.get("type") ?? "all";

    const service = new EstimateService(supabase);
    const data = await service.listAll(estimateType === "all" ? null : estimateType);

    return NextResponse.json({ data });
    },
);

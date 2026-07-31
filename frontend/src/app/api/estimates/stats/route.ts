/**
 * Estimate type stats for the company-level hub page
 * GET /api/estimates/stats
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { EstimateService } from "@/lib/services/estimate-service";

export const GET = withApiGuardrails(
  "estimates/stats#GET",
  async () => {
  
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "estimates/stats#GET", message: "Authentication required." });
    }

    const service = new EstimateService(supabase);
    const stats = await service.getTypeStats();

    return NextResponse.json({ stats });
    },
);

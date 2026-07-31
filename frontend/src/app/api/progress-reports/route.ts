import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requireDeveloperApi } from "@/lib/auth/require-developer";
import { listAllProgressReports } from "@/lib/progress-reports/server";
import { getApiRouteUserFromRequest } from "@/lib/supabase/server";

export const GET = withApiGuardrails(
  "progress-reports#GET",
  async ({ request }) => {
    const developerGuard = await requireDeveloperApi(request);
    if (developerGuard) return developerGuard;

    const user = await getApiRouteUserFromRequest(request);
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "progress-reports#GET",
        message: "Authentication required.",
      });
    }

    const reports = await listAllProgressReports();
    return NextResponse.json({ reports });
  },
);

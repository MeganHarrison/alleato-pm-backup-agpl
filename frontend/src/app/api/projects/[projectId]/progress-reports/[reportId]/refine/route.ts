import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requireDeveloperApi } from "@/lib/auth/require-developer";
import { getApiRouteUserFromRequest } from "@/lib/supabase/server";
import { refineProgressReport } from "@/lib/progress-reports/server";

export const POST = withApiGuardrails(
  "projects/[projectId]/progress-reports/[reportId]/refine#POST",
  async ({ request, params }) => {
    const developerGuard = await requireDeveloperApi(request);
    if (developerGuard) return developerGuard;
    const user = await getApiRouteUserFromRequest(request);
    if (!user)
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "progress-report-refine",
        message: "Authentication required.",
      });
    const { projectId, reportId } = await params;
    const numericProjectId = Number.parseInt(projectId, 10);
    if (!Number.isFinite(numericProjectId))
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    const detail = await refineProgressReport({
      projectId: numericProjectId,
      reportId,
      userId: user.id,
    });
    return NextResponse.json(detail);
  },
);

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requireDeveloperApi } from "@/lib/auth/require-developer";
import { getApiRouteUserFromRequest } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";
import { NextResponse } from "next/server";
import { assembleProgressReportFromDeepRead } from "@/lib/progress-reports/assemble-from-deep-read";

export const dynamic = "force-dynamic";

/**
 * POST /api/projects/[projectId]/progress-reports/[reportId]/refresh-from-deep-read
 *
 * Cheap, no-LLM refresh: reshapes the latest daily deep read into the report's
 * sections and returns them for the editor to preview and save. Same content the
 * nightly cron produces — this just lets a PM pull it on demand.
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/progress-reports/[reportId]/refresh-from-deep-read#POST",
  async ({ request, params }) => {
    const developerGuard = await requireDeveloperApi(request);
    if (developerGuard) return developerGuard;

    const user = await getApiRouteUserFromRequest(request);
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/progress-reports/[reportId]/refresh-from-deep-read#POST",
        message: "Authentication required.",
      });
    }

    const { projectId, reportId } = await params;
    const numericProjectId = Number.parseInt(projectId, 10);
    if (!Number.isFinite(numericProjectId)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const sections = await assembleProgressReportFromDeepRead(numericProjectId);
    if (!sections) {
      return NextResponse.json(
        { error: "No daily deep read is available for this project yet. Try again after the next run." },
        { status: 404 },
      );
    }

    // internal_notes is cron-managed (not an editor field), so persist it here
    // directly to keep it from the same packet as the returned client sections.
    // The three visible sections are returned for the editor to preview and save.
        await serviceDb.from("project_progress_reports")
      .update({ internal_notes: sections.internal_notes })
      .eq("id", reportId)
      .eq("project_id", numericProjectId);

    return NextResponse.json({
      past_week_highlights: sections.past_week_highlights,
      upcoming_week_activities: sections.upcoming_week_activities,
      open_items: sections.open_items,
    });
  },
);

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requireDeveloperApi } from "@/lib/auth/require-developer";
import { getApiRouteUserFromRequest } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";
import { NextResponse } from "next/server";
import { generateProgressReportSections } from "@/lib/progress-reports/ai-generate";
import { recordProgressReportAiGeneratedDecision } from "@/lib/progress-reports/ai-notifications";

export const dynamic = "force-dynamic";

export const POST = withApiGuardrails(
  "projects/[projectId]/progress-reports/[reportId]/ai-generate#POST",
  async ({ request, params }) => {
    const developerGuard = await requireDeveloperApi(request);
    if (developerGuard) return developerGuard;

    const user = await getApiRouteUserFromRequest(request);
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/progress-reports/[reportId]/ai-generate#POST",
        message: "Authentication required.",
      });
    }

    const { projectId, reportId } = await params;
    const numericProjectId = Number.parseInt(projectId, 10);
    if (!Number.isFinite(numericProjectId)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }


    const { data: report, error: reportError } = await serviceDb.from("project_progress_reports")
      .select("id, week_start, week_end, project_id")
      .eq("id", reportId)
      .eq("project_id", numericProjectId)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    try {
      const sections = await generateProgressReportSections({
        projectId: numericProjectId,
        weekStart: report.week_start as string,
        weekEnd: report.week_end as string,
      });
      const notificationDecision =
        await recordProgressReportAiGeneratedDecision({
          userId: user.id,
          projectId: numericProjectId,
          reportId,
          weekStart: report.week_start as string,
          weekEnd: report.week_end as string,
        });
      if (notificationDecision.status === "failed") {
        console.warn(
          JSON.stringify({
            event: "progress_report_ai_notification_decision_failed",
            projectId: numericProjectId,
            reportId,
            userId: user.id,
            error: notificationDecision.error,
          }),
        );
      }
      return NextResponse.json(sections);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "AI generation failed" },
        { status: 500 },
      );
    }
  },
);

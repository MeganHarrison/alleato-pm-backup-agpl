import { after, NextResponse } from "next/server";
import { z } from "zod";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requireDeveloperApi } from "@/lib/auth/require-developer";
import { getApiRouteUserFromRequest } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";
import {
  createProgressReportDraft,
  listProgressReports,
} from "@/lib/progress-reports/server";
import { generateProgressReportSections } from "@/lib/progress-reports/ai-generate";

const createSchema = z.object({
  weekStart: z.string().optional(),
  weekEnd: z.string().optional(),
});

function reportProgressReportEnrichmentFailure(details: Record<string, unknown>) {
  console.warn(JSON.stringify({
    event: "progress_report_ai_enrichment_failed",
    timestamp: new Date().toISOString(),
    ...details,
  }));
}

async function enrichProgressReportDraft({
  projectId,
  reportId,
  userId,
}: {
  projectId: number;
  reportId: string;
  userId: string;
}) {
  const { data: report } = await serviceDb
    .from("project_progress_reports")
    .select("week_start, week_end")
    .eq("id", reportId)
    .single();

  if (!report) return;

  const sections = await generateProgressReportSections({
    projectId,
    weekStart: report.week_start as string,
    weekEnd: report.week_end as string,
  });

  await serviceDb
    .from("project_progress_reports")
    .update({
      past_week_highlights: sections.past_week_highlights,
      upcoming_week_activities: sections.upcoming_week_activities,
      open_items: sections.open_items,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reportId);
}

function scheduleProgressReportEnrichment(task: () => Promise<void>) {
  try {
    after(() => task());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("outside a request scope")) {
      throw error;
    }
    void task();
  }
}

export const GET = withApiGuardrails(
  "projects/[projectId]/progress-reports#GET",
  async ({ request, params }) => {
    const developerGuard = await requireDeveloperApi(request);
    if (developerGuard) return developerGuard;

    const user = await getApiRouteUserFromRequest(request);
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/progress-reports#GET",
        message: "Authentication required.",
      });
    }

    const { projectId } = await params;
    const numericProjectId = Number.parseInt(projectId, 10);
    if (!Number.isFinite(numericProjectId)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const reports = await listProgressReports(numericProjectId);
    return NextResponse.json({ reports });
  },
);

export const POST = withApiGuardrails(
  "projects/[projectId]/progress-reports#POST",
  async ({ request, params }) => {
    const developerGuard = await requireDeveloperApi(request);
    if (developerGuard) return developerGuard;

    const user = await getApiRouteUserFromRequest(request);
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/progress-reports#POST",
        message: "Authentication required.",
      });
    }

    const { projectId } = await params;
    const numericProjectId = Number.parseInt(projectId, 10);
    if (!Number.isFinite(numericProjectId)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const body = createSchema.parse(await request.json().catch(() => ({})));
    const result = await createProgressReportDraft({
      projectId: numericProjectId,
      userId: user.id,
      userEmail: user.email ?? null,
      weekStart: body.weekStart,
      weekEnd: body.weekEnd,
    });

    if (result.action !== "skipped") {
      scheduleProgressReportEnrichment(async () => {
        try {
          await enrichProgressReportDraft({
            projectId: numericProjectId,
            reportId: result.reportId,
            userId: user.id,
          });
        } catch (error) {
          reportProgressReportEnrichmentFailure({
            projectId: numericProjectId,
            reportId: result.reportId,
            userId: user.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    }

    return NextResponse.json(result, { status: 201 });
  },
);

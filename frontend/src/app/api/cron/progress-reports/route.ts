export const dynamic = "force-dynamic";

/**
 * POST /api/cron/progress-reports
 *
 * Weekly cron job (Monday 8am UTC) that auto-creates a draft progress report
 * for every active project that doesn't already have one for the current week.
 * Uses `createProgressReportDraft()` which is idempotent — safe to re-run.
 *
 * Secured via CRON_SECRET env var (set in Vercel).
 */

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/supabase/service-db";
import { createProgressReportDraft, PROGRESS_REPORT_CRON_USER_ID } from "@/lib/progress-reports/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { logEvent } from "@/lib/guardrails/observability";
import { logger } from "@/lib/logger";

export const maxDuration = 120;

const CRON_USER_ID = PROGRESS_REPORT_CRON_USER_ID;
const CRON_USER_EMAIL = "cron@alleato.internal";

export const POST = withApiGuardrails("/api/cron/progress-reports#POST", async ({ request, requestId }) => {
  const cronSecret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "/api/cron/progress-reports#POST",
      message: "Unauthorized cron invocation.",
      status: 401,
      severity: "medium",
    });
  }


  const { data: projects, error: projectsError } = await serviceDb.from("projects")
    .select("id, name")
    .eq("archived", false);

  if (projectsError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/cron/progress-reports#POST",
      message: "Failed to fetch active projects.",
      details: { reason: projectsError.message },
      cause: projectsError,
    });
  }

  if (!projects || projects.length === 0) {
    return NextResponse.json({ success: true, projectsChecked: 0, reportsCreated: 0 });
  }

  let created = 0;
  let refreshed = 0;
  let skipped = 0;
  const errors: Array<{ projectId: number; reason: string }> = [];

  for (const project of projects) {
    try {
      const result = await createProgressReportDraft({
        projectId: project.id,
        userId: CRON_USER_ID,
        userEmail: CRON_USER_EMAIL,
      });

      if (result.action === "created") {
        created++;
      } else if (result.action === "refreshed") {
        refreshed++;
      } else {
        skipped++;
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      logger.error({ msg: `[cron/progress-reports] Failed for project ${project.id}:`, data: reason });
      errors.push({ projectId: project.id, reason });
    }
  }

  logEvent({
    event: "background_job_completed",
    requestId,
    where: "/api/cron/progress-reports#POST",
    details: {
      projects_checked: projects.length,
      reports_created: created,
      reports_refreshed: refreshed,
      skipped,
      errors: errors.length,
    },
  });

  return NextResponse.json({
    success: true,
    projectsChecked: projects.length,
    reportsCreated: created,
    reportsRefreshed: refreshed,
    skipped,
    errors,
    runAt: new Date().toISOString(),
  });
});

// Vercel cron invocations are HTTP GET (vercel.com/docs/cron-jobs); auth still requires CRON_SECRET.
export const GET = POST;

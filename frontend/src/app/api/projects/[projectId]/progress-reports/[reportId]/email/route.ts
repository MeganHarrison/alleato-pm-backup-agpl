import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requireDeveloperApi } from "@/lib/auth/require-developer";
import { renderPdfFromHtml } from "@/lib/documents/pdf";
import { sendDocumentEmail } from "@/lib/documents/email";
import {
  buildProgressReportEmailHtml, buildProgressReportPdfLayout, } from "@/lib/progress-reports/pdf";
import { getProgressReportDetail } from "@/lib/progress-reports/server";
import { getApiRouteUserFromRequest } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";

const emailSchema = z.object({
  recipients: z.array(z.string().email()).min(1),
  note: z.string().optional().nullable(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiGuardrails(
  "projects/[projectId]/progress-reports/[reportId]/email#POST",
  async ({ request, params }) => {
    const developerGuard = await requireDeveloperApi(request);
    if (developerGuard) return developerGuard;

    const user = await getApiRouteUserFromRequest(request);
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/progress-reports/[reportId]/email#POST",
        message: "Authentication required.",
      });
    }

    const { projectId, reportId } = await params;
    const numericProjectId = Number.parseInt(projectId, 10);
    if (!Number.isFinite(numericProjectId)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const body = emailSchema.parse(await request.json());

    const [detail, projectResult, profileResult] = await Promise.all([
      getProgressReportDetail(numericProjectId, reportId),
      serviceDb.from("projects")
        .select("name, project_number, address")
        .eq("id", numericProjectId)
        .single(),
      serviceDb.from("user_profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    if (projectResult.error || !projectResult.data) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const layout = buildProgressReportPdfLayout({
      project: projectResult.data,
      report: detail.report,
      selectedPhotos: detail.selectedPhotos,
    });
    const pdfBuffer = await renderPdfFromHtml(layout.html, {
      footerOverlayPlan: layout.footerOverlayPlan,
    });
    const projectName = projectResult.data.name ?? "Project";
    const safeName = projectName
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    const filename = `${safeName || "project"}-progress-report-${detail.report.week_end}.pdf`;
    const senderName =
      profileResult.data?.full_name ?? user.email ?? "Alleato Project Team";
    const subject = `${projectName} Weekly Progress Report (${detail.report.week_start} to ${detail.report.week_end})`;
    const emailHtml = buildProgressReportEmailHtml({
      projectName,
      weekStart: detail.report.week_start,
      weekEnd: detail.report.week_end,
      senderName,
      note: body.note ?? null,
    });

    await sendDocumentEmail({
      to: body.recipients,
      subject,
      html: emailHtml,
      text: `${senderName} sent the latest weekly progress report for ${projectName}. The PDF report is attached.`,
      attachments: [
        {
          filename,
          content: pdfBuffer.toString("base64"),
        },
      ],
      audit: {
        template: "project-progress-report",
        entity: { type: "progress_report", id: reportId },
        userId: user.id,
        metadata: {
          project_id: numericProjectId,
          project_name: projectName,
          week_start: detail.report.week_start,
          week_end: detail.report.week_end,
          recipients: body.recipients,
        },
      },
    });

    await serviceDb.from("project_progress_reports")
      .update({
        client_recipients: body.recipients,
        status: "sent",
        sent_at: new Date().toISOString(),
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("project_id", numericProjectId)
      .eq("id", reportId);

    return NextResponse.json({ ok: true });
  },
);

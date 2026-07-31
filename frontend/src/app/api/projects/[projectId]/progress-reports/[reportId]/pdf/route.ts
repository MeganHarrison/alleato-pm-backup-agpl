import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requireDeveloperApi } from "@/lib/auth/require-developer";
import { renderPdfFromHtml } from "@/lib/documents/pdf";
import { buildProgressReportPdfLayout } from "@/lib/progress-reports/pdf";
import {
  getProgressReportDetail, listProjectTeamContacts, resolveProgressReportContacts, } from "@/lib/progress-reports/server";
import { getApiRouteUserFromRequest } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiGuardrails(
  "projects/[projectId]/progress-reports/[reportId]/pdf#GET",
  async ({ request, params }) => {
    const developerGuard = await requireDeveloperApi(request);
    if (developerGuard) return developerGuard;

    const user = await getApiRouteUserFromRequest(request);
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/progress-reports/[reportId]/pdf#GET",
        message: "Authentication required.",
      });
    }

    const { projectId, reportId } = await params;
    const numericProjectId = Number.parseInt(projectId, 10);
    if (!Number.isFinite(numericProjectId)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

        const [detail, projectResult, projectTeamContacts] = await Promise.all([
      getProgressReportDetail(numericProjectId, reportId),
      serviceDb.from("projects")
        .select("name, project_number, address")
        .eq("id", numericProjectId)
        .single(),
      listProjectTeamContacts(numericProjectId),
    ]);

    if (projectResult.error || !projectResult.data) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const audience = url.searchParams.get("audience") === "internal" ? "internal" : "client";
    const length = url.searchParams.get("length") === "brief" ? "brief" : "detailed";

    const layout = buildProgressReportPdfLayout({
      project: projectResult.data,
      report: {
        ...detail.report,
        contacts: resolveProgressReportContacts(projectTeamContacts, detail.report.contacts),
      },
      selectedPhotos: detail.selectedPhotos,
      view: { audience, length },
    });

    // Preview path: return the exact branded HTML the PDF is rendered from, so the
    // in-app "Preview Report" shows a faithful render of the printed document
    // without paying for a full PDF render. Same source of truth as the PDF.
    if (url.searchParams.get("format") === "html") {
      return new NextResponse(layout.html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "private, no-store",
        },
      });
    }

    const pdfBuffer = await renderPdfFromHtml(layout.html, {
      footerOverlayPlan: layout.footerOverlayPlan,
    });
    const safeName = (projectResult.data.name ?? "project")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    const filename = `${safeName || "project"}-progress-report-${audience}-${length}-${detail.report.week_end}.pdf`;
    const disposition =
      url.searchParams.get("disposition") === "inline" ? "inline" : "attachment";

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  },
);

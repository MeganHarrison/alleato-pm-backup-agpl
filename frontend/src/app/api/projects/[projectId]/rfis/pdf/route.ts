import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions-guard";
import { buildBrandedLogTableHtml, renderPdfFromHtml } from "@/lib/documents/pdf";
import {
  buildBrandedDocumentHtml,
  buildBrandedFooterTemplate,
  BRANDED_FOOTER_MARGIN,
} from "@/lib/documents/branded-letterhead";

// Puppeteer requires the Node.js runtime — Edge runtime does not support it.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-US");
}

/**
 * GET /api/projects/[projectId]/rfis/pdf
 * Renders a branded, Procore-style formatted "RFI Log" PDF covering every
 * RFI on the project.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/rfis/pdf#GET",
  async ({ params }) => {
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    const guard = await requirePermission(projectIdNum, "rfis", "read");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    const { data: project } = await supabase
      .from("projects")
      .select("name, project_number")
      .eq("id", projectIdNum)
      .single();

    const { data, error } = await supabase
      .from("rfis")
      .select(
        "number, subject, status, ball_in_court, rfi_manager, responsible_contractor, date_initiated, due_date, closed_date",
      )
      .eq("project_id", projectIdNum)
      .order("number");

    if (error) {
      throw new GuardrailError({ code: "INTERNAL_ERROR", where: "GET /api/projects/[projectId]/rfis/pdf", message: "Failed to load RFIs", cause: error });
    }

    const rows = data ?? [];

    const columns = [
      { label: "#", align: "left" as const },
      { label: "Subject", align: "left" as const },
      { label: "Status", align: "left" as const },
      { label: "Ball In Court", align: "left" as const },
      { label: "RFI Manager", align: "left" as const },
      { label: "Responsible Contractor", align: "left" as const },
      { label: "Date Initiated", align: "left" as const },
      { label: "Due Date", align: "left" as const },
      { label: "Closed Date", align: "left" as const },
    ];

    const tableRows = rows.map((r) => [
      r.number,
      r.subject,
      r.status,
      r.ball_in_court,
      r.rfi_manager,
      r.responsible_contractor,
      formatDate(r.date_initiated),
      formatDate(r.due_date),
      formatDate(r.closed_date),
    ]);

    const bodyHtml = buildBrandedLogTableHtml({
      columns,
      rows: tableRows,
      emptyMessage: "No RFIs found.",
    });

    const projectLabel = project
      ? [project.project_number, project.name].filter(Boolean).join(" — ")
      : `Project ${projectId}`;

    const html = buildBrandedDocumentHtml({
      title: "RFI Log",
      subtitle: projectLabel,
      detail: `${rows.length} RFI${rows.length === 1 ? "" : "s"}`,
      bodyHtml,
      renderFooterInBody: false,
      contentWidth: "100%",
    });

    const pdfBuffer = await renderPdfFromHtml(html, {
      landscape: true,
      footerTemplate: buildBrandedFooterTemplate(),
      marginBottom: BRANDED_FOOTER_MARGIN,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="rfi-log-${projectId}.pdf"`,
      },
    });
  },
);

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
 * GET /api/projects/[projectId]/submittals/pdf
 * Renders a branded, Procore-style formatted "Submittal Log" PDF covering
 * every non-deleted submittal on the project.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/submittals/pdf#GET",
  async ({ params }) => {
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    const guard = await requirePermission(projectIdNum, "submittals", "read");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    const { data: project } = await supabase
      .from("projects")
      .select("name, project_number")
      .eq("id", projectIdNum)
      .single();

    const { data, error } = await supabase
      .from("submittals")
      .select(
        `id, submittal_number, revision, title, status, specification_section,
         division, ball_in_court, final_due_date, sent_date, created_at,
         submittal_type:submittal_types(name),
         submittal_package:submittal_packages(name)`,
      )
      .eq("project_id", projectIdNum)
      .is("deleted_at", null)
      .order("submittal_number");

    if (error) {
      throw new GuardrailError({ code: "INTERNAL_ERROR", where: "GET /api/projects/[projectId]/submittals/pdf", message: "Failed to load submittals", cause: error });
    }

    const rows = (data ?? []) as Array<{
      submittal_number: number | string | null;
      title: string | null;
      revision: string | number | null;
      status: string | null;
      specification_section: string | null;
      ball_in_court: string | null;
      final_due_date: string | null;
      sent_date: string | null;
      submittal_type: { name?: string | null } | null;
      submittal_package: { name?: string | null } | null;
    }>;

    const columns = [
      { label: "#", align: "left" as const },
      { label: "Title", align: "left" as const },
      { label: "Rev.", align: "left" as const },
      { label: "Type", align: "left" as const },
      { label: "Package", align: "left" as const },
      { label: "Status", align: "left" as const },
      { label: "Spec Section", align: "left" as const },
      { label: "Ball In Court", align: "left" as const },
      { label: "Sent Date", align: "left" as const },
      { label: "Due Date", align: "left" as const },
    ];

    const tableRows = rows.map((r) => [
      r.submittal_number,
      r.title,
      r.revision,
      r.submittal_type?.name,
      r.submittal_package?.name,
      r.status,
      r.specification_section,
      r.ball_in_court,
      formatDate(r.sent_date),
      formatDate(r.final_due_date),
    ]);

    const bodyHtml = buildBrandedLogTableHtml({
      columns,
      rows: tableRows,
      emptyMessage: "No submittals found.",
    });

    const projectLabel = project
      ? [project.project_number, project.name].filter(Boolean).join(" — ")
      : `Project ${projectId}`;

    const html = buildBrandedDocumentHtml({
      title: "Submittal Log",
      subtitle: projectLabel,
      detail: `${rows.length} submittal${rows.length === 1 ? "" : "s"}`,
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
        "Content-Disposition": `attachment; filename="submittal-log-${projectId}.pdf"`,
      },
    });
  },
);

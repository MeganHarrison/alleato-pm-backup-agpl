import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
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

function publishStateLabel(isPublished: boolean | null, isObsolete: boolean | null): string {
  if (isObsolete) return "Obsolete";
  return isPublished ? "Published" : "Draft";
}

/**
 * GET /api/projects/[projectId]/drawings/pdf
 * Renders a branded, Procore-style formatted "Drawing List" PDF covering
 * every drawing on the project.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/drawings/pdf#GET",
  async ({ params }) => {
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    const supabase = await createClient();

    const { data: project } = await supabase
      .from("projects")
      .select("name, project_number")
      .eq("id", projectIdNum)
      .single();

    const { data, error } = await supabase
      .from("drawing_log")
      .select(
        "drawing_number, title, discipline, drawing_type, revision_number, set_name, is_published, is_obsolete, drawing_date, received_date",
      )
      .eq("project_id", projectIdNum)
      .is("deleted_at", null)
      .order("drawing_number");

    if (error) {
      throw new GuardrailError({ code: "INTERNAL_ERROR", where: "GET /api/projects/[projectId]/drawings/pdf", message: "Failed to load drawings", cause: error });
    }

    const rows = data ?? [];

    const columns = [
      { label: "Number", align: "left" as const },
      { label: "Title", align: "left" as const },
      { label: "Discipline", align: "left" as const },
      { label: "Type", align: "left" as const },
      { label: "Rev.", align: "left" as const },
      { label: "Set", align: "left" as const },
      { label: "Status", align: "left" as const },
      { label: "Drawing Date", align: "left" as const },
      { label: "Received Date", align: "left" as const },
    ];

    const tableRows = rows.map((r) => [
      r.drawing_number,
      r.title,
      r.discipline,
      r.drawing_type,
      r.revision_number,
      r.set_name,
      publishStateLabel(r.is_published, r.is_obsolete),
      formatDate(r.drawing_date),
      formatDate(r.received_date),
    ]);

    const bodyHtml = buildBrandedLogTableHtml({
      columns,
      rows: tableRows,
      emptyMessage: "No drawings found.",
    });

    const projectLabel = project
      ? [project.project_number, project.name].filter(Boolean).join(" — ")
      : `Project ${projectId}`;

    const html = buildBrandedDocumentHtml({
      title: "Drawing List",
      subtitle: projectLabel,
      detail: `${rows.length} drawing${rows.length === 1 ? "" : "s"}`,
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
        "Content-Disposition": `attachment; filename="drawing-list-${projectId}.pdf"`,
      },
    });
  },
);

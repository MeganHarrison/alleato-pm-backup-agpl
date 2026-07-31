import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions-guard";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { listLinkedPatternCDocuments } from "@/lib/documents/pattern-c-attachments";
import { renderPdfFromHtml } from "@/lib/documents/pdf";
import {
  buildBrandedDocumentHtml,
  buildBrandedFooterTemplate,
  BRANDED_FOOTER_MARGIN,
} from "@/lib/documents/branded-letterhead";

// Puppeteer requires the Node.js runtime — Edge runtime does not support it.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function esc(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-US");
}

/**
 * GET /api/projects/[projectId]/rfis/[rfiId]/pdf
 * Renders a single, branded RFI PDF: question, formal answer(s),
 * distribution list, and attachments — modeled on Procore's single-RFI export.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/rfis/[rfiId]/pdf#GET",
  async ({ params }) => {
    const { projectId, rfiId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    const guard = await requirePermission(projectIdNum, "rfis", "read");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const serviceClient = createServiceClient();

    const { data: rfi, error } = await supabase
      .from("rfis")
      .select("*")
      .eq("project_id", projectIdNum)
      .eq("id", rfiId)
      .single();

    if (error || !rfi) {
      throw new GuardrailError({ code: "NOT_FOUND", where: "GET /api/projects/[projectId]/rfis/[rfiId]/pdf", message: "RFI not found", cause: error });
    }

    const { data: project } = await supabase
      .from("projects")
      .select("name, project_number")
      .eq("id", projectIdNum)
      .single();

    const { data: responses } = await serviceDb.from("rfi_responses")
      .select("id, responder_name, responder_email, body, is_official, created_at")
      .eq("rfi_id", rfiId)
      .order("created_at", { ascending: true });

    const attachments = await listLinkedPatternCDocuments({
      supabase,
      serviceClient,
      entityType: "rfi",
      entityId: rfiId,
    });

    const officialResponses = (responses ?? []).filter((r) => r.is_official);
    const answerResponses = officialResponses.length ? officialResponses : responses ?? [];

    function sectionHeading(label: string): string {
      return `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#242424;border-bottom:1px solid #ece7e2;padding-bottom:4px;margin:20px 0 8px;">${esc(label)}</div>`;
    }

    const metaGrid = `
      <table style="width:100%;border-collapse:collapse;margin-bottom:18px;font-size:11px;">
        <tr>
          <td style="width:25%;padding:4px 8px 4px 0;color:#6b6762;font-weight:700;">Status</td>
          <td style="width:25%;padding:4px 8px;">${esc(rfi.status)}</td>
          <td style="width:25%;padding:4px 8px 4px 0;color:#6b6762;font-weight:700;">Ball In Court</td>
          <td style="width:25%;padding:4px 8px;">${esc(rfi.ball_in_court)}</td>
        </tr>
        <tr>
          <td style="padding:4px 8px 4px 0;color:#6b6762;font-weight:700;">RFI Manager</td>
          <td style="padding:4px 8px;">${esc(rfi.rfi_manager)}</td>
          <td style="padding:4px 8px 4px 0;color:#6b6762;font-weight:700;">Responsible Contractor</td>
          <td style="padding:4px 8px;">${esc(rfi.responsible_contractor)}</td>
        </tr>
        <tr>
          <td style="padding:4px 8px 4px 0;color:#6b6762;font-weight:700;">Received From</td>
          <td style="padding:4px 8px;">${esc(rfi.received_from)}</td>
          <td style="padding:4px 8px 4px 0;color:#6b6762;font-weight:700;">Location</td>
          <td style="padding:4px 8px;">${esc(rfi.location)}</td>
        </tr>
        <tr>
          <td style="padding:4px 8px 4px 0;color:#6b6762;font-weight:700;">Date Initiated</td>
          <td style="padding:4px 8px;">${formatDate(rfi.date_initiated)}</td>
          <td style="padding:4px 8px 4px 0;color:#6b6762;font-weight:700;">Due Date</td>
          <td style="padding:4px 8px;">${formatDate(rfi.due_date)}</td>
        </tr>
        <tr>
          <td style="padding:4px 8px 4px 0;color:#6b6762;font-weight:700;">Closed Date</td>
          <td style="padding:4px 8px;">${formatDate(rfi.closed_date)}</td>
          <td style="padding:4px 8px 4px 0;color:#6b6762;font-weight:700;">Drawing #</td>
          <td style="padding:4px 8px;">${esc(rfi.drawing_number)}</td>
        </tr>
        <tr>
          <td style="padding:4px 8px 4px 0;color:#6b6762;font-weight:700;">Cost Impact</td>
          <td style="padding:4px 8px;">${esc(rfi.cost_impact)}</td>
          <td style="padding:4px 8px 4px 0;color:#6b6762;font-weight:700;">Schedule Impact</td>
          <td style="padding:4px 8px;">${esc(rfi.schedule_impact)}</td>
        </tr>
      </table>
    `;

    const questionSection = `${sectionHeading("Question")}
      <div style="font-size:11px;white-space:pre-wrap;">${esc(rfi.question) || "—"}</div>`;

    const answerSection = `${sectionHeading("Answer")}
      ${
        answerResponses.length
          ? answerResponses
              .map(
                (r) => `<div style="font-size:11px;margin-bottom:10px;">
                  <div style="color:#5f5b56;font-size:9px;margin-bottom:2px;">${esc(r.responder_name || r.responder_email)} &middot; ${formatDate(r.created_at)}${r.is_official ? " &middot; Official" : ""}</div>
                  <div style="white-space:pre-wrap;">${esc(r.body)}</div>
                </div>`,
              )
              .join("")
          : `<div style="font-size:11px;color:#807b76;">No response recorded.</div>`
      }`;

    const distributionSection = (rfi.distribution_list ?? []).length
      ? `${sectionHeading("Distribution")}
        <div style="font-size:10px;">${(rfi.distribution_list ?? []).map((d: string) => esc(d)).join(", ")}</div>`
      : "";

    const assigneesSection = (rfi.assignees ?? []).length
      ? `${sectionHeading("Assignees")}
        <div style="font-size:10px;">${(rfi.assignees ?? []).map((a: string) => esc(a)).join(", ")}</div>`
      : "";

    const attachmentsSection = attachments.length
      ? `${sectionHeading("Attachments")}
        <ul style="margin:0;padding-left:18px;font-size:10px;">
          ${attachments.map((a) => `<li>${esc(a.title || a.file_name)}</li>`).join("")}
        </ul>`
      : "";

    const bodyHtml = `${metaGrid}${questionSection}${answerSection}${distributionSection}${assigneesSection}${attachmentsSection}`;

    const projectLabel = project
      ? [project.project_number, project.name].filter(Boolean).join(" — ")
      : `Project ${projectId}`;

    const html = buildBrandedDocumentHtml({
      title: `RFI #${rfi.number}`,
      subtitle: rfi.subject || undefined,
      detail: projectLabel,
      bodyHtml,
      renderFooterInBody: false,
      contentWidth: "720px",
    });

    const pdfBuffer = await renderPdfFromHtml(html, {
      footerTemplate: buildBrandedFooterTemplate(),
      marginBottom: BRANDED_FOOTER_MARGIN,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="rfi-${rfi.number}.pdf"`,
      },
    });
  },
);

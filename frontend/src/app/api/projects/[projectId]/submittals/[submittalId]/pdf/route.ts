import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { listLinkedPatternCDocuments } from "@/lib/documents/pattern-c-attachments";
import { renderPdfFromHtml } from "@/lib/documents/pdf";
import { getPublicAssetDataUri } from "@/lib/documents/branded-letterhead";
import { requirePermission } from "@/lib/permissions-guard";
import {
  buildSubmittalExportFilename,
  COVER_SHEET_EXPORT_ITEM,
  isPdfPacketPartSupported,
  mergeSubmittalExportPacket,
  parseSelectedSubmittalExportItems,
  type SubmittalExportPacketPart,
} from "@/lib/submittals/export-packet";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMPANY_NAME = "Alleato Group";
const COMPANY_ADDRESS_LINES = [
  "8383 Craig Street, Suite 150",
  "Indianapolis, Indiana 46250",
  "P: +13177600088",
];

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
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type ProjectLinesInput = {
  project_number?: string | null;
  name?: string | null;
  address?: string | null;
  state?: string | null;
  // `city` isn't a column on `projects` — it lives inside summary_metadata.
  summary_metadata?: { city?: string | null } | null;
} | null;

function formatProjectLines(project: ProjectLinesInput): string[] {
  if (!project) return [];

  const city = project.summary_metadata?.city ?? null;
  const lines = [
    project.project_number || project.name
      ? `Project: ${[project.project_number, project.name].filter(Boolean).join(" ")}`
      : null,
    project.address ?? null,
    [city, project.state].filter(Boolean).join(", ") || null,
  ];

  return lines.filter((line): line is string => Boolean(line && line.trim()));
}

function buildMetaRows(
  rows: Array<
    [string, string | null | undefined, string, string | null | undefined]
  >,
): string {
  return rows
    .map(
      ([leftLabel, leftValue, rightLabel, rightValue]) => `
        <tr>
          <td class="meta-label">${esc(leftLabel)}</td>
          <td class="meta-value">${esc(leftValue || "—")}</td>
          <td class="meta-label">${esc(rightLabel)}</td>
          <td class="meta-value">${esc(rightValue || "—")}</td>
        </tr>
      `,
    )
    .join("");
}

function resolveProjectFieldValue(
  value: string | number | null | undefined,
): string {
  if (value == null) return "—";
  const stringValue = String(value).trim();
  return stringValue.length > 0 ? stringValue : "—";
}

export const GET = withApiGuardrails(
  "projects/[projectId]/submittals/[submittalId]/pdf#GET",
  async ({ request, params }) => {
    const { projectId, submittalId } = await params;
    const projectIdNum = Number.parseInt(projectId, 10);

    const guard = await requirePermission(projectIdNum, "submittals", "read");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const serviceClient = createServiceClient();
    const searchParams = new URL(request.url).searchParams;
    const selectedItems = parseSelectedSubmittalExportItems(searchParams);

    const { data: submittal, error } = await supabase
      .from("submittals")
      .select(
        `*,
         submittal_type:submittal_types(id, name),
         submittal_package:submittal_packages(id, name),
         submittal_workflow_steps(
           id,
           created_at,
           step_order,
           step_type,
           submittal_responses(id, responder_id, response_status, comments, responded_at)
         ),
         submittal_distributions(
           id,
           from_id,
           message,
           distributed_at,
           submittal_distribution_recipients(id, recipient_id)
         ),
         submittal_history(id, action, actor_id, new_status, occurred_at)
        `,
      )
      .eq("project_id", projectIdNum)
      .eq("id", submittalId)
      .is("deleted_at", null)
      .single();

    if (error || !submittal) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "GET /api/projects/[projectId]/submittals/[submittalId]/pdf",
        message: "Submittal not found.",
        cause: error,
      });
    }

    const attachments = await listLinkedPatternCDocuments({
      supabase,
      serviceClient,
      entityType: "submittal",
      entityId: submittalId,
    });

    const [{ data: project }, { data: responsibleContractor }] =
      await Promise.all([
        supabase
          .from("projects")
          .select("name, project_number, address, state, summary_metadata")
          .eq("id", projectIdNum)
          .single(),
        submittal.responsible_contractor_id
          ? supabase
              .from("companies")
              .select("name")
              .eq("id", submittal.responsible_contractor_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

    const authOrPersonIds = new Set<string>();
    for (const step of submittal.submittal_workflow_steps ?? []) {
      for (const response of step.submittal_responses ?? []) {
        if (response.responder_id) authOrPersonIds.add(response.responder_id);
      }
    }
    for (const distribution of submittal.submittal_distributions ?? []) {
      if (distribution.from_id) authOrPersonIds.add(distribution.from_id);
      for (const recipient of distribution.submittal_distribution_recipients ??
        []) {
        if (recipient.recipient_id) authOrPersonIds.add(recipient.recipient_id);
      }
    }
    for (const entry of submittal.submittal_history ?? []) {
      if (entry.actor_id) authOrPersonIds.add(entry.actor_id);
    }
    if (submittal.received_from_id) authOrPersonIds.add(submittal.received_from_id);
    if (submittal.submittal_manager_id) {
      authOrPersonIds.add(submittal.submittal_manager_id);
    }

    const nameById = new Map<string, string>();

    if (authOrPersonIds.size > 0) {
      const ids = Array.from(authOrPersonIds);
      const [
        { data: authUserRows },
        { data: personLinkedRows },
        { data: peopleRows },
      ] = await Promise.all([
        supabase
          .from("users_auth")
          .select(
            "auth_user_id, person_id, person:people!users_auth_person_id_fkey(first_name, last_name, email)",
          )
          .in("auth_user_id", ids),
        supabase
          .from("users_auth")
          .select(
            "auth_user_id, person_id, person:people!users_auth_person_id_fkey(first_name, last_name, email)",
          )
          .in("person_id", ids),
        supabase
          .from("people")
          .select("id, first_name, last_name, email")
          .in("id", ids),
      ]);

      for (const row of [...(authUserRows ?? []), ...(personLinkedRows ?? [])]) {
        const person = row.person as {
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
        } | null;
        const name =
          [person?.first_name, person?.last_name].filter(Boolean).join(" ") ||
          person?.email ||
          null;
        if (name && row.auth_user_id) nameById.set(row.auth_user_id, name);
        if (name && row.person_id) nameById.set(row.person_id, name);
      }

      for (const row of peopleRows ?? []) {
        if (nameById.has(row.id)) continue;
        const name =
          [row.first_name, row.last_name].filter(Boolean).join(" ") ||
          row.email ||
          null;
        if (name) nameById.set(row.id, name);
      }
    }

    function resolveName(id: string | null | undefined): string {
      if (!id) return "—";
      return nameById.get(id) || "—";
    }

    const workflowSteps = (submittal.submittal_workflow_steps ?? []).slice().sort(
      (left, right) => left.step_order - right.step_order,
    );
    const workflowResponses = workflowSteps
      .flatMap((step) =>
        (step.submittal_responses ?? []).map((response) => ({
          ...response,
          stepCreatedAt: step.created_at,
          stepType: step.step_type,
        })),
      )
      .filter(
        (response) =>
          response.response_status &&
          response.response_status.toLowerCase() !== "pending",
      )
      .sort(
        (left, right) =>
          new Date(right.responded_at ?? right.stepCreatedAt ?? 0).getTime() -
          new Date(left.responded_at ?? left.stepCreatedAt ?? 0).getTime(),
      );

    const latestResponse = workflowResponses[0] ?? null;
    const distributions = (submittal.submittal_distributions ?? []).slice().sort(
      (left, right) =>
        new Date(right.distributed_at ?? 0).getTime() -
        new Date(left.distributed_at ?? 0).getTime(),
    );
    const latestDistribution = distributions[0] ?? null;
    const currentAttachmentNames = attachments.map(
      (attachment) => attachment.file_name ?? attachment.title ?? "Attachment",
    );
    const attachmentSummary = currentAttachmentNames.length
      ? currentAttachmentNames.join(", ")
      : "—";
    const approvers = Array.from(
      new Set(
        workflowResponses
          .map((response) => resolveName(response.responder_id))
          .filter((name) => name !== "—"),
      ),
    );
    const recipientSummary = latestDistribution
      ? (latestDistribution.submittal_distribution_recipients ?? [])
          .map((recipient) => resolveName(recipient.recipient_id))
          .filter((name) => name !== "—")
          .join(", ") || "—"
      : "—";

    const headerImageSrc = getPublicAssetDataUri(
      "export-assets/submittal-cover-header.png",
    );
    const footerImageSrc = getPublicAssetDataUri(
      "export-assets/submittal-cover-footer.png",
    );

    const submittalDisplayNumber =
      submittal.revision !== null && submittal.revision !== undefined
        ? `${submittal.submittal_number}.${submittal.revision}`
        : String(submittal.submittal_number ?? "");

    const summaryRows = buildMetaRows([
      [
        "Revision",
        resolveProjectFieldValue(submittal.revision),
        "Submittal Manager",
        resolveName(submittal.submittal_manager_id),
      ],
      [
        "Status",
        submittal.status,
        "Date Created",
        formatDate(submittal.created_at),
      ],
      [
        "Responsible Contractor",
        responsibleContractor?.name ?? "—",
        "Received From",
        resolveName(submittal.received_from_id),
      ],
      [
        "Final Due Date",
        formatDate(submittal.final_due_date),
        "Lead Time",
        submittal.lead_time != null ? `${submittal.lead_time}` : "—",
      ],
      [
        "Location",
        resolveProjectFieldValue(submittal.location_id),
        "Type",
        submittal.submittal_type?.name ?? "—",
      ],
      [
        "Submittal Package",
        submittal.submittal_package?.name ?? "—",
        "Approvers",
        approvers.join(", ") || "—",
      ],
      [
        "Ball in Court",
        resolveName(submittal.ball_in_court),
        "Distribution",
        recipientSummary,
      ],
      [
        "Spec Section",
        submittal.specification_section ?? "—",
        "Description",
        submittal.description ?? "—",
      ],
    ]);

    const workflowRows = [
      `<tr>
        <td>General Information Attachments</td>
        <td>${formatDate(submittal.sent_date)}</td>
        <td>${formatDate(submittal.final_due_date)}</td>
        <td>—</td>
        <td>—</td>
        <td class="attachments-cell">${esc(attachmentSummary)}</td>
      </tr>`,
      ...workflowSteps.flatMap((step) => {
        const responses = step.submittal_responses ?? [];
        if (responses.length === 0) {
          return [
            `<tr>
              <td>${esc(step.step_type)}</td>
              <td>${formatDate(step.created_at)}</td>
              <td>—</td>
              <td>—</td>
              <td>No response recorded</td>
              <td>—</td>
            </tr>`,
          ];
        }

        return responses.map(
          (response) => `<tr>
            <td>${esc(resolveName(response.responder_id) || step.step_type)}</td>
            <td>${formatDate(step.created_at)}</td>
            <td>—</td>
            <td>${formatDate(response.responded_at)}</td>
            <td>${esc(response.response_status || "—")}</td>
            <td class="attachments-cell">${esc(attachmentSummary)}</td>
          </tr>`,
        );
      }),
    ].join("");

    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${esc(submittal.title || "Submittal Export")}</title>
    <style>
      @page {
        size: Letter;
        margin: 0.5in;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        font-family: Arial, Helvetica, sans-serif;
        color: #111827;
        font-size: 12px;
        line-height: 1.35;
      }
      .header-image,
      .footer-image {
        position: fixed;
        left: 0;
        width: 100%;
        pointer-events: none;
      }
      .header-image {
        top: 0;
        height: 86px;
        object-fit: cover;
      }
      .footer-image {
        bottom: 0;
        height: 34px;
        object-fit: cover;
      }
      .page {
        padding: 58px 24px 40px;
      }
      .top-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 24px;
        margin-top: 10px;
      }
      .company-block,
      .project-block {
        width: 46%;
      }
      .company-name,
      .project-label {
        font-size: 12px;
        font-weight: 700;
      }
      .company-line,
      .project-line {
        font-size: 11px;
        line-height: 1.4;
      }
      .title-band {
        margin: 18px 0 14px;
        border-top: 1px solid #d1d5db;
        border-bottom: 1px solid #d1d5db;
        padding: 8px 0 10px;
        text-align: center;
        font-size: 28px;
        font-weight: 700;
      }
      .section-heading {
        font-size: 12px;
        font-weight: 700;
        margin: 0 0 6px;
      }
      .distribution-note {
        margin-bottom: 12px;
        font-size: 11px;
        font-style: italic;
      }
      .distribution-grid {
        display: grid;
        grid-template-columns: 140px 1fr;
        gap: 4px 12px;
        margin-bottom: 12px;
      }
      .label {
        font-weight: 700;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      .summary-table th,
      .workflow-table th {
        background: #ececec;
        border: 1px solid #d1d5db;
        padding: 8px;
        font-size: 11px;
        text-align: left;
      }
      .summary-table td,
      .workflow-table td {
        border: 1px solid #d1d5db;
        padding: 7px 8px;
        vertical-align: top;
        font-size: 11px;
      }
      .meta-table {
        margin-top: 16px;
        border-top: 1px solid #d1d5db;
        border-bottom: 1px solid #d1d5db;
      }
      .meta-table td {
        padding: 8px 6px;
        vertical-align: top;
      }
      .meta-label {
        width: 16%;
        font-weight: 700;
      }
      .meta-value {
        width: 34%;
      }
      .workflow-heading,
      .comments-heading {
        border-top: 1px solid #d1d5db;
        margin-top: 18px;
        padding-top: 12px;
        font-size: 12px;
        font-weight: 700;
      }
      .attachments-cell {
        word-break: break-word;
      }
      .comments-box {
        min-height: 52px;
        border-bottom: 1px solid #d1d5db;
        padding: 8px 0 0;
        font-size: 11px;
      }
    </style>
  </head>
  <body>
    ${
      headerImageSrc
        ? `<img class="header-image" src="${headerImageSrc}" alt="" />`
        : ""
    }
    ${
      footerImageSrc
        ? `<img class="footer-image" src="${footerImageSrc}" alt="" />`
        : ""
    }
    <main class="page">
      <section class="top-row">
        <div class="company-block">
          <div class="company-name">${esc(COMPANY_NAME)}</div>
          ${COMPANY_ADDRESS_LINES.map(
            (line) => `<div class="company-line">${esc(line)}</div>`,
          ).join("")}
        </div>
        <div class="project-block" style="text-align:right;">
          ${formatProjectLines(project as ProjectLinesInput).map((line, index) => {
            const className = index === 0 ? "project-label" : "project-line";
            return `<div class="${className}">${esc(line)}</div>`;
          }).join("")}
        </div>
      </section>

      <div class="title-band">Submittal #${esc(submittalDisplayNumber)}${submittal.title ? ` - ${esc(submittal.title)}` : ""}</div>

      <div class="section-heading">Distribution Summary</div>
      <div class="distribution-note">
        Distributed by ${esc(resolveName(latestDistribution?.from_id) || "—")} on ${esc(formatDate(latestDistribution?.distributed_at))}
      </div>
      <div class="distribution-grid">
        <div class="label">To</div>
        <div>${esc(recipientSummary)}</div>
        <div class="label">Message</div>
        <div>${esc(latestDistribution?.message || "None")}</div>
        <div class="label">Attachments</div>
        <div>${esc(attachmentSummary)}</div>
      </div>

      <table class="summary-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Response</th>
            <th>Attachments</th>
            <th>Comments</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${esc(resolveName(latestResponse?.responder_id) || "—")}</td>
            <td>${esc(latestResponse?.response_status || "—")}</td>
            <td class="attachments-cell">${esc(attachmentSummary)}</td>
            <td>${esc(latestResponse?.comments || "—")}</td>
          </tr>
        </tbody>
      </table>

      <table class="meta-table">
        <tbody>${summaryRows}</tbody>
      </table>

      <div class="workflow-heading">Submittal Workflow</div>
      <table class="workflow-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Sent Date</th>
            <th>Due Date</th>
            <th>Returned Date</th>
            <th>Response</th>
            <th>Attachments</th>
          </tr>
        </thead>
        <tbody>${workflowRows}</tbody>
      </table>

      <div class="comments-heading">Comments</div>
      <div class="comments-box">${esc(latestResponse?.comments || "")}</div>
    </main>
  </body>
</html>`;

    const coverSheetPdfBuffer = await renderPdfFromHtml(html);
    const attachmentById = new Map(
      attachments.map((attachment) => [attachment.document_metadata_id, attachment]),
    );

    const packetParts: SubmittalExportPacketPart[] = [];
    for (const item of selectedItems) {
      if (item === COVER_SHEET_EXPORT_ITEM) {
        packetParts.push({
          fileName: "cover-sheet.pdf",
          mimeType: "application/pdf",
          bytes: new Uint8Array(coverSheetPdfBuffer),
        });
        continue;
      }

      const attachment = attachmentById.get(item);
      if (!attachment) {
        throw new GuardrailError({
          code: "BAD_REQUEST",
          where: "GET /api/projects/[projectId]/submittals/[submittalId]/pdf",
          message: `Selected attachment "${item}" is not linked to this submittal.`,
        });
      }

      const fileName = attachment.file_name ?? attachment.title ?? "attachment";
      if (!isPdfPacketPartSupported({ fileName, mimeType: attachment.mime_type })) {
        throw new GuardrailError({
          code: "BAD_REQUEST",
          where: "GET /api/projects/[projectId]/submittals/[submittalId]/pdf",
          message: `Attachment "${fileName}" cannot be included in a PDF packet. Supported types: PDF, PNG, JPG, JPEG.`,
        });
      }
      if (!attachment.download_url) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "GET /api/projects/[projectId]/submittals/[submittalId]/pdf",
          message: `Attachment "${fileName}" is missing a download URL.`,
        });
      }

      const response = await fetch(attachment.download_url);
      if (!response.ok) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "GET /api/projects/[projectId]/submittals/[submittalId]/pdf",
          message: `Failed to download attachment "${fileName}" for export.`,
        });
      }

      packetParts.push({
        fileName,
        mimeType: attachment.mime_type,
        bytes: new Uint8Array(await response.arrayBuffer()),
      });
    }

    const mergedPacket = await mergeSubmittalExportPacket(packetParts);
    const filename = buildSubmittalExportFilename({
      submittalNumber: submittal.submittal_number,
      title: submittal.title,
    });

    return new NextResponse(mergedPacket as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  },
);

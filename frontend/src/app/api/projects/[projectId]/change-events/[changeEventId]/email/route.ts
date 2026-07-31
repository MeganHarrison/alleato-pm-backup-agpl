import { withApiGuardrails } from "@/lib/guardrails/api";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions-guard";
import {
  renderPdfFromHtml,
  buildChangeEventHtml,
  buildChangeEventFooterPlan,
} from "@/lib/documents/pdf";
import { resolveLineItemCommitmentNumbers } from "@/lib/change-events/resolve-line-item-commitment-numbers";
import { logger } from "@/lib/logger";
import { EMAIL_FROM } from "@/lib/email/client";

// Puppeteer requires the Node.js runtime — Edge runtime does not support it.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function extractProjectCity(summaryMetadata: unknown): string | null {
  if (!summaryMetadata || typeof summaryMetadata !== "object" || Array.isArray(summaryMetadata)) {
    return null;
  }
  const record = summaryMetadata as Record<string, unknown>;
  return typeof record.city === "string" ? record.city : null;
}

function escHtml(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const POST = withApiGuardrails(
  "projects/[projectId]/change-events/[changeEventId]/email#POST",
  async ({ request, params }) => {
    const { projectId, changeEventId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    const guard = await requirePermission(projectIdNum, "change_orders", "write");
    if (guard.denied) return guard.response;

    const body = await request.json();
    const { recipients, subject, message } = body as {
      recipients: string[];
      subject: string;
      message?: string;
    };

    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ error: "recipients is required" }, { status: 400 });
    }
    const invalidEmail = recipients.find((r) => !EMAIL_RE.test(r));
    if (invalidEmail) {
      return NextResponse.json(
        { error: `Invalid email address: ${invalidEmail}` },
        { status: 400 },
      );
    }
    if (!subject) {
      return NextResponse.json({ error: "subject is required" }, { status: 400 });
    }

    const supabase = await createClient();
        const user = await getApiRouteUser();

    const { data: changeEvent, error: ceError } = await supabase
      .from("change_events")
      .select(
        `
        *,
        change_event_line_items(
          id,
          description,
          budget_code_id,
          quantity,
          unit_of_measure,
          unit_cost,
          revenue_rom,
          cost_rom,
          latest_price,
          non_committed_cost,
          commitment_id,
          commitment_type,
          budget_line:budget_lines!change_event_line_items_budget_code_id_fkey(
            id,
            description,
            cost_code:cost_codes!cost_code_id(
              id,
              title,
              division_title
            ),
            cost_type:cost_code_types!cost_type_id(
              code,
              description
            )
          ),
          vendor:companies!vendor_id(id, name)
        )
      `,
      )
      .eq("project_id", projectIdNum)
      .eq("id", changeEventId)
      .is("deleted_at", null)
      .single();

    if (ceError || !changeEvent) {
      return NextResponse.json({ error: "Change event not found" }, { status: 404 });
    }

    const { data: project } = await supabase
      .from("projects")
      .select("id, name, project_number, address, state, summary_metadata")
      .eq("id", projectIdNum)
      .single();

    let creator = null;
    if (changeEvent.created_by) {
      const { data: userAuth } = await supabase
        .from("users_auth")
        .select("person_id")
        .eq("auth_user_id", changeEvent.created_by)
        .single();
      if (userAuth?.person_id) {
        const { data: person } = await supabase
          .from("people")
          .select("id, email, first_name, last_name")
          .eq("id", userAuth.person_id)
          .single();
        creator = person;
      }
    }

    const lineItems = changeEvent.change_event_line_items || [];
    const commitmentMap = await resolveLineItemCommitmentNumbers(
      supabase,
      lineItems.map((item) => ({
        commitment_id: item.commitment_id,
        commitment_type: item.commitment_type,
      })),
    );
    const lineItemsWithCommitment = lineItems.map((item) => ({
      ...item,
      commitment: item.commitment_id ? commitmentMap.get(item.commitment_id) ?? null : null,
    }));
    const mappedProject = project
      ? {
          ...project,
          city: extractProjectCity(project.summary_metadata),
          number: project.project_number,
        }
      : null;
    const htmlContent = buildChangeEventHtml(
      { ...changeEvent, creator },
      lineItemsWithCommitment,
      mappedProject,
    );

    const ceNumber = changeEvent.number || changeEvent.id;
    const fromAddress = EMAIL_FROM;

    let attachments: Array<{ filename: string; content: string }> = [];
    try {
      const pdfBuffer = await renderPdfFromHtml(htmlContent, {
        footerOverlayPlan: buildChangeEventFooterPlan(changeEvent),
      });
      attachments = [
        {
          filename: `change-event-${ceNumber}.pdf`,
          content: pdfBuffer.toString("base64"),
        },
      ];
    } catch (pdfError) {
      logger.error({
        msg: "[change-events/email] PDF generation failed, sending without attachment",
        error: pdfError instanceof Error ? pdfError.message : String(pdfError),
        stack: pdfError instanceof Error ? pdfError.stack : undefined,
      });
    }

    const messageHtml = message
      ? `<p style="font-family:Arial,sans-serif;font-size:14px;color:#333;white-space:pre-wrap;">${escHtml(message)}</p><br/>`
      : "";

    // Only mention the PDF attachment if one was actually generated.
    // On Vercel (Puppeteer unavailable), attachments stays [] — avoid lying to recipients.
    const pdfNote = attachments.length > 0
      ? `<p style="font-size:13px;color:#444;">Please find the change event details attached as a PDF.</p>`
      : `<p style="font-size:13px;color:#444;">The change event details are available in your Alleato project dashboard.</p>`;

    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
        <div style="background:#2d2d2d;padding:16px 24px;">
          <h1 style="color:#fff;font-size:18px;margin:0;">Alleato Group</h1>
        </div>
        <div style="padding:24px;">
          <h2 style="font-size:16px;margin-bottom:8px;">Change Event #${escHtml(String(ceNumber))}: ${escHtml(changeEvent.title) || "Untitled"}</h2>
          <p style="color:#666;font-size:13px;margin-bottom:16px;">
            Project: ${escHtml(project?.name) || "Unknown Project"}${project?.project_number ? ` (${escHtml(String(project.project_number))})` : ""}
          </p>
          ${messageHtml}
          ${pdfNote}
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
          <p style="font-size:11px;color:#999;">This email was sent from Alleato Group project management software.</p>
        </div>
      </div>
    `;

    const { data: emailEvent, error: emailEventError } = await serviceDb.from("email_events")
      .insert({
        template: "status-report",
        to_email: recipients[0],
        from_email: fromAddress,
        subject,
        status: "queued",
        entity_type: "change_event",
        entity_id: String(changeEventId),
        user_id: user?.id ?? null,
        metadata: {
          project_id: projectIdNum,
          change_event_id: changeEventId,
          change_event_number: ceNumber,
          recipient_count: recipients.length,
          attachment_count: attachments.length,
        },
      })
      .select("id")
      .single();

    if (emailEventError || !emailEvent?.id) {
      return NextResponse.json(
        {
          error: "Email audit log could not be created.",
          details:
            emailEventError?.message ??
            "The change event email was blocked so it cannot be sent without an audit trail.",
        },
        { status: 500 },
      );
    }

    const { data: emailHistory, error: emailHistoryError } = await serviceDb.from("project_emails")
      .insert({
        project_id: projectIdNum,
        subject,
        body: message ?? "",
        body_html: emailHtml,
        from_name: "Alleato",
        from_email: fromAddress,
        to_list: recipients,
        status: "Draft",
        sent_at: null,
        has_attachments: attachments.length > 0,
        related_tool: "change-event",
        related_id: String(changeEventId),
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    if (emailHistoryError || !emailHistory?.id) {
      await serviceDb.from("email_events")
        .update({
          status: "failed",
          error: {
            message:
              emailHistoryError?.message ??
              "Project email history row could not be created.",
          },
        })
        .eq("id", emailEvent.id);

      return NextResponse.json(
        {
          error: "Email history could not be created.",
          details:
            emailHistoryError?.message ??
            "The change event email was blocked so it cannot be sent without visible history.",
        },
        { status: 500 },
      );
    }

    if (!process.env.RESEND_API_KEY) {
      const error = { message: "Missing RESEND_API_KEY" };
      await Promise.all([
        serviceDb.from("email_events")
          .update({ status: "failed", error })
          .eq("id", emailEvent.id),
        serviceDb.from("project_emails")
          .update({ status: "Failed" })
          .eq("id", emailHistory.id),
      ]);

      return NextResponse.json(
        { error: "Email service not configured.", details: error.message },
        { status: 500 },
      );
    }

    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { data, error: sendError } = await resend.emails.send({
      from: fromAddress,
      to: recipients,
      subject,
      html: emailHtml,
      attachments,
    });

    if (sendError) {
      logger.error({
        msg: "[change-events/email] Resend send failed",
        error: sendError.message || String(sendError),
      });
      await Promise.all([
        serviceDb.from("email_events")
          .update({
            status: "failed",
            error: { message: sendError.message || "Failed to send email" },
          })
          .eq("id", emailEvent.id),
        serviceDb.from("project_emails")
          .update({ status: "Failed" })
          .eq("id", emailHistory.id),
      ]);
      return NextResponse.json(
        { error: sendError.message || "Failed to send email" },
        { status: 500 },
      );
    }

    const sentAt = new Date().toISOString();
    await Promise.all([
      serviceDb.from("email_events")
        .update({
          status: "sent",
          resend_id: data?.id ?? null,
          sent_at: sentAt,
        })
        .eq("id", emailEvent.id),
      serviceDb.from("project_emails")
        .update({ status: "Sent", sent_at: sentAt })
        .eq("id", emailHistory.id),
    ]);

    return NextResponse.json({
      success: true,
      id: data?.id,
      email_event_id: emailEvent.id,
      project_email_id: emailHistory.id,
    });
  },
);

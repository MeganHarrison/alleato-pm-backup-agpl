import { NextResponse } from "next/server";

import { buildCommitmentChangeOrderPdfArtifact } from "@/lib/change-orders/commitment-change-order-pdf";
import { renderPdfFromHtml } from "@/lib/documents/pdf";
import { sendDocumentEmail } from "@/lib/documents/email";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

interface EmailRecipient {
  email: string;
  name: string;
}

function isValidEmail(value: string | null | undefined): value is string {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function renderEmailHtml(params: {
  number: string;
  title: string;
  status: string | null;
  amount: number | null;
  message: string;
  senderName: string;
}) {
  const intro = params.message.trim()
    ? `<p style="margin:0 0 16px;">${params.message.trim().replace(/\n/g, "<br />")}</p>`
    : "";
  const amount =
    typeof params.amount === "number"
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(params.amount)
      : "Not set";

  return `
    <div style="max-width:700px;margin:0 auto;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
      <div style="padding:24px;border:1px solid #e2e8f0;border-radius:16px;background:#ffffff;">
        <div style="text-transform:uppercase;letter-spacing:0.08em;font-size:11px;font-weight:700;color:#64748b;margin-bottom:8px;">Commitment Change Order</div>
        <h1 style="margin:0 0 8px;font-size:24px;line-height:1.2;">${params.number}${params.title ? ` · ${params.title}` : ""}</h1>
        <p style="margin:0 0 18px;color:#475569;">${params.status || "Status not set"}</p>
        ${intro}
        <p style="margin:0 0 16px;">A PDF copy is attached for download and review.</p>
        <table style="width:100%;border-collapse:collapse;margin:0 0 16px;">
          <tr>
            <td style="padding:6px 0;color:#64748b;">Amount</td>
            <td style="padding:6px 0;text-align:right;font-weight:600;">${amount}</td>
          </tr>
        </table>
        <p style="margin:20px 0 0;">Sent by ${params.senderName} via Alleato.</p>
      </div>
    </div>
  `;
}

function renderEmailText(params: {
  number: string;
  title: string;
  status: string | null;
  amount: number | null;
  message: string;
  senderName: string;
}) {
  const amount =
    typeof params.amount === "number"
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(params.amount)
      : "Not set";

  const lines = [
    `Commitment Change Order: ${params.number}${params.title ? ` - ${params.title}` : ""}`,
    `Status: ${params.status || "Not set"}`,
    `Amount: ${amount}`,
    "",
  ];

  if (params.message.trim()) {
    lines.push(params.message.trim(), "");
  }

  lines.push(`Sent by ${params.senderName} via Alleato.`);
  return lines.join("\n");
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiGuardrails<{
  projectId: string;
  commitmentCoId: string;
}>(
  "projects/[projectId]/commitment-change-orders/[commitmentCoId]/email#POST",
  async ({ request, params }) => {
    const { projectId, commitmentCoId } = await params;
    const parsedProjectId = Number.parseInt(projectId, 10);

    if (!Number.isFinite(parsedProjectId)) {
      throw new GuardrailError({
        code: "BAD_REQUEST",
        where: "projects/[projectId]/commitment-change-orders/[commitmentCoId]/email#POST",
        message: "Invalid project id.",
        status: 400,
      });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/commitment-change-orders/[commitmentCoId]/email#POST",
        message: "Authentication required.",
      });
    }

    const body = await request.json();
    const recipients = Array.isArray(body.recipients) ? (body.recipients as EmailRecipient[]) : [];
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (recipients.length === 0) {
      return NextResponse.json({ error: "At least one recipient is required" }, { status: 400 });
    }
    if (!subject) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }

    const invalidRecipient = recipients.find((recipient) => !isValidEmail(recipient.email?.trim()));
    if (invalidRecipient) {
      return NextResponse.json(
        { error: `Invalid email address: ${invalidRecipient.email}` },
        { status: 400 },
      );
    }

    const {
      data: senderProfile,
      error: senderError,
    } = await supabase
      .from("people")
      .select("first_name, last_name, email")
      .eq("auth_user_id", user.id)
      .single();

    if (senderError && senderError.code !== "PGRST116") {
      return NextResponse.json({ error: senderError.message }, { status: 500 });
    }

    const senderName = senderProfile
      ? [senderProfile.first_name, senderProfile.last_name].filter(Boolean).join(" ").trim()
      : user.email?.split("@")[0] || "Alleato User";

    const artifact = await buildCommitmentChangeOrderPdfArtifact(
      supabase,
      parsedProjectId,
      commitmentCoId,
    );
    const normalizedRecipientEmails = recipients.map((recipient) => recipient.email.trim().toLowerCase());
    const senderCopyEmail = [senderProfile?.email, user.email]
      .map((email) => email?.trim().toLowerCase() ?? null)
      .find((email): email is string => isValidEmail(email) && !normalizedRecipientEmails.includes(email));
    const bccRecipients = senderCopyEmail ? [senderCopyEmail] : [];

    const number = artifact.scoped.change_order_number || "CCO";
    const title = artifact.scoped.title || artifact.scoped.description || "Commitment Change Order";
    const emailHtml = renderEmailHtml({
      number,
      title,
      status: artifact.scoped.status,
      amount: artifact.scoped.amount,
      message,
      senderName: senderName || "Alleato User",
    });
    const emailText = renderEmailText({
      number,
      title,
      status: artifact.scoped.status,
      amount: artifact.scoped.amount,
      message,
      senderName: senderName || "Alleato User",
    });
    const pdfBuffer = await renderPdfFromHtml(artifact.html, {});

    const result = await sendDocumentEmail({
      to: recipients.map((recipient) => recipient.email.trim()),
      bcc: bccRecipients,
      subject,
      html: emailHtml,
      text: emailText,
      attachments: [{ filename: artifact.filename, content: pdfBuffer.toString("base64") }],
      audit: {
        template: "commitment-change-order-delivery",
        entity: { type: "commitment-change-order", id: commitmentCoId },
        userId: user.id,
        idempotencyKey: `commitment-change-order-delivery/${commitmentCoId}/${subject}`,
        metadata: {
          project_id: parsedProjectId,
          record_type: "commitment-change-order",
          record_id: commitmentCoId,
          recipient_emails: recipients.map((recipient) => recipient.email.trim()),
          bcc_emails: bccRecipients,
          has_attachments: true,
          filename: artifact.filename,
        },
      },
    });

    const sentAt = new Date().toISOString();
    const { error: emailHistoryError } = await supabase.from("project_emails").insert({
      project_id: parsedProjectId,
      subject,
      body: emailText,
      body_html: emailHtml,
      from_email: user.email ?? null,
      from_name: senderName || null,
      to_list: recipients.map((recipient) => recipient.email.trim()),
      bcc_list: bccRecipients,
      status: "Sent",
      sent_at: sentAt,
      created_by: user.id,
      related_tool: "commitment-change-order",
      related_id: commitmentCoId,
      has_attachments: true,
      thread_id: result.id,
    });

    if (emailHistoryError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/commitment-change-orders/[commitmentCoId]/email#POST",
        message: `Email sent, but history logging failed: ${emailHistoryError.message}`,
      });
    }

    return NextResponse.json({
      success: true,
      id: result.id,
      historyLogged: true,
      recipients: recipients.map((recipient) => recipient.email.trim()),
    });
  },
);

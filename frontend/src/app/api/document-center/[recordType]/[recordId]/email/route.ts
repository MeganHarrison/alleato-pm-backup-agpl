import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { sendDocumentEmail } from "@/lib/documents/email";
import { renderPdfFromHtml } from "@/lib/documents/pdf";
import { logger } from "@/lib/logger";
import {
  getDocumentPdfOptions,
  getDocumentBundle,
  renderDocumentEmailHtml,
  renderDocumentEmailText,
  renderDocumentHtml,
  type DocumentRecordType,
} from "@/lib/documents/record-documents";

interface RouteParams {
  params: Promise<{
    recordType: string;
    recordId: string;
  }>;
}

interface EmailRecipient {
  email: string;
  name: string;
}

interface DocumentProjectContext {
  projectId: number;
  relatedTool: string;
}

function isValidEmail(value: string | null | undefined): value is string {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function isDocumentRecordType(value: string): value is DocumentRecordType {
  return (
    value === "prime-contract" ||
    value === "commitment" ||
    value === "change-order" ||
    value === "prime-contract-change-order"
  );
}

async function getDocumentProjectContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  recordType: DocumentRecordType,
  recordId: string,
): Promise<DocumentProjectContext | null> {
  if (recordType === "prime-contract") {
    const { data, error } = await supabase
      .from("prime_contracts")
      .select("project_id")
      .eq("id", recordId)
      .single();

    if (error || data?.project_id == null) return null;
    return { projectId: data.project_id, relatedTool: "prime-contract" };
  }

  if (recordType === "commitment") {
    const { data, error } = await supabase
      .from("commitments_unified")
      .select("project_id")
      .eq("id", recordId)
      .single();

    if (error || data?.project_id == null) return null;
    return { projectId: data.project_id, relatedTool: "commitment" };
  }

  const numericRecordId = Number(recordId);
  if (!Number.isFinite(numericRecordId)) return null;

  const { data, error } = await supabase
    .from("prime_contract_change_orders")
    .select("project_id")
    .eq("id", numericRecordId)
    .single();

  if (error || data?.project_id == null) return null;
  return { projectId: data.project_id, relatedTool: recordType };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiGuardrails(
  "document-center/[recordType]/[recordId]/email#POST",
  async ({ request, params }) => {
  
    const { recordType, recordId } = await params;
    if (!isDocumentRecordType(recordType)) {
      return NextResponse.json({ error: "Unsupported record type" }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "document-center/[recordType]/[recordId]/email#POST", message: "Authentication required." });
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

    const invalidRecipient = recipients.find((recipient) => {
      const email = recipient.email?.trim();
      return !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    });

    if (invalidRecipient) {
      return NextResponse.json(
        { error: `Invalid email address: ${invalidRecipient.email}` },
        { status: 400 },
      );
    }

    const bundle = await getDocumentBundle(supabase, recordType, recordId);
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

    const projectContext = await getDocumentProjectContext(supabase, recordType, recordId);
    if (!projectContext) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "document-center/[recordType]/[recordId]/email#POST",
        message: "The project context could not be resolved for document email audit logging.",
      });
    }

    const emailHtml = renderDocumentEmailHtml(bundle, message, senderName || "Alleato User");
    const emailText = renderDocumentEmailText(bundle, message, senderName || "Alleato User");
    const normalizedRecipientEmails = recipients.map((recipient) => recipient.email.trim().toLowerCase());
    const senderCopyEmail = [senderProfile?.email, user.email]
      .map((email) => email?.trim().toLowerCase() ?? null)
      .find((email): email is string => isValidEmail(email) && !normalizedRecipientEmails.includes(email));
    const bccRecipients = senderCopyEmail ? [senderCopyEmail] : [];

    let attachments: Array<{ filename: string; content: string }> = [];
    try {
      const documentHtml = renderDocumentHtml(bundle);
      const pdfBuffer = await renderPdfFromHtml(documentHtml, getDocumentPdfOptions(bundle));
      attachments = [{ filename: bundle.filename, content: pdfBuffer.toString("base64") }];
    } catch (pdfError) {
      logger.error({ msg: "[document-center/email] PDF generation failed, sending without attachment:", data: pdfError });
    }

    const result = await sendDocumentEmail({
      to: recipients.map((recipient) => recipient.email.trim()),
      bcc: bccRecipients,
      subject,
      html: emailHtml,
      text: emailText,
      attachments,
      audit: {
        template: "document-delivery",
        entity: { type: projectContext.relatedTool, id: recordId },
        userId: user.id,
        idempotencyKey: `document-delivery/${recordType}/${recordId}/${subject}`,
        metadata: {
          project_id: projectContext.projectId,
          record_type: recordType,
          record_id: recordId,
          related_tool: projectContext.relatedTool,
          recipient_emails: recipients.map((recipient) => recipient.email.trim()),
          bcc_emails: bccRecipients,
          has_attachments: attachments.length > 0,
          filename: bundle.filename,
        },
      },
    });

    const sentAt = new Date().toISOString();
    const { error: emailHistoryError } = await supabase.from("project_emails").insert({
      project_id: projectContext.projectId,
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
      related_tool: projectContext.relatedTool,
      related_id: recordId,
      has_attachments: attachments.length > 0,
      thread_id: result.id,
    });

    if (emailHistoryError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "document-center/[recordType]/[recordId]/email#POST",
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

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";
import { renderInvoicePdfBuffer } from "@/lib/invoice-pdf";
import { fetchInvoicePdfData } from "../pdf/route";
import { requirePermission } from "@/lib/permissions-guard";
import { logger } from "@/lib/logger";

// Node runtime required by @react-pdf/renderer
export const runtime = "nodejs";

interface EmailRequestBody {
  to: string[] | string;
  cc?: string[] | string;
  subject?: string;
  message?: string;
}

function normalizeEmails(value: string[] | string | undefined): string[] {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : value.split(",");
  return arr
    .map((e) => e.trim())
    .filter((e) => e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}

function getFromAddress(): string {
  const configured =
    process.env.RESEND_FROM_EMAIL || process.env.DIGEST_FROM_EMAIL;
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") {
    return "Alleato <onboarding@resend.dev>";
  }
  throw new Error(
    "RESEND_FROM_EMAIL must be configured with a verified sender address",
  );
}

export const POST = withApiGuardrails<{ projectId: string; invoiceId: string }>(
  "projects/[projectId]/invoicing/owner/[invoiceId]/email#POST",
  async ({ request, params }) => {

    const { projectId, invoiceId } = params;
    const projectIdNum = parseInt(projectId, 10);

    const guard = await requirePermission(projectIdNum, "contracts", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
        const user = await getApiRouteUser();

    const body = (await request.json()) as EmailRequestBody;
    const toList = normalizeEmails(body.to);
    const ccList = normalizeEmails(body.cc);

    if (toList.length === 0) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/email#POST",
        message: "At least one valid recipient is required in 'to'.",
      });
    }

    const invoiceIdNum = parseInt(invoiceId, 10);

    const result = await fetchInvoicePdfData(
      supabase,
      projectIdNum,
      invoiceIdNum,
    );
    if (result.error || !result.data) {
      throw new GuardrailError({
        code: "ROUTE_BINDING_MISSING",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/email#POST",
        message: result.error?.message || "Invoice not found.",
      });
    }

    const data = result.data;

    const invoiceNumber = data.invoice_number || `INV-${data.id}`;
    const subject = body.subject?.trim() || `Invoice #${invoiceNumber}`;
    const message =
      body.message?.trim() ||
      `Please find attached invoice #${invoiceNumber}.`;
    const fromAddress = getFromAddress();

    const { data: emailEvent, error: emailEventError } = await serviceDb.from("email_events")
      .insert({
        template: "owner-invoice-issued",
        to_email: toList[0],
        from_email: fromAddress,
        subject,
        status: "queued",
        entity_type: "owner_invoice",
        entity_id: String(invoiceIdNum),
        user_id: user?.id ?? null,
        metadata: {
          project_id: projectIdNum,
          invoice_id: invoiceIdNum,
          invoice_number: invoiceNumber,
          cc: ccList,
          recipient_count: toList.length,
        },
      })
      .select("id")
      .single();

    if (emailEventError || !emailEvent?.id) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/email#POST",
        message: "Email audit log could not be created.",
        details:
          emailEventError?.message ??
          "The email send was blocked so the invoice email cannot be sent without an audit trail.",
      });
    }

    const emailEventId = emailEvent.id;

    // Generate PDF
    const pdfBuffer = await renderInvoicePdfBuffer(data);
    const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

    // Compose email HTML
    const safeMessage = message
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br/>");

    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
        <div style="background:#2d2d2d;padding:16px 24px;">
          <h1 style="color:#fff;font-size:18px;margin:0;">Alleato Group</h1>
        </div>
        <div style="padding:24px;">
          <h2 style="font-size:16px;margin-bottom:8px;">Invoice #${invoiceNumber}</h2>
          <p style="color:#666;font-size:13px;margin-bottom:16px;">
            Project: ${data.project?.name || "Unknown Project"}${data.project?.number ? ` (${data.project.number})` : ""}
          </p>
          <p style="font-family:Arial,sans-serif;font-size:14px;color:#333;white-space:pre-wrap;">${safeMessage}</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
          <p style="font-size:11px;color:#999;">This email was sent from Alleato Group project management software.</p>
        </div>
      </div>
    `;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      if (emailEventId) {
        await serviceDb.from("email_events")
          .update({
            status: "failed",
            error: { message: "Missing RESEND_API_KEY" },
          })
          .eq("id", emailEventId);
      }

      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/email#POST",
        message: "Email service not configured.",
        details: "Missing RESEND_API_KEY.",
      });
    }

    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    const { data: sendResult, error: sendError } = await resend.emails.send({
      from: fromAddress,
      to: toList,
      cc: ccList.length > 0 ? ccList : undefined,
      subject,
      html: emailHtml,
      attachments: [
        {
          filename: `invoice-${invoiceNumber}.pdf`,
          content: pdfBase64,
        },
      ],
    });

    if (sendError) {
      if (emailEventId) {
        await serviceDb.from("email_events")
          .update({
            status: "failed",
            error: { message: sendError.message, name: sendError.name },
          })
          .eq("id", emailEventId);
      }

      logger.error({ msg: "[invoice email] Resend error:", data: sendError });
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/email#POST",
        message: "Failed to send email.",
        details: sendError.message,
      });
    }

    if (emailEventId) {
      await serviceDb.from("email_events")
        .update({
          status: "sent",
          resend_id: sendResult?.id ?? null,
          sent_at: new Date().toISOString(),
        })
        .eq("id", emailEventId);
    }

    return NextResponse.json({
      success: true,
      id: sendResult?.id,
      email_event_id: emailEventId ?? null,
    });
    },
);

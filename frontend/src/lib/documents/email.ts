import type { Json } from "@/types/database.types";
import { serviceDb } from "@/lib/supabase/service-db";

interface EmailAttachment {
  filename: string;
  content: string;
}

interface EmailAuditOptions {
  template: string;
  entity?: { type: string; id: string | number };
  userId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

interface SendEmailOptions {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
  audit: EmailAuditOptions;
}

interface ResendSuccessResponse {
  id: string;
}

function getFromAddress(): string {
  const configuredFrom =
    process.env.RESEND_FROM_EMAIL ||
    process.env.DIGEST_FROM_EMAIL ||
    process.env.EMAIL_FROM_ADDRESS;

  if (configuredFrom) {
    return configuredFrom;
  }

  if (process.env.NODE_ENV !== "production") {
    return "Alleato <onboarding@resend.dev>";
  }

  throw new Error(
    "RESEND_FROM_EMAIL, DIGEST_FROM_EMAIL, or EMAIL_FROM_ADDRESS must be configured with a verified sender address",
  );
}

export async function sendDocumentEmail(
  options: SendEmailOptions,
): Promise<ResendSuccessResponse> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const from = getFromAddress();
  const primaryTo = options.to[0];
  if (!primaryTo) {
    throw new Error("At least one recipient is required");
  }

    const { data: logRow, error: logError } = await serviceDb.from("email_events")
    .insert({
      template: options.audit.template,
      to_email: primaryTo,
      from_email: from,
      subject: options.subject,
      status: "queued",
      entity_type: options.audit.entity?.type ?? null,
      entity_id: options.audit.entity?.id != null ? String(options.audit.entity.id) : null,
      user_id: options.audit.userId ?? null,
      idempotency_key: options.audit.idempotencyKey ?? null,
      metadata: (options.audit.metadata as Json) ?? null,
    })
    .select("id")
    .single();

  if (logError || !logRow?.id) {
    throw new Error(
      `Failed to create document email audit event: ${logError?.message ?? "No audit id returned"}`,
    );
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: options.to,
      cc: options.cc ?? [],
      bcc: options.bcc ?? [],
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments ?? [],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    const message = `Failed to send email: ${body || response.statusText}`;
    const { error: updateError } = await serviceDb.from("email_events")
      .update({ status: "failed", error: { message } })
      .eq("id", logRow.id);
    if (updateError) {
      throw new Error(
        `${message}; additionally failed to update document email audit event: ${updateError.message}`,
      );
    }
    throw new Error(message);
  }

  const result = (await response.json()) as ResendSuccessResponse;

  const { error: updateError } = await serviceDb.from("email_events")
    .update({
      status: "sent",
      resend_id: result.id,
      sent_at: new Date().toISOString(),
    })
    .eq("id", logRow.id);

  if (updateError) {
    throw new Error(
      `Email sent, but failed to update document email audit event: ${updateError.message}`,
    );
  }

  return result;
}

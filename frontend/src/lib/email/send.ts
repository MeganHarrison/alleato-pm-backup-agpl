/**
 * Central transactional email sender.
 *
 * - Uses Resend's React rendering (`react:` prop)
 * - Attaches idempotency keys so retries never double-send
 * - Logs every send to `email_events` for observability
 * - Returns `{ id, error }` — never throws on API errors
 *
 * Usage:
 *   await sendEmail({
 *     template: "sov-invitation",
 *     to: sub.email,
 *     subject: `Submit your SOV for ${project.name}`,
 *     react: <SOVInvitation ... />,
 *     entity: { type: "sov_submission", id: submission.id },
 *     idempotencyKey: `sov-invite/${submission.id}`,
 *   });
 */

import type * as React from "react";
import type { Json } from "@/types/database.types";
import { getResend, EMAIL_FROM } from "./client";
import { serviceDb } from "@/lib/supabase/service-db";

export type EmailTemplate =
  | "user-invite"
  | "welcome"
  | "forgot-password"
  | "password-changed"
  | "sov-invitation"
  | "sov-invite-new-user"
  | "sov-reminder"
  | "sov-submitted-to-pm"
  | "sov-approved"
  | "sov-rejected"
  | "invoice-submitted-to-pm"
  | "subcontractor-invoice-invitation"
  | "subcontractor-invoice-invite-new-user"
  | "invoice-approved"
  | "invoice-rejected"
  | "commitment-issued"
  | "change-order-signature"
  | "daily-digest"
  | "rfi-notification"
  | "rfi-updated"
  | "rfi-closed"
  | "rfi-response-received"
  | "submittal-notification"
  | "mention-notification"
  | "owner-invoice-issued"
  | "owner-change-order"
  | "status-report";

export interface SendEmailInput {
  template: EmailTemplate;
  to: string | string[];
  subject: string;
  /** Override the default from address (e.g. for testing with Resend sandbox). */
  from?: string;
  react: React.ReactElement;
  replyTo?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  /** Business entity this email relates to (for logging). */
  entity?: { type: string; id: string | number };
  /** User receiving the email (for logging + RLS). */
  userId?: string;
  /** Stable key — prevents duplicate sends on retry. Max 256 chars, 24h TTL. */
  idempotencyKey?: string;
  /** Arbitrary metadata to log. */
  metadata?: Record<string, unknown>;
}

export interface SendEmailResult {
  id: string | null;
  error: { message: string; name?: string } | null;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const {
    template,
    to,
    subject,
    from,
    react,
    replyTo,
    cc,
    bcc,
    entity,
    userId,
    idempotencyKey,
    metadata,
  } = input;

  const fromAddress = from ?? EMAIL_FROM;

    const toList = Array.isArray(to) ? to : [to];
  const primaryTo = toList[0];

  // Insert initial log row
  const { data: logRow } = await serviceDb.from("email_events")
    .insert({
      template,
      to_email: primaryTo,
      from_email: fromAddress,
      subject,
      status: "queued",
      entity_type: entity?.type ?? null,
      entity_id: entity?.id != null ? String(entity.id) : null,
      user_id: userId ?? null,
      idempotency_key: idempotencyKey ?? null,
      metadata: (metadata as Json) ?? null,
    })
    .select("id")
    .single();

  const logId = logRow?.id as string | undefined;

  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send(
      {
        from: fromAddress,
        to: toList,
        subject,
        react,
        replyTo,
        cc,
        bcc,
      },
      idempotencyKey ? { idempotencyKey } : undefined
    );

    if (error) {
      if (logId) {
        await serviceDb.from("email_events")
          .update({
            status: "failed",
            error: { message: error.message, name: error.name },
          })
          .eq("id", logId);
      }
      console.error(`[email] ${template} failed`, error);
      return { id: null, error: { message: error.message, name: error.name } };
    }

    if (logId) {
      await serviceDb.from("email_events")
        .update({
          status: "sent",
          resend_id: data?.id ?? null,
          sent_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    return { id: data?.id ?? null, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (logId) {
      await serviceDb.from("email_events")
        .update({ status: "failed", error: { message } })
        .eq("id", logId);
    }
    console.error(`[email] ${template} threw`, err);
    return { id: null, error: { message } };
  }
}

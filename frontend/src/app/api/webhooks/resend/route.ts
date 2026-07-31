/**
 * Resend delivery webhook.
 *
 * Handles: email.sent, email.delivered, email.bounced, email.complained,
 *          email.opened, email.clicked, email.delivery_delayed, email.suppressed
 *
 * Signature verification uses the Svix-compatible headers Resend sends.
 * Configure the endpoint + secret in the Resend dashboard → Webhooks.
 */
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getResend } from "@/lib/email/client";
import { serviceDb } from "@/lib/supabase/service-db";
import { logger } from "@/lib/logger";
import type { Database, Json } from "@/types/database.types";

export const runtime = "nodejs";

const EVENT_TO_STATUS: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.delivery_delayed": "delivery_delayed",
  "email.suppressed": "suppressed",
};

export const POST = withApiGuardrails(
  "webhooks/resend#POST",
  async ({ request }) => {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    logger.error({ msg: "[resend-webhook] RESEND_WEBHOOK_SECRET not set" });
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const payload = await request.text();
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "missing signature headers" }, { status: 400 });
  }

  let event: { type: string; data: Record<string, unknown> };
  try {
    const resend = getResend();
    const verified = resend.webhooks.verify({
      payload,
      headers: {
        id: svixId,
        timestamp: svixTimestamp,
        signature: svixSignature,
      },
      webhookSecret: secret,
    });
    event = verified as unknown as { type: string; data: Record<string, unknown> };
  } catch (err) {
    logger.error({ msg: "[resend-webhook] signature verification failed", error: err instanceof Error ? err.message : String(err) });
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "webhooks/resend#POST", message: "Authentication required." });
  }

  const status = EVENT_TO_STATUS[event.type];
  if (!status) {
    // Not an email event we track (e.g. domain.*, contact.*)
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const emailId =
    (event.data.email_id as string | undefined) ??
    (event.data.id as string | undefined);
  if (!emailId) {
    return NextResponse.json({ ok: true, ignored: "no email_id" });
  }

    const update: Database["public"]["Tables"]["email_events"]["Update"] = { status };
  if (status === "delivered") update.delivered_at = new Date().toISOString();
  if (status === "bounced" || status === "complained") {
    update.error = { type: event.type, data: event.data } as Json;
  }

  await serviceDb.from("email_events").update(update).eq("resend_id", emailId);

  return NextResponse.json({ ok: true });
  },
);

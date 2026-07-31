/**
 * RFI reply-by-email ingestion (Outlook / Microsoft Graph).
 *
 * Subcontractors reply to their RFI email; the reply lands in the shared reply
 * mailbox (RFI_REPLY_MAILBOX) carrying its token in the plus-address. This cron
 * reads that mailbox via Graph, matches each reply to its RFI, strips the quoted
 * original, and writes an `rfi_responses` row (source='email') — the same store
 * as the no-login web channel.
 *
 * Idempotent: rows are keyed by the Graph message id (unique), so re-reading the
 * same window never double-inserts.
 *
 * Scheduling: the Render cron `alleato-rfi-email-ingest` (every 15 min) runs the
 * Python equivalent at backend/src/services/rfis/email_ingestion.py. This route
 * is kept for manual testing via ?secret=CRON_SECRET.
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { resolveRfiResponseToken } from "@/lib/rfi/response-tokens";
import { notifyRfiResponseReceived } from "@/lib/rfi/rfi-notify";
import {
  parseReplyMailbox,
  extractReplyToken,
  stripQuotedReply,
} from "@/lib/rfi/email-reply";
import { listOutlookReplyMessages } from "@/lib/microsoft-graph/mail";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOOKBACK_HOURS = 48;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

export const GET = withApiGuardrails("cron/rfi-email-replies#GET", async ({ request }) => {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mailbox = parseReplyMailbox(process.env.RFI_REPLY_MAILBOX);
  if (!mailbox) {
    return NextResponse.json({
      ok: true,
      skipped: "RFI_REPLY_MAILBOX not configured",
    });
  }

  const sinceIso = new Date(Date.now() - LOOKBACK_HOURS * 3600_000).toISOString();
  const result = await listOutlookReplyMessages({
    mailboxUserId: mailbox.address,
    sinceIso,
    limit: 100,
  });

  if (!result.ok) {
    logger.error({ msg: "[rfi-email-replies] mailbox read failed", error: result.error });
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  const supabase = createServiceClient();
  let ingested = 0;
  let unmatched = 0;

  for (const message of result.messages) {
    const token = extractReplyToken(
      [...message.toList, ...message.ccList],
      message.bodyText,
      mailbox,
    );
    if (!token) {
      unmatched++;
      continue;
    }

    const resolved = await resolveRfiResponseToken(supabase, token);
    if (!resolved) {
      unmatched++;
      continue;
    }

    const body = stripQuotedReply(message.bodyText);
    if (!body) continue;

    // Don't accept responses to a closed RFI.
    const { data: rfi } = await serviceDb.from("rfis")
      .select("id, status, rfi_manager")
      .eq("id", resolved.rfiId)
      .maybeSingle();
    if (!rfi || rfi.status === "closed" || rfi.status === "closed-draft") continue;

    // Insert keyed by Graph message id; duplicates (re-read window) are ignored.
    const { data: inserted, error } = await serviceDb.from("rfi_responses")
      .upsert(
        {
          rfi_id: resolved.rfiId,
          project_id: resolved.projectId,
          responder_name: resolved.recipientName ?? message.fromName,
          responder_email: resolved.recipientEmail ?? message.fromEmail,
          responder_person_id: resolved.recipientPersonId,
          body,
          source: "email",
          source_message_id: message.id,
        },
        { onConflict: "source_message_id", ignoreDuplicates: true },
      )
      .select("id");

    if (error) {
      logger.error({ msg: "[rfi-email-replies] insert failed", error: error.message });
      continue;
    }
    if (!inserted || inserted.length === 0) continue; // duplicate, already ingested

    ingested++;
    if (rfi.rfi_manager) {
      await serviceDb.from("rfis")
        .update({ ball_in_court: rfi.rfi_manager })
        .eq("id", resolved.rfiId);
    }
    void notifyRfiResponseReceived(supabase, {
      rfiId: resolved.rfiId,
      responderName: resolved.recipientName ?? resolved.recipientEmail,
      body,
    }).catch(() => undefined);
  }

  return NextResponse.json({
    ok: true,
    scanned: result.messages.length,
    ingested,
    unmatched,
  });
});

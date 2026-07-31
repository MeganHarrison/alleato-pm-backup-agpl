/**
 * Public RFI response endpoint (NO app login).
 *
 * A subcontractor follows the magic link in their RFI email to /respond/rfi/<token>
 * and submits an answer. Authorization is the token itself (resolved server-side
 * against rfi_response_tokens) — there is no Supabase session. All DB access uses
 * the service-role client AFTER the token is validated.
 *
 * POST /api/respond/rfi/[token]  — submit a response
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { resolveRfiResponseToken } from "@/lib/rfi/response-tokens";
import { notifyRfiResponseReceived } from "@/lib/rfi/rfi-notify";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const MAX_BODY_LENGTH = 20_000;

export const POST = withApiGuardrails<{ token: string }>(
  "respond/rfi/[token]#POST",
  async ({ request, params }) => {
    const { token } = await params;
    const supabase = createServiceClient();

    const resolved = await resolveRfiResponseToken(supabase, token);
    if (!resolved) {
      return NextResponse.json(
        { error: "This response link is invalid or has expired." },
        { status: 410 },
      );
    }

    let payload: { body?: unknown };
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const body = typeof payload.body === "string" ? payload.body.trim() : "";
    if (!body) {
      return NextResponse.json(
        { error: "Please enter a response before submitting." },
        { status: 400 },
      );
    }
    if (body.length > MAX_BODY_LENGTH) {
      return NextResponse.json(
        { error: "Response is too long." },
        { status: 400 },
      );
    }

    // Reject responses to an already-closed RFI so subs can't reopen the thread.
    const { data: rfi } = await serviceDb.from("rfis")
      .select("id, status, rfi_manager")
      .eq("id", resolved.rfiId)
      .maybeSingle();

    if (!rfi) {
      return NextResponse.json({ error: "RFI not found." }, { status: 404 });
    }
    if (rfi.status === "closed" || rfi.status === "closed-draft") {
      return NextResponse.json(
        { error: "This RFI is closed and no longer accepting responses." },
        { status: 409 },
      );
    }

    const { data: inserted, error: insertError } = await serviceDb.from("rfi_responses")
      .insert({
        rfi_id: resolved.rfiId,
        project_id: resolved.projectId,
        responder_name: resolved.recipientName,
        responder_email: resolved.recipientEmail,
        responder_person_id: resolved.recipientPersonId,
        body,
        source: "web",
      })
      .select("id, created_at")
      .single();

    if (insertError) {
      logger.error({
        msg: "[rfi-respond] insert failed",
        error: insertError.message,
        rfiId: resolved.rfiId,
      });
      return NextResponse.json(
        { error: "Could not save your response. Please try again." },
        { status: 500 },
      );
    }

    // Ball is now back with the RFI manager. Best-effort; never fail the response.
    if (rfi.rfi_manager) {
      await serviceDb.from("rfis")
        .update({ ball_in_court: rfi.rfi_manager })
        .eq("id", resolved.rfiId);
    }

    // Notify the RFI manager / internal team a response arrived (best-effort).
    void notifyRfiResponseReceived(supabase, {
      rfiId: resolved.rfiId,
      responderName: resolved.recipientName ?? resolved.recipientEmail,
      body,
    }).catch((err) => {
      logger.warn({
        msg: "[rfi-respond] response notification failed",
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return NextResponse.json({
      ok: true,
      responseId: inserted.id,
      createdAt: inserted.created_at,
    });
  },
);

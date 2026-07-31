/**
 * GET /api/insight-cards/[cardId]/acknowledge
 *
 * Owner-facing action endpoint clicked from the daily Teams brief.
 * Marks the insight card as resolved so it stops surfacing in tomorrow's
 * briefing.
 *
 * Auth: shared bearer token in `?token=` (OWNER_BRIEFING_ACTION_TOKEN) OR
 *       authenticated Supabase session.
 *
 * Behavior: 302 redirect back to `?return=<url>` after the update. If the
 * return URL is missing, redirect to the AI assistant.
 */

import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function authorize(request: Request): Promise<{ ok: boolean; via: string }> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();
  const expected = process.env.OWNER_BRIEFING_ACTION_TOKEN?.trim() || process.env.CRON_SECRET?.trim();
  if (token && expected && token === expected) {
    return { ok: true, via: "token" };
  }
  try {
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (user) return { ok: true, via: "session" };
  } catch (error) {
    console.warn("insight-card acknowledge session auth failed; falling back to token auth", error);
  }
  return { ok: false, via: "none" };
}

function safeReturn(rawReturn: string | null, fallback: string): string {
  if (!rawReturn) return fallback;
  try {
    const parsed = new URL(rawReturn);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return fallback;
    // Only allow same-host redirects to avoid open-redirect abuse.
    if (!parsed.hostname.endsWith("alleatogroup.com") && parsed.hostname !== "localhost") {
      return fallback;
    }
    return parsed.toString();
  } catch {
    return fallback;
  }
}

export const GET = withApiGuardrails(
  "insight-cards/[cardId]/acknowledge#GET",
  async ({ request, params }): Promise<Response> => {
    const auth = await authorize(request);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error_code: "AUTH_EXPIRED", error_message: "Unauthorized" },
        { status: 401 },
      );
    }

    const cardId = (await params)?.cardId;
    if (!cardId || typeof cardId !== "string") {
      return NextResponse.json(
        { success: false, error_code: "BAD_REQUEST", error_message: "cardId is required" },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();
    const { error } = await serviceDb.from("insight_cards")
      .update({
        current_status: "resolved",
        updated_at: new Date().toISOString(),
      })
      .eq("id", cardId);
    if (error) {
      return NextResponse.json(
        {
          success: false,
          error_code: "INSIGHT_CARD_UPDATE_FAILED",
          error_message: `Failed to acknowledge insight card ${cardId}: ${error.message}`,
        },
        { status: 500 },
      );
    }

    const url = new URL(request.url);
    const fallback = `${url.origin}/ai?intent=owner-brief&ack=${cardId}`;
    const redirectUrl = safeReturn(url.searchParams.get("return"), fallback);
    return NextResponse.redirect(redirectUrl, 302);
  },
);

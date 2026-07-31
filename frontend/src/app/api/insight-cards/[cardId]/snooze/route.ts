/**
 * GET /api/insight-cards/[cardId]/snooze
 *
 * Owner-facing action endpoint clicked from the daily Teams brief. Snoozes the
 * card for 24h by setting `stale_after = now + 24h`. The owner briefing
 * builder filters out cards whose stale_after has not yet elapsed.
 *
 * Auth: shared bearer token (OWNER_BRIEFING_ACTION_TOKEN) OR authenticated session.
 * Behavior: 302 redirect back to `?return=<url>`.
 */

import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SNOOZE_HOURS = 24;

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
    console.warn("insight-card snooze session auth failed; falling back to token auth", error);
  }
  return { ok: false, via: "none" };
}

function safeReturn(rawReturn: string | null, fallback: string): string {
  if (!rawReturn) return fallback;
  try {
    const parsed = new URL(rawReturn);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return fallback;
    if (!parsed.hostname.endsWith("alleatogroup.com") && parsed.hostname !== "localhost") {
      return fallback;
    }
    return parsed.toString();
  } catch {
    return fallback;
  }
}

export const GET = withApiGuardrails(
  "insight-cards/[cardId]/snooze#GET",
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

    const snoozedUntil = new Date(Date.now() + SNOOZE_HOURS * 3_600_000).toISOString();
    const supabase = createServiceClient();
    const { error } = await serviceDb.from("insight_cards")
      .update({
        stale_after: snoozedUntil,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cardId);
    if (error) {
      return NextResponse.json(
        {
          success: false,
          error_code: "INSIGHT_CARD_SNOOZE_FAILED",
          error_message: `Failed to snooze insight card ${cardId}: ${error.message}`,
        },
        { status: 500 },
      );
    }

    const url = new URL(request.url);
    const fallback = `${url.origin}/ai?intent=owner-brief&snoozed=${cardId}`;
    const redirectUrl = safeReturn(url.searchParams.get("return"), fallback);
    return NextResponse.redirect(redirectUrl, 302);
  },
);

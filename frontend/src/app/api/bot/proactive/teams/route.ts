// frontend/src/app/api/bot/proactive/teams/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { sendProactiveTeamsDM } from "@/lib/bot/teams-proactive";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { logger } from "@/lib/logger";

/**
 * POST /api/bot/proactive/teams
 *
 * Send a proactive Teams DM to a Supabase user.
 * Requires Bearer token matching NOTIFICATION_SERVICE_KEY.
 *
 * Body: { userId: string, message: string }
 * Response: { sent: boolean, reason?: string }
 */
export const POST = withApiGuardrails("bot/proactive/teams#POST", async ({ request }): Promise<Response> => {
  const authHeader = request.headers.get("authorization");
  const serviceKey = process.env.NOTIFICATION_SERVICE_KEY;

  if (!serviceKey) {
    logger.error({ msg: "[bot/proactive/teams] NOTIFICATION_SERVICE_KEY is not set" });
    return NextResponse.json({ error: "Service misconfigured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${serviceKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { userId?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userId, message } = body;

  if (!userId || !message) {
    return NextResponse.json(
      { error: "Missing required fields: userId, message" },
      { status: 400 },
    );
  }

  try {
    const result = await sendProactiveTeamsDM(userId, message);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ msg: "[bot/proactive/teams] failed", error: msg, userId });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
});

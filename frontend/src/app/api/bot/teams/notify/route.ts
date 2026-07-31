export const dynamic = "force-dynamic";

/**
 * POST /api/bot/teams/notify
 *
 * Send a proactive Teams message to a linked user.
 * Internal endpoint — authenticated via CRON_SECRET.
 *
 * Body: { userId: string, message: string, preferDm?: boolean }
 */

import { NextResponse } from "next/server";
import { sendProactiveMessage } from "@/lib/bot/teams-chat";
import { withApiGuardrails } from "@/lib/guardrails/api";

export const POST = withApiGuardrails("bot/teams/notify#POST", async ({ request }): Promise<Response> => {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { userId?: string; message?: string; preferDm?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, message, preferDm = true } = body;
  if (!userId || !message) {
    return NextResponse.json({ error: "userId and message are required" }, { status: 400 });
  }

  try {
    await sendProactiveMessage(userId, message, preferDm);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[teams-notify] failed to send proactive message", { userId, error: msg });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
});

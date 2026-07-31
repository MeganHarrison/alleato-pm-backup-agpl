/**
 * Unified webhook route for all Chat SDK platforms.
 *
 * POST /api/bot/slack    → Slack events & interactions
 * POST /api/bot/teams    → Microsoft Teams activity
 * POST /api/bot/telegram → Telegram webhook updates
 *
 * The [platform] segment maps directly to the adapter name registered
 * in the Chat SDK bot instance.
 */

import { after } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

export const maxDuration = 120;

export const POST = withApiGuardrails<Promise<{ platform: string }>>(
  "/api/bot/[platform]#POST",
  async ({ request, params }) => {
  try {
    const { platform } = await params;
    const { bot } = await import("@/lib/bot");

    const handler = bot.webhooks[platform as keyof typeof bot.webhooks];
    if (!handler) {
      throw new GuardrailError({
        code: "ROUTE_BINDING_MISSING",
        where: "/api/bot/[platform]#POST",
        message: `Unknown platform: ${platform}`,
        status: 404,
        severity: "low",
      });
    }

    return await handler(request, {
      waitUntil: (task: Promise<unknown>) => after(() => task),
    });
  } catch (error) {
    if (error instanceof GuardrailError) throw error;
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/bot/[platform]#POST",
      message: "Bot webhook processing failed.",
      details: { reason: error instanceof Error ? error.message : String(error) },
      cause: error instanceof Error ? error : undefined,
    });
  }
  },
);

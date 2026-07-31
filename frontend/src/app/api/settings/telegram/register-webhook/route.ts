export const dynamic = "force-dynamic";

/**
 * POST /api/settings/telegram/register-webhook
 *
 * One-time admin call that registers the bot's webhook URL with Telegram.
 * Must be called after each production deployment if the domain changes.
 *
 * Requires: admin session + TELEGRAM_BOT_TOKEN env var.
 */

import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { fetchWithGuardrails } from "@/lib/fetch-with-guardrails";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

export const POST = withApiGuardrails(
  "/api/settings/telegram/register-webhook#POST",
  async ({ request, requestId }) => {
    const user = await getApiRouteUser();
    const supabase = createServiceClient();
    if (!user) {
      throw new GuardrailError({
        code: "UNAUTHORIZED",
        where: "/api/settings/telegram/register-webhook#POST",
        message: "Not authenticated.",
        status: 401,
        severity: "low",
      });
    }

    // Admin-only
    const { data: profile } = await serviceDb.from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      throw new GuardrailError({
        code: "FORBIDDEN",
        where: "/api/settings/telegram/register-webhook#POST",
        message: "Admin access required.",
        status: 403,
        severity: "low",
      });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new GuardrailError({
        code: "MISSING_CONFIG",
        where: "/api/settings/telegram/register-webhook#POST",
        message: "TELEGRAM_BOT_TOKEN is not set.",
        severity: "high",
      });
    }

    // Derive the webhook URL from the request origin (works on Vercel + local)
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ??
      request.headers.get("origin") ??
      request.headers.get("x-forwarded-host");

    if (!origin) {
      throw new GuardrailError({
        code: "MISSING_CONFIG",
        where: "/api/settings/telegram/register-webhook#POST",
        message: "Cannot determine app URL. Set NEXT_PUBLIC_APP_URL.",
        severity: "medium",
      });
    }

    const webhookUrl = `${origin.replace(/\/$/, "")}/api/bot/telegram`;
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;

    const body: Record<string, string> = { url: webhookUrl };
    if (secretToken) body.secret_token = secretToken;

    const data = await fetchWithGuardrails(
      `https://api.telegram.org/bot${token}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        requestId,
        where: "/api/settings/telegram/register-webhook",
        timeoutMs: 10_000,
        retries: 1,
      },
    );

    return NextResponse.json({ webhookUrl, telegram: data });
  },
);

// GET — check current webhook status
export const GET = withApiGuardrails(
  "/api/settings/telegram/register-webhook#GET",
  async ({ requestId }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "UNAUTHORIZED",
        where: "/api/settings/telegram/register-webhook#GET",
        message: "Not authenticated.",
        status: 401,
        severity: "low",
      });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return NextResponse.json({ registered: false, reason: "TELEGRAM_BOT_TOKEN not set" });
    }

    const data = await fetchWithGuardrails(
      `https://api.telegram.org/bot${token}/getWebhookInfo`,
      {
        requestId,
        where: "/api/settings/telegram/register-webhook#GET",
        timeoutMs: 8_000,
        retries: 0,
      },
    );

    return NextResponse.json({ registered: !!(data as { result?: { url?: string } }).result?.url, info: data });
  },
);

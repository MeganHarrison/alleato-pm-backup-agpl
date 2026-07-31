export const dynamic = "force-dynamic";

/**
 * GET /api/settings/teams/register-webhook
 *
 * Returns the Teams bot Messaging Endpoint URL that should be pasted into
 * the Azure Bot resource configuration.
 *
 * Teams webhooks are registered manually in the Azure Portal (unlike Telegram
 * which has a setWebhook API). This route tells admins what URL to register.
 *
 * POST — validates that TEAMS_APP_ID and TEAMS_APP_PASSWORD are configured.
 *
 * Requires: admin session.
 */

import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

// GET — return the Messaging Endpoint URL for the admin to paste into Azure
export const GET = withApiGuardrails(
  "/api/settings/teams/register-webhook#GET",
  async ({ request }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "UNAUTHORIZED",
        where: "/api/settings/teams/register-webhook#GET",
        message: "Not authenticated.",
        status: 401,
        severity: "low",
      });
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ??
      request.headers.get("origin") ??
      request.headers.get("x-forwarded-host");

    const webhookUrl = origin
      ? `${origin.replace(/\/$/, "")}/api/bot/teams`
      : null;

    const configured = !!(
      process.env.TEAMS_APP_ID && process.env.TEAMS_APP_PASSWORD
    );

    return NextResponse.json({
      webhookUrl,
      configured,
      appId: process.env.TEAMS_APP_ID ?? null,
      tenantId: process.env.TEAMS_APP_TENANT_ID ?? null,
      instructions: [
        "1. Go to portal.azure.com → Azure Bot resource",
        "2. Under Configuration, set Messaging Endpoint to the webhookUrl above",
        "3. Save changes — Teams will start sending activities to that URL",
      ],
    });
  },
);

// POST — validate credentials are set (smoke-test config without calling Azure)
export const POST = withApiGuardrails(
  "/api/settings/teams/register-webhook#POST",
  async ({ request }) => {
    const user = await getApiRouteUser();
    const supabase = createServiceClient();
    if (!user) {
      throw new GuardrailError({
        code: "UNAUTHORIZED",
        where: "/api/settings/teams/register-webhook#POST",
        message: "Not authenticated.",
        status: 401,
        severity: "low",
      });
    }

    const { data: profile } = await serviceDb.from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      throw new GuardrailError({
        code: "FORBIDDEN",
        where: "/api/settings/teams/register-webhook#POST",
        message: "Admin access required.",
        status: 403,
        severity: "low",
      });
    }

    const missing: string[] = [];
    if (!process.env.TEAMS_APP_ID) missing.push("TEAMS_APP_ID");
    if (!process.env.TEAMS_APP_PASSWORD) missing.push("TEAMS_APP_PASSWORD");

    if (missing.length > 0) {
      throw new GuardrailError({
        code: "MISSING_CONFIG",
        where: "/api/settings/teams/register-webhook#POST",
        message: `Missing required env vars: ${missing.join(", ")}`,
        details: { missing },
        severity: "high",
      });
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ??
      request.headers.get("origin") ??
      request.headers.get("x-forwarded-host");

    const webhookUrl = `${(origin ?? "").replace(/\/$/, "")}/api/bot/teams`;

    return NextResponse.json({
      ok: true,
      webhookUrl,
      appId: process.env.TEAMS_APP_ID,
      tenantId: process.env.TEAMS_APP_TENANT_ID ?? "multi-tenant",
    });
  },
);

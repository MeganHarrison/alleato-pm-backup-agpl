export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { nanoid } from "nanoid";

// GET — check whether the current user has a linked Telegram account
export const GET = withApiGuardrails(
  "/api/settings/telegram/link#GET",
  async () => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "UNAUTHORIZED",
        where: "/api/settings/telegram/link#GET",
        message: "Not authenticated.",
        status: 401,
        severity: "low",
      });
    }

    const supabase = createServiceClient();
    const { data: mapping } = await serviceDb.from("bot_user_mappings")
      .select("platform_user_id, display_name, created_at")
      .eq("supabase_user_id", user.id)
      .eq("platform", "telegram")
      .maybeSingle();

    return NextResponse.json({ linked: !!mapping, mapping: mapping ?? null });
  },
);

// POST — generate a short-lived link code for the current user
export const POST = withApiGuardrails(
  "/api/settings/telegram/link#POST",
  async () => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "UNAUTHORIZED",
        where: "/api/settings/telegram/link#POST",
        message: "Not authenticated.",
        status: 401,
        severity: "low",
      });
    }

    const supabase = createServiceClient();

    // Invalidate any previous unused codes for this user
    await serviceDb.from("telegram_link_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("used_at", null);

    const code = nanoid(8);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error } = await serviceDb.from("telegram_link_codes").insert({
      code,
      user_id: user.id,
      expires_at: expiresAt,
    });

    if (error) {
      throw new GuardrailError({
        code: "DB_INSERT_FAILED",
        where: "/api/settings/telegram/link#POST",
        message: "Failed to create link code.",
        details: { reason: error.message },
        severity: "medium",
      });
    }

    const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? "alleatoAIbot";
    const deepLink = `https://t.me/${botUsername}?start=${code}`;

    return NextResponse.json({ code, deepLink, expiresAt });
  },
);

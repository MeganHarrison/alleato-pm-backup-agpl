import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";

const WHERE = "api.engagement.session#POST";
const SessionSchema = z.object({
  id: z.string().uuid(),
  entrySurface: z.enum(["admin", "main", "training", "other"]),
});

export const POST = withApiGuardrails(WHERE, async ({ request }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: WHERE,
      message: "Sign in before recording application activity.",
      status: 401,
    });
  }

  const input = await parseJsonBody(request, SessionSchema, WHERE);
  const { data: existing, error: readError } = await serviceDb
    .from("app_usage_sessions")
    .select("id, user_id")
    .eq("id", input.id)
    .maybeSingle();

  if (readError) {
    throw new GuardrailError({ code: "DATABASE_ERROR", where: WHERE, details: readError.message });
  }
  if (existing && existing.user_id !== user.id) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where: WHERE,
      message: "This activity session belongs to a different signed-in user.",
      status: 403,
    });
  }

  const result = existing
    ? await serviceDb
        .from("app_usage_sessions")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", input.id)
    : await serviceDb.from("app_usage_sessions").insert({
        id: input.id,
        user_id: user.id,
        entry_surface: input.entrySurface,
      });

  if (result.error) {
    throw new GuardrailError({ code: "DATABASE_ERROR", where: WHERE, details: result.error.message });
  }
  return NextResponse.json({ recorded: true }, { status: existing ? 200 : 201 });
});

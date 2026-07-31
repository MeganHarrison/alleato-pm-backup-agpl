import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const GET = withApiGuardrails(
  "team-chat/previews#GET",
  async () => {
  const supabase = await createClient();

  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "team-chat/previews#GET",
      message: "Authentication required.",
    });
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (profileError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "team-chat/previews#GET",
      message: profileError.message,
    });
  }

  if (!profile?.is_admin) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where: "team-chat/previews#GET",
      message: "Admin access required.",
      status: 403,
    });
  }

  // Get the most recent message per channel
  const { data, error } = await supabase
    .from("team_chat_messages")
    .select("channel_id, content, user_name, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "team-chat/previews#GET",
      message: error.message,
    });
  }

  // Keep only the latest message per channel
  const byChannel: Record<string, { content: string; user_name: string; created_at: string }> = {};
  for (const row of data ?? []) {
    if (!byChannel[row.channel_id]) {
      byChannel[row.channel_id] = {
        content: row.content,
        user_name: row.user_name,
        created_at: row.created_at,
      };
    }
  }

  return NextResponse.json(byChannel);
  },
);

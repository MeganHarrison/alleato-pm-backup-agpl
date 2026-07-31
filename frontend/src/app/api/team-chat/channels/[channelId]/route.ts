import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { NextResponse } from "next/server";

async function assertAdminAccess() {
  // Ensure only authenticated admins can mutate channels.
  const supabase = await createClient();
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "team-chat/channels/[channelId]#DELETE",
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
      where: "team-chat/channels/[channelId]#DELETE",
      message: profileError.message,
    });
  }

  if (!profile?.is_admin) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where: "team-chat/channels/[channelId]#DELETE",
      message: "Admin access required.",
      status: 403,
    });
  }

  return supabase;
}

export const DELETE = withApiGuardrails(
  "team-chat/channels/[channelId]#DELETE",
  async ({ params }) => {
    const supabase = await assertAdminAccess();
    const channelId = decodeURIComponent(params.channelId);

    if (!channelId) {
      return NextResponse.json({ error: "channelId is required." }, { status: 400 });
    }

    if (channelId === "general") {
      return NextResponse.json(
        { error: "The general channel cannot be deleted." },
        { status: 400 },
      );
    }

    const { count, error: countError } = await supabase
      .from("team_chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("channel_id", channelId);

    if (countError) {
      return apiErrorResponse(countError);
    }

    if ((count ?? 0) === 0) {
      return NextResponse.json({ error: "Channel not found." }, { status: 404 });
    }

    const { error } = await supabase
      .from("team_chat_messages")
      .delete()
      .eq("channel_id", channelId);

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ success: true });
  },
);

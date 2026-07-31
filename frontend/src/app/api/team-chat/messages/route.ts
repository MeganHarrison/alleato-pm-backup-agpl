import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { fetchAllComments } from "@/lib/comments/all-comments";
import {
  buildCommentInboxMessages,
  isCommentInboxChannel,
} from "@/lib/team-chat/comment-dm";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";

async function assertAdminAccess(where: string) {
  const supabase = await createClient();
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
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
      where,
      message: profileError.message,
    });
  }

  if (!profile?.is_admin) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where,
      message: "Admin access required.",
      status: 403,
    });
  }

  return { supabase, userId: user.id, email: user.email ?? null };
}

export const GET = withApiGuardrails(
  "team-chat/messages#GET",
  async ({ request }) => {
    const { supabase } = await assertAdminAccess("team-chat/messages#GET");
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channel");
    const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 200);

    if (!channelId) {
      return NextResponse.json({ error: "channel is required" }, { status: 400 });
    }

    if (isCommentInboxChannel(channelId)) {
      try {
        const comments = await fetchAllComments();
        return NextResponse.json(buildCommentInboxMessages(comments));
      } catch (error) {
        return NextResponse.json(
          {
            error: "Failed to load comments inbox.",
            detail: error instanceof Error ? error.message : String(error),
          },
          { status: 502 },
        );
      }
    }

    const { data, error } = await supabase
      .from("team_chat_messages")
      .select("id, channel_id, user_name, content, created_at")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json(data);
  },
);

export const POST = withApiGuardrails(
  "team-chat/messages#POST",
  async ({ request }) => {
    const { supabase, userId, email } = await assertAdminAccess(
      "team-chat/messages#POST",
    );

    const body = await request.json();
    const { channelId, content } = body as {
      channelId: string;
      content: string;
    };

    if (!channelId || !content?.trim()) {
      return NextResponse.json(
        { error: "channelId and content are required" },
        { status: 400 },
      );
    }

    if (isCommentInboxChannel(channelId)) {
      return NextResponse.json(
        { error: "Comments inbox is read-only." },
        { status: 403 },
      );
    }

    const normalizedContent = content.trim();
    if (normalizedContent.length > 4000) {
      return NextResponse.json(
        { error: "Messages must be 4000 characters or fewer." },
        { status: 400 },
      );
    }

    const [{ data: profile, error: profileError }, { count: channelMessageCount, error: channelError }] =
      await Promise.all([
        supabase
          .from("user_profiles")
          .select("full_name, email")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("team_chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("channel_id", channelId),
      ]);

    if (profileError) {
      return apiErrorResponse(profileError);
    }

    if (channelError) {
      return apiErrorResponse(channelError);
    }

    if (channelId !== "general" && (channelMessageCount ?? 0) === 0) {
      return NextResponse.json({ error: "Channel not found." }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("team_chat_messages")
      .insert({
        channel_id: channelId,
        user_id: userId,
        user_name: profile?.full_name ?? profile?.email ?? email ?? "Admin",
        content: normalizedContent,
      })
      .select("id, channel_id, user_name, content, created_at")
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json(data, { status: 201 });
  },
);

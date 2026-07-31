import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { fetchAllComments } from "@/lib/comments/all-comments";
import { buildCommentInboxChannel } from "@/lib/team-chat/comment-dm";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";

// Deterministic DM channel ID: dm-{sortedPrefix1}-{sortedPrefix2}
function dmChannelId(userId1: string, userId2: string): string {
  const clean = (id: string) => id.replace(/-/g, "").slice(0, 12);
  const [a, b] = [clean(userId1), clean(userId2)].sort();
  return `dm-${a}-${b}`;
}

// Encodes participant IDs in the topic so we can identify DM channels and resolve partner names.
function dmTopic(userId1: string, userId2: string): string {
  return `__dm__:${userId1},${userId2}`;
}

async function assertAdmin() {
  const supabase = await createClient();
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "team-chat/direct-messages",
      message: "Authentication required.",
    });
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("is_admin, full_name, email")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.is_admin) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where: "team-chat/direct-messages",
      message: "Admin access required.",
      status: 403,
    });
  }

  return {
    supabase,
    userId: user.id,
    userName: profile.full_name ?? profile.email ?? "Admin",
  };
}

// GET: list all DM channels where the current user is a participant.
export const GET = withApiGuardrails("team-chat/direct-messages#GET", async () => {
  const { supabase, userId } = await assertAdmin();

  // Find channels whose topic encodes this user as a participant.
  const { data: channels, error } = await supabase
    .from("team_chat_channels")
    .select("id, name, topic, created_at")
    .like("topic", `__dm__%${userId}%`);

  if (error) {
    return apiErrorResponse(error);
  }

  const dmChannels = channels ?? [];
  let dms: Array<{
    id: string;
    name: string;
    topic: string;
    team: string;
    section: "dm";
    unread: number;
    memberCount: number;
    preview: string;
    lastMessageAt: string | null;
    deletable: false;
    isDm: true;
    dmPartnerId: string;
    dmPartnerName: string;
  }> = [];

  if (dmChannels.length > 0) {
    // Resolve partner display names from user_profiles.
    const partnerIds = dmChannels.flatMap((ch) => {
      const match = ch.topic.match(/^__dm__:(.+),(.+)$/);
      if (!match) return [];
      return [match[1], match[2]].filter((id) => id !== userId);
    });

    const uniquePartnerIds = [...new Set(partnerIds)];
    const { data: partnerProfiles } = await supabase
      .from("user_profiles")
      .select("id, full_name, email")
      .in("id", uniquePartnerIds);

    const profileMap = new Map(
      (partnerProfiles ?? []).map((p) => [p.id, p.full_name ?? p.email ?? "Unknown"]),
    );

    // Fetch last message preview for each DM.
    const channelIds = dmChannels.map((ch) => ch.id);
    const { data: lastMessages } = await supabase
      .from("team_chat_messages")
      .select("channel_id, content, created_at")
      .in("channel_id", channelIds)
      .order("created_at", { ascending: false });

    const latestByChannel = new Map<string, { content: string; created_at: string }>();
    for (const msg of lastMessages ?? []) {
      if (!latestByChannel.has(msg.channel_id)) {
        latestByChannel.set(msg.channel_id, {
          content: msg.content,
          created_at: msg.created_at,
        });
      }
    }

    dms = dmChannels.map((ch) => {
      const match = ch.topic.match(/^__dm__:(.+),(.+)$/);
      const partnerId = match
        ? [match[1], match[2]].find((id) => id !== userId) ?? ""
        : "";
      const latest = latestByChannel.get(ch.id);

      return {
        id: ch.id,
        name: profileMap.get(partnerId) ?? ch.name,
        topic: ch.topic,
        team: "Direct Messages",
        section: "dm" as const,
        unread: 0,
        memberCount: 2,
        preview: latest?.content ?? "No messages yet.",
        lastMessageAt: latest?.created_at ?? null,
        deletable: false,
        isDm: true,
        dmPartnerId: partnerId,
        dmPartnerName: profileMap.get(partnerId) ?? ch.name,
      };
    });
  }

  let commentInbox: ReturnType<typeof buildCommentInboxChannel>;
  try {
    const comments = await fetchAllComments();
    commentInbox = buildCommentInboxChannel(comments);
  } catch (error) {
    console.error("[team-chat/direct-messages] comments inbox unavailable", {
      error: error instanceof Error ? error.message : String(error),
    });
    commentInbox = buildCommentInboxChannel([], { unavailable: true });
  }

  return NextResponse.json([commentInbox, ...dms]);
});

// POST: open (or create) a DM channel with a target user.
export const POST = withApiGuardrails(
  "team-chat/direct-messages#POST",
  async ({ request }) => {
    const { supabase, userId, userName } = await assertAdmin();
    const body = (await request.json()) as { targetUserId?: string };
    const targetUserId = body.targetUserId?.trim() ?? "";

    if (!targetUserId || targetUserId === userId) {
      throw new GuardrailError({
        code: "INVALID_INPUT",
        where: "team-chat/direct-messages#POST",
        message: "Invalid target user.",
        status: 400,
      });
    }

    // Verify target user exists.
    const { data: targetProfile, error: targetError } = await supabase
      .from("user_profiles")
      .select("full_name, email")
      .eq("id", targetUserId)
      .maybeSingle();

    if (targetError) return apiErrorResponse(targetError);
    if (!targetProfile) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "team-chat/direct-messages#POST",
        message: "User not found.",
        status: 404,
      });
    }

    const targetName = targetProfile.full_name ?? targetProfile.email ?? "Unknown";
    const channelId = dmChannelId(userId, targetUserId);
    const topic = dmTopic(userId, targetUserId);

    // Check if DM channel already exists.
    const { data: existing } = await supabase
      .from("team_chat_channels")
      .select("id, name")
      .eq("id", channelId)
      .maybeSingle();

    if (existing) {
      // Channel exists — just return it.
      const { data: lastMsg } = await supabase
        .from("team_chat_messages")
        .select("content, created_at")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return NextResponse.json({
        id: channelId,
        name: targetName,
        topic,
        team: "Direct Messages",
        section: "dm",
        unread: 0,
        memberCount: 2,
        preview: lastMsg?.content ?? "No messages yet.",
        lastMessageAt: lastMsg?.created_at ?? null,
        deletable: false,
        isDm: true,
        dmPartnerId: targetUserId,
        dmPartnerName: targetName,
      });
    }

    // Create the DM channel.
    const { error: createError } = await supabase
      .from("team_chat_channels")
      .insert({ id: channelId, name: targetName, topic, created_by: userId });

    if (createError) return apiErrorResponse(createError);

    // Seed with a system message so the messages endpoint recognizes this channel.
    await supabase.from("team_chat_messages").insert({
      channel_id: channelId,
      user_id: userId,
      user_name: userName,
      content: `${userName} started a direct message conversation with ${targetName}.`,
    });

    return NextResponse.json(
      {
        id: channelId,
        name: targetName,
        topic,
        team: "Direct Messages",
        section: "dm",
        unread: 0,
        memberCount: 2,
        preview: "No messages yet.",
        lastMessageAt: null,
        deletable: false,
        isDm: true,
        dmPartnerId: targetUserId,
        dmPartnerName: targetName,
      },
      { status: 201 },
    );
  },
);

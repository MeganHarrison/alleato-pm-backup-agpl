import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { NextResponse } from "next/server";

interface ChannelResponse {
  id: string;
  name: string;
  topic: string;
  team: string;
  section: "channels";
  unread: number;
  memberCount: number;
  preview: string;
  lastMessageAt: string | null;
  deletable: boolean;
}

interface AdminUserResponse {
  id: string;
  name: string;
}

// Converts a channel id slug into a human-readable title for API responses.
function channelNameFromId(channelId: string): string {
  if (channelId === "general") return "General";
  return channelId
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function channelSlugFromName(name: string): string {
  // Build a stable URL-safe id from channel display name.
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function getAuthedUserWithAdminFlag() {
  // Resolve authenticated user and app-admin capability in one helper.
  const supabase = await createClient();
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "team-chat/channels#auth",
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
      where: "team-chat/channels#auth",
      message: profileError.message,
    });
  }

  return { supabase, userId: user.id, isAdmin: profile?.is_admin === true };
}

export const GET = withApiGuardrails("team-chat/channels#GET", async () => {
  const { supabase, isAdmin } = await getAuthedUserWithAdminFlag();
  if (!isAdmin) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where: "team-chat/channels#GET",
      message: "Admin access required.",
      status: 403,
    });
  }

  const [{ data: messages, error: messagesError }, { data: adminUsers, error: adminsError }] =
    await Promise.all([
      supabase
        .from("team_chat_messages")
        .select("channel_id, content, user_id, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("user_profiles")
        .select("id, full_name, email")
        .eq("is_admin", true)
        .order("full_name", { ascending: true }),
    ]);

  if (messagesError) {
    return apiErrorResponse(messagesError);
  }

  if (adminsError) {
    return apiErrorResponse(adminsError);
  }

  const latestByChannel = new Map<string, { content: string; created_at: string }>();
  const membersByChannel = new Map<string, Set<string>>();
  const channelIds = new Set<string>(["general"]);

  for (const row of messages ?? []) {
    channelIds.add(row.channel_id);
    if (!latestByChannel.has(row.channel_id)) {
      latestByChannel.set(row.channel_id, {
        content: row.content,
        created_at: row.created_at,
      });
    }

    if (row.user_id) {
      const memberSet = membersByChannel.get(row.channel_id) ?? new Set<string>();
      memberSet.add(row.user_id);
      membersByChannel.set(row.channel_id, memberSet);
    }
  }

  const normalizedChannels: ChannelResponse[] = Array.from(channelIds)
    .sort((left, right) => left.localeCompare(right))
    .map((channelId) => {
      const latest = latestByChannel.get(channelId);

      return {
        id: channelId,
        name: channelNameFromId(channelId),
        topic: channelId === "general" ? "General team discussion" : "Team discussion",
        team: "Team Chat",
        section: "channels",
        unread: 0,
        memberCount: membersByChannel.get(channelId)?.size ?? 0,
        preview: latest?.content ?? "No messages yet.",
        lastMessageAt: latest?.created_at ?? null,
        deletable: channelId !== "general",
      };
    });

  const normalizedAdmins: AdminUserResponse[] = (adminUsers ?? []).map((admin) => ({
    id: admin.id,
    name: admin.full_name ?? admin.email ?? "Admin",
  }));

  return NextResponse.json({
    channels: normalizedChannels,
    adminUsers: normalizedAdmins,
    canManageChannels: isAdmin,
  });
});

export const POST = withApiGuardrails("team-chat/channels#POST", async ({ request }) => {
  const { supabase, userId, isAdmin } = await getAuthedUserWithAdminFlag();

  if (!isAdmin) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where: "team-chat/channels#POST",
      message: "Admin access required.",
      status: 403,
    });
  }

  const body = (await request.json()) as { name?: string; topic?: string };
  const channelName = body.name?.trim() ?? "";
  const topic = body.topic?.trim() || "Team discussion";

  if (channelName.length < 2) {
    return NextResponse.json({ error: "Channel name must be at least 2 characters." }, { status: 400 });
  }

  if (channelName.length > 80) {
    return NextResponse.json({ error: "Channel name must be 80 characters or fewer." }, { status: 400 });
  }

  const channelId = channelSlugFromName(channelName);
  if (!channelId) {
    return NextResponse.json({ error: "Channel name must include letters or numbers." }, { status: 400 });
  }

  const [{ count: existingCount, error: existingError }, { data: profile, error: profileError }] =
    await Promise.all([
      supabase
        .from("team_chat_channels")
        .select("id", { count: "exact", head: true })
        .eq("id", channelId),
      supabase
        .from("user_profiles")
        .select("full_name, email")
        .eq("id", userId)
        .maybeSingle(),
    ]);

  if (existingError) {
    return apiErrorResponse(existingError);
  }

  if (profileError) {
    return apiErrorResponse(profileError);
  }

  if ((existingCount ?? 0) > 0 || channelId === "general") {
    return NextResponse.json({ error: "A channel with this name already exists." }, { status: 409 });
  }

  const { error: channelError } = await supabase
    .from("team_chat_channels")
    .insert({ id: channelId, name: channelName, topic, created_by: userId });

  if (channelError) {
    return apiErrorResponse(channelError);
  }

  const { error } = await supabase
    .from("team_chat_messages")
    .insert({
      channel_id: channelId,
      user_id: userId,
      user_name: profile?.full_name ?? profile?.email ?? "Admin",
      content: `Channel created: ${channelName}. ${topic}`,
    });

  if (error) {
    return apiErrorResponse(error);
  }

  return NextResponse.json(
    {
      id: channelId,
      name: channelName,
      topic,
      team: "Team Chat",
      section: "channels",
      unread: 0,
      memberCount: 0,
      preview: `Channel created: ${channelName}.`,
      lastMessageAt: null,
      deletable: channelId !== "general",
    } satisfies ChannelResponse,
    { status: 201 },
  );
});

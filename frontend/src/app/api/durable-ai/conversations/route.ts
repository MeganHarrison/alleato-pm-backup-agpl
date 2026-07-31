import { randomUUID } from "node:crypto";

import { getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";
import {
  DURABLE_AI_SURFACE,
  durableApiError,
  isDurableConversationMetadata,
} from "@/lib/ai/durable-chat.server";

const WHERE = "durable-ai/conversations";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  const user = await getApiRouteUser();
  if (!user) {
    return durableApiError({
      status: 401,
      code: "AUTH_REQUIRED",
      message: "Authentication is required to load durable AI conversations.",
      where: `${WHERE}#GET`,
    });
  }

  const { data, error } = await serviceDb
    .from("conversations")
    .select("session_id, title, last_message_at, created_at, metadata")
    .eq("user_id", user.id)
    .or("is_archived.is.null,is_archived.eq.false")
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (error) {
    return durableApiError({
      status: 500,
      code: "CONVERSATION_LIST_FAILED",
      message: `Durable conversation lookup failed: ${error.message}`,
      where: `${WHERE}#GET`,
    });
  }

  return Response.json({
    conversations: (data ?? [])
      .filter((conversation) =>
        isDurableConversationMetadata(conversation.metadata),
      )
      .map(({ metadata: _metadata, ...conversation }) => conversation),
  });
}

export async function POST(request: Request) {
  const user = await getApiRouteUser();
  if (!user) {
    return durableApiError({
      status: 401,
      code: "AUTH_REQUIRED",
      message:
        "Authentication is required to create a durable AI conversation.",
      where: `${WHERE}#POST`,
    });
  }

  let body: { sessionId?: unknown; title?: unknown } = {};
  try {
    body = (await request.json()) as {
      sessionId?: unknown;
      title?: unknown;
    };
  } catch {
    // An empty body is valid and creates an untitled canary conversation.
  }

  const sessionId =
    typeof body.sessionId === "string" && UUID_PATTERN.test(body.sessionId)
      ? body.sessionId
      : randomUUID();
  const now = new Date().toISOString();
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 120)
      : "Durable AI canary";
  const { data, error } = await serviceDb
    .from("conversations")
    .insert({
      session_id: sessionId,
      user_id: user.id,
      title,
      last_message_at: now,
      metadata: { surface: DURABLE_AI_SURFACE, runtime: "vercel_workflow" },
    })
    .select("session_id, title, last_message_at, created_at")
    .single();
  if (error) {
    if (error.code === "23505") {
      const { data: existing, error: lookupError } = await serviceDb
        .from("conversations")
        .select("session_id, title, last_message_at, created_at, metadata")
        .eq("session_id", sessionId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (
        !lookupError &&
        existing &&
        isDurableConversationMetadata(existing.metadata)
      ) {
        const { metadata: _metadata, ...conversation } = existing;
        return Response.json({ conversation });
      }
    }
    return durableApiError({
      status: 500,
      code: "CONVERSATION_CREATE_FAILED",
      message: `Durable conversation creation failed: ${error.message}`,
      where: `${WHERE}#POST`,
    });
  }

  return Response.json({ conversation: data }, { status: 201 });
}

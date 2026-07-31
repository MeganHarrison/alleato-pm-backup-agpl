import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";
import { apiErrorResponse } from "@/lib/api-error";
import {
  conversationMatchesSurface,
  parseAssistantSurface,
} from "@/lib/ai/chat-surface";

/**
 * GET /api/ai-assistant/conversations
 * List all non-archived conversations for the current user.
 */
export const GET = withApiGuardrails(
  "ai-assistant/conversations#GET",
  async ({ request }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "ai-assistant/conversations#GET",
        message: "Authentication required.",
      });
    }

    const { data, error } = await serviceDb
      .from("conversations")
      .select(
        "session_id, title, last_message_at, created_at, metadata, is_pinned",
      )
      .eq("user_id", user.id)
      .or("is_archived.is.null,is_archived.eq.false")
      .order("is_pinned", { ascending: false })
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (error) {
      return apiErrorResponse(error);
    }

    const surface = parseAssistantSurface(
      new URL(request.url).searchParams.get("surface"),
    );
    const conversations = (data ?? []).filter((conversation) =>
      conversationMatchesSurface(conversation.metadata, surface),
    );

    return NextResponse.json({ conversations });
  },
);

/**
 * POST /api/ai-assistant/conversations
 * Create a new conversation.
 * Body: { title?: string, metadata?: Record<string, unknown> }
 */
export const POST = withApiGuardrails(
  "ai-assistant/conversations#POST",
  async ({ request }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "ai-assistant/conversations#POST",
        message: "Authentication required.",
      });
    }

    const body = await request.json();
    const surface = parseAssistantSurface(
      new URL(request.url).searchParams.get("surface"),
    );
    const sessionId = randomUUID();
    const now = new Date().toISOString();

    const { data, error } = await serviceDb
      .from("conversations")
      .insert({
        session_id: sessionId,
        user_id: user.id,
        title: body.title || "New conversation",
        last_message_at: now,
        metadata: {
          ...(body.metadata &&
          typeof body.metadata === "object" &&
          !Array.isArray(body.metadata)
            ? body.metadata
            : {}),
          surface,
        },
      })
      .select(
        "session_id, title, last_message_at, created_at, metadata, is_pinned",
      )
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ conversation: data }, { status: 201 });
  },
);

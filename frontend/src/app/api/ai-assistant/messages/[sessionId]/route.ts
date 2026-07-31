import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";
import { apiErrorResponse } from "@/lib/api-error";
import { conversationBelongsToSurface } from "@/lib/ai/chat-surface.server";
import { parseAssistantSurface } from "@/lib/ai/chat-surface";

type RouteParams = { params: Promise<{ sessionId: string }> };

/**
 * GET /api/ai-assistant/messages/[sessionId]
 * Load all messages for a conversation.
 */
export const GET = withApiGuardrails(
  "ai-assistant/messages/[sessionId]#GET",
  async ({ request, params }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "ai-assistant/messages/[sessionId]#GET",
        message: "Authentication required.",
      });
    }

    const { sessionId } = await params;
    const surface = parseAssistantSurface(
      new URL(request.url).searchParams.get("surface"),
    );

    if (
      !(await conversationBelongsToSurface({
        sessionId,
        userId: user.id,
        surface,
      }))
    ) {
      return NextResponse.json(
        { error: "Conversation not found on this assistant surface." },
        { status: 404 },
      );
    }

    const { data, error } = await serviceDb
      .from("chat_history")
      .select("id, role, content, sources, metadata, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ messages: data ?? [] });
  },
);

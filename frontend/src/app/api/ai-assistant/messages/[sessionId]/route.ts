import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";
import { apiErrorResponse } from "@/lib/api-error";
import { conversationBelongsToSurface } from "@/lib/ai/chat-surface.server";
import { parseAssistantSurface } from "@/lib/ai/chat-surface";
import type { Json } from "@/types/database.types";
import { z } from "zod";

type RouteParams = { params: Promise<{ sessionId: string }> };

const eveMessagesSchema = z.object({
  surface: z.enum(["alleato_ai", "ask_alleato"]).default("alleato_ai"),
  messages: z
    .array(
      z.object({
        id: z.string().min(1).max(200),
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
        parts: z.array(z.unknown()).max(200),
      }),
    )
    .max(200),
});

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

/**
 * POST /api/ai-assistant/messages/[sessionId]
 * Persist Eve's completed message projection without introducing another
 * model runtime. Message IDs make retries and reconnects idempotent.
 */
export const POST = withApiGuardrails(
  "ai-assistant/messages/[sessionId]#POST",
  async ({ request, params }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "ai-assistant/messages/[sessionId]#POST",
        message: "Authentication required.",
      });
    }

    const { sessionId } = await params;
    const parsed = eveMessagesSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Eve message persistence payload is invalid." },
        { status: 400 },
      );
    }

    if (
      !(await conversationBelongsToSurface({
        sessionId,
        userId: user.id,
        surface: parsed.data.surface,
      }))
    ) {
      return NextResponse.json(
        { error: "Conversation not found on this Eve assistant surface." },
        { status: 404 },
      );
    }

    const { data: existing, error: existingError } = await serviceDb
      .from("chat_history")
      .select("metadata")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .contains("metadata", { runtime: "eve" });

    if (existingError) return apiErrorResponse(existingError);

    const existingIds = new Set(
      (existing ?? []).flatMap((row) => {
        const metadata = row.metadata;
        if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
          return [];
        }
        const id = (metadata as Record<string, unknown>).eve_message_id;
        return typeof id === "string" ? [id] : [];
      }),
    );
    const newMessages = parsed.data.messages.filter(
      (message) => !existingIds.has(message.id),
    );

    if (newMessages.length > 0) {
      const { error: insertError } = await serviceDb.from("chat_history").insert(
        newMessages.map((message) => ({
          session_id: sessionId,
          user_id: user.id,
          role: message.role,
          content: message.content,
          metadata: {
            eve_message_id: message.id,
            eve_parts: message.parts as Json,
            runtime: "eve",
          },
        })),
      );
      if (insertError) return apiErrorResponse(insertError);

      const { error: conversationError } = await serviceDb
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("session_id", sessionId)
        .eq("user_id", user.id);
      if (conversationError) return apiErrorResponse(conversationError);
    }

    return NextResponse.json({ persisted: newMessages.length });
  },
);

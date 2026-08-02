import { withApiGuardrails } from "@/lib/guardrails/api";
import { parseJsonBody } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";
import { apiErrorResponse } from "@/lib/api-error";
import { conversationBelongsToSurface } from "@/lib/ai/chat-surface.server";
import { parseAssistantSurface } from "@/lib/ai/chat-surface";
import { createChatHistoryWriter } from "@/app/api/ai-assistant/chat/chat-history-writer";

type RouteParams = { params: Promise<{ sessionId: string }> };

const EveMessageBody = z
  .object({
    surface: z.enum(["alleato_ai", "ask_alleato"]),
    messages: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(200),
            role: z.enum(["user", "assistant"]),
            content: z.string().trim().max(500_000),
            parts: z.array(z.unknown()).max(2_000),
          })
          .strict()
          .refine(
            (message) => message.content.length > 0 || message.parts.length > 0,
            { message: "A persisted Eve message must contain text or parts." },
          ),
      )
      .max(500),
  })
  .strict();

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
 * Persist a completed Eve snapshot without duplicating messages on retries.
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
    const body = await parseJsonBody(
      request,
      EveMessageBody,
      "ai-assistant/messages/[sessionId]#POST",
    );
    const surface = parseAssistantSurface(body.surface);
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

    const { data: persistedMessages, error: persistedMessagesError } =
      await serviceDb
        .from("chat_history")
        .select("id, metadata")
        .eq("session_id", sessionId)
        .eq("user_id", user.id);
    if (persistedMessagesError) {
      throw new GuardrailError({
        code: "DATABASE_ERROR",
        where: "ai-assistant/messages/[sessionId]#POST",
        message: "Existing Eve message persistence could not be verified.",
        status: 500,
        cause: persistedMessagesError,
      });
    }

    const persistedIds = new Map(
      (persistedMessages ?? []).flatMap((row) => {
        const metadata = row.metadata;
        if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
          return [];
        }
        const eveMessageId = (metadata as Record<string, unknown>).eve_message_id;
        return typeof eveMessageId === "string"
          ? [[eveMessageId, row.id] as const]
          : [];
      }),
    );
    const writer = createChatHistoryWriter(serviceDb, {
      sessionId,
      userId: user.id,
    });
    let persistedCount = 0;
    let updatedCount = 0;
    for (const message of body.messages) {
      const record = {
        role: message.role,
        content: message.content,
        metadata: {
          architecture: "eve",
          eve_message_id: message.id,
          eve_parts: message.parts,
          surface,
        },
      } as const;
      const persistedId = persistedIds.get(message.id);
      if (persistedId) {
        await writer.replaceRecordOrThrow(
          persistedId,
          record,
          `${message.role} Eve message`,
        );
        updatedCount += 1;
        continue;
      }
      await writer.persistRecordOrThrow(
        record,
        `${message.role} Eve message`,
      );
      persistedCount += 1;
    }

    return NextResponse.json({
      persistedCount,
      updatedCount,
    });
  },
);

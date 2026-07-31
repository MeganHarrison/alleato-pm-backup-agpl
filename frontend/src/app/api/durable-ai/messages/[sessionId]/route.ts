import type { UIMessage } from "ai";

import {
  durableApiError,
  durableConversationBelongsToUser,
} from "@/lib/ai/durable-chat.server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";

const WHERE = "durable-ai/messages/[sessionId]";

function isUiMessage(value: unknown): value is UIMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    (record.role === "user" || record.role === "assistant") &&
    Array.isArray(record.parts)
  );
}

export const GET = withApiGuardrails<{ sessionId: string }>(
  `${WHERE}#GET`,
  async ({ params }) => {
    const user = await getApiRouteUser();
    if (!user) {
      return durableApiError({
        status: 401,
        code: "AUTH_REQUIRED",
        message: "Authentication is required to load durable AI messages.",
        where: `${WHERE}#GET`,
      });
    }

    const { sessionId } = params;
    const ownership = await durableConversationBelongsToUser({
      sessionId,
      userId: user.id,
    });
    if (ownership.error) {
      return durableApiError({
        status: 500,
        code: "DURABLE_CONVERSATION_AUTHORIZATION_FAILED",
        message: `Durable conversation ownership lookup failed: ${ownership.error}`,
        where: `${WHERE}#GET`,
      });
    }
    if (!ownership.belongs) {
      return durableApiError({
        status: 404,
        code: "DURABLE_CONVERSATION_NOT_FOUND",
        message:
          "This durable AI conversation does not exist or is not owned by the current user.",
        where: `${WHERE}#GET`,
      });
    }

    const { data, error } = await serviceDb
      .from("chat_history")
      .select("id, role, content, metadata, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (error) {
      return durableApiError({
        status: 500,
        code: "MESSAGE_LOAD_FAILED",
        message: `Durable message lookup failed: ${error.message}`,
        where: `${WHERE}#GET`,
      });
    }

    const messages: UIMessage[] = (data ?? []).map((row) => {
      const metadata =
        row.metadata &&
        typeof row.metadata === "object" &&
        !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null;
      const persistedUiMessage = metadata?.ui_message;
      if (isUiMessage(persistedUiMessage)) return persistedUiMessage;

      return {
        id: row.id,
        role: row.role === "assistant" ? "assistant" : "user",
        parts: row.content ? [{ type: "text", text: row.content }] : [],
      };
    });

    return Response.json({ messages });
  },
);

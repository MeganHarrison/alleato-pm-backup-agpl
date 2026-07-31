"use client";

import * as React from "react";
import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";
import { apiFetch } from "@/lib/api-client";
import type { RagConversation } from "@/hooks/use-rag-conversations";

export const ASK_ALLEATO_CHAT_ID = "ask-alleato";

function stripStatusParts(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => ({
    ...message,
    parts: message.parts.filter((part) => part.type !== "data-status"),
  }));
}

export function getMessageText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function useAskAlleatoChat() {
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const sessionIdRef = React.useRef<string | null>(null);

  const chat = useChat({
    // The UI chat identity must remain stable while the backend conversation is
    // created. Changing this id after the first send resets useChat state and
    // drops the first request/response from the compact surface.
    id: ASK_ALLEATO_CHAT_ID,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    transport: new DefaultChatTransport({
      api: "/api/ask-alleato/chat",
      prepareSendMessagesRequest(request) {
        const cleanedMessages = stripStatusParts(request.messages);
        const lastMessage = cleanedMessages.at(-1);
        return {
          body: {
            id: sessionIdRef.current,
            message: lastMessage,
            messages: cleanedMessages,
          },
        };
      },
    }),
    onError(nextError) {
      setError(nextError.message || "Ask Alleato could not get a response.");
    },
  });

  const ensureSession = React.useCallback(async () => {
    if (sessionIdRef.current) return sessionIdRef.current;
    const data = await apiFetch<{ conversation: RagConversation }>(
      "/api/ai-assistant/conversations?surface=ask_alleato",
      {
        method: "POST",
        body: JSON.stringify({ title: "Ask Alleato" }),
      },
    );
    const nextSessionId = data.conversation.session_id;
    sessionIdRef.current = nextSessionId;
    setSessionId(nextSessionId);
    return nextSessionId;
  }, []);

  const send = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || chat.status === "streaming") return;
      setError(null);
      await ensureSession();
      chat.sendMessage({ text: trimmed });
    },
    [chat, ensureSession],
  );

  return {
    ...chat,
    sessionId,
    send,
    error,
    isStreaming: chat.status === "streaming",
  };
}

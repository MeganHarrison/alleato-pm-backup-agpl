"use client";

import * as React from "react";
import type { UIMessage } from "ai";
import type {
  HandleMessageStreamEvent,
  SessionState,
} from "eve/client";
import { useEveAgent } from "eve/react";
import { apiFetch } from "@/lib/api-client";
import type { RagConversation } from "@/hooks/use-rag-conversations";
import { createClient } from "@/lib/supabase/client";
import {
  eveMessageToUiMessage,
  persistEveMessages,
} from "@/hooks/use-alleato-eve-chat";

type SavedEveChat = {
  events?: readonly HandleMessageStreamEvent[];
  session?: SessionState;
};

export type AskAlleatoChatState = {
  messages: UIMessage[];
  status: string;
  sessionId: string | null;
  send: (text: string) => Promise<void>;
  stop: () => void;
  error: string | null;
  isStreaming: boolean;
};

function askAlleatoSessionStorageKey(userId: string): string {
  return `alleato:eve-chat:ask-alleato:${userId}:session`;
}

function eveChatStorageKey(userId: string, sessionId: string): string {
  return `alleato:eve-chat:${userId}:${sessionId}`;
}

function readAskAlleatoSessionId(userId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(
      askAlleatoSessionStorageKey(userId),
    );
  } catch {
    return null;
  }
}

function readSavedEveChat(
  userId: string,
  sessionId: string | null,
): SavedEveChat {
  if (!sessionId || typeof window === "undefined") return {};
  try {
    const value = window.localStorage.getItem(
      eveChatStorageKey(userId, sessionId),
    );
    if (!value) return {};
    const parsed = JSON.parse(value) as SavedEveChat;
    return {
      events: Array.isArray(parsed.events) ? parsed.events : undefined,
      session:
        parsed.session && typeof parsed.session.streamIndex === "number"
          ? parsed.session
          : undefined,
    };
  } catch {
    return {};
  }
}

function persistAskAlleatoSessionId(
  userId: string,
  sessionId: string,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    askAlleatoSessionStorageKey(userId),
    sessionId,
  );
}

function persistEveChat(
  userId: string,
  sessionId: string,
  events: readonly HandleMessageStreamEvent[],
  session: SessionState,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    eveChatStorageKey(userId, sessionId),
    JSON.stringify({ events, session } satisfies SavedEveChat),
  );
}

export function getMessageText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function useAskAlleatoIdentity() {
  const [error, setError] = React.useState<string | null>(null);
  const [userId, setUserId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    const supabase = createClient();
    async function resolveIdentity() {
      try {
        const {
          data: { session },
          error: authError,
        } = await supabase.auth.getSession();
        if (authError) throw authError;
        if (!session?.user.id) {
          throw new Error("Your session expired. Sign in again to use Ask Alleato.");
        }
        if (active) {
          setUserId(session.user.id);
        }
      } catch (identityError) {
        if (!active) return;
        setError(
          identityError instanceof Error
            ? identityError.message
            : "Ask Alleato could not verify your session.",
        );
      }
    }

    void resolveIdentity();
    return () => {
      active = false;
    };
  }, []);

  return { error, userId, isLoading: userId === null && error === null };
}

function useAskAlleatoSession({
  durable,
  userId,
}: {
  durable: boolean;
  userId: string | null;
}) {
  const [sessionId, setSessionId] = React.useState<string | null>(
    durable && userId ? readAskAlleatoSessionId(userId) : null,
  );
  const sessionIdRef = React.useRef<string | null>(sessionId);

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
    if (durable && userId) {
      persistAskAlleatoSessionId(userId, nextSessionId);
    }
    sessionIdRef.current = nextSessionId;
    setSessionId(nextSessionId);
    return nextSessionId;
  }, [durable, userId]);

  return { sessionId, sessionIdRef, ensureSession };
}

export function useAskAlleatoChat(userId: string): AskAlleatoChatState {
  const [error, setError] = React.useState<string | null>(null);
  const { sessionId, sessionIdRef, ensureSession } = useAskAlleatoSession({
    durable: true,
    userId,
  });
  const [savedChat] = React.useState(() =>
    readSavedEveChat(userId, sessionId),
  );
  const supabase = React.useMemo(() => createClient(), []);
  const eventsRef = React.useRef<readonly HandleMessageStreamEvent[]>(
    savedChat.events ?? [],
  );
  const eveSessionRef = React.useRef<SessionState>(
    savedChat.session ?? { streamIndex: 0 },
  );

  const agent = useEveAgent({
    host: "/api/ai-assistant/eve/proxy",
    auth: {
      bearer: async () => {
        const {
          data: { session },
          error: authError,
        } = await supabase.auth.getSession();
        if (authError) throw authError;
        if (!session?.access_token) {
          throw new Error("Your session expired. Sign in again to use Eve.");
        }
        return session.access_token;
      },
    },
    headers: {
      "x-alleato-assistant-surface": "ask_alleato",
    },
    initialEvents: savedChat.events,
    initialSession: savedChat.session,
    prepareSend: (input) => ({
      ...input,
      clientContext: {
        assistantSurface: "ask_alleato",
        conversationId: sessionIdRef.current,
      },
    }),
    onEvent(event) {
      eventsRef.current = [...eventsRef.current, event];
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId) return;
      persistEveChat(
        userId,
        currentSessionId,
        eventsRef.current,
        eveSessionRef.current,
      );
    },
    onSessionChange(nextSession) {
      eveSessionRef.current = nextSession;
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId) return;
      persistEveChat(
        userId,
        currentSessionId,
        eventsRef.current,
        nextSession,
      );
    },
    onError(nextError) {
      setError(nextError.message || "Ask Alleato could not get a response.");
    },
    onFinish(snapshot) {
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId) return;
      eventsRef.current = snapshot.events;
      eveSessionRef.current = snapshot.session;
      persistEveChat(
        userId,
        currentSessionId,
        snapshot.events,
        snapshot.session,
      );
      void persistEveMessages(
        currentSessionId,
        snapshot.data.messages,
        "ask_alleato",
      ).catch((persistenceError: unknown) => {
        setError(
          persistenceError instanceof Error
            ? persistenceError.message
            : "Ask Alleato could not save the conversation.",
        );
      });
    },
  });

  const send = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (
        !trimmed ||
        agent.status === "streaming" ||
        agent.status === "submitted"
      )
        return;
      setError(null);
      await ensureSession();
      await agent.send({ message: trimmed });
    },
    [agent, ensureSession],
  );

  return {
    messages: agent.data.messages.map(eveMessageToUiMessage) as UIMessage[],
    status: agent.status,
    sessionId,
    send,
    stop: agent.stop,
    error,
    isStreaming:
      agent.status === "streaming" || agent.status === "submitted",
  };
}

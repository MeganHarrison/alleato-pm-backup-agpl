"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { FileUIPart, UIMessage, UserContent } from "ai";
import type {
  HandleMessageStreamEvent,
  SessionState,
} from "eve/client";
import {
  useEveAgent,
  type EveDynamicToolPart,
  type EveMessage,
  type EveMessagePart,
} from "eve/react";
import {
  compactPersistedEveEvents,
  resolvePersistedEveSession,
  type PersistedEveChat,
  writePersistedEveChat,
} from "@/hooks/eve-session-persistence";
import { apiFetch } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/client";

type EveChatContext = {
  assistantSurface: "alleato_ai" | "ask_alleato" | "asrs";
  conversationId: string;
  councilMode: boolean;
  selectedModel: string;
  selectedProjectId: number | null;
};

function storageKey(sessionId: string): string {
  return `alleato:eve-chat:${sessionId}`;
}

function readSavedChat(sessionId: string): PersistedEveChat {
  if (typeof window === "undefined") return {};
  try {
    const value = window.localStorage.getItem(storageKey(sessionId));
    if (!value) return {};
    const parsed = JSON.parse(value) as PersistedEveChat;
    const parsedSession =
      parsed.session && typeof parsed.session.streamIndex === "number"
        ? parsed.session
        : undefined;
    return {
      events: Array.isArray(parsed.events) ? parsed.events : undefined,
      session: parsedSession
        ? resolvePersistedEveSession(undefined, parsedSession)
        : undefined,
    };
  } catch {
    return {};
  }
}

function persistChat(
  sessionId: string,
  events: readonly HandleMessageStreamEvent[],
  session: SessionState,
): void {
  if (typeof window === "undefined") return;
  const previous = readSavedChat(sessionId).session;
  const persistedSession = resolvePersistedEveSession(previous, session);
  writePersistedEveChat(window.localStorage, storageKey(sessionId), {
    events: compactPersistedEveEvents(events),
    ...(persistedSession ? { session: persistedSession } : {}),
  });
}

function authorizationText(
  part: Extract<EveMessagePart, { type: "authorization" }>,
): string {
  if (part.state === "required") {
    const url = part.authorization?.url;
    return url
      ? `${part.description}\n\nConnect ${part.displayName}: ${url}`
      : part.description;
  }
  return part.outcome === "authorized"
    ? `${part.displayName} connected.`
    : `${part.displayName} authorization ${part.outcome}.`;
}

function toolPart(part: EveDynamicToolPart) {
  return {
    ...part,
    type: `tool-${part.toolName}` as `tool-${string}`,
  };
}

function messagePart(part: EveMessagePart) {
  switch (part.type) {
    case "authorization":
      return { type: "text" as const, text: authorizationText(part) };
    case "dynamic-tool":
      return toolPart(part);
    default:
      return part;
  }
}

export function eveMessageToUiMessage(message: EveMessage): UIMessage {
  return {
    id: message.id,
    role: message.role,
    parts: message.parts.map(messagePart) as UIMessage["parts"],
  };
}

function messageText(message: UIMessage): string {
  return message.parts
    .filter(
      (part): part is Extract<(typeof message.parts)[number], { type: "text" }> =>
        part.type === "text",
    )
    .map((part) => part.text)
    .join("");
}

export async function persistEveMessages(
  sessionId: string,
  messages: readonly EveMessage[],
  surface: "alleato_ai" | "ask_alleato" = "alleato_ai",
): Promise<void> {
  await apiFetch(`/api/ai-assistant/messages/${sessionId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      surface,
      messages: messages.flatMap((message) => {
        const content = message.parts
          .filter(
            (part): part is Extract<EveMessagePart, { type: "text" }> =>
              part.type === "text",
          )
          .map((part) => part.text)
          .join("")
          .trim();
        return content || message.parts.length > 0
          ? [
              {
                id: message.id,
                role: message.role,
                content,
                parts: message.parts,
              },
            ]
          : [];
      }),
    }),
  });
}

function mergeMessages(
  persisted: readonly UIMessage[],
  live: readonly EveMessage[],
): UIMessage[] {
  const merged = [...persisted];
  const messageIds = new Set(persisted.map((message) => message.id));

  for (const eveMessage of live) {
    const message = eveMessageToUiMessage(eveMessage);
    if (messageIds.has(message.id)) continue;
    messageIds.add(message.id);
    merged.push(message);
  }
  return merged;
}

function toEveContent(text: string, files?: FileUIPart[]): UserContent {
  if (!files?.length) return text;
  return [
    ...(text.trim() ? [{ type: "text" as const, text }] : []),
    ...files.map((file) => ({
      type: "file" as const,
      data: file.url,
      mediaType: file.mediaType,
      filename: file.filename,
    })),
  ];
}

export function useAlleatoEveChat({
  context,
  initialMessages,
  onError,
  onFinish,
  sessionId,
}: {
  context: EveChatContext;
  initialMessages: readonly UIMessage[];
  onError?: (error: Error) => void;
  onFinish?: () => void;
  sessionId: string;
}) {
  const [saved] = useState(() => readSavedChat(sessionId));
  const supabase = useMemo(() => createClient(), []);
  const sessionRef = useRef<SessionState>(
    saved.session ?? { streamIndex: 0 },
  );
  const eventsRef = useRef<readonly HandleMessageStreamEvent[]>(
    saved.events ?? [],
  );
  const contextRef = useRef(context);
  contextRef.current = context;

  const agent = useEveAgent({
    host: "/api/ai-assistant/eve/proxy",
    auth: {
      bearer: async () => {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error) throw error;
        if (!session?.access_token) {
          throw new Error("Your session expired. Sign in again to use Eve.");
        }
        return session.access_token;
      },
    },
    headers: async () => {
      const currentContext = contextRef.current;
      const headers: Record<string, string> = {
        "x-alleato-assistant-surface":
          currentContext.assistantSurface === "ask_alleato"
            ? "ask_alleato"
            : "ai_assistant",
      };
      const projectId = currentContext.selectedProjectId;
      if (
        typeof projectId === "number" &&
        Number.isInteger(projectId) &&
        projectId > 0
      ) {
        headers["x-alleato-project-id"] = String(projectId);
      }
      return headers;
    },
    initialEvents: saved.events,
    initialSession: saved.session,
    prepareSend: (input) => ({
      ...input,
      clientContext: {
        ...contextRef.current,
        currentPath:
          typeof window === "undefined" ? null : window.location.pathname,
      },
    }),
    onEvent: (event) => {
      eventsRef.current = [...eventsRef.current, event];
      persistChat(sessionId, eventsRef.current, sessionRef.current);
    },
    onSessionChange: (session) => {
      sessionRef.current = session;
      persistChat(sessionId, eventsRef.current, session);
    },
    onFinish: (snapshot) => {
      eventsRef.current = snapshot.events;
      sessionRef.current = snapshot.session;
      persistChat(sessionId, snapshot.events, snapshot.session);
      void persistEveMessages(sessionId, snapshot.data.messages)
        .then(() => onFinish?.())
        .catch((error: unknown) => {
          onError?.(
            error instanceof Error
              ? error
              : new Error("Saving Eve chat history failed."),
          );
        });
    },
    onError,
  });

  const messages = useMemo(
    () => mergeMessages(initialMessages, agent.data.messages),
    [agent.data.messages, initialMessages],
  );

  const sendMessage = useCallback(
    (message: { text: string; files?: FileUIPart[] }) =>
      agent.send({ message: toEveContent(message.text, message.files) }),
    [agent],
  );

  const addToolApprovalResponse = useCallback(
    (response: { id: string; approved: boolean; reason?: string }) => {
      const requestPart = agent.data.messages
        .flatMap((message) => message.parts)
        .find(
          (part): part is EveDynamicToolPart =>
            part.type === "dynamic-tool" &&
            (part.approval?.id === response.id ||
              part.toolMetadata?.eve?.inputRequest?.requestId === response.id),
        );
      const requestId =
        requestPart?.toolMetadata?.eve?.inputRequest?.requestId;

      if (!requestId) {
        throw new Error(
          `Eve approval request ${response.id} is no longer available.`,
        );
      }
      void agent.send({
        inputResponses: [
          {
            requestId,
            optionId: response.approved ? "approve" : "deny",
            text: response.reason,
          },
        ],
      });
    },
    [agent],
  );

  return {
    addToolApprovalResponse,
    error: agent.error,
    messages,
    sendMessage,
    status: agent.status,
    stop: agent.stop,
  };
}

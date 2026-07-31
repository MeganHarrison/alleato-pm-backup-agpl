"use client";

import { useChat, type UIMessage } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type FileUIPart,
} from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ChatArea } from "@/components/ai-assistant/chat-area";
import { ErrorState } from "@/components/ds";
import { DEFAULT_AI_ASSISTANT_MODEL } from "@/lib/ai/assistant-models";
import { getDurableSubmissionId } from "@/lib/ai/durable-chat";
import { apiFetch } from "@/lib/api-client";

type DurableConversation = {
  session_id: string;
  title: string | null;
  last_message_at: string | null;
  created_at: string | null;
};

type ConversationListResponse = { conversations: DurableConversation[] };
type ConversationCreateResponse = { conversation: DurableConversation };
type MessageListResponse = { messages: UIMessage[] };

const SESSION_STORAGE_KEY = "alleato-durable-ai-session-id";

function runStorageKey(sessionId: string) {
  return `alleato-durable-ai-run:${sessionId}`;
}

async function loadOrCreateConversation(): Promise<DurableConversation> {
  const list = await apiFetch<ConversationListResponse>(
    "/api/durable-ai/conversations",
    { cache: "no-store" },
  );
  const storedSessionId = window.localStorage.getItem(SESSION_STORAGE_KEY);
  const selected =
    list.conversations.find(
      (conversation) => conversation.session_id === storedSessionId,
    ) ?? list.conversations[0];
  if (selected) {
    window.localStorage.setItem(SESSION_STORAGE_KEY, selected.session_id);
    return selected;
  }

  // React Strict Mode can initialize this surface twice in development. Give
  // both requests the same client-generated ID so conversation creation is
  // idempotent instead of leaving behind an extra empty conversation.
  const pendingSessionId =
    window.localStorage.getItem(SESSION_STORAGE_KEY) ?? crypto.randomUUID();
  window.localStorage.setItem(SESSION_STORAGE_KEY, pendingSessionId);
  const created = await apiFetch<ConversationCreateResponse>(
    "/api/durable-ai/conversations",
    {
      method: "POST",
      body: JSON.stringify({
        sessionId: pendingSessionId,
        title: "Durable AI canary",
      }),
    },
  );
  window.localStorage.setItem(
    SESSION_STORAGE_KEY,
    created.conversation.session_id,
  );
  return created.conversation;
}

function DurableChatSession({
  sessionId,
  initialMessages,
}: {
  sessionId: string;
  initialMessages: UIMessage[];
}) {
  const [input, setInput] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null,
  );
  const [durableError, setDurableError] = useState<string | null>(null);
  const [initialRunId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem(runStorageKey(sessionId)),
  );
  const [activeRunId, setActiveRunId] = useState<string | null>(initialRunId);
  // Resume only a run that existed before this component mounted. A run ID
  // discovered from the live POST already has a reader; flipping `resume`
  // then would attach a second reader and replay the same workflow chunks.
  const [shouldResume] = useState(Boolean(initialRunId));
  const activeRunIdRef = useRef(activeRunId);
  activeRunIdRef.current = activeRunId;
  const selectedProjectIdRef = useRef(selectedProjectId);
  selectedProjectIdRef.current = selectedProjectId;

  const clearCompletedRun = useCallback(
    async (runId: string) => {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
          const status = await apiFetch<{
            ledgerStatus?: string;
            stage?: string;
          }>(`/api/durable-ai/chat/${encodeURIComponent(runId)}/status`, {
            cache: "no-store",
          });
          if (status.ledgerStatus === "completed") {
            window.localStorage.removeItem(runStorageKey(sessionId));
            setActiveRunId((current) => (current === runId ? null : current));
            return;
          }
          if (status.ledgerStatus === "failed") {
            setDurableError(
              `Durable AI run ${runId} failed during ${status.stage ?? "unknown"}.`,
            );
            return;
          }
        } catch {
          // The workflow may still be registering its run; the bounded poll
          // below keeps the reconnect locator until persistence is confirmed.
        }
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }
      setDurableError(
        `Durable AI run ${runId} streamed a response but persistence did not report completion. Refreshing will reconnect to this run instead of resubmitting it.`,
      );
    },
    [sessionId],
  );

  useEffect(() => {
    if (!initialRunId) return;
    let cancelled = false;
    void apiFetch<{ ledgerStatus?: string }>(
      `/api/durable-ai/chat/${encodeURIComponent(initialRunId)}/status`,
      { cache: "no-store" },
    )
      .then((runStatus) => {
        if (cancelled || runStatus.ledgerStatus !== "completed") return;
        window.localStorage.removeItem(runStorageKey(sessionId));
        setActiveRunId((current) =>
          current === initialRunId ? null : current,
        );
      })
      .catch(() => {
        // The reconnect request remains the source of truth and will surface a
        // structured error if this best-effort stale-marker check cannot run.
      });
    return () => {
      cancelled = true;
    };
  }, [initialRunId, sessionId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: "/api/durable-ai/chat",
        fetch: async (request, init) => {
          // The transport needs the raw response so it can persist Vercel's run
          // ID header before AI SDK consumes the body stream.
          const response = await globalThis.fetch(request, init);
          if (response.status === 204) {
            window.localStorage.removeItem(runStorageKey(sessionId));
            setActiveRunId(null);
            setDurableError(null);
            return response;
          }
          const runId = response.headers.get("x-workflow-run-id");
          if (runId) {
            window.localStorage.setItem(runStorageKey(sessionId), runId);
            setActiveRunId(runId);
            setDurableError(null);
          }
          return response;
        },
        prepareSendMessagesRequest({ messages }) {
          const lastMessage = messages.at(-1);
          return {
            body: {
              id: sessionId,
              messages,
              clientMessageId: getDurableSubmissionId(lastMessage),
              selectedProjectId: selectedProjectIdRef.current,
            },
          };
        },
        prepareReconnectToStreamRequest({ id, ...request }) {
          const runId = window.localStorage.getItem(runStorageKey(id));
          if (!runId) {
            throw new Error(
              "No active durable workflow run was found for this conversation.",
            );
          }
          return {
            ...request,
            api: `/api/durable-ai/chat/${encodeURIComponent(runId)}/stream`,
          };
        },
      }),
    [sessionId],
  );

  const {
    messages,
    sendMessage,
    status,
    stop,
    addToolApprovalResponse,
    error,
  } = useChat({
    id: sessionId,
    messages: initialMessages,
    resume: shouldResume,
    experimental_throttle: 50,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    transport,
    onFinish: () => {
      const runId = activeRunIdRef.current;
      if (runId) void clearCompletedRun(runId);
    },
    onError: (chatError) => {
      const runId = activeRunIdRef.current;
      setDurableError(
        runId
          ? `Durable AI run ${runId} disconnected: ${chatError.message}. Refresh to reconnect to the same run.`
          : chatError.message,
      );
    },
  });

  const isStreaming = status === "submitted" || status === "streaming";
  const handleSubmit = useCallback(
    (message: string, files?: FileUIPart[]) => {
      if (!message.trim() || isStreaming) return;
      setDurableError(null);
      sendMessage({ text: message, files });
      setInput("");
    },
    [isStreaming, sendMessage],
  );

  const liveStatus = isStreaming
    ? {
        stage: activeRunId ? "workflow-running" : "workflow-starting",
        message: activeRunId
          ? "Durable workflow is running"
          : "Starting durable workflow",
        status: "loading" as const,
        timestamp: new Date().toISOString(),
      }
    : null;

  return (
    <ChatArea
      messages={messages}
      liveStatus={liveStatus}
      chatError={durableError ?? error?.message ?? null}
      isLoadingMessages={false}
      isStreaming={isStreaming}
      input={input}
      sessionId={sessionId}
      councilMode={false}
      onCouncilModeChange={() => undefined}
      selectedProjectId={selectedProjectId}
      onProjectChange={setSelectedProjectId}
      selectedModel={DEFAULT_AI_ASSISTANT_MODEL}
      onModelChange={() => undefined}
      onInputChange={setInput}
      onSubmit={handleSubmit}
      onToolApprovalResponse={addToolApprovalResponse}
      onStop={stop}
      assistantSurface="alleato_ai"
    />
  );
}

export function DurableAiChatPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const conversation = await loadOrCreateConversation();
        const history = await apiFetch<MessageListResponse>(
          `/api/durable-ai/messages/${encodeURIComponent(conversation.session_id)}`,
          { cache: "no-store" },
        );
        if (cancelled) return;
        setSessionId(conversation.session_id);
        setMessages(history.messages);
      } catch (error) {
        if (cancelled) return;
        setLoadError(
          error instanceof Error
            ? `Durable AI could not initialize: ${error.message}`
            : "Durable AI could not initialize.",
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading durable AI…
      </div>
    );
  }
  if (loadError || !sessionId) {
    return (
      <ErrorState
        title="Durable AI could not start"
        error={loadError ?? "Durable AI did not receive a conversation ID."}
        className="h-full"
      />
    );
  }

  return (
    <DurableChatSession
      key={sessionId}
      sessionId={sessionId}
      initialMessages={messages}
    />
  );
}

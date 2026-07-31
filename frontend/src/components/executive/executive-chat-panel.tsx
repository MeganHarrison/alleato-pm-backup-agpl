"use client";

import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type FileUIPart,
} from "ai";
import { useChat, type UIMessage } from "@ai-sdk/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BrainCircuit,
  CalendarCheck2,
  ListChecks,
  SendHorizontal,
  SparklesIcon,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ChatArea,
  type ResponseQuality,
} from "@/components/ai-assistant/chat-area";
import type {
  AssistantTraceDiagnostics,
  ToolTraceItem,
} from "@/components/ai-assistant/trace-panel";
import { apiFetch } from "@/lib/api-client";
import {
  DEFAULT_AI_ASSISTANT_MODEL,
  type AiAssistantModelId,
} from "@/lib/ai/assistant-models";
import type { BrandonDailyUpdatePacket } from "@/lib/executive/brandon-daily-update";

type PersistedDataPart = {
  type: `data-${string}`;
  id?: string;
  data: unknown;
};

type ChatHistoryMessage = {
  id: string;
  role: string;
  content: string;
  sources: unknown[] | null;
  metadata?: {
    tool_trace?: ToolTraceItem[];
    memory_usage?: {
      totalUsed: number;
      preferencesUsed?: number;
      relevantUsed?: number;
      teamUsed?: number;
      recentConversationsUsed?: number;
      memories?: Array<{ id: string; type: string; content: string }>;
    };
    response_quality?: ResponseQuality;
    provider_path?: string;
    model?: string;
    provider_decision?: Record<string, unknown> | null;
    loop_diagnostic?: Record<string, unknown> | null;
    data_parts?: PersistedDataPart[];
  } | null;
  created_at: string | null;
};

type MemoryUsage = NonNullable<
  NonNullable<ChatHistoryMessage["metadata"]>["memory_usage"]
>;

type StrategistLiveStatus = {
  stage: string;
  message: string;
  status: "loading" | "success" | "warning" | "error";
  timestamp?: string;
};

function isStrategistLiveStatus(value: unknown): value is StrategistLiveStatus {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.message === "string" && typeof record.stage === "string";
}

function stripRuntimeDataParts(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => ({
    ...message,
    parts: message.parts.filter((part) => !part.type.startsWith("data-")),
  }));
}

function normalizePersistedDataParts(
  message: ChatHistoryMessage,
): PersistedDataPart[] {
  const parts = message.metadata?.data_parts;
  if (!Array.isArray(parts)) return [];
  return parts.filter((part): part is PersistedDataPart => {
    if (!part || typeof part !== "object") return false;
    const record = part as Record<string, unknown>;
    return typeof record.type === "string" && record.type.startsWith("data-");
  });
}

function dbMessageToUIMessage(message: ChatHistoryMessage): UIMessage {
  return {
    id: message.id,
    role: message.role as "user" | "assistant",
    parts: [
      ...normalizePersistedDataParts(message),
      ...(message.content
        ? [{ type: "text" as const, text: message.content }]
        : []),
    ],
  };
}

function extractToolTraces(
  messages: ChatHistoryMessage[],
): Record<string, ToolTraceItem[]> {
  const tracesByMessageId: Record<string, ToolTraceItem[]> = {};
  messages.forEach((message) => {
    const traces = message.metadata?.tool_trace;
    if (Array.isArray(traces) && traces.length > 0) {
      tracesByMessageId[message.id] = traces;
    }
  });
  return tracesByMessageId;
}

function extractSources(
  messages: ChatHistoryMessage[],
): Record<string, unknown[]> {
  const byMessageId: Record<string, unknown[]> = {};
  messages.forEach((message) => {
    if (Array.isArray(message.sources) && message.sources.length > 0) {
      byMessageId[message.id] = message.sources;
    }
  });
  return byMessageId;
}

function extractMemoryUsage(
  messages: ChatHistoryMessage[],
): Record<string, MemoryUsage> {
  const byMessageId: Record<string, MemoryUsage> = {};
  messages.forEach((message) => {
    const usage = message.metadata?.memory_usage;
    if (usage && typeof usage.totalUsed === "number") {
      byMessageId[message.id] = usage;
    }
  });
  return byMessageId;
}

function extractResponseQuality(
  messages: ChatHistoryMessage[],
): Record<string, ResponseQuality> {
  const byMessageId: Record<string, ResponseQuality> = {};
  messages.forEach((message) => {
    const quality = message.metadata?.response_quality;
    if (quality) byMessageId[message.id] = quality;
  });
  return byMessageId;
}

function extractTraceDiagnostics(
  messages: ChatHistoryMessage[],
): Record<string, AssistantTraceDiagnostics> {
  const byMessageId: Record<string, AssistantTraceDiagnostics> = {};
  messages.forEach((message) => {
    const metadata = message.metadata;
    if (!metadata) return;
    const diagnostics: AssistantTraceDiagnostics = {
      providerPath: metadata.provider_path ?? null,
      model: metadata.model ?? null,
      providerDecision: metadata.provider_decision ?? null,
      loopDiagnostic: metadata.loop_diagnostic ?? null,
    };
    if (
      diagnostics.providerPath ||
      diagnostics.model ||
      diagnostics.providerDecision ||
      diagnostics.loopDiagnostic
    ) {
      byMessageId[message.id] = diagnostics;
    }
  });
  return byMessageId;
}

const STARTER_PROMPTS = [
  {
    label: "Highest risk",
    prompt:
      "What are the three highest-risk items Brandon should act on today?",
    icon: TriangleAlert,
  },
  {
    label: "Meeting follow-ups",
    prompt: "What follow-ups came out of today's meetings?",
    icon: CalendarCheck2,
  },
  {
    label: "Follow-up plan",
    prompt:
      "Turn the most urgent items into a follow-up plan with owners and dates.",
    icon: ListChecks,
  },
  {
    label: "Owner escalation",
    prompt: "What would you escalate to the owner right now and why?",
    icon: SparklesIcon,
  },
];

function getPacketItemCount(packet: BrandonDailyUpdatePacket) {
  return (
    packet.sections.needsBrandon.length +
    packet.sections.waitingOnOthers.length +
    packet.sections.importantUpdates.length
  );
}

function getLoadedSourceCount(packet: BrandonDailyUpdatePacket) {
  return packet.sourceCoverage.reduce(
    (total, source) => total + source.count,
    0,
  );
}

function formatChatGeneratedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function ExecutiveChatSession({
  sessionId,
  packet,
  initialMessages,
  toolTracesByMessageId,
  sourcesByMessageId,
  memoryUsageByMessageId,
  responseQualityByMessageId,
  traceDiagnosticsByMessageId,
  isLoadingMessages,
  pendingFirstMessage,
  queuedPrompt,
  selectedModel,
  onModelChange,
  onFinishMessage,
}: {
  sessionId: string;
  packet: BrandonDailyUpdatePacket;
  initialMessages: UIMessage[];
  toolTracesByMessageId: Record<string, ToolTraceItem[]>;
  sourcesByMessageId: Record<string, unknown[]>;
  memoryUsageByMessageId: Record<string, MemoryUsage>;
  responseQualityByMessageId: Record<string, ResponseQuality>;
  traceDiagnosticsByMessageId: Record<string, AssistantTraceDiagnostics>;
  isLoadingMessages: boolean;
  pendingFirstMessage: string | null;
  queuedPrompt: { id: string; text: string } | null;
  selectedModel: AiAssistantModelId;
  onModelChange: (model: AiAssistantModelId) => void;
  onFinishMessage: (sessionId: string) => void;
}) {
  const [input, setInput] = useState("");
  const [liveStatus, setLiveStatus] = useState<StrategistLiveStatus | null>(
    null,
  );
  const hasSentFirstMessage = useRef(false);
  const lastQueuedPromptId = useRef<string | null>(null);
  const skipNextMessagesSync = useRef(false);
  const prevInitialMessagesRef = useRef(initialMessages);
  const sessionIdRef = useRef(sessionId);
  const selectedModelRef = useRef(selectedModel);

  sessionIdRef.current = sessionId;
  selectedModelRef.current = selectedModel;

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    addToolApprovalResponse,
  } = useChat({
    id: sessionId,
    messages: initialMessages,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    transport: new DefaultChatTransport({
      api: "/api/ai-assistant/chat",
      prepareSendMessagesRequest(request) {
        const cleanedMessages = stripRuntimeDataParts(request.messages);
        const lastMessage = cleanedMessages.at(-1);
        return {
          body: {
            id: sessionIdRef.current,
            message: lastMessage,
            messages: cleanedMessages,
            selectedModel: selectedModelRef.current,
            executiveBriefPacket: packet,
          },
        };
      },
    }),
    onData: ({ data, type }) => {
      if (type !== "data-status") return;
      if (isStrategistLiveStatus(data)) setLiveStatus(data);
    },
    onFinish() {
      setLiveStatus(null);
      onFinishMessage(sessionIdRef.current);
    },
    onError(error) {
      skipNextMessagesSync.current = false;
      setLiveStatus({
        stage: "fallback",
        message: error.message,
        status: "error",
        timestamp: new Date().toISOString(),
      });
    },
  });

  const sendExecutiveMessage = useCallback(
    (message: { text: string; files?: FileUIPart[] }) => {
      skipNextMessagesSync.current = true;
      void sendMessage(message);
    },
    [sendMessage],
  );

  useEffect(() => {
    if (prevInitialMessagesRef.current === initialMessages) return;
    prevInitialMessagesRef.current = initialMessages;
    if (skipNextMessagesSync.current) {
      skipNextMessagesSync.current = false;
      return;
    }
    setMessages(initialMessages);
  }, [initialMessages, setMessages]);

  useEffect(() => {
    if (pendingFirstMessage && !hasSentFirstMessage.current) {
      hasSentFirstMessage.current = true;
      sendExecutiveMessage({ text: pendingFirstMessage });
    }
  }, [pendingFirstMessage, sendExecutiveMessage]);

  useEffect(() => {
    if (!queuedPrompt) return;
    if (queuedPrompt.id === lastQueuedPromptId.current) return;
    if (!hasSentFirstMessage.current && pendingFirstMessage) return;
    lastQueuedPromptId.current = queuedPrompt.id;
    sendExecutiveMessage({ text: queuedPrompt.text });
  }, [pendingFirstMessage, queuedPrompt, sendExecutiveMessage]);

  return (
    <ChatArea
      messages={messages}
      toolTracesByMessageId={toolTracesByMessageId}
      sourcesByMessageId={sourcesByMessageId}
      memoryUsageByMessageId={memoryUsageByMessageId}
      responseQualityByMessageId={responseQualityByMessageId}
      traceDiagnosticsByMessageId={traceDiagnosticsByMessageId}
      liveStatus={liveStatus}
      isLoadingMessages={isLoadingMessages}
      isStreaming={status === "streaming" || status === "submitted"}
      input={input}
      sessionId={sessionId}
      selectedModel={selectedModel}
      onModelChange={onModelChange}
      onInputChange={setInput}
      onSubmit={(message, files) => sendExecutiveMessage({ text: message, files })}
      onToolApprovalResponse={addToolApprovalResponse}
      onStop={stop}
    />
  );
}

export function ExecutiveChatPanel({
  packet,
  presentation = "panel",
}: {
  packet: BrandonDailyUpdatePacket;
  presentation?: "panel" | "sheet";
}) {
  const [draftInput, setDraftInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [toolTracesByMessageId, setToolTracesByMessageId] = useState<
    Record<string, ToolTraceItem[]>
  >({});
  const [sourcesByMessageId, setSourcesByMessageId] = useState<
    Record<string, unknown[]>
  >({});
  const [memoryUsageByMessageId, setMemoryUsageByMessageId] = useState<
    Record<string, MemoryUsage>
  >({});
  const [responseQualityByMessageId, setResponseQualityByMessageId] = useState<
    Record<string, ResponseQuality>
  >({});
  const [traceDiagnosticsByMessageId, setTraceDiagnosticsByMessageId] =
    useState<Record<string, AssistantTraceDiagnostics>>({});
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [pendingFirstMessage, setPendingFirstMessage] = useState<string | null>(
    null,
  );
  const [queuedPrompt, setQueuedPrompt] = useState<{
    id: string;
    text: string;
  } | null>(null);
  const [chatStartError, setChatStartError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<AiAssistantModelId>(
    DEFAULT_AI_ASSISTANT_MODEL,
  );
  const itemCount = getPacketItemCount(packet);
  const sourceCount = getLoadedSourceCount(packet);

  const loadSessionMessages = useCallback(async (targetSessionId: string) => {
    setIsLoadingMessages(true);
    try {
      const data = await apiFetch<{ messages?: ChatHistoryMessage[] }>(
        `/api/ai-assistant/messages/${targetSessionId}`,
      );
      const historyMessages = (data.messages ?? []) as ChatHistoryMessage[];
      setInitialMessages(historyMessages.map((m) => dbMessageToUIMessage(m)));
      setToolTracesByMessageId(extractToolTraces(historyMessages));
      setSourcesByMessageId(extractSources(historyMessages));
      setMemoryUsageByMessageId(extractMemoryUsage(historyMessages));
      setResponseQualityByMessageId(extractResponseQuality(historyMessages));
      setTraceDiagnosticsByMessageId(extractTraceDiagnostics(historyMessages));
    } catch {
      setInitialMessages([]);
      setToolTracesByMessageId({});
      setSourcesByMessageId({});
      setMemoryUsageByMessageId({});
      setResponseQualityByMessageId({});
      setTraceDiagnosticsByMessageId({});
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  const createConversation = useCallback(async () => {
    const data = await apiFetch<{ conversation: { session_id: string } }>(
      "/api/ai-assistant/conversations",
      {
        method: "POST",
        body: JSON.stringify({
          title: `Executive brief — ${new Date(packet.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
          metadata: {
            origin: "executive-brief",
            packetGeneratedAt: packet.generatedAt,
            packetWindowDays: packet.windowDays,
          },
        }),
      },
    );
    return data.conversation.session_id;
  }, [packet.generatedAt, packet.windowDays]);

  const handlePrompt = useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (!trimmed) return;
      setChatStartError(null);
      if (sessionId) {
        setQueuedPrompt({ id: `${Date.now()}:${trimmed}`, text: trimmed });
        return;
      }
      try {
        const newSessionId = await createConversation();
        setSessionId(newSessionId);
        setPendingFirstMessage(trimmed);
        setDraftInput("");
      } catch (error) {
        setChatStartError(
          error instanceof Error
            ? error.message
            : "Could not start the executive chat session.",
        );
      }
    },
    [createConversation, sessionId],
  );

  const handleFinishMessage = useCallback(
    (targetSessionId: string) => {
      setPendingFirstMessage(null);
      setQueuedPrompt(null);
      void loadSessionMessages(targetSessionId);
    },
    [loadSessionMessages],
  );

  useEffect(() => {
    if (!sessionId) return;
    if (pendingFirstMessage) return;
    void loadSessionMessages(sessionId);
  }, [loadSessionMessages, pendingFirstMessage, sessionId]);

  return (
    <section
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden bg-background",
        presentation === "panel" && "rounded-lg border border-border",
      )}
    >
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <BrainCircuit className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">
                AI Chief of Staff
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {itemCount} active item{itemCount === 1 ? "" : "s"} ·{" "}
                {packet.windowDays}-day brief · {sourceCount} source row
                {sourceCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right text-[11px] leading-4 text-muted-foreground">
            {formatChatGeneratedAt(packet.generatedAt)}
          </div>
        </div>
      </div>

      {sessionId ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <ExecutiveChatSession
            key={sessionId}
            sessionId={sessionId}
            packet={packet}
            initialMessages={initialMessages}
            toolTracesByMessageId={toolTracesByMessageId}
            sourcesByMessageId={sourcesByMessageId}
            memoryUsageByMessageId={memoryUsageByMessageId}
            responseQualityByMessageId={responseQualityByMessageId}
            traceDiagnosticsByMessageId={traceDiagnosticsByMessageId}
            isLoadingMessages={isLoadingMessages}
            pendingFirstMessage={pendingFirstMessage}
            queuedPrompt={queuedPrompt}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            onFinishMessage={handleFinishMessage}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-border p-3">
            <div className="rounded-lg border border-input bg-background px-3 py-2 transition-colors focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10">
              <Textarea
                value={draftInput}
                onChange={(e) => setDraftInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handlePrompt(draftInput);
                  }
                }}
                placeholder="Ask about this brief"
                rows={3}
                className="min-h-20 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
              />
              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-muted-foreground">
                  {selectedModel.replace("openai/", "")}
                </span>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-2 rounded-md px-3"
                  disabled={!draftInput.trim()}
                  onClick={() => void handlePrompt(draftInput)}
                >
                  <SendHorizontal className="h-3.5 w-3.5" />
                  Ask
                </Button>
              </div>
              {chatStartError ? (
                <div className="mt-2 flex items-start gap-2 text-xs text-destructive">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{chatStartError}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Starting points
              </p>
            </div>

            <div className="divide-y divide-border border-t border-border">
              {STARTER_PROMPTS.map(({ label, prompt, icon: Icon }) => (
                <Button
                  key={prompt}
                  type="button"
                  variant="ghost"
                  className="h-auto w-full justify-start rounded-none px-4 py-3 text-left hover:bg-muted/50"
                  onClick={() => void handlePrompt(prompt)}
                >
                  <span className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 space-y-1">
                      <span className="block text-sm font-medium text-foreground">
                        {label}
                      </span>
                      <span className="block whitespace-normal text-xs leading-5 text-muted-foreground">
                        {prompt}
                      </span>
                    </span>
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

"use client";

import { useChat, type UIMessage } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type FileUIPart,
} from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  useRagConversations,
  useCreateConversation,
  useRenameConversation,
  useDeleteConversation,
  useTogglePinConversation,
} from "@/hooks/use-rag-conversations";
import { useChatSessionMessages } from "@/hooks/use-chat-session-messages";
import {
  DEFAULT_AI_ASSISTANT_MODEL,
  type AiAssistantModelId,
} from "@/lib/ai/assistant-models";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HistoryIcon } from "lucide-react";
import { ConversationSidebar } from "./conversation-sidebar";
import { ChatArea, type ResponseQuality } from "./chat-area";
import { shouldSyncInitialMessages } from "./chat-message-sync";
import { formatChatError, isChatTransportLoadFailure } from "./rag-chat-errors";
import type { MemoryUsage } from "./memory-usage-disclosure";
import type { SkillUsage } from "./skill-usage-disclosure";
import type { AssistantTraceDiagnostics, ToolTraceItem } from "./trace-panel";
import {
  DEFAULT_ASSISTANT_SURFACE,
  type AssistantSurface,
} from "@/lib/ai/chat-surface";

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

function stripStatusParts(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => ({
    ...message,
    parts: message.parts.filter((part) => !part.type.startsWith("data-")),
  }));
}

export function ChatWithSession({
  sessionId,
  initialMessages,
  toolTracesByMessageId,
  sourcesByMessageId,
  memoryUsageByMessageId,
  skillUsageByMessageId,
  responseQualityByMessageId,
  traceDiagnosticsByMessageId,
  langfuseTraceIdByMessageId,
  isLoadingMessages,
  loadMessagesError,
  pendingFirstMessage,
  pendingFirstFiles,
  councilMode,
  onCouncilModeChange,
  selectedProjectId,
  onProjectChange,
  selectedModel,
  onModelChange,
  onFinishMessage,
  welcomeHideOrb,
  chatApi,
  chatMode,
}: {
  sessionId: string;
  initialMessages: UIMessage[];
  toolTracesByMessageId: Record<string, ToolTraceItem[]>;
  sourcesByMessageId: Record<string, unknown[]>;
  memoryUsageByMessageId: Record<string, MemoryUsage>;
  skillUsageByMessageId: Record<string, SkillUsage>;
  responseQualityByMessageId: Record<string, ResponseQuality>;
  traceDiagnosticsByMessageId: Record<string, AssistantTraceDiagnostics>;
  langfuseTraceIdByMessageId: Record<string, string>;
  isLoadingMessages: boolean;
  loadMessagesError: string | null;
  pendingFirstMessage: string | null;
  pendingFirstFiles?: FileUIPart[];
  councilMode: boolean;
  onCouncilModeChange: (val: boolean) => void;
  selectedProjectId: number | null;
  onProjectChange: (id: number | null) => void;
  selectedModel: AiAssistantModelId;
  onModelChange: (model: AiAssistantModelId) => void;
  onFinishMessage: (sessionId: string) => void;
  welcomeHideOrb?: boolean;
  chatApi: string;
  chatMode: "general" | "training";
}) {
  const [input, setInput] = useState("");
  const [liveStatus, setLiveStatus] = useState<StrategistLiveStatus | null>(
    null,
  );
  const councilModeRef = useRef(councilMode);
  councilModeRef.current = councilMode;

  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  const selectedProjectIdRef = useRef(selectedProjectId);
  selectedProjectIdRef.current = selectedProjectId;
  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;
  const lastSubmittedMessageRef = useRef("");

  // Tracks whether to skip the next initialMessages → setMessages sync.
  // Set true in onFinish so that the post-stream DB reload doesn't replace
  // the correct live useChat messages with the freshly-fetched DB copy.
  const skipNextMessagesSync = useRef(false);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    addToolApprovalResponse,
    error,
  } = useChat({
    id: sessionId,
    messages: initialMessages,
    experimental_throttle: 50,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    transport: new DefaultChatTransport({
      api: chatApi,
      prepareSendMessagesRequest(request) {
        const cleanedMessages = stripStatusParts(request.messages);
        const lastMessage = cleanedMessages.at(-1);
        return {
          body: {
            id: sessionIdRef.current,
            message: lastMessage,
            messages: cleanedMessages,
            councilMode: councilModeRef.current,
            selectedProjectId: selectedProjectIdRef.current ?? undefined,
            selectedModel: selectedModelRef.current,
          },
        };
      },
    }),
    onFinish: () => {
      // The general assistant keeps the historical live-message preservation
      // behavior because its richer widget stream can differ from persistence.
      skipNextMessagesSync.current = true;
      lastSubmittedMessageRef.current = "";
      setLiveStatus(null);
      onFinishMessage(sessionIdRef.current);
    },
    onError: (chatError) => {
      setLiveStatus(null);
      if (isChatTransportLoadFailure(chatError)) {
        const lastSubmittedMessage = lastSubmittedMessageRef.current.trim();
        if (lastSubmittedMessage) {
          setInput((current) => current || lastSubmittedMessage);
        }
      }
    },
    onData: (part) => {
      if (part.type !== "data-status") return;
      if (isStrategistLiveStatus(part.data)) {
        setLiveStatus(part.data);
      }
    },
  });

  // Auto-send the first message when mounting after conversation creation
  const hasSentFirstMessage = useRef(false);
  useEffect(() => {
    if (pendingFirstMessage && !hasSentFirstMessage.current) {
      hasSentFirstMessage.current = true;
      sendMessage({ text: pendingFirstMessage, files: pendingFirstFiles });
      setInput("");
    }
  }, [pendingFirstFiles, pendingFirstMessage, sendMessage]);

  // Track the live message list so the sync effect can tell whether it is about
  // to clobber an in-flight conversation (see guard below). A ref avoids adding
  // `messages` to the effect deps, which would re-run the sync on every token.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Sync initial messages when they change (conversation switch).
  // Skip when skipNextMessagesSync is set — see ref declaration above.
  const prevInitialRef = useRef(initialMessages);
  useEffect(() => {
    if (prevInitialRef.current === initialMessages) return;
    prevInitialRef.current = initialMessages;

    const wasPostFinishReload = skipNextMessagesSync.current;
    skipNextMessagesSync.current = false;

    if (
      shouldSyncInitialMessages({
        skipPostFinishReload: wasPostFinishReload,
        initialCount: initialMessages.length,
        liveCount: messagesRef.current.length,
      })
    ) {
      setMessages(initialMessages);
    }
  }, [initialMessages, setMessages]);

  const isStreaming = status === "submitted" || status === "streaming";

  // Show the pending first message as an optimistic bubble while useChat's
  // messages array is still empty (before sendMessage fires in useEffect).
  // Prevents the welcome screen from flashing during new-session creation.
  const displayMessages = useMemo<UIMessage[]>(() => {
    if (pendingFirstMessage && messages.length === 0) {
      return [
        {
          id: "pending-first-message",
          role: "user" as const,
          parts: [{ type: "text" as const, text: pendingFirstMessage }],
        },
      ];
    }
    return messages;
  }, [pendingFirstMessage, messages]);

  const handleSubmit = useCallback(
    (message: string, files?: FileUIPart[]) => {
      if (!message.trim() || isStreaming) return;
      lastSubmittedMessageRef.current = message;
      sendMessage({ text: message, files });
      setInput("");
    },
    [sendMessage, isStreaming],
  );

  return (
    <ChatArea
      messages={displayMessages}
      toolTracesByMessageId={toolTracesByMessageId}
      sourcesByMessageId={sourcesByMessageId}
      memoryUsageByMessageId={memoryUsageByMessageId}
      skillUsageByMessageId={skillUsageByMessageId}
      responseQualityByMessageId={responseQualityByMessageId}
      traceDiagnosticsByMessageId={traceDiagnosticsByMessageId}
      langfuseTraceIdByMessageId={langfuseTraceIdByMessageId}
      liveStatus={liveStatus}
      chatError={error ? formatChatError(error) : loadMessagesError}
      isLoadingMessages={isLoadingMessages}
      isStreaming={isStreaming}
      input={input}
      sessionId={sessionId}
      councilMode={councilMode}
      onCouncilModeChange={onCouncilModeChange}
      selectedProjectId={selectedProjectId}
      onProjectChange={onProjectChange}
      selectedModel={selectedModel}
      onModelChange={onModelChange}
      onInputChange={setInput}
      onSubmit={handleSubmit}
      onToolApprovalResponse={addToolApprovalResponse}
      onStop={stop}
      welcomeHideOrb={welcomeHideOrb}
      chatMode={chatMode}
    />
  );
}

export function RagChatPage({
  surface = DEFAULT_ASSISTANT_SURFACE,
  basePath = "/ai",
  chatApi = "/api/ai-assistant/chat",
  chatMode = "general",
}: {
  surface?: AssistantSurface;
  basePath?: string;
  chatApi?: string;
  chatMode?: "general" | "training";
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams()!;
  const activeSessionId = searchParams?.get("session") ?? null;
  const projectIdParam = searchParams?.get("projectId") ?? null;
  const initialProjectId = projectIdParam ? Number(projectIdParam) : null;

  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [pendingFirstMessage, setPendingFirstMessage] = useState<string | null>(
    null,
  );
  const [pendingFirstFiles, setPendingFirstFiles] = useState<
    FileUIPart[] | undefined
  >();
  const {
    initialMessages,
    toolTracesByMessageId,
    sourcesByMessageId,
    memoryUsageByMessageId,
    skillUsageByMessageId,
    responseQualityByMessageId,
    traceDiagnosticsByMessageId,
    langfuseTraceIdByMessageId,
    isLoadingMessages,
    loadMessagesError,
    loadSessionMessages,
    reset: resetSessionMessages,
  } = useChatSessionMessages(surface);
  const [noSessionInput, setNoSessionInput] = useState("");
  // Optimistic user message shown while a new conversation is being created
  const [optimisticUserMessage, setOptimisticUserMessage] = useState<
    string | null
  >(null);
  // Tracks the last effective session id so we only clear the optimistic message once per session transition
  const prevEffectiveSessionIdRef = useRef<string | null>(null);
  const [councilMode, setCouncilMode] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    Number.isFinite(initialProjectId) ? initialProjectId : null,
  );
  const [selectedModel, setSelectedModel] = useState<AiAssistantModelId>(
    DEFAULT_AI_ASSISTANT_MODEL,
  );

  useEffect(() => {
    if (!historyOpen) return;

    const closeHistoryOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHistoryOpen(false);
      }
    };

    window.addEventListener("keydown", closeHistoryOnEscape);
    return () => window.removeEventListener("keydown", closeHistoryOnEscape);
  }, [historyOpen]);

  // Conversation CRUD (React Query — unchanged)
  const { data: conversations = [], isLoading: isLoadingConvos } =
    useRagConversations(surface);
  const createConversation = useCreateConversation(surface);
  const renameConversation = useRenameConversation(surface);
  const deleteConversation = useDeleteConversation(surface);
  const togglePinConversation = useTogglePinConversation(surface);

  // Load messages when session changes
  useEffect(() => {
    const sessionId = activeSessionId;
    if (!sessionId) {
      resetSessionMessages();
      return;
    }
    // Skip fetching for a session we just created and haven't sent to yet.
    // The session is empty — fetching would return [] and wipe the live
    // streaming messages via the ChatWithSession sync effect.
    if (pendingSessionId === sessionId && pendingFirstMessage !== null) return;
    void loadSessionMessages(sessionId);
  }, [
    activeSessionId,
    loadSessionMessages,
    resetSessionMessages,
    pendingSessionId,
    pendingFirstMessage,
  ]);

  const effectiveSessionId = activeSessionId || pendingSessionId;

  // Clear optimistic message once ChatWithSession takes over so it doesn't double-render
  useEffect(() => {
    if (
      effectiveSessionId &&
      effectiveSessionId !== prevEffectiveSessionIdRef.current
    ) {
      prevEffectiveSessionIdRef.current = effectiveSessionId;
      setOptimisticUserMessage(null);
    }
  }, [effectiveSessionId]);
  const handleFinishMessage = useCallback(
    (sessionId: string) => {
      queryClient.invalidateQueries({
        queryKey: ["rag-conversations", surface],
      });
      setPendingSessionId(null);
      setPendingFirstMessage(null);
      setPendingFirstFiles(undefined);
      void loadSessionMessages(sessionId);
    },
    [queryClient, loadSessionMessages, surface],
  );

  const setActiveSession = useCallback(
    (sessionId: string | null) => {
      setPendingSessionId(null);
      setPendingFirstMessage(null);
      setPendingFirstFiles(undefined);
      if (sessionId) {
        router.push(`${basePath}?session=${sessionId}`, { scroll: false });
      } else {
        router.push(basePath, { scroll: false });
      }
    },
    [basePath, router],
  );

  const handleNewChat = useCallback(() => {
    if (createConversation.isPending) return;

    resetSessionMessages();
    setOptimisticUserMessage(null);
    setNoSessionInput("");
    setActiveSession(null);
  }, [createConversation.isPending, resetSessionMessages, setActiveSession]);

  const handleSelectConversation = useCallback(
    (sessionId: string) => {
      setActiveSession(sessionId);
    },
    [setActiveSession],
  );

  const handleRename = useCallback(
    (sessionId: string, title: string) => {
      renameConversation.mutate({ sessionId, title });
    },
    [renameConversation],
  );

  const handleDelete = useCallback(
    (sessionId: string) => {
      deleteConversation.mutate(sessionId);
      if (activeSessionId === sessionId) {
        setActiveSession(null);
      }
    },
    [deleteConversation, activeSessionId, setActiveSession],
  );

  const handleTogglePin = useCallback(
    (sessionId: string, isPinned: boolean) => {
      togglePinConversation.mutate({ sessionId, isPinned });
    },
    [togglePinConversation],
  );

  // Handle first message in a new conversation
  const handleFirstMessage = useCallback(
    async (message: string, files?: FileUIPart[]) => {
      // Show the user message immediately — don't wait for the API call
      setOptimisticUserMessage(message);
      const title = message.substring(0, 50);
      try {
        const result = await createConversation.mutateAsync(title);
        const sessionId = result.session_id;
        setPendingSessionId(sessionId);
        setPendingFirstMessage(message);
        setPendingFirstFiles(files);
        router.push(`${basePath}?session=${sessionId}`, { scroll: false });
      } catch {
        // Creation failed — clear the optimistic message
        setOptimisticUserMessage(null);
      }
    },
    [basePath, createConversation, router],
  );

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 bg-background pb-14 md:pb-0">
      <ConversationSidebar
        conversations={conversations}
        activeSessionId={effectiveSessionId}
        isLoading={isLoadingConvos}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onRename={handleRename}
        onDelete={handleDelete}
        onTogglePin={handleTogglePin}
        isNewChatDisabled={createConversation.isPending}
        desktopDocked={true}
      />
      {!historyOpen && (
        <div className="absolute left-4 top-4 z-30">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Open chat history"
                className="h-11 w-11 rounded-full bg-background/90 text-muted-foreground shadow-none ring-1 ring-border/50 hover:bg-muted hover:text-foreground md:h-9 md:w-9"
                onClick={() => setHistoryOpen(true)}
              >
                <HistoryIcon className="h-5 w-5 md:h-4 md:w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>Chat history</TooltipContent>
          </Tooltip>
        </div>
      )}
      <div className="min-h-0 min-w-0 flex-1">
        {effectiveSessionId ? (
          <ChatWithSession
            key={effectiveSessionId}
            sessionId={effectiveSessionId}
            initialMessages={initialMessages}
            toolTracesByMessageId={toolTracesByMessageId}
            sourcesByMessageId={sourcesByMessageId}
            memoryUsageByMessageId={memoryUsageByMessageId}
            skillUsageByMessageId={skillUsageByMessageId}
            responseQualityByMessageId={responseQualityByMessageId}
            traceDiagnosticsByMessageId={traceDiagnosticsByMessageId}
            langfuseTraceIdByMessageId={langfuseTraceIdByMessageId}
            isLoadingMessages={isLoadingMessages}
            loadMessagesError={loadMessagesError}
            pendingFirstMessage={pendingFirstMessage}
            pendingFirstFiles={pendingFirstFiles}
            councilMode={councilMode}
            onCouncilModeChange={setCouncilMode}
            selectedProjectId={selectedProjectId}
            onProjectChange={setSelectedProjectId}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            onFinishMessage={handleFinishMessage}
            chatApi={chatApi}
            chatMode={chatMode}
          />
        ) : (
          <ChatArea
            messages={
              optimisticUserMessage
                ? [
                    {
                      id: "optimistic-user",
                      role: "user" as const,
                      parts: [
                        { type: "text" as const, text: optimisticUserMessage },
                      ],
                    },
                  ]
                : []
            }
            toolTracesByMessageId={{}}
            responseQualityByMessageId={{}}
            skillUsageByMessageId={{}}
            traceDiagnosticsByMessageId={{}}
            liveStatus={null}
            chatError={loadMessagesError}
            isLoadingMessages={false}
            isStreaming={createConversation.isPending}
            input={noSessionInput}
            councilMode={councilMode}
            onCouncilModeChange={setCouncilMode}
            selectedProjectId={selectedProjectId}
            onProjectChange={setSelectedProjectId}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            onInputChange={setNoSessionInput}
            onSubmit={(msg: string, files?: FileUIPart[]) => {
              setNoSessionInput("");
              handleFirstMessage(msg, files);
            }}
            onStop={() => {}}
            chatMode={chatMode}
          />
        )}
      </div>
    </div>
  );
}

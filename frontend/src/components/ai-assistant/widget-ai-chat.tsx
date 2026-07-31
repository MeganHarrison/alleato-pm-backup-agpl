"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FileUIPart } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquareIcon, Trash2 } from "lucide-react";
import {
  useRagConversations,
  useCreateConversation,
  useDeleteConversation,
  type RagConversation,
} from "@/hooks/use-rag-conversations";
import { useChatSessionMessages } from "@/hooks/use-chat-session-messages";
import { useProject } from "@/contexts/project-context";
import {
  DEFAULT_AI_ASSISTANT_MODEL,
  type AiAssistantModelId,
} from "@/lib/ai/assistant-models";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ds";
import { cn } from "@/lib/utils";
import type { AiWidgetNotificationDraft } from "@/lib/collaboration/ai-widget-notifications";
import { ChatArea } from "./chat-area";
import { ChatWithSession } from "./rag-chat-page";

export type WidgetAiChatView = "chat" | "history";

/**
 * Full-featured AI assistant chat for the global floating widget. Reuses the
 * same `/api/ai-assistant/chat` transport, composer (project picker, file
 * attachments, model/council controls) and persisted conversations as the `/ai`
 * page — only difference is sessions live in local state instead of the URL so
 * the widget never navigates the user away from their current page.
 */
export function WidgetAiChat({
  view = "chat",
  onViewChange,
  onAssistantActivity,
  onCompactStateChange,
  showWelcomePrompt = false,
  onWelcomePromptDismiss,
  notificationDraft,
}: {
  /** Reserved for parity with the launcher; focus is handled by GlobalAiWidget. */
  autoFocusComposer?: boolean;
  view?: WidgetAiChatView;
  onViewChange?: (view: WidgetAiChatView) => void;
  onAssistantActivity?: () => void;
  onCompactStateChange?: (compact: boolean) => void;
  showWelcomePrompt?: boolean;
  onWelcomePromptDismiss?: () => void;
  notificationDraft?: AiWidgetNotificationDraft | null;
}) {
  const queryClient = useQueryClient();
  const { data: conversations = [], isLoading: isLoadingConvos } =
    useRagConversations();
  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation();

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
  } = useChatSessionMessages();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [pendingFirstMessage, setPendingFirstMessage] = useState<string | null>(
    null,
  );
  const [pendingFirstFiles, setPendingFirstFiles] = useState<
    FileUIPart[] | undefined
  >();
  const [optimisticUserMessage, setOptimisticUserMessage] = useState<
    string | null
  >(null);
  const [noSessionInput, setNoSessionInput] = useState("");
  const { projectId: routeProjectId } = useProject();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    routeProjectId,
  );
  // The route project only wins until the user explicitly picks a project
  // (including "All projects") in the composer — after that their choice sticks.
  const hasUserPickedProjectRef = useRef(false);
  const [selectedModel, setSelectedModel] = useState<AiAssistantModelId>(
    DEFAULT_AI_ASSISTANT_MODEL,
  );
  const [councilMode, setCouncilMode] = useState(false);
  const consumedNotificationDraftIdRef = useRef<string | null>(null);

  const effectiveSessionId = activeSessionId ?? pendingSessionId;

  // Follow the project of the page the user is viewing so the assistant knows
  // "where it is". Navigating off project pages keeps the last project rather
  // than clearing it mid-conversation.
  useEffect(() => {
    if (hasUserPickedProjectRef.current) return;
    if (routeProjectId === null) return;
    setSelectedProjectId(routeProjectId);
  }, [routeProjectId]);

  const handleProjectChange = useCallback((id: number | null) => {
    hasUserPickedProjectRef.current = true;
    setSelectedProjectId(id);
  }, []);

  useEffect(() => {
    onCompactStateChange?.(view === "chat" && !effectiveSessionId);
  }, [effectiveSessionId, onCompactStateChange, view]);

  useEffect(() => {
    if (!notificationDraft?.prompt) return;
    if (consumedNotificationDraftIdRef.current === notificationDraft.id) return;

    consumedNotificationDraftIdRef.current = notificationDraft.id;
    setPendingSessionId(null);
    setPendingFirstMessage(null);
    setPendingFirstFiles(undefined);
    setOptimisticUserMessage(null);
    resetSessionMessages();
    setActiveSessionId(null);
    setNoSessionInput(notificationDraft.prompt);
    onViewChange?.("chat");
  }, [notificationDraft, onViewChange, resetSessionMessages]);

  // Load history when an existing conversation is opened. Skip a session we just
  // created and haven't sent to yet — fetching would return [] and wipe the live
  // streaming messages via the ChatWithSession sync effect.
  useEffect(() => {
    if (!activeSessionId) {
      resetSessionMessages();
      return;
    }
    if (pendingSessionId === activeSessionId && pendingFirstMessage !== null) {
      return;
    }
    void loadSessionMessages(activeSessionId);
  }, [
    activeSessionId,
    pendingSessionId,
    pendingFirstMessage,
    loadSessionMessages,
    resetSessionMessages,
  ]);

  // Clear the optimistic bubble once ChatWithSession takes over.
  const prevEffectiveSessionIdRef = useRef<string | null>(null);
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
      queryClient.invalidateQueries({ queryKey: ["rag-conversations"] });
      setPendingSessionId(null);
      setPendingFirstMessage(null);
      setPendingFirstFiles(undefined);
      void loadSessionMessages(sessionId);
      onAssistantActivity?.();
    },
    [queryClient, loadSessionMessages, onAssistantActivity],
  );

  const handleNewChat = useCallback(() => {
    setPendingSessionId(null);
    setPendingFirstMessage(null);
    setPendingFirstFiles(undefined);
    setNoSessionInput("");
    setOptimisticUserMessage(null);
    resetSessionMessages();
    setActiveSessionId(null);
    onViewChange?.("chat");
  }, [resetSessionMessages, onViewChange]);

  const handleSelectConversation = useCallback(
    (sessionId: string) => {
      setPendingSessionId(null);
      setPendingFirstMessage(null);
      setPendingFirstFiles(undefined);
      setActiveSessionId(sessionId);
      onViewChange?.("chat");
    },
    [onViewChange],
  );

  const handleDelete = useCallback(
    (sessionId: string) => {
      deleteConversation.mutate(sessionId);
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        resetSessionMessages();
      }
    },
    [deleteConversation, activeSessionId, resetSessionMessages],
  );

  // First message in a brand-new conversation — create it, then stream.
  const handleFirstMessage = useCallback(
    async (message: string, files?: FileUIPart[]) => {
      setOptimisticUserMessage(message);
      onViewChange?.("chat");
      try {
        const result = await createConversation.mutateAsync(
          message.substring(0, 50),
        );
        const sessionId = result.session_id;
        setPendingSessionId(sessionId);
        setPendingFirstMessage(message);
        setPendingFirstFiles(files);
        setActiveSessionId(sessionId);
      } catch {
        setOptimisticUserMessage(null);
      }
    },
    [createConversation, onViewChange],
  );

  if (view === "history") {
    return (
      <WidgetConversationList
        conversations={conversations}
        isLoading={isLoadingConvos}
        activeSessionId={effectiveSessionId}
        onSelect={handleSelectConversation}
        onNewChat={handleNewChat}
        onDelete={handleDelete}
      />
    );
  }

  if (effectiveSessionId) {
    return (
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
        onProjectChange={handleProjectChange}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        onFinishMessage={handleFinishMessage}
        chatApi="/api/ai-assistant/chat"
        assistantSurface="alleato_ai"
        welcomeHideOrb
      />
    );
  }

  return (
    <ChatArea
      messages={
        optimisticUserMessage
          ? [
              {
                id: "optimistic-user",
                role: "user" as const,
                parts: [{ type: "text" as const, text: optimisticUserMessage }],
              },
            ]
          : []
      }
      toolTracesByMessageId={{}}
      responseQualityByMessageId={{}}
      skillUsageByMessageId={{}}
      traceDiagnosticsByMessageId={{}}
      langfuseTraceIdByMessageId={{}}
      liveStatus={null}
      chatError={loadMessagesError}
      isLoadingMessages={false}
      isStreaming={createConversation.isPending}
      input={noSessionInput}
      councilMode={councilMode}
      onCouncilModeChange={setCouncilMode}
      selectedProjectId={selectedProjectId}
      onProjectChange={handleProjectChange}
      selectedModel={selectedModel}
      onModelChange={setSelectedModel}
      onInputChange={setNoSessionInput}
      onSubmit={(message: string, files?: FileUIPart[]) => {
        setNoSessionInput("");
        void handleFirstMessage(message, files);
      }}
      onStop={() => {}}
      welcomeHideOrb
      showWidgetWelcomePrompt={showWelcomePrompt}
      onWidgetWelcomeDismiss={onWelcomePromptDismiss}
    />
  );
}

function WidgetConversationList({
  conversations,
  isLoading,
  activeSessionId,
  onSelect,
  onNewChat,
  onDelete,
}: {
  conversations: RagConversation[];
  isLoading: boolean;
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onNewChat: () => void;
  onDelete: (sessionId: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {conversations.length > 0 ? (
          <div className="flex flex-col">
            {conversations.map((conversation) => {
              const isActive = conversation.session_id === activeSessionId;
              return (
                <div
                  key={conversation.session_id}
                  className={cn(
                    "group flex items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted",
                    isActive && "bg-muted",
                  )}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onSelect(conversation.session_id)}
                    className="h-auto min-w-0 flex-1 justify-start truncate px-0 text-sm font-normal text-foreground hover:bg-transparent"
                  >
                    <span className="truncate">
                      {conversation.title?.trim() || "New conversation"}
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onDelete(conversation.session_id)}
                    aria-label="Delete conversation"
                    className="h-7 w-7 shrink-0 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-4">
            <EmptyState
              icon={<MessageSquareIcon />}
              title={isLoading ? "Loading…" : "No conversations yet"}
              description="Start a question and it will be saved here."
            />
          </div>
        )}
      </div>
      <div className="shrink-0 px-3 py-3">
        <Button type="button" onClick={onNewChat} className="w-full">
          New chat
        </Button>
      </div>
    </div>
  );
}

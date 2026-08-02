"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  Maximize2,
  Minimize2,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCollaborationNotifications } from "@/hooks/use-collaboration-notifications";
import { isAiApprovalQueueNotification } from "@/lib/collaboration/ai-approval-queue";
import {
  getFirstUnreadAiWidgetNotificationDraft,
  getUnreadAiApprovalDecisionNotifications,
  getUnreadAiWidgetNotifications,
  isAiWidgetNotificationKind,
  type AiWidgetNotificationDraft,
} from "@/lib/collaboration/ai-widget-notifications";
import { shouldInterruptAiWidget } from "@/lib/collaboration/ai-notification-routing";
import { useDeferredMount } from "@/hooks/use-deferred-mount";
import { shouldHideGlobalAiWidgetForRoute } from "@/lib/performance/runtime-gates";
import { cn } from "@/lib/utils";
import { PopoverLayerProvider } from "@/components/ui/popover";
import { WidgetAiChat, type WidgetAiChatView } from "./widget-ai-chat";

const AI_WIDGET_WELCOME_STORAGE_KEY = "alleato-ai-widget-welcome-seen-v1";

function focusFirstPanelElement(panel: HTMLDivElement) {
  const focusable = panel.querySelector<HTMLElement>(
    'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
  );
  focusable?.focus();
}

function reportWelcomeStorageError(error: unknown) {
  console.error("[ai-widget] Welcome notification storage failed", error);
}

function reportNotificationError(error: unknown) {
  console.error("[ai-widget] Collaboration notification sync failed", error);
}

export function GlobalAiWidget() {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [view, setView] = React.useState<WidgetAiChatView>("chat");
  const [expanded, setExpanded] = React.useState(false);
  const [compactPanel, setCompactPanel] = React.useState(false);
  const [hasAssistantActivityUnread, setHasAssistantActivityUnread] =
    React.useState(false);
  const [showWelcomePrompt, setShowWelcomePrompt] = React.useState(false);
  const [notificationDraft, setNotificationDraft] =
    React.useState<AiWidgetNotificationDraft | null>(null);
  const launcherRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const openRef = React.useRef(open);
  const pathname = usePathname() ?? "/";
  const notificationsReady = useDeferredMount(12_000);
  const hidden = shouldHideGlobalAiWidgetForRoute(pathname);
  const {
    notifications,
    error: notificationError,
    markAsRead,
  } = useCollaborationNotifications({
    enabled: !hidden && notificationsReady,
  });
  const unreadAiNotifications = React.useMemo(
    () => getUnreadAiWidgetNotifications(notifications),
    [notifications],
  );
  const unreadApprovalDecisionNotifications = React.useMemo(
    () => getUnreadAiApprovalDecisionNotifications(notifications),
    [notifications],
  );
  const unreadApprovalDecisionCount = unreadApprovalDecisionNotifications.length;
  const hasUnreadAiWelcomeNotification = unreadAiNotifications.some(
    (notification) => notification.kind === "ai_assistant_welcome",
  );
  const hasUnreadInterruptingAiNotification = unreadAiNotifications.some(
    shouldInterruptAiWidget,
  );
  const unreadNotificationDraft = React.useMemo(
    () => getFirstUnreadAiWidgetNotificationDraft(notifications),
    [notifications],
  );
  const hasUnread =
    hasAssistantActivityUnread ||
    showWelcomePrompt ||
    hasUnreadInterruptingAiNotification;

  React.useEffect(() => {
    openRef.current = open;
    if (open) setHasAssistantActivityUnread(false);
  }, [open]);

  React.useEffect(() => {
    if (notificationError) reportNotificationError(notificationError);
  }, [notificationError]);

  // Collapse the panel when navigating to a route the widget hides on.
  React.useEffect(() => {
    if (hidden) setOpen(false);
  }, [hidden]);

  React.useEffect(() => {
    if (hidden) {
      setShowWelcomePrompt(false);
      return;
    }

    try {
      const hasSeenWelcome =
        window.localStorage.getItem(AI_WIDGET_WELCOME_STORAGE_KEY) === "seen";
      const shouldShowWelcome =
        !hasSeenWelcome || hasUnreadAiWelcomeNotification;
      setShowWelcomePrompt(shouldShowWelcome);
    } catch (error) {
      reportWelcomeStorageError(error);
      setShowWelcomePrompt(false);
    }
  }, [hasUnreadAiWelcomeNotification, hidden]);

  const markWelcomeSeen = React.useCallback(() => {
    try {
      window.localStorage.setItem(AI_WIDGET_WELCOME_STORAGE_KEY, "seen");
    } catch (error) {
      reportWelcomeStorageError(error);
    }
  }, []);

  const dismissWelcomePrompt = React.useCallback(() => {
    markWelcomeSeen();
    setShowWelcomePrompt(false);
  }, [markWelcomeSeen]);

  React.useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }

    const timeout = window.setTimeout(() => setMounted(false), 240);
    return () => window.clearTimeout(timeout);
  }, [open]);

  const closePanel = React.useCallback(() => {
    setOpen(false);
    if (showWelcomePrompt) setShowWelcomePrompt(false);
    window.requestAnimationFrame(() => {
      launcherRef.current?.focus();
    });
  }, [showWelcomePrompt]);

  const openPanel = React.useCallback(() => {
    setOpen(true);
    setHasAssistantActivityUnread(false);
    if (showWelcomePrompt) markWelcomeSeen();
    setNotificationDraft(unreadNotificationDraft);

    const markableNotifications = unreadAiNotifications.filter(
      (notification) =>
        isAiWidgetNotificationKind(notification.kind) &&
        !isAiApprovalQueueNotification(notification),
    );
    if (markableNotifications.length > 0) {
      void Promise.all(
        markableNotifications.map((notification) =>
          markAsRead(notification.id),
        ),
      ).catch(reportNotificationError);
    }
  }, [
    markAsRead,
    markWelcomeSeen,
    showWelcomePrompt,
    unreadAiNotifications,
    unreadNotificationDraft,
  ]);

  React.useEffect(() => {
    if (!open) return;

    if (unreadNotificationDraft) {
      setNotificationDraft((current) =>
        current?.id === unreadNotificationDraft.id
          ? current
          : unreadNotificationDraft,
      );
    }

    const markableNotifications = unreadAiNotifications.filter(
      (notification) =>
        isAiWidgetNotificationKind(notification.kind) &&
        !isAiApprovalQueueNotification(notification),
    );
    if (markableNotifications.length > 0) {
      void Promise.all(
        markableNotifications.map((notification) =>
          markAsRead(notification.id),
        ),
      ).catch(reportNotificationError);
    }
  }, [markAsRead, open, unreadAiNotifications, unreadNotificationDraft]);

  const handleAssistantActivity = React.useCallback(() => {
    if (!openRef.current) setHasAssistantActivityUnread(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;

    function handleWindowKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closePanel();
    }

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [closePanel, open]);

  const handlePanelKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("aria-hidden"));

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [closePanel],
  );

  React.useEffect(() => {
    if (!open || !panelRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      if (panelRef.current) focusFirstPanelElement(panelRef.current);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  if (hidden) return null;

  return (
    <PopoverLayerProvider layer="global-ai-widget">
      {mounted && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label="Alleato AI"
          onKeyDown={handlePanelKeyDown}
          className={cn(
            "global-ai-widget-panel flex flex-col overflow-hidden rounded-xl border border-border bg-background",
            "transition-[opacity,transform] duration-200 ease-out",
            compactPanel && !expanded && "global-ai-widget-panel-compact",
            expanded && "global-ai-widget-panel-expanded",
            open
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-5 opacity-0",
          )}
        >
          <div className="flex shrink-0 items-center justify-between px-3.5 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {view === "chat" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setView("history")}
                  aria-label="View AI assistant messages"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              ) : (
                <div className="h-8 w-8 shrink-0" aria-hidden="true" />
              )}

              <div className="flex min-w-0 items-center gap-2">
                {view === "chat" && (
                  <Sparkles className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {view === "history" ? "History" : "Alleato AI"}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setExpanded((value) => !value)}
                aria-label={
                  expanded ? "Collapse AI assistant" : "Expand AI assistant"
                }
                aria-pressed={expanded}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                {expanded ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={closePanel}
                aria-label="Close AI assistant"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {unreadApprovalDecisionCount > 0 && (
            <Link
              href="/ai/approvals"
              className="mx-3.5 mb-2 flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="truncate">
                {unreadApprovalDecisionCount === 1
                  ? "1 AI decision needs review"
                  : `${unreadApprovalDecisionCount} AI decisions need review`}
              </span>
              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                Open
              </span>
            </Link>
          )}
          <div className="flex min-h-0 flex-1 flex-col">
            <WidgetAiChat
              autoFocusComposer={open && view === "chat"}
              view={view}
              onViewChange={setView}
              onAssistantActivity={handleAssistantActivity}
              onCompactStateChange={setCompactPanel}
              showWelcomePrompt={showWelcomePrompt}
              onWelcomePromptDismiss={dismissWelcomePrompt}
              notificationDraft={notificationDraft}
            />
          </div>
        </div>
      )}

      <Button
        ref={launcherRef}
        type="button"
        variant="default"
        aria-label={open ? "Minimize AI assistant" : "Open AI assistant"}
        onClick={open ? closePanel : openPanel}
        className={cn(
          "global-ai-widget-launcher flex items-center justify-center rounded-full bg-primary text-primary-foreground",
          "transition-[transform,opacity,box-shadow] duration-150 ease-out",
          "hover:-translate-y-px hover:scale-[1.02] active:scale-[0.97]",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        )}
      >
        {open ? (
          <ChevronDown className="size-6" strokeWidth={2.2} />
        ) : (
          <Sparkles className="size-6" strokeWidth={1.9} />
        )}
        {!open && hasUnread && (
          <span
            className="absolute right-0.5 top-0.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-destructive"
            aria-hidden="true"
          />
        )}
      </Button>
    </PopoverLayerProvider>
  );
}

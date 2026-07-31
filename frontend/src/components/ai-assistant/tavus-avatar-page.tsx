"use client";

import { useCallback, useState } from "react";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  Loader2Icon,
  VideoIcon,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ds";

interface TavusConversationResponse {
  conversationId: string;
  conversationName: string;
  conversationUrl: string;
  meetingToken?: string | null;
  status: string;
}

function getConversationUrl(conversation: TavusConversationResponse): string {
  return conversation.meetingToken
    ? `${conversation.conversationUrl}?t=${encodeURIComponent(conversation.meetingToken)}`
    : conversation.conversationUrl;
}

export function TavusAvatarPage() {
  const [conversation, setConversation] =
    useState<TavusConversationResponse | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionWarning, setPermissionWarning] = useState<string | null>(null);

  const requestMediaPermission = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        "This browser does not expose camera and microphone permissions to the app.",
      );
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    stream.getTracks().forEach((track) => track.stop());
  }, []);

  const startConversation = useCallback(async () => {
    const roomWindow = window.open("about:blank", "_blank");
    if (roomWindow) {
      roomWindow.document.title = "Opening Ava...";
      roomWindow.document.body.innerHTML =
        "<p style=\"font: 14px system-ui; padding: 24px;\">Opening Ava's live room...</p>";
    }

    setIsStarting(true);
    setError(null);
    setPermissionWarning(null);

    try {
      try {
        await requestMediaPermission();
      } catch (permissionError) {
        const message =
          permissionError instanceof Error ? permissionError.message : "";
        setPermissionWarning(
          message ||
            "Camera or microphone access is blocked in this browser. The Tavus room will still open, but you may need to use Open and grant permission in the Tavus tab.",
        );
      }

      const response = await apiFetch<TavusConversationResponse>(
        "/api/ai-assistant/avatar/conversation",
        {
          method: "POST",
          body: JSON.stringify({ selectedProjectId: null }),
        },
      );
      setConversation(response);
      const roomUrl = getConversationUrl(response);
      if (roomWindow) {
        roomWindow.location.href = roomUrl;
      } else {
        setPermissionWarning(
          "The browser blocked the Tavus popup. Use Open Tavus room to launch it in a tab where camera and microphone permissions work reliably.",
        );
      }
    } catch (caught) {
      roomWindow?.close();
      const message = caught instanceof Error ? caught.message : "";
      setError(message || "Tavus avatar session failed to start.");
    } finally {
      setIsStarting(false);
    }
  }, [requestMediaPermission]);

  const conversationUrl = conversation ? getConversationUrl(conversation) : null;

  return (
    <div className="space-y-6">
      {error && (
        <ErrorState
          title="Avatar session failed"
          error={error}
          onRetry={startConversation}
          className="items-start px-0 py-0 text-left"
        />
      )}

      {permissionWarning && (
        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" />
          <div className="space-y-2">
            <p>{permissionWarning}</p>
            {conversationUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={conversationUrl} target="_blank" rel="noreferrer">
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                  Open Tavus room
                </a>
              </Button>
            )}
          </div>
        </div>
      )}

      <section className="flex min-h-96 items-center justify-center px-4 py-12 sm:px-6">
        {conversationUrl ? (
          <div className="max-w-md space-y-4 text-center">
            <ArrowRightIcon className="mx-auto h-6 w-6 text-muted-foreground" />
            <div className="space-y-2">
              <p className="text-base font-semibold text-foreground">
                Ava is ready in a Tavus tab
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                Camera and microphone permissions work more reliably when the Tavus room opens directly instead of inside an embedded frame.
              </p>
            </div>
            <Button asChild>
              <a href={conversationUrl} target="_blank" rel="noreferrer">
                <ArrowRightIcon className="h-4 w-4" />
                Open Tavus room
              </a>
            </Button>
          </div>
        ) : (
          <div className="max-w-md space-y-4 text-center">
            <VideoIcon className="mx-auto h-6 w-6 text-muted-foreground" />
            <div className="space-y-2">
              <p className="text-base font-semibold text-foreground">
                Start Ava in a separate live room
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                This keeps the main AI assistant as the normal RAG strategy chat while the avatar stays isolated for onboarding and demos.
              </p>
            </div>
            <Button
              type="button"
              onClick={startConversation}
              disabled={isStarting}
            >
              {isStarting ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              ) : (
                <VideoIcon className="h-4 w-4" />
              )}
              Start live avatar
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

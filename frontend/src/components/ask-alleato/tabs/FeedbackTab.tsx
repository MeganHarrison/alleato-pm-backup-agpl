"use client";

import * as React from "react";
import { Bug, CheckCircle2, HelpCircle, ImagePlus, Lightbulb, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";
import { ADMIN_FEEDBACK_OVERLAY_ATTRIBUTE, feedbackTargetProps } from "@/lib/admin-feedback/constants";
import { buildFeedbackTargetSnapshot, type FeedbackTargetSnapshot } from "@/lib/admin-feedback/targeting";
import { captureTargetScreenshot } from "@/lib/admin-feedback/screenshot";
import { getErrorDetail } from "@/lib/format-error";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import {
  ASK_ALLEATO_FEEDBACK_PLACEHOLDER,
  ASK_ALLEATO_FEEDBACK_TAGS,
  mapAskAlleatoTagToRequestType,
  type AskAlleatoFeedbackTag,
} from "@/lib/ask-alleato/feedback-tag-mapping";
import { cn } from "@/lib/utils";

function inferProjectId(pathname: string) {
  const match = pathname.match(/^\/(\d+)(?:\/|$)/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function getDefaultFeedbackTarget() {
  const target =
    document.querySelector("[data-feedback-id='app.main-content']") ??
    document.querySelector("main") ??
    document.body;
  return target instanceof HTMLElement ? target : document.body;
}

export function FeedbackTab({
  pagePath,
  onSubmitted,
}: {
  pagePath: string;
  onSubmitted?: () => void;
}) {
  const [comment, setComment] = React.useState("");
  const [tag, setTag] = React.useState<AskAlleatoFeedbackTag>("Confused");
  const [target, setTarget] = React.useState<FeedbackTargetSnapshot | null>(null);
  const [screenshotDataUrl, setScreenshotDataUrl] = React.useState<string | null>(null);
  const [isCapturing, setIsCapturing] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const pageTitle = typeof document === "undefined" ? pagePath : document.title;

  React.useEffect(() => {
    const targetElement = getDefaultFeedbackTarget();
    setTarget(buildFeedbackTargetSnapshot(targetElement));
  }, [pagePath]);

  const handleCapture = async () => {
    setIsCapturing(true);
    try {
      const targetElement = getDefaultFeedbackTarget();
      setTarget(buildFeedbackTargetSnapshot(targetElement));
      setScreenshotDataUrl(await captureTargetScreenshot(targetElement));
    } catch (error) {
      const description = getErrorDetail(error);
      reportNonCriticalFailure({
        area: "ask-alleato-feedback",
        operation: "capture-screenshot",
        error,
        userVisibleFallback: "Feedback screenshot capture failed.",
        metadata: { pagePath },
      });
      toast.error("Could not capture screenshot", { description });
    } finally {
      setIsCapturing(false);
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!comment.trim()) {
      toast.error("Add a note before submitting feedback.");
      return;
    }

    const feedbackTarget = target ?? buildFeedbackTargetSnapshot(getDefaultFeedbackTarget());
    setIsSubmitting(true);
    try {
      await apiFetch("/api/admin/feedback", {
        method: "POST",
        body: JSON.stringify({
          comment: comment.trim(),
          requestType: mapAskAlleatoTagToRequestType(tag),
          severity: "medium",
          pageUrl: window.location.href,
          pagePath,
          pageTitle: document.title || null,
          projectId: inferProjectId(pagePath),
          screenshotDataUrl,
          target: {
            id: feedbackTarget.targetId,
            selector: feedbackTarget.selector,
            text: feedbackTarget.text,
            tagName: feedbackTarget.tagName,
            domPath: feedbackTarget.domPath,
            rect: {
              x: feedbackTarget.pageX,
              y: feedbackTarget.pageY,
              width: feedbackTarget.width,
              height: feedbackTarget.height,
            },
          },
          metadata: {
            pathname: pagePath,
            feedbackTag: tag,
            source: "ask-alleato-widget",
            userAgent: navigator.userAgent,
          },
        }),
      });
      setIsSuccess(true);
      toast.success("Feedback submitted.");
      window.setTimeout(() => {
        setComment("");
        setTag("Confused");
        setScreenshotDataUrl(null);
        setIsSuccess(false);
        onSubmitted?.();
      }, 1600);
    } catch (error) {
      const description = getErrorDetail(error);
      reportNonCriticalFailure({
        area: "ask-alleato-feedback",
        operation: "submit-feedback",
        error,
        userVisibleFallback: "Feedback submission failed.",
        metadata: {
          pagePath,
          tag,
          targetId: feedbackTarget.targetId,
        },
      });
      toast.error("Could not submit feedback", { description });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="py-8 text-center" {...{ [ADMIN_FEEDBACK_OVERLAY_ATTRIBUTE]: "true" }}>
        <CheckCircle2 className="mx-auto mb-3 size-10 text-status-success" />
        <div className="font-medium text-foreground">Got it. Logged.</div>
        <div className="mt-1 text-[13px] text-muted-foreground">
          The team will see it on the feedback board.
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4"
      {...feedbackTargetProps("ask-alleato.feedback-form")}
      {...{ [ADMIN_FEEDBACK_OVERLAY_ATTRIBUTE]: "true" }}
    >
      <Textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder={ASK_ALLEATO_FEEDBACK_PLACEHOLDER}
        className="min-h-28 text-sm"
      />
      <div className="flex flex-wrap gap-1.5">
        {ASK_ALLEATO_FEEDBACK_TAGS.map((nextTag) => (
          <TagButton
            key={nextTag}
            tag={nextTag}
            active={tag === nextTag}
            onClick={() => setTag(nextTag)}
          />
        ))}
      </div>
      <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <Sparkles className="size-3.5 text-primary" />
          Page context is attached automatically.
        </div>
        <div className="mt-1 line-clamp-2">{target?.text || pageTitle || pagePath}</div>
      </div>
      {screenshotDataUrl && (
        <div className="overflow-hidden rounded-lg border bg-muted/20">
          <img src={screenshotDataUrl} alt="Attached screenshot" className="h-32 w-full object-cover object-top" />
        </div>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="outline" size="sm" onClick={handleCapture} disabled={isCapturing}>
          <ImagePlus className="size-3.5" />
          {isCapturing ? "Capturing" : screenshotDataUrl ? "Retake screenshot" : "Add screenshot"}
        </Button>
        <Button type="submit" size="sm" disabled={isSubmitting || !comment.trim()}>
          <Send className="size-3.5" />
          {isSubmitting ? "Sending" : "Send feedback"}
        </Button>
      </div>
    </form>
  );
}

function TagButton({
  tag,
  active,
  onClick,
}: {
  tag: AskAlleatoFeedbackTag;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = tag === "Bug" ? Bug : tag === "Idea" ? Lightbulb : HelpCircle;
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      onClick={onClick}
      className={cn(
        "h-7 rounded-full",
        active
          ? "border-primary/30 bg-primary/5 text-primary"
          : "bg-background text-muted-foreground hover:border-primary/30 hover:text-primary",
      )}
    >
      <Icon className="size-3" />
      {tag}
    </Button>
  );
}

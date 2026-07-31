"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  ArrowUp,
  Bug,
  Camera,
  CircleHelp,
  CircleStop,
  Crosshair,
  Lightbulb,
  Pause,
  Play,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  ADMIN_FEEDBACK_SHEET_OFFSET_CSS_VAR,
  ADMIN_FEEDBACK_SHEET_OPEN_ATTRIBUTE,
  ADMIN_FEEDBACK_OVERLAY_ATTRIBUTE,
  OPEN_ADMIN_FEEDBACK_COMPOSER_EVENT,
  type AdminFeedbackRequestType,
} from "@/lib/admin-feedback/constants";
import {
  buildFeedbackTargetSnapshot,
  elementFromPointBelowOverlays,
  getSelectableElement,
  isOverlayHost,
  type FeedbackTargetSnapshot,
} from "@/lib/admin-feedback/targeting";
import { captureTargetScreenshot } from "@/lib/admin-feedback/screenshot";
import { getBestComposerTarget } from "@/lib/admin-feedback/launcher-target";
import { compressImageDataUrl } from "@/lib/admin-feedback/compress-image";
import {
  MAX_RECORDING_DURATION_MS,
  type ScreenRecorderHandle,
  deleteOrphanedRecording,
  isScreenRecordingSupported,
  startScreenRecording,
  uploadRecording,
} from "@/lib/admin-feedback/screen-recorder";
import { useCurrentUserProfile } from "@/hooks/use-current-user-profile";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiFetch } from "@/lib/api-client";
import { getErrorDetail } from "@/lib/format-error";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  SidePanel,
  SidePanelBody,
  SidePanelContent,
  SidePanelHeader,
  SidePanelTitle,
} from "@/components/ui/side-panel";
import { InfoAlert } from "@/components/ds/InfoAlert";
import { ScreenshotAnnotator } from "@/components/admin-feedback/ScreenshotAnnotator";

type FeedbackType = "Bug" | "Idea" | "Question";
type PriorityLevel = "high" | "medium" | "low";

type SubmissionState = {
  title: string;
  comment: string;
  feedbackType: FeedbackType;
  priority: PriorityLevel;
  affectedTool: string;
};

type RectState = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const FEEDBACK_TYPES: { value: FeedbackType; icon: typeof Bug }[] = [
  { value: "Bug", icon: Bug },
  { value: "Idea", icon: Lightbulb },
  { value: "Question", icon: CircleHelp },
];
const ADMIN_FEEDBACK_DESKTOP_OFFSET = "34rem";

const TOOL_PATH_MAP: [string, string][] = [
  ["/budget", "Budget"],
  ["/change-events", "Change Events"],
  ["/change-management", "Change Management"],
  ["/commitments", "Commitments"],
  ["/direct-costs", "Direct Costs"],
  ["/drawings", "Drawings"],
  ["/estimates", "Estimates"],
  ["/invoicing", "Invoicing"],
  ["/prime-contracts", "Prime Contracts"],
  ["/rfis", "RFIs"],
  ["/submittals", "Submittals"],
  ["/directory", "Directory"],
  ["/schedule", "Schedule"],
  ["/ai", "AI"],
  ["/ai-assistant", "AI Assistant"],
  ["/portfolio", "Portfolio"],
];

function inferToolFromPath(pathname: string): string {
  for (const [segment, name] of TOOL_PATH_MAP) {
    if (pathname.includes(segment)) return name;
  }
  return "";
}

function getDefaultForm(pathname: string): SubmissionState {
  return {
    title: "",
    comment: "",
    feedbackType: "Bug",
    priority: "medium",
    affectedTool: inferToolFromPath(pathname),
  };
}

function mapFeedbackTypeToRequestType(
  feedbackType: FeedbackType,
): AdminFeedbackRequestType {
  if (feedbackType === "Bug") {
    return "bug";
  }

  if (feedbackType === "Idea") {
    return "feature_request";
  }

  return "question";
}

function getSubmissionSuccessLabel(feedbackType: FeedbackType) {
  if (feedbackType === "Idea") return "Idea submitted.";
  if (feedbackType === "Question") return "Question submitted.";
  return "Feedback submitted.";
}

function getRectState(target: FeedbackTargetSnapshot | null): RectState | null {
  if (!target) {
    return null;
  }

  return {
    left: target.pageX - window.scrollX,
    top: target.pageY - window.scrollY,
    width: target.width,
    height: target.height,
  };
}

function inferProjectId(pathname: string) {
  const match = pathname.match(/^\/(\d+)(?:\/|$)/);
  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function waitForComposerToLeaveViewport() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

function formatRecordingElapsed(elapsedMs: number) {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function FeedbackToolButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={cn("text-muted-foreground hover:text-foreground", className)}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function AdminFeedbackWidget() {
  const pathname = usePathname()!;
  const isMobile = useIsMobile();
  const pagePath = pathname ?? "/";
  const [isSelecting, setIsSelecting] = useState(false);
  const [hoveredTarget, setHoveredTarget] =
    useState<FeedbackTargetSnapshot | null>(null);
  const [selectedTarget, setSelectedTarget] =
    useState<FeedbackTargetSnapshot | null>(null);
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(
    null,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftActive, setDraftActive] = useState(false);
  const [form, setForm] = useState<SubmissionState>(() => getDefaultForm(pagePath));
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(
    null,
  );
  // Flattened base + annotations, produced by ScreenshotAnnotator. Kept separate
  // from `screenshotDataUrl` (the immutable base) so the annotator never feeds
  // its output back into the <img> it draws over — that loop blanked the
  // screenshot the moment you drew on it.
  const [annotatedScreenshotDataUrl, setAnnotatedScreenshotDataUrl] = useState<
    string | null
  >(null);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Per-capture toggle. OFF (default) = just save the row for batch triage in
  // the inbox; ON = also open a GitHub issue immediately. The default stays
  // save-only so flagging many things quickly never fans out into issues.
  const [createIssue, setCreateIssue] = useState(false);
  const [videoRecordingUrl, setVideoRecordingUrl] = useState<string | null>(
    null,
  );
  const [videoRecordingPath, setVideoRecordingPath] = useState<string | null>(
    null,
  );
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const recordingHandleRef = useRef<ScreenRecorderHandle | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingSupported = isScreenRecordingSupported();
  const shouldLoadProfile = dialogOpen || isSubmitting;
  // Loaded in the background purely for submit-time attribution (submitterName /
  // submitterEmail). It must NEVER gate the composer's render — doing so unmounts
  // the open panel until the profile fetch resolves, which is what made the form
  // "take a minute to load" and blink out on open.
  const { profile } = useCurrentUserProfile({
    enabled: shouldLoadProfile,
  });
  const frameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);

  // Any new base screenshot (capture / upload / re-pick / clear) discards the
  // prior annotation so a stale overlay can never be submitted with a new image.
  useEffect(() => {
    setAnnotatedScreenshotDataUrl(null);
  }, [screenshotDataUrl]);

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file.");
        return;
      }

      // 10MB limit
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Image must be under 10MB.");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setScreenshotDataUrl(reader.result);
        }
      };
      reader.onerror = () => {
        const error = reader.error ?? new Error("The browser could not read the selected image file.");
        reportNonCriticalFailure({
          area: "admin-feedback-widget",
          operation: "read-uploaded-screenshot",
          error,
          userVisibleFallback: "The selected feedback screenshot could not be read.",
          metadata: {
            fileName: file.name,
            fileSize: file.size,
          },
        });
        toast.error("Could not read image file", {
          description: getErrorDetail(error),
        });
      };
      reader.readAsDataURL(file);

      // Reset the input so the same file can be re-selected
      event.target.value = "";
    },
    [],
  );

  const finalizeRecording = useCallback(async (options?: { reopenComposer?: boolean }) => {
    const handle = recordingHandleRef.current;
    if (!handle) return;
    const shouldReopenComposer = options?.reopenComposer ?? true;
    recordingHandleRef.current = null;
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    try {
      const { blob } = await handle.stop();
      setIsRecording(false);
      setIsRecordingPaused(false);
      if (blob.size === 0) {
        toast.error("Recording was empty — try again.");
        if (shouldReopenComposer) {
          setDialogOpen(true);
        }
        return;
      }
      const previewUrl = URL.createObjectURL(blob);
      setVideoPreviewUrl(previewUrl);
      setIsUploadingVideo(true);
      try {
        const { publicUrl, path } = await uploadRecording(blob);
        setVideoRecordingUrl(publicUrl);
        setVideoRecordingPath(path);
        toast.success("Screen recording attached.");
        if (shouldReopenComposer) {
          setDialogOpen(true);
        }
      } catch (uploadError) {
        reportNonCriticalFailure({
          area: "admin-feedback-widget",
          operation: "upload-screen-recording",
          error: uploadError,
          userVisibleFallback: "Could not save your screen recording.",
        });
        toast.error("Could not upload screen recording", {
          description: getErrorDetail(uploadError),
        });
        setVideoPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return null;
        });
        if (shouldReopenComposer) {
          setDialogOpen(true);
        }
      } finally {
        setIsUploadingVideo(false);
      }
    } catch (error) {
      setIsRecording(false);
      setIsRecordingPaused(false);
      reportNonCriticalFailure({
        area: "admin-feedback-widget",
        operation: "stop-screen-recording",
        error,
        userVisibleFallback: "Could not finalize the screen recording.",
      });
      toast.error("Recording failed", { description: getErrorDetail(error) });
      if (shouldReopenComposer) {
        setDialogOpen(true);
      }
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!recordingSupported || isRecording || recordingHandleRef.current) {
      return;
    }
    try {
      setRecordingElapsedMs(0);
      setDialogOpen(false);
      await waitForComposerToLeaveViewport();
      const handle = await startScreenRecording();
      recordingHandleRef.current = handle;
      setIsRecording(true);
      setIsRecordingPaused(false);
      const startedAt = performance.now();
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingElapsedMs(performance.now() - startedAt);
      }, 250);

      // Hook into the recorder's own stop event so the browser "Stop sharing"
      // button finalizes the recording too.
      handle.recorder.addEventListener("stop", () => {
        if (recordingHandleRef.current === handle) {
          void finalizeRecording();
        }
      });
    } catch (error) {
      setIsRecording(false);
      setDialogOpen(true);
      const message = error instanceof Error ? error.message : String(error);
      if (/permission denied|not allowed/i.test(message)) {
        toast.error("Screen recording permission was denied.");
      } else {
        toast.error("Could not start screen recording", { description: message });
      }
    }
  }, [recordingSupported, isRecording, finalizeRecording]);

  const stopRecording = useCallback(() => {
    void finalizeRecording();
  }, [finalizeRecording]);

  const pauseRecording = useCallback(() => {
    const handle = recordingHandleRef.current;
    if (!handle || handle.recorder.state !== "recording") {
      return;
    }

    try {
      handle.recorder.pause();
      setIsRecordingPaused(true);
    } catch (error) {
      reportNonCriticalFailure({
        area: "admin-feedback-widget",
        operation: "pause-screen-recording",
        error,
        userVisibleFallback: "Could not pause the screen recording.",
      });
      toast.error("Could not pause recording", {
        description: getErrorDetail(error),
      });
    }
  }, []);

  const resumeRecording = useCallback(() => {
    const handle = recordingHandleRef.current;
    if (!handle || handle.recorder.state !== "paused") {
      return;
    }

    try {
      handle.recorder.resume();
      setIsRecordingPaused(false);
    } catch (error) {
      reportNonCriticalFailure({
        area: "admin-feedback-widget",
        operation: "resume-screen-recording",
        error,
        userVisibleFallback: "Could not resume the screen recording.",
      });
      toast.error("Could not resume recording", {
        description: getErrorDetail(error),
      });
    }
  }, []);

  const discardRecording = useCallback(() => {
    if (recordingHandleRef.current) {
      try {
        recordingHandleRef.current.cancel();
      } catch (cancelError) {
        console.warn("[admin-feedback] cancel recording failed", cancelError);
      }
      recordingHandleRef.current = null;
    }
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setIsRecordingPaused(false);
    setIsUploadingVideo(false);
    setRecordingElapsedMs(0);
    setVideoPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setVideoRecordingUrl(null);
    setVideoRecordingPath((current) => {
      if (current) {
        void deleteOrphanedRecording(current);
      }
      return null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (recordingHandleRef.current) {
        try {
          recordingHandleRef.current.cancel();
        } catch (cancelError) {
          console.warn("[admin-feedback] cancel recording on unmount failed", cancelError);
        }
      }
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    };
  }, [videoPreviewUrl]);

  const hoveredRect = hoveredTarget ? getRectState(hoveredTarget) : null;
  const isImmersiveChatRoute =
    pagePath === "/ai" ||
    pagePath.startsWith("/ai/") ||
    pagePath.startsWith("/ai-assistant") ||
    pagePath.startsWith("/ai-avatar");
  const hasRecoverableDraft =
    draftActive ||
    selectedElement !== null ||
    selectedTarget !== null ||
    Boolean(screenshotDataUrl) ||
    Boolean(videoPreviewUrl) ||
    Boolean(videoRecordingUrl) ||
    form.title.trim().length > 0 ||
    form.comment.trim().length > 0;

  useEffect(() => {
    const root = document.documentElement;
    const shouldShiftLayout = dialogOpen && !isMobile;

    root.setAttribute(
      ADMIN_FEEDBACK_SHEET_OPEN_ATTRIBUTE,
      shouldShiftLayout ? "true" : "false",
    );
    root.style.setProperty(
      ADMIN_FEEDBACK_SHEET_OFFSET_CSS_VAR,
      shouldShiftLayout ? ADMIN_FEEDBACK_DESKTOP_OFFSET : "0px",
    );

    return () => {
      root.setAttribute(ADMIN_FEEDBACK_SHEET_OPEN_ATTRIBUTE, "false");
      root.style.setProperty(ADMIN_FEEDBACK_SHEET_OFFSET_CSS_VAR, "0px");
    };
  }, [dialogOpen, isMobile]);

  useEffect(() => {
    if (!isSelecting || dialogOpen) {
      return;
    }

    const onMouseMove = (event: MouseEvent) => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }

      frameRef.current = window.requestAnimationFrame(() => {
        const element = getSelectableElement(
          elementFromPointBelowOverlays(event.clientX, event.clientY),
        );
        if (!element) {
          setHoveredTarget(null);
          return;
        }

        setHoveredTarget(buildFeedbackTargetSnapshot(element));
      });
    };

    const onClick = (event: MouseEvent) => {
      const element = getSelectableElement(
        elementFromPointBelowOverlays(event.clientX, event.clientY),
      );
      if (!element) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      setSelectedElement(element);
      setSelectedTarget(buildFeedbackTargetSnapshot(element));
      setHoveredTarget(buildFeedbackTargetSnapshot(element));
      setDraftActive(true);
      setDialogOpen(true);
      setIsSelecting(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      setIsSelecting(false);
      setHoveredTarget(null);
    };

    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("mousemove", onMouseMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [dialogOpen, isSelecting]);

  useEffect(() => {
    if (!dialogOpen || !selectedElement) {
      return;
    }
    // Don't clobber a screenshot the user already captured, uploaded, or
    // annotated when the composer is reopened.
    if (screenshotDataUrl) {
      return;
    }

    let isCancelled = false;

    setIsCapturingScreenshot(true);
    captureTargetScreenshot(selectedElement)
      .then((dataUrl) => {
        if (!isCancelled) {
          setScreenshotDataUrl(dataUrl);
        }
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }
        // This capture is automatic — the user never asked for it, and the
        // composer offers explicit Camera / Upload / Point-to-an-area controls.
        // A failure here (html-to-image is intermittently flaky on complex
        // pages) must not block the user with an error toast. Record it for
        // monitoring and leave the screenshot unset; the manual controls remain.
        reportNonCriticalFailure({
          area: "admin-feedback-widget",
          operation: "auto-capture-screenshot",
          error,
          userVisibleFallback:
            "Automatic screenshot skipped; manual capture still available.",
          metadata: {
            pagePath,
            selectedTargetId: selectedTarget?.targetId ?? null,
          },
        });
        setScreenshotDataUrl(null);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsCapturingScreenshot(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [dialogOpen, selectedElement, screenshotDataUrl, pagePath, selectedTarget]);

  useEffect(() => {
    if (!dialogOpen || !selectedTarget) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      commentInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [dialogOpen, selectedTarget]);

  useEffect(() => {
    const openComposer = () => {
      if (hasRecoverableDraft) {
        setIsSelecting(false);
        setDialogOpen(true);
        return;
      }

      const target = getBestComposerTarget();

      if (!(target instanceof HTMLElement)) {
        toast.error("Could not find page context", {
          description: "Select a visible page element and try again.",
        });
        return;
      }

      const snapshot = buildFeedbackTargetSnapshot(target);
      setIsSelecting(false);
      setSelectedElement(target);
      setSelectedTarget(snapshot);
      setHoveredTarget(snapshot);
      setScreenshotDataUrl(null);
      setForm(getDefaultForm(pagePath));
      setDraftActive(true);
      setDialogOpen(true);
    };

    window.addEventListener(OPEN_ADMIN_FEEDBACK_COMPOSER_EVENT, openComposer);
    return () =>
      window.removeEventListener(
        OPEN_ADMIN_FEEDBACK_COMPOSER_EVENT,
        openComposer,
      );
  }, [hasRecoverableDraft, pagePath]);

  // Set cursor to crosshair when selecting
  useEffect(() => {
    if (isSelecting) {
      document.body.style.cursor = "crosshair";
    } else {
      document.body.style.cursor = "";
    }
    return () => {
      document.body.style.cursor = "";
    };
  }, [isSelecting]);

  if (isImmersiveChatRoute) {
    return null;
  }

  const resetComposer = () => {
    setDialogOpen(false);
    setSelectedElement(null);
    setSelectedTarget(null);
    setHoveredTarget(null);
    setDraftActive(false);
    setScreenshotDataUrl(null);
    setForm(getDefaultForm(pagePath));
    setCreateIssue(false);
    discardRecording();
  };

  const minimizeComposer = () => {
    setDialogOpen(false);
  };

  const refreshScreenshot = async () => {
    if (!selectedElement) {
      return;
    }

    setIsCapturingScreenshot(true);
    const wasOpen = dialogOpen;

    try {
      if (wasOpen) {
        setDialogOpen(false);
        await waitForComposerToLeaveViewport();
      }

      const dataUrl = await captureTargetScreenshot(selectedElement);
      setScreenshotDataUrl(dataUrl);
      toast.success("Screenshot attached.");
    } catch (error) {
      reportNonCriticalFailure({
        area: "admin-feedback-widget",
        operation: "capture-selection-screenshot",
        error,
        userVisibleFallback: "Feedback screenshot capture failed.",
        metadata: {
          pagePath,
          selectedTargetId: selectedTarget?.targetId ?? null,
        },
      });
      toast.error("Could not capture screenshot", {
        description: getErrorDetail(error),
      });
    } finally {
      setIsCapturingScreenshot(false);
      if (wasOpen) {
        setDialogOpen(true);
      }
    }
  };

  const startSelectMode = () => {
    setDialogOpen(false);
    setSelectedElement(null);
    setSelectedTarget(null);
    setHoveredTarget(null);
    setDraftActive(true);
    setScreenshotDataUrl(null);
    setIsSelecting(true);
  };

  const handleSubmit = () => {
    if (!selectedTarget) {
      return;
    }

    if (!form.comment.trim()) {
      toast.error("Add a comment before submitting feedback.");
      return;
    }

    setIsSubmitting(true);

    void (async () => {
      // Guarantee the screenshot fits within the 4.5MB serverless body limit.
      // An oversized screenshot must never block the whole submission — drop it
      // with a warning rather than failing the feedback entirely.
      // Prefer the annotated flatten when the user drew on the capture; fall
      // back to the untouched base screenshot otherwise.
      let screenshotForUpload = annotatedScreenshotDataUrl ?? screenshotDataUrl;
      if (screenshotForUpload) {
        try {
          screenshotForUpload = await compressImageDataUrl(screenshotForUpload);
        } catch (compressionError) {
          reportNonCriticalFailure({
            area: "admin-feedback-widget",
            operation: "compress-feedback-screenshot",
            error: compressionError,
            userVisibleFallback: "Feedback screenshot could not be processed.",
            metadata: { pagePath },
          });
          screenshotForUpload = null;
          toast.warning("Screenshot couldn't be attached — submitting feedback without it.");
        }
      }

      try {
        const payload = await apiFetch<{
          captured?: boolean;
          githubIssue?: { url?: string };
          githubWarning?: { message?: string } | string | null;
        }>("/api/admin/feedback", {
          method: "POST",
          body: JSON.stringify({
            title: form.title.trim() || undefined,
            comment: form.comment.trim(),
            createIssue,
            requestType: mapFeedbackTypeToRequestType(form.feedbackType),
            severity: form.feedbackType === "Bug" ? form.priority : "medium",
            pageUrl: window.location.href,
            pagePath,
            pageTitle: document.title || null,
            projectId: inferProjectId(pagePath),
            screenshotDataUrl: screenshotForUpload,
            target: {
              id: selectedTarget.targetId,
              selector: selectedTarget.selector,
              text: selectedTarget.text,
              tagName: selectedTarget.tagName,
              domPath: selectedTarget.domPath,
              rect: {
                x: selectedTarget.pageX,
                y: selectedTarget.pageY,
                width: selectedTarget.width,
                height: selectedTarget.height,
              },
            },
            metadata: {
              pathname: pagePath,
              feedbackType: form.feedbackType,
              intakeKind: "product_feedback",
              intakeSource: "admin-feedback-widget",
              canonicalWorkflow: "feedback-inbox",
              priority: form.feedbackType === "Bug" ? form.priority : undefined,
              affectedTool: form.affectedTool || undefined,
              submitterName: profile?.fullName,
              submitterEmail: profile?.email,
              source: "admin-feedback-widget",
              userAgent: navigator.userAgent,
              viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
              },
              selectedText: selectedTarget.text,
              selectedSelector: selectedTarget.selector,
              selectedDomPath: selectedTarget.domPath,
              videoRecordingUrl: videoRecordingUrl ?? undefined,
            },
          }),
        });

        if (payload?.githubIssue?.url) {
          toast.success("Feedback submitted and GitHub issue created.");
        } else if (payload?.githubWarning) {
          const warningDescription =
            typeof payload.githubWarning === "string"
              ? payload.githubWarning
              : payload.githubWarning.message;
          toast.warning("Feedback saved; GitHub issue was not created.", {
            description:
              warningDescription ||
              "Open Feedback Inbox and send it to GitHub after the integration is fixed.",
          });
        } else if (payload?.captured) {
          toast.success("Saved to inbox.", {
            description: "Batch-triage it later — no issue was created.",
          });
        } else {
          toast.success(getSubmissionSuccessLabel(form.feedbackType));
        }

        // The recording is now referenced by the saved feedback record — clear
        // the local path so resetComposer() does NOT delete it as an orphan.
        setVideoRecordingPath(null);
        resetComposer();
      } catch (error) {
        const description = getErrorDetail(error);
        reportNonCriticalFailure({
          area: "admin-feedback-widget",
          operation: "submit-feedback",
          error,
          userVisibleFallback: "Feedback submission failed.",
          metadata: {
            pagePath,
            selectedTargetId: selectedTarget.targetId,
            feedbackType: form.feedbackType,
            priority:
              form.feedbackType === "Bug" ? form.priority : undefined,
          },
        });
        toast.error("Could not submit feedback", { description });
      } finally {
        setIsSubmitting(false);
      }
    })();
  };

  const recordingStatusLabel = isRecordingPaused
    ? `Recording paused at ${formatRecordingElapsed(recordingElapsedMs)}`
    : `Recording ${formatRecordingElapsed(recordingElapsedMs)}`;

  return (
    <>
      {hoveredRect && isSelecting && (
        <div
          className="pointer-events-none fixed z-[9998] rounded-md border-2 border-primary bg-primary/10 ring-1 ring-primary/30"
          style={{
            left: hoveredRect.left,
            top: hoveredRect.top,
            width: hoveredRect.width,
            height: hoveredRect.height,
          }}
        />
      )}
      {isSelecting && (
        <div
          className="fixed left-4 bottom-4 z-[9999] rounded-full bg-foreground px-3 py-1.5 text-xs text-background shadow-sm"
          {...{ [ADMIN_FEEDBACK_OVERLAY_ATTRIBUTE]: "true" }}
        >
          Click an element, then keep writing in the sheet.
        </div>
      )}
      {isRecording && (
        <div
          className="fixed bottom-4 left-1/2 z-[9999] flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 items-center justify-between gap-3 rounded-full border border-border bg-background px-3 py-2 text-sm shadow-sm sm:right-4 sm:left-auto sm:w-auto sm:translate-x-0"
          role="status"
          aria-live="polite"
          {...{ [ADMIN_FEEDBACK_OVERLAY_ATTRIBUTE]: "true" }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "h-2.5 w-2.5 shrink-0 rounded-full bg-destructive",
                !isRecordingPaused && "animate-pulse",
              )}
              aria-hidden="true"
            />
            <span className="truncate font-medium text-foreground">
              {recordingStatusLabel}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={isRecordingPaused ? resumeRecording : pauseRecording}
              aria-label={isRecordingPaused ? "Resume recording" : "Pause recording"}
            >
              {isRecordingPaused ? (
                <Play className="h-4 w-4" />
              ) : (
                <Pause className="h-4 w-4" />
              )}
            </Button>
            {!dialogOpen && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDialogOpen(true)}
              >
                Form
              </Button>
            )}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={stopRecording}
              className="gap-1.5 rounded-full"
            >
              <CircleStop className="h-3.5 w-3.5" />
              Stop
            </Button>
          </div>
        </div>
      )}

      <SidePanel
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            minimizeComposer();
          }
        }}
        modal={false}
      >
        <SidePanelContent
          size="md"
          showOverlay={false}
          showCloseButton={false}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          {...{ [ADMIN_FEEDBACK_OVERLAY_ATTRIBUTE]: "true" }}
        >
          <SidePanelHeader className="flex-row items-center justify-between gap-4 space-y-0">
            <SidePanelTitle className="min-w-0 truncate tracking-tight">
              Share Feedback or Idea
            </SidePanelTitle>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href="/feedback-inbox" className="gap-1.5">
                  View feedback
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={minimizeComposer}
                aria-label="Close feedback sheet"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SidePanelHeader>

          <SidePanelBody>
            {selectedTarget ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Type</Label>
                <div className="flex flex-wrap gap-2">
                  {FEEDBACK_TYPES.map(({ value, icon: Icon }) => {
                    const active = form.feedbackType === value;
                    return (
                      <Button
                        key={value}
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-pressed={active}
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            feedbackType: value,
                          }))
                        }
                        className={cn(
                          "h-8 gap-1.5 rounded-md border border-border px-3 text-sm font-medium",
                          active
                            ? "bg-primary/10 text-foreground hover:bg-primary/10"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {value}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback-comment">Enter feedback</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <InputGroup className="rounded-2xl border-border/70 focus-within:border-border">
                  <InputGroupTextarea
                    id="feedback-comment"
                    ref={commentInputRef}
                    rows={5}
                    placeholder="Describe the issue, idea, or question."
                    value={form.comment}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        comment: event.target.value,
                      }))
                    }
                  />
                  <InputGroupAddon
                    align="block-end"
                    className="justify-between gap-1"
                  >
                    <div className="flex items-center gap-0.5">
                      <FeedbackToolButton
                        label={
                          screenshotDataUrl
                            ? "Retake screenshot"
                            : "Capture screenshot"
                        }
                        onClick={() => void refreshScreenshot()}
                        disabled={isCapturingScreenshot}
                      >
                        <Camera
                          className={cn(
                            "h-4 w-4",
                            isCapturingScreenshot && "animate-pulse",
                          )}
                        />
                      </FeedbackToolButton>
                      <FeedbackToolButton
                        label="Point to an area"
                        onClick={startSelectMode}
                      >
                        <Crosshair className="h-4 w-4" />
                      </FeedbackToolButton>
                      <FeedbackToolButton
                        label="Upload image"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4" />
                      </FeedbackToolButton>
                      {recordingSupported && !isRecording && !videoPreviewUrl && (
                        <FeedbackToolButton
                          label="Record screen"
                          onClick={startRecording}
                        >
                          <Video className="h-4 w-4" />
                        </FeedbackToolButton>
                      )}
                      {isRecording && (
                        <FeedbackToolButton
                          label="Stop recording"
                          onClick={stopRecording}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <CircleStop className="h-4 w-4" />
                        </FeedbackToolButton>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSubmit}
                      disabled={
                        isSubmitting ||
                        isRecording ||
                        isUploadingVideo ||
                        form.comment.trim().length === 0
                      }
                      className="gap-1.5 rounded-full"
                    >
                      {isSubmitting
                        ? "Sending..."
                        : isUploadingVideo
                          ? "Uploading..."
                          : createIssue
                            ? "Send + issue"
                            : "Save"}
                      {!isSubmitting && !isUploadingVideo && (
                        <ArrowUp className="h-4 w-4" />
                      )}
                    </Button>
                  </InputGroupAddon>
                </InputGroup>
              </div>

              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="feedback-create-issue" className="font-normal text-muted-foreground">
                  Create GitHub issue now
                </Label>
                <Switch
                  id="feedback-create-issue"
                  checked={createIssue}
                  onCheckedChange={setCreateIssue}
                  aria-label="Create GitHub issue now"
                />
              </div>

              {screenshotDataUrl && (
                <ScreenshotAnnotator
                  dataUrl={screenshotDataUrl}
                  onChange={setAnnotatedScreenshotDataUrl}
                />
              )}

              {isRecording && (
                <InfoAlert
                  variant="error"
                  role="status"
                  icon={
                    <span className="mt-1 inline-flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-destructive" />
                  }
                >
                  {isRecordingPaused ? "Recording paused" : "Recording"} at{" "}
                  {formatRecordingElapsed(recordingElapsedMs)} /{" "}
                  {formatRecordingElapsed(MAX_RECORDING_DURATION_MS)}. Use the
                  recording bar to pause or stop, then send the feedback.
                </InfoAlert>
              )}

              {videoPreviewUrl && !isRecording && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label>Screen recording</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={discardRecording}
                      aria-label="Remove recording"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={isUploadingVideo}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="overflow-hidden rounded-lg bg-muted/30">
                    <video
                      src={videoPreviewUrl}
                      controls
                      className="aspect-video w-full bg-foreground"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isUploadingVideo
                      ? "Uploading recording..."
                      : videoRecordingUrl
                        ? "Recording attached."
                        : "Recording ready to attach."}
                  </p>
                </div>
              )}

              {hasRecoverableDraft && (
                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={resetComposer}
                    className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear draft
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="max-w-xs text-center text-sm text-muted-foreground">
                Select a page area or reopen the sheet from the header to keep
                writing.
              </p>
            </div>
          )}
          </SidePanelBody>
        </SidePanelContent>
      </SidePanel>
    </>
  );
}

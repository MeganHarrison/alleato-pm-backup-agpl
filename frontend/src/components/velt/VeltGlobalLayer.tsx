"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { useCommentsVisibilityStore } from "@/lib/stores/comments-visibility-store";
import { useCommentScopeStore } from "@/lib/stores/comment-scope-store";
import {
  getDefaultCommentScope,
  isDrawingCommentContext,
  type CommentScope,
} from "@/lib/comments/comment-scope";
import { observeMalformedVeltAnnotations } from "@/components/velt/annotation-sanitizer";
import { observeVeltCommentDialogPolish } from "@/components/velt/velt-dialog-polish";
import {
  VeltComments,
  VeltCommentsSidebar,
  useCommentEventCallback,
  useCommentModeState,
  useCommentUtils,
  useSetDocument,
  useVeltClient,
} from "@veltdev/react";

interface VeltCommentElement {
  enableAttachments?: () => void;
  enableEnterKeyToSubmit?: () => void;
  allowedElementQuerySelectors?: (selectors: string[]) => void;
  commentToNearestAllowedElement?: (enabled: boolean) => void;
  enableGhostComments?: () => void;
  enableGhostCommentsIndicator?: () => void;
}

function isVeltCommentElement(value: unknown): value is VeltCommentElement {
  return typeof value === "object" && value !== null;
}

// Keep stable app content as the preferred target, then fall back to the page
// body so header, navigation, and portal-rendered surfaces remain commentable.
// More specific overlay selectors win through nearest-element targeting.
const COMMENTABLE_SELECTORS = [
  "body",
  "[role='dialog']",
  "[role='alertdialog']",
  "[data-radix-popper-content-wrapper]",
  "[data-drawing-comment-target='true']",
];

// The drawings collection has its own record-level discussion workflow. A
// persisted global visibility preference must never turn the collection into a
// page-annotation canvas or leave a site-feedback composer behind after the
// user exits a drawing viewer.
const DRAWING_COLLECTION_ROUTE_PATTERN =
  /^\/[^/]+\/drawings(?:\/(?!viewer(?:\/|$)).*)?\/?$/;

function isDrawingCollectionRoute(pathname: string): boolean {
  return DRAWING_COLLECTION_ROUTE_PATTERN.test(pathname);
}

function requestsGitHubIssue(context: unknown): boolean {
  if (!context || typeof context !== "object") return false;
  return (
    (context as Record<string, unknown>).submissionIntent === "github_issue"
  );
}

type VeltFeedbackMirrorResponse = {
  feedbackStatus: string;
  githubIssueUrl: string | null;
};

function reportMirrorResult(
  createIssue: boolean,
  result: VeltFeedbackMirrorResponse,
) {
  if (createIssue && !result.githubIssueUrl) {
    toast.error("Comment saved, but GitHub issue creation failed.", {
      description: "Open the feedback inbox to retry issue creation.",
    });
  }
}

function reportMirrorFailure(error: unknown) {
  console.warn("[velt-feedback-bridge] feedback mirror failed", error);
  toast.error("Comment saved, but feedback sync failed.", {
    description:
      "The page comment is available. Retry from the feedback inbox.",
  });
}

function VeltCommentConfiguration() {
  const { client } = useVeltClient();

  useEffect(() => {
    if (!client) return;
    const commentElement: unknown = client.getCommentElement();
    if (!isVeltCommentElement(commentElement)) {
      console.warn("[velt] Comment element is unavailable; comment enhancements were not configured.");
      return;
    }
    commentElement.enableAttachments?.();
    // NOTE: enableSidebarButtonOnCommentDialog() intentionally removed — it
    // rendered the full-width "All comments" footer band that duplicated
    // all-comments access (still reachable via the global Comments button) and
    // ate ~half the dialog height (noise-gate rule #8).

    // No always-on formatting toolbar. It added a persistent 8-button row that
    // roughly doubled the composer height, and an audit of all 27 comments in
    // the system (Brandon + Megan included) found zero use of bold/italic/lists.
    // The composer collapses to a single growing input + send, matching Linear /
    // Notion and the noise-gate rule that unused controls are guilty until
    // proven useful. Links still auto-linkify; Shift+Enter still breaks lines.
    // (enableFormatOptions intentionally NOT called.)

    // Enter submits the comment; Shift+Enter inserts a newline (paragraph break),
    // matching every other text input in the app.
    commentElement.enableEnterKeyToSubmit?.();

    // Targeting: use the nearest allowed stable container, not ephemeral child
    // nodes like table cells. That preserves dialog commenting without letting
    // pins attach to DOM that gets replaced on table re-renders.
    commentElement.allowedElementQuerySelectors?.(COMMENTABLE_SELECTORS);
    commentElement.commentToNearestAllowedElement?.(true);

    // A pin dropped inside an overlay loses its anchor when the overlay closes.
    // Ghost comments keep it addressable (with a visible indicator) instead of
    // silently vanishing — the "fail loudly" bar for overlay commenting.
    commentElement.enableGhostComments?.();
    commentElement.enableGhostCommentsIndicator?.();
  }, [client]);

  return null;
}

function VeltCommentDialogPolishController({ scope }: { scope: CommentScope }) {
  const commentElement = useCommentUtils();
  useEffect(() => {
    if (!commentElement) return;

    commentElement.setContextProvider(() => ({
      ...scope.context,
      submissionIntent:
        scope.channel === "site-feedback"
          ? "github_issue"
          : "comment",
    }));
    commentElement.enableContextInPageModeComposer?.();
  }, [commentElement, scope]);

  useEffect(
    () => observeVeltCommentDialogPolish(document),
    [],
  );
  return null;
}

function VeltFeedbackInboxBridge() {
  const addCommentEvent = useCommentEventCallback("addComment");
  const addCommentAnnotationEvent = useCommentEventCallback(
    "addCommentAnnotation",
  );
  const mirroredKeysRef = useRef(new Set<string>());

  useEffect(() => {
    const annotation = addCommentAnnotationEvent?.commentAnnotation;
    const firstComment = annotation?.comments?.[0];
    if (
      !annotation?.annotationId ||
      !firstComment?.commentId ||
      !firstComment.from?.userId
    ) {
      return;
    }

    const key = `annotation:${annotation.annotationId}:comment:${firstComment.commentId}`;
    if (mirroredKeysRef.current.has(key)) {
      return;
    }
    if (isDrawingCommentContext(annotation.context)) {
      return;
    }
    mirroredKeysRef.current.add(key);
    const createIssue = requestsGitHubIssue(annotation.context);

    void apiFetch<VeltFeedbackMirrorResponse>("/api/admin/feedback/velt", {
      method: "POST",
      body: JSON.stringify({
        annotationId: annotation.annotationId,
        commentId: firstComment.commentId,
        documentId: annotation.pageInfo?.path ?? window.location.pathname,
        pageUrl:
          annotation.pageInfo?.commentUrl ??
          annotation.pageInfo?.url ??
          window.location.href,
        pageTitle: annotation.pageInfo?.title ?? document.title,
        commentText: firstComment.commentText ?? null,
        commentHtml: firstComment.commentHtml ?? null,
        createdAt: firstComment.createdAt ?? annotation.createdAt ?? null,
        lastUpdated: firstComment.lastUpdated ?? annotation.lastUpdated ?? null,
        attachments: firstComment.attachments ?? [],
        author: {
          userId: firstComment.from?.userId ?? null,
          name: firstComment.from?.name ?? null,
          email: firstComment.from?.email ?? null,
        },
        taggedUsers: [
          ...(firstComment.taggedUserContacts ?? []).map(
            (entry) => entry.contact ?? {},
          ),
          ...(firstComment.to ?? []),
        ],
        targetElementId: annotation.targetElementId ?? null,
        targetElementPath: annotation.targetElement?.xpath ?? null,
        taggedElementPath: annotation.taggedElementPath ?? null,
        taggedElementRect: annotation.taggedElementRect ?? null,
        annotationContext:
          annotation.context && typeof annotation.context === "object"
            ? annotation.context
            : null,
        createIssue,
        source: "velt_comment_annotation",
      }),
    })
      .then((result) => reportMirrorResult(createIssue, result))
      .catch(reportMirrorFailure);
  }, [addCommentAnnotationEvent]);

  useEffect(() => {
    const annotation = addCommentEvent?.commentAnnotation;
    const comment = addCommentEvent?.comment;
    if (
      !annotation?.annotationId ||
      !comment?.commentId ||
      !comment.from?.userId
    ) {
      return;
    }

    const key = `annotation:${annotation.annotationId}:comment:${comment.commentId}`;
    if (mirroredKeysRef.current.has(key)) {
      return;
    }
    if (isDrawingCommentContext(annotation.context)) {
      return;
    }
    mirroredKeysRef.current.add(key);
    const createIssue =
      String(annotation.comments?.[0]?.commentId) ===
        String(comment.commentId) && requestsGitHubIssue(annotation.context);

    void apiFetch<VeltFeedbackMirrorResponse>("/api/admin/feedback/velt", {
      method: "POST",
      body: JSON.stringify({
        annotationId: annotation.annotationId,
        commentId: comment.commentId,
        documentId: annotation.pageInfo?.path ?? window.location.pathname,
        pageUrl:
          annotation.pageInfo?.commentUrl ??
          annotation.pageInfo?.url ??
          window.location.href,
        pageTitle: annotation.pageInfo?.title ?? document.title,
        commentText: comment.commentText ?? null,
        commentHtml: comment.commentHtml ?? null,
        createdAt: comment.createdAt ?? annotation.createdAt ?? null,
        lastUpdated: comment.lastUpdated ?? annotation.lastUpdated ?? null,
        attachments: comment.attachments ?? [],
        author: {
          userId: comment.from?.userId ?? null,
          name: comment.from?.name ?? null,
          email: comment.from?.email ?? null,
        },
        taggedUsers: [
          ...(comment.taggedUserContacts ?? []).map(
            (entry) => entry.contact ?? {},
          ),
          ...(comment.to ?? []),
        ],
        targetElementId: annotation.targetElementId ?? null,
        targetElementPath: annotation.targetElement?.xpath ?? null,
        taggedElementPath: annotation.taggedElementPath ?? null,
        taggedElementRect: annotation.taggedElementRect ?? null,
        annotationContext:
          annotation.context && typeof annotation.context === "object"
            ? annotation.context
            : null,
        createIssue,
        source: "velt_comment_reply",
      }),
    })
      .then((result) => reportMirrorResult(createIssue, result))
      .catch(reportMirrorFailure);
  }, [addCommentEvent]);

  return null;
}

function VeltCommentRestingStateController() {
  const commentElement = useCommentUtils();
  const commentModeActive = useCommentModeState();
  const addCommentEvent = useCommentEventCallback("addComment");
  const addCommentAnnotationEvent = useCommentEventCallback(
    "addCommentAnnotation",
  );
  const shouldCollapseAfterSubmitRef = useRef(false);
  const clearScopeOverride = useCommentScopeStore(
    (state) => state.clearScopeOverride,
  );
  const collapseVersionRef = useRef(0);
  const cleanupTimersRef = useRef<{
    collapse?: number;
    restoreHover?: number;
    forceCleanup?: number;
  }>({});

  const clearCleanupTimers = () => {
    const timers = cleanupTimersRef.current;
    if (timers.collapse) {
      window.clearTimeout(timers.collapse);
    }
    if (timers.restoreHover) {
      window.clearTimeout(timers.restoreHover);
    }
    if (timers.forceCleanup) {
      window.clearTimeout(timers.forceCleanup);
    }
    cleanupTimersRef.current = {};
  };

  const finishCollapse = (collapseVersion: number) => {
    if (collapseVersionRef.current !== collapseVersion) return;
    if (!commentElement) return;

    commentElement.selectCommentByAnnotationId?.();
    commentElement.clearPageModeComposerContext?.();
    commentElement.disableCommentMode?.();
    commentElement.enableDialogOnHover?.();
    clearScopeOverride();
    shouldCollapseAfterSubmitRef.current = false;
    clearCleanupTimers();
  };

  useEffect(() => {
    if (addCommentEvent || addCommentAnnotationEvent) {
      shouldCollapseAfterSubmitRef.current = true;
    }
  }, [addCommentAnnotationEvent, addCommentEvent]);

  useEffect(() => {
    if (!commentElement || commentModeActive !== false) return;
    if (!shouldCollapseAfterSubmitRef.current) return;

    clearCleanupTimers();
    shouldCollapseAfterSubmitRef.current = false;
    collapseVersionRef.current += 1;
    const collapseVersion = collapseVersionRef.current;

    commentElement.disableDialogOnHover?.();

    cleanupTimersRef.current.collapse = window.setTimeout(() => {
      finishCollapse(collapseVersion);
    }, 80);

    cleanupTimersRef.current.restoreHover = window.setTimeout(() => {
      if (collapseVersionRef.current !== collapseVersion) return;
      commentElement.enableDialogOnHover?.();
    }, 900);

    cleanupTimersRef.current.forceCleanup = window.setTimeout(() => {
      finishCollapse(collapseVersion);
    }, 1500);

    return clearCleanupTimers;
  }, [commentElement, commentModeActive]);

  return null;
}

export function VeltGlobalLayer() {
  const rawPathname = usePathname();
  const pathname = rawPathname ?? "/";
  const commentsVisible = useCommentsVisibilityStore((state) => state.visible);
  const scopeOverride = useCommentScopeStore((state) => state.scopeOverride);
  const clearScopeOverride = useCommentScopeStore(
    (state) => state.clearScopeOverride,
  );
  const defaultScope = useMemo(
    () => getDefaultCommentScope(pathname),
    [pathname],
  );
  const activeScope =
    scopeOverride?.routePath === pathname ? scopeOverride : defaultScope;
  const suppressGlobalPageComments = isDrawingCollectionRoute(pathname);

  // Keep one canonical Velt document owner. Drawing routes use their route
  // document; header feedback temporarily switches to its namespaced document.
  useSetDocument(activeScope.documentId, {
    documentName: activeScope.documentName,
  });

  useEffect(() => {
    if (scopeOverride && scopeOverride.routePath !== pathname) {
      clearScopeOverride();
    }
  }, [clearScopeOverride, pathname, scopeOverride]);

  useEffect(() => observeMalformedVeltAnnotations(document), []);

  // When the user hides comments, unmount the entire visual layer — comment
  // pins and floating comment UI — so the page content is unobstructed. The
  // feedback bridge stays mounted because entity-scoped comment surfaces (for
  // example the drawings side-panel discussion) still submit Velt events even
  // when the global page comment layer is hidden, and those events must
  // continue mirroring into the feedback inbox / optional GitHub issue flow.
  if (!commentsVisible || suppressGlobalPageComments) {
    return <VeltFeedbackInboxBridge />;
  }

  return (
    <>
      <VeltFeedbackInboxBridge />
      <VeltCommentConfiguration />
      <VeltCommentDialogPolishController scope={activeScope} />
      <VeltCommentRestingStateController />
      <VeltComments
        shadowDom={false}
        textMode={false}
        bubbleOnPinHover
        collapsedComments
        dialogOnHover
        attachments
        reactions={false}
        dialogShadowDom={false}
        commentIndex={false}
        visibilityOptions={false}
        priority={false}
        ghostComments
        ghostCommentsIndicator
        attachmentNameInMessage
        allowedElementIds={["app-main-content"]}
        allowedElementQuerySelectors={COMMENTABLE_SELECTORS}
        commentToNearestAllowedElement
      />
      {activeScope.channel === "site-feedback" ? (
        <VeltCommentsSidebar groupConfig={{ enable: false }} shadowDom={false} />
      ) : null}
    </>
  );
}

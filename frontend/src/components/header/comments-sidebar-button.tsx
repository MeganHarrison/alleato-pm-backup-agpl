"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  MessageSquare,
  Plus,
  SendHorizontal,
} from "lucide-react";
import {
  useCommentModeState,
  useCommentUtils,
  useVeltClient,
} from "@veltdev/react";
import useSWR from "swr";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  SidePanel,
  SidePanelBody,
  SidePanelContent,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle,
} from "@/components/ui/side-panel";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { AllCommentItem } from "@/app/api/comments/all/route";
import {
  cleanCommentPreview,
  relativeTimeLabel,
  sortComments,
} from "@/app/(main)/comments/comments-page-utils";
import { apiFetch } from "@/lib/api-client";
import { shouldForceCollaborationRuntime } from "@/lib/performance/runtime-gates";
import { useCollaborationRuntimeStore } from "@/lib/stores/collaboration-runtime-store";
import { useCommentsVisibilityStore } from "@/lib/stores/comments-visibility-store";
import { useCommentScopeStore } from "@/lib/stores/comment-scope-store";
import { getSiteFeedbackCommentScope } from "@/lib/comments/comment-scope";
import { cn } from "@/lib/utils";

type CommentSubmissionIntent = "comment" | "github_issue";

function useCommentSummary() {
  const { data } = useSWR<{ comments: AllCommentItem[] }>(
    "/api/comments/all",
    (url: string) => apiFetch<{ comments: AllCommentItem[] }>(url),
    { revalidateOnFocus: false },
  );

  return React.useMemo(() => {
    const comments = [...(data?.comments ?? [])].sort(sortComments);
    return { comments };
  }, [data?.comments]);
}

function initials(name: string): string {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "C"
  );
}

type CommentIconButtonProps = React.ComponentProps<typeof Button> & {
  active?: boolean;
  expanded?: boolean;
};

const CommentIconButton = React.forwardRef<
  HTMLButtonElement,
  CommentIconButtonProps
>(function CommentIconButton({ active, expanded, className, ...props }, ref) {
  return (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Discussion"
      aria-pressed={active ? "true" : "false"}
      aria-expanded={expanded}
      aria-haspopup="dialog"
      {...props}
      className={cn(
        "relative h-8 w-8",
        active
          ? "text-foreground hover:bg-accent hover:text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      <MessageSquare className="h-4 w-4" />
    </Button>
  );
});

function SiteCommentsLink({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex items-center justify-center">
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href="/comments"
            onClick={onNavigate}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            View all comments
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-56">
          Listing of all comments throughout the site.
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function CommentsSidebarButton() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const collaborationRuntimeEnabled = useCollaborationRuntimeStore(
    (state) => state.enabled,
  );
  const setCollaborationRuntimeEnabled = useCollaborationRuntimeStore(
    (state) => state.setEnabled,
  );
  const collaborationRuntimeActive =
    collaborationRuntimeEnabled || shouldForceCollaborationRuntime(pathname);
  const commentsVisible = useCommentsVisibilityStore((state) => state.visible);
  const setCommentsVisible = useCommentsVisibilityStore(
    (state) => state.setVisible,
  );
  const [pendingCommentMode, setPendingCommentMode] =
    React.useState<CommentSubmissionIntent | null>(null);
  const [pageSheetOpen, setPageSheetOpen] = React.useState(false);
  const [focusedAnnotationId, setFocusedAnnotationId] = React.useState<
    string | null
  >(null);
  const summary = useCommentSummary();
  const pageComments = React.useMemo(
    () =>
      summary.comments.filter((comment) => {
        if (!pathname) return false;
        return comment.documentId === pathname;
      }),
    [pathname, summary.comments],
  );

  const openPageDiscussion = React.useCallback(() => {
    window.setTimeout(() => {
      setPageSheetOpen(true);
    }, 120);
  }, []);

  React.useEffect(() => {
    if (!searchParams || !pathname) {
      return;
    }

    const requestedDiscussionId = searchParams.get("discussion");
    if (!requestedDiscussionId) {
      return;
    }

    setFocusedAnnotationId(requestedDiscussionId);
    setCommentsVisible(true);
    openPageDiscussion();

    const params = new URLSearchParams(searchParams.toString());
    params.delete("discussion");
    const nextUrl = params.toString()
      ? `${pathname}?${params.toString()}`
      : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [openPageDiscussion, pathname, router, searchParams, setCommentsVisible]);

  return (
    <>
      <ActiveCommentsSidebarButton
        collaborationRuntimeActive={collaborationRuntimeActive}
        startCommentOnMount={pendingCommentMode}
        onCommentModeStarted={() => setPendingCommentMode(null)}
        onRequestCommentMode={(intent) => {
          setCollaborationRuntimeEnabled(true);
          setCommentsVisible(true);
          setPendingCommentMode(intent);
        }}
        onOpenPageSheet={() => {
          setCommentsVisible(true);
          openPageDiscussion();
        }}
      />
      <PageDiscussionSheet
        open={pageSheetOpen}
        onOpenChange={(nextOpen) => {
          setPageSheetOpen(nextOpen);
          if (!nextOpen) {
            setFocusedAnnotationId(null);
          }
        }}
        comments={pageComments}
        focusedAnnotationId={focusedAnnotationId}
        onAddComment={() => {
          setPageSheetOpen(false);
          if (!collaborationRuntimeActive) {
            setCollaborationRuntimeEnabled(true);
          }
          setCommentsVisible(true);
          setPendingCommentMode("github_issue");
        }}
      />
    </>
  );
}

function ActiveCommentsSidebarButton({
  collaborationRuntimeActive,
  startCommentOnMount,
  onCommentModeStarted,
  onRequestCommentMode,
  onOpenPageSheet,
}: {
  collaborationRuntimeActive: boolean;
  startCommentOnMount?: CommentSubmissionIntent | null;
  onCommentModeStarted?: () => void;
  onRequestCommentMode: (intent: CommentSubmissionIntent) => void;
  onOpenPageSheet: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const commentModeActive = useCommentModeState();
  const commentElement = useCommentUtils();
  const { client: veltClient } = useVeltClient();
  const pathname = usePathname() ?? "/";
  const setScopeOverride = useCommentScopeStore(
    (state) => state.setScopeOverride,
  );
  const clearScopeOverride = useCommentScopeStore(
    (state) => state.clearScopeOverride,
  );
  const commentsVisible = useCommentsVisibilityStore((state) => state.visible);
  const setCommentsVisible = useCommentsVisibilityStore(
    (state) => state.setVisible,
  );
  const setPageCommentsVisible = React.useCallback(
    (nextVisible: boolean) => {
      setCommentsVisible(nextVisible);

      if (!commentElement) return;

      if (nextVisible) {
        commentElement.showCommentsOnDom();
        return;
      }

      commentElement.selectCommentByAnnotationId();
      commentElement.closeCommentSidebar();
      commentElement.disableCommentMode();
      commentElement.hideCommentsOnDom();
      clearScopeOverride();
    },
    [clearScopeOverride, commentElement, setCommentsVisible],
  );
  const handleOpenDiscussion = React.useCallback(() => {
    setOpen(false);
    onOpenPageSheet();
  }, [onOpenPageSheet]);
  const activateCommentMode = React.useCallback(
    async (intent: CommentSubmissionIntent) => {
      if (!commentElement || !veltClient) return false;

      const scope = getSiteFeedbackCommentScope(pathname);
      try {
        setScopeOverride(scope);
        await veltClient.setDocument(scope.documentId, {
          documentName: scope.documentName,
        });
      } catch (scopeError) {
        console.error("[site-feedback] failed to activate feedback scope", scopeError);
        clearScopeOverride();
        toast.error("Page feedback could not be activated.", {
          description: "No feedback comment was started. Try again or reload the page.",
        });
        return false;
      }

      commentElement.setContextProvider(() => ({
        ...scope.context,
        submissionIntent: intent,
      }));
      commentElement.enableContextInPageModeComposer?.();
      commentElement.enableCommentMode();

      return true;
    },
    [
      clearScopeOverride,
      commentElement,
      pathname,
      setScopeOverride,
      veltClient,
    ],
  );
  const startCommentMode = React.useCallback(
    async (intent: CommentSubmissionIntent) => {
      setOpen(false);
      if (!collaborationRuntimeActive) {
        onRequestCommentMode(intent);
        return;
      }

      setPageCommentsVisible(true);
      if (!(await activateCommentMode(intent))) {
        onRequestCommentMode(intent);
      }
    },
    [
      activateCommentMode,
      collaborationRuntimeActive,
      onRequestCommentMode,
      setPageCommentsVisible,
    ],
  );

  React.useEffect(() => {
    if (commentModeActive) setOpen(false);
  }, [commentModeActive]);

  React.useEffect(() => {
    if (!startCommentOnMount || commentModeActive || !commentElement) return;

    const frame = window.requestAnimationFrame(() => {
      void activateCommentMode(startCommentOnMount).then((activated) => {
        if (activated) onCommentModeStarted?.();
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    activateCommentMode,
    commentElement,
    commentModeActive,
    onCommentModeStarted,
    startCommentOnMount,
  ]);

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <CommentIconButton
            active={commentModeActive}
            expanded={open}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className="w-56">
          <DropdownMenuItem onSelect={() => void startCommentMode("github_issue")}>
            <Plus className="h-4 w-4" />
            Add Comment
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleOpenDiscussion}
            onSelect={(event) => {
              event.preventDefault();
              handleOpenDiscussion();
            }}
          >
            <MessageSquare className="h-4 w-4" />
            Page Comments
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              setOpen(false);
              setPageCommentsVisible(!commentsVisible);
            }}
          >
            {commentsVisible ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            {commentsVisible ? "Hide Comments" : "View Comments"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export function PageDiscussionSheet({
  open,
  onOpenChange,
  comments,
  focusedAnnotationId,
  onAddComment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comments: AllCommentItem[];
  focusedAnnotationId?: string | null;
  onAddComment: () => void;
}) {
  const orderedComments = React.useMemo(() => {
    return [...comments].sort((left, right) => {
      if (left.annotationId === focusedAnnotationId) return -1;
      if (right.annotationId === focusedAnnotationId) return 1;
      return (right.lastUpdated ?? 0) - (left.lastUpdated ?? 0);
    });
  }, [comments, focusedAnnotationId]);

  return (
    <SidePanel open={open} onOpenChange={onOpenChange}>
      <SidePanelContent side="right" size="compact">
        <SidePanelHeader className="text-left">
          <SidePanelTitle>Comments</SidePanelTitle>
        </SidePanelHeader>
        <div className="flex h-full flex-col">
          <SidePanelBody className="px-4 py-2">
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No page discussion yet.
              </p>
            ) : (
              <div className="space-y-4">
                {orderedComments.map((comment) => (
                  <div
                    key={comment.annotationId}
                    className="py-1"
                  >
                    <div
                      className={cn(
                        "rounded-md px-2 py-1.5",
                        comment.annotationId === focusedAnnotationId &&
                          "bg-muted/40",
                      )}
                    >
                      <div className="space-y-2.5">
                        {(comment.messages.length > 0
                          ? comment.messages
                          : [
                              {
                                commentId: `${comment.annotationId}:preview`,
                                authorName: comment.authorName,
                                text: comment.preview,
                                createdAt: comment.lastUpdated,
                              },
                            ]
                        ).map((message) => (
                          <div key={message.commentId} className="flex gap-2.5">
                            <Avatar className="mt-0.5 h-6 w-6 shrink-0">
                              <AvatarFallback className="bg-muted text-[9px] font-medium text-muted-foreground">
                                {initials(message.authorName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-xs font-medium text-foreground">
                                  {message.authorName}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {relativeTimeLabel(message.createdAt)}
                                </span>
                                {comment.annotationId === focusedAnnotationId ? (
                                  <span className="text-[10px] font-medium text-primary">
                                    Opened from notification
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-0.5 whitespace-pre-wrap text-xs leading-5 text-foreground">
                                {cleanCommentPreview(message.text)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SidePanelBody>
          <SidePanelFooter className="px-4 py-3">
            <div className="flex w-full flex-col gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={onAddComment}
                className="group h-auto w-full justify-between rounded-full border border-border bg-background px-4 py-2.5 hover:bg-muted/40"
              >
                <span className="text-sm text-muted-foreground">
                  Reply on page
                </span>
                <span className="inline-flex h-7 w-7 items-center justify-center text-muted-foreground transition-colors group-hover:text-foreground">
                  <SendHorizontal className="h-4 w-4" />
                </span>
              </Button>
              <SiteCommentsLink />
            </div>
          </SidePanelFooter>
        </div>
      </SidePanelContent>
    </SidePanel>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Inbox,
  MessageCircle,
  PanelLeft,
} from "lucide-react";
import useSWR from "swr";

import { apiFetch } from "@/lib/api-client";
import type { AllCommentItem } from "@/app/api/comments/all/route";
import { EmptyState, ErrorState } from "@/components/ds";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  SplitPage,
  SplitPageFrame,
  useSplitPage,
} from "@/components/ui/split-page";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { cn } from "@/lib/utils";
import {
  cleanCommentPreview,
  type CommentScope,
  documentLabel,
  filterComments,
  isResolved,
  matchesCurrentUser,
  relativeTimeLabel,
  sanitizeComments,
  scopeLabels,
  sortComments,
  statusLabel,
  timeLabel,
} from "@/app/(main)/comments/comments-page-utils";
import { createClient } from "@/lib/supabase/client";
import { getCurrentBrowserUser } from "@/lib/supabase/current-user";

const PRIMARY_SCOPES: CommentScope[] = ["all", "mine", "mentions", "unresolved"];
const SECONDARY_SCOPES: CommentScope[] = ["resolved"];

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

function CommentsListPane({
  comments,
  selectedComment,
  scope,
  scopeCounts,
  query,
  currentUserName,
  onQueryChange,
  onScopeChange,
  onSelect,
}: {
  comments: AllCommentItem[];
  selectedComment: AllCommentItem | null;
  scope: CommentScope;
  scopeCounts: Record<CommentScope, number>;
  query: string;
  currentUserName: string | null;
  onQueryChange: (value: string) => void;
  onScopeChange: (scope: CommentScope) => void;
  onSelect: (comment: AllCommentItem) => void;
}) {
  const { isDesktop, onClose } = useSplitPage();

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="space-y-4 px-5 py-4">
        <div className="min-w-0">
          <SectionRuleHeading label="Discussion" className="mb-1 pb-0" />
          <p className="mt-1 text-sm text-muted-foreground">
            {comments.length} visible threads
          </p>
        </div>

        <div className="mt-4">
          <ExpandableSearch
            value={query}
            onChange={onQueryChange}
            placeholder="Search comments"
            ariaLabel="Search comments"
            defaultExpanded
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {PRIMARY_SCOPES.map((value) => (
            <Button
              key={value}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onScopeChange(value)}
              className={cn(
                "h-8 rounded-full px-3 text-xs font-medium",
                scope === value
                  ? "bg-foreground text-background hover:bg-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {scopeLabels[value]}
              <span
                className={cn(
                  "ml-1 text-[11px]",
                  scope === value ? "text-background/70" : "text-muted-foreground",
                )}
              >
                {scopeCounts[value]}
              </span>
            </Button>
          ))}
          {SECONDARY_SCOPES.map((value) => (
            <Button
              key={value}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onScopeChange(value)}
              className={cn(
                "h-8 rounded-full px-3 text-xs font-medium",
                scope === value
                  ? "bg-muted text-foreground hover:bg-muted"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {scopeLabels[value]}
              <span className="ml-1 text-[11px] text-muted-foreground">
                {scopeCounts[value]}
              </span>
            </Button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {comments.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            No matching comments.
          </div>
        ) : (
          comments.map((comment) => {
            const selected = selectedComment?.annotationId === comment.annotationId;

            return (
              <Button
                key={comment.annotationId}
                type="button"
                onClick={() => {
                  onSelect(comment);
                  if (!isDesktop) onClose();
                }}
                variant="ghost"
                className={cn(
                  "h-auto w-full justify-start rounded-none px-5 py-4 text-left font-normal transition-colors",
                  selected ? "bg-muted/50 hover:bg-muted/50" : "hover:bg-muted/30",
                )}
              >
                <span
                  className={cn(
                    "mt-1 h-2 w-2 shrink-0 rounded-full",
                    isResolved(comment)
                      ? "bg-border"
                      : matchesCurrentUser(comment, currentUserName)
                        ? "bg-primary/65"
                        : "bg-foreground/40",
                  )}
                />
                <Avatar className="mt-0.5 h-6 w-6 shrink-0">
                  <AvatarFallback className="bg-muted text-[10px] font-semibold text-foreground">
                    {initials(comment.authorName)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                      {comment.authorName}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {relativeTimeLabel(comment.lastUpdated)}
                    </span>
                  </span>
                  <span className="mt-1 block line-clamp-2 text-sm text-foreground">
                    {cleanCommentPreview(comment.preview)}
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>{documentLabel(comment.documentId)}</span>
                    {!isResolved(comment) ? <span>{statusLabel(comment)}</span> : null}
                    {comment.replyCount > 0 ? (
                      <span>
                        {comment.replyCount}{" "}
                        {comment.replyCount === 1 ? "reply" : "replies"}
                      </span>
                    ) : null}
                  </span>
                </span>
              </Button>
            );
          })
        )}
      </div>
    </div>
  );
}

function CommentsDetailWorkspace({
  selectedComment,
  total,
}: {
  selectedComment: AllCommentItem | null;
  total: number;
}) {
  const { isDesktop, onOpen } = useSplitPage();

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="space-y-4 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              {!isDesktop ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onOpen}
                  className="-ml-2 h-8 w-8 text-muted-foreground"
                  aria-label="Open comments list"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              ) : (
                <PanelLeft className="mt-1 h-4 w-4 text-muted-foreground" />
              )}
              <div className="min-w-0">
                <SectionRuleHeading label="Discussion" className="mb-1 pb-0" />
                <p className="truncate text-sm text-muted-foreground">
                  {selectedComment
                    ? `${selectedComment.authorName} · ${documentLabel(selectedComment.documentId)}`
                    : `${total} comments across Alleato`}
                </p>
              </div>
            </div>
          </div>

          {selectedComment?.documentId.startsWith("/") ? (
            <Button asChild size="sm">
              <Link href={selectedComment.documentId}>
                Open source
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {selectedComment ? (
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-8 lg:px-10">
            <section className="space-y-5">
              <div className="flex items-start gap-3">
                <Avatar className="mt-0.5 h-7 w-7 shrink-0">
                  <AvatarFallback className="bg-muted text-[10px] font-semibold text-foreground">
                    {initials(selectedComment.authorName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-1">
                  <p className="text-base font-semibold text-foreground">
                    {selectedComment.authorName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {timeLabel(selectedComment.lastUpdated) || "Unknown update time"}
                  </p>
                </div>
              </div>

              <div className="max-w-3xl whitespace-pre-wrap text-sm leading-7 text-foreground">
                {cleanCommentPreview(selectedComment.preview)}
              </div>
            </section>

            <section className="border-t border-border/60 pt-6 text-sm sm:flex sm:flex-wrap sm:gap-10">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Status
                </p>
                <p className="text-foreground">{statusLabel(selectedComment)}</p>
              </div>

              <div className="mt-6 space-y-1 sm:mt-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Replies
                </p>
                <p className="text-foreground">{selectedComment.replyCount}</p>
              </div>

              <div className="mt-6 space-y-1 sm:mt-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Source
                </p>
                <p className="break-words text-foreground">
                  {documentLabel(selectedComment.documentId)}
                </p>
              </div>
            </section>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-6">
            <EmptyState
              icon={<Inbox className="h-6 w-6" />}
              title="Select a comment"
              description="Choose a thread from the left rail to inspect details and open the source page."
            />
          </div>
        )}
      </div>
    </div>
  );
}

function CommentsPageLoadingState() {
  return <div className="h-svh w-full bg-background" />;
}

function CommentsPageErrorState({
  onRetry,
}: {
  onRetry: () => void;
}) {
  return (
    <div className="flex h-svh w-full items-center justify-center bg-background p-6">
      <ErrorState
        title="Couldn't load comments"
        description="The comments service did not respond. Try again in a moment."
        onRetry={onRetry}
      />
    </div>
  );
}

function CommentsPageEmptyState() {
  return (
    <div className="flex h-svh w-full items-center justify-center bg-background p-6">
      <EmptyState
        icon={<MessageCircle className="h-6 w-6" />}
        title="No discussion yet."
        description="Add the first comment."
      />
    </div>
  );
}

export function CommentsSplitPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [currentUserName, setCurrentUserName] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const scopeParam = searchParams.get("scope");
  const query = searchParams.get("q") ?? "";
  const scope = React.useMemo<CommentScope>(() => {
    return (Object.keys(scopeLabels) as CommentScope[]).includes(
      scopeParam as CommentScope,
    )
      ? (scopeParam as CommentScope)
      : "unresolved";
  }, [scopeParam]);

  const { data, error, isLoading, mutate } = useSWR<{ comments: AllCommentItem[] }>(
    "/api/comments/all",
    (url: string) => apiFetch<{ comments: AllCommentItem[] }>(url),
  );

  React.useEffect(() => {
    let active = true;

    const loadCurrentUser = async () => {
      try {
        const supabase = createClient();
        const user = await getCurrentBrowserUser(supabase);
        if (!active) return;

        setCurrentUserName(
          user?.user_metadata?.full_name ??
            user?.user_metadata?.name ??
            user?.email ??
            null,
        );
      } catch {
        if (active) setCurrentUserName(null);
      }
    };

    void loadCurrentUser();
    return () => {
      active = false;
    };
  }, []);

  const comments = React.useMemo(() => {
    const rows = sanitizeComments(data?.comments ?? []);
    return [...rows].sort(sortComments);
  }, [data]);

  const filteredComments = React.useMemo(() => {
    return filterComments(comments, scope, query, currentUserName);
  }, [comments, currentUserName, query, scope]);

  const updateUrlState = React.useCallback(
    (next: { scope?: CommentScope; query?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      const nextScope = next.scope ?? scope;
      const nextQuery = next.query ?? query;

      if (nextScope === "unresolved") {
        params.delete("scope");
      } else {
        params.set("scope", nextScope);
      }

      if (nextQuery.trim()) {
        params.set("q", nextQuery.trim());
      } else {
        params.delete("q");
      }

      const nextUrl = params.toString()
        ? `${pathname}?${params.toString()}`
        : pathname;
      router.replace(nextUrl, { scroll: false });
    },
    [pathname, query, router, scope, searchParams],
  );

  React.useEffect(() => {
    if (!selectedId && filteredComments.length > 0) {
      setSelectedId(filteredComments[0]?.annotationId ?? null);
      return;
    }

    if (
      selectedId &&
      !filteredComments.some((comment) => comment.annotationId === selectedId)
    ) {
      setSelectedId(filteredComments[0]?.annotationId ?? null);
    }
  }, [filteredComments, selectedId]);

  const selectedComment =
    filteredComments.find((comment) => comment.annotationId === selectedId) ?? null;

  const total = comments.length;
  const unresolvedCount = comments.filter((comment) => !isResolved(comment)).length;
  const resolvedCount = total - unresolvedCount;
  const mineCount = comments.filter((comment) =>
    matchesCurrentUser(comment, currentUserName),
  ).length;
  const mentionCount = filterComments(
    comments,
    "mentions",
    "",
    currentUserName,
  ).length;

  const scopeCounts: Record<CommentScope, number> = {
    unresolved: unresolvedCount,
    all: total,
    mine: mineCount,
    mentions: mentionCount,
    resolved: resolvedCount,
  };

  if (isLoading) {
    return <CommentsPageLoadingState />;
  }

  if (error) {
    return <CommentsPageErrorState onRetry={() => void mutate()} />;
  }

  if (total === 0) {
    return <CommentsPageEmptyState />;
  }

  return (
    <SplitPageFrame height="viewport" className="bg-background">
      <SplitPage
        breakpoint="lg"
        defaultIsOpen
        className="min-h-0 flex-1"
        firstPaneClassName="w-full lg:w-[25rem] lg:border-r lg:border-border/60"
      >
        <CommentsListPane
          comments={filteredComments}
          selectedComment={selectedComment}
          scope={scope}
          scopeCounts={scopeCounts}
          query={query}
          currentUserName={currentUserName}
          onQueryChange={(value) => updateUrlState({ query: value })}
          onScopeChange={(value) => updateUrlState({ scope: value })}
          onSelect={(comment) => setSelectedId(comment.annotationId)}
        />
        <CommentsDetailWorkspace selectedComment={selectedComment} total={total} />
      </SplitPage>
    </SplitPageFrame>
  );
}

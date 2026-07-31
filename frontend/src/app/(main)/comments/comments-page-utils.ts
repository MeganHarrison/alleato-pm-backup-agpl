import type { AllCommentItem } from "@/app/api/comments/all/route";

export type CommentScope =
  | "unresolved"
  | "all"
  | "mine"
  | "mentions"
  | "resolved";

const EXCLUDED_COMMENT_IDS = new Set([
  "8e0a5ed8-750b-49f1-9aa6-bbc01f634074",
]);

export const scopeLabels: Record<CommentScope, string> = {
  unresolved: "Unresolved",
  all: "All",
  mine: "Mine",
  mentions: "Mentions",
  resolved: "Resolved",
};

export function documentLabel(documentId: string): string {
  if (!documentId || documentId === "/") return "Home";
  return documentId.replace(/^\//, "").replace(/\//g, " / ");
}

export function cleanCommentPreview(preview: string): string {
  const cleaned = preview
    .replace(/\{\{[^}]+\}\}/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "(no text)";
}

export function timeLabel(ms: number | null): string {
  if (!ms) return "";
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function relativeTimeLabel(ms: number | null, now = Date.now()): string {
  if (!ms) return "Unknown";
  const diff = now - ms;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 2) return "Yesterday";
  if (days < 7) {
    return new Date(ms).toLocaleDateString(undefined, { weekday: "short" });
  }
  return timeLabel(ms);
}

export function isResolved(comment: AllCommentItem): boolean {
  return /resolved|closed|done/i.test(comment.statusName ?? "");
}

export function statusLabel(comment: AllCommentItem): string {
  return comment.statusName || "Open";
}

export function matchesCurrentUser(
  comment: AllCommentItem,
  currentUserName?: string | null,
): boolean {
  const normalized = currentUserName?.trim().toLowerCase();
  if (!normalized) return false;

  const author = comment.authorName.trim().toLowerCase();
  if (author === normalized) return true;

  const parts = normalized.split(/\s+/).filter(Boolean);
  return parts.length > 0 && parts.every((part) => author.includes(part));
}

export function matchesMention(
  comment: AllCommentItem,
  currentUserName?: string | null,
): boolean {
  const normalized = currentUserName?.trim();
  if (!normalized) return false;

  const parts = normalized.split(/\s+/).filter(Boolean);
  const haystack = cleanCommentPreview(comment.preview).toLowerCase();

  return (
    haystack.includes(`@${normalized.toLowerCase()}`) ||
    parts.some((part) => haystack.includes(`@${part.toLowerCase()}`))
  );
}

export function matchesSearch(comment: AllCommentItem, query: string): boolean {
  if (!query) return true;
  const haystack = [
    comment.authorName,
    cleanCommentPreview(comment.preview),
    comment.statusName,
    comment.documentId,
    documentLabel(comment.documentId),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function commentPriority(comment: AllCommentItem): number {
  return isResolved(comment) ? 1 : 0;
}

export function sortComments(a: AllCommentItem, b: AllCommentItem): number {
  return (
    commentPriority(a) - commentPriority(b) ||
    (b.lastUpdated ?? 0) - (a.lastUpdated ?? 0) ||
    documentLabel(a.documentId).localeCompare(documentLabel(b.documentId))
  );
}

export function filterComments(
  comments: AllCommentItem[],
  scope: CommentScope,
  query: string,
  currentUserName?: string | null,
): AllCommentItem[] {
  return comments.filter((comment) => {
    if (scope === "unresolved" && isResolved(comment)) return false;
    if (scope === "resolved" && !isResolved(comment)) return false;
    if (scope === "mine" && !matchesCurrentUser(comment, currentUserName)) {
      return false;
    }
    if (scope === "mentions" && !matchesMention(comment, currentUserName)) {
      return false;
    }
    return matchesSearch(comment, query.trim());
  });
}

export function sanitizeComments(comments: AllCommentItem[]): AllCommentItem[] {
  return comments.filter(
    (comment) => !EXCLUDED_COMMENT_IDS.has(comment.annotationId),
  );
}

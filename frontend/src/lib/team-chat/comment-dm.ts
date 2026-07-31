import { documentLabel, cleanCommentPreview } from "@/app/(main)/comments/comments-page-utils";
import type { AllCommentItem } from "@/lib/comments/all-comments";

export const COMMENT_INBOX_CHANNEL_ID = "comments-inbox";

export interface CommentInboxMessage {
  id: string;
  channel_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

export interface CommentInboxChannel {
  id: string;
  name: string;
  topic: string;
  team: string;
  section: "dm";
  unread: number;
  memberCount: number;
  preview: string;
  lastMessageAt: string | null;
  deletable: false;
  isDm: true;
  dmPartnerId: null;
  dmPartnerName: null;
  source: "comments";
  readOnly: true;
}

function latestCommentTimestamp(comment: AllCommentItem): number {
  const latestMessage = [...comment.messages].sort(
    (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0),
  ).at(-1);

  return latestMessage?.createdAt ?? comment.lastUpdated ?? 0;
}

function latestCommentMessage(comment: AllCommentItem) {
  return [...comment.messages].sort(
    (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0),
  ).at(-1);
}

export function buildCommentInboxChannel(
  comments: AllCommentItem[],
  options?: { unavailable?: boolean },
): CommentInboxChannel {
  const sorted = [...comments].sort(
    (a, b) => latestCommentTimestamp(a) - latestCommentTimestamp(b),
  );
  const latestComment = sorted.at(-1);
  const latestMessage = latestComment ? latestCommentMessage(latestComment) : null;
  const uniqueAuthors = new Set(
    comments
      .map((comment) => comment.authorName.trim())
      .filter(Boolean),
  );

  return {
    id: COMMENT_INBOX_CHANNEL_ID,
    name: "Comments inbox",
    topic: "Recent Velt page comments",
    team: "Comments",
    section: "dm",
    unread: 0,
    memberCount: Math.max(uniqueAuthors.size, comments.length > 0 ? 1 : 0),
    preview: latestComment
      ? cleanCommentPreview(latestMessage?.text ?? latestComment.preview)
      : options?.unavailable
        ? "Comments unavailable right now."
        : "No comment activity yet.",
    lastMessageAt: latestComment
      ? new Date(latestCommentTimestamp(latestComment)).toISOString()
      : null,
    deletable: false,
    isDm: true,
    dmPartnerId: null,
    dmPartnerName: null,
    source: "comments",
    readOnly: true,
  };
}

export function buildCommentInboxMessages(
  comments: AllCommentItem[],
): CommentInboxMessage[] {
  return [...comments]
    .sort((a, b) => latestCommentTimestamp(a) - latestCommentTimestamp(b))
    .map((comment) => {
      const latestMessage = latestCommentMessage(comment);
      const timestamp = latestMessage?.createdAt ?? comment.lastUpdated ?? 0;
      const authorName = latestMessage?.authorName ?? comment.authorName;
      const text = cleanCommentPreview(latestMessage?.text ?? comment.preview);
      const source = documentLabel(comment.documentId);

      return {
        id: `comment:${comment.annotationId}`,
        channel_id: COMMENT_INBOX_CHANNEL_ID,
        user_name: authorName,
        content: source ? `${text} · ${source}` : text,
        created_at: new Date(timestamp).toISOString(),
      };
    });
}

export function isCommentInboxChannel(channelId: string | null | undefined): boolean {
  return channelId === COMMENT_INBOX_CHANNEL_ID;
}

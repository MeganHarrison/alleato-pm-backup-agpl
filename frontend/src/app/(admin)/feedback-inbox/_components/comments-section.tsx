"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { ChevronDown, ChevronUp, Loader2, Send, XCircle } from "lucide-react";
import { Button, Textarea } from "@/components/ds";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { appToast as toast } from "@/lib/toast/app-toast";

import type { FeedbackComment, UserProfile } from "../types";
import {
  displayName,
  extractMentionIds,
  getInitials,
  notifyFeedbackInboxFailure,
  relativeTime,
} from "../helpers";

type PendingImage = {
  id: string;
  dataUrl: string;
  name: string;
};

const MAX_COMMENT_IMAGES = 8;

function CommentInput({
  onSubmit,
  users,
  submitting,
  inputRef: externalInputRef,
}: {
  onSubmit: (
    body: string,
    mentions: string[],
    screenshotDataUrls: string[],
  ) => void;
  users: UserProfile[];
  submitting: boolean;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const [value, setValue] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [attachedImages, setAttachedImages] = useState<PendingImage[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const localInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef ?? localInputRef;

  function attachImageFile(
    file: File,
    source: "file-picker" | "paste" | "drop",
  ) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB.");
      return false;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAttachedImages((current) => [
          ...current,
          {
            id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
            dataUrl: reader.result as string,
            name: file.name,
          },
        ]);
      }
    };
    reader.onerror = () => {
      const error =
        reader.error ??
        new Error("The browser could not read the selected image file.");
      notifyFeedbackInboxFailure({
        operation: "read-comment-screenshot",
        title: "Could not read image file",
        fallback: "The selected feedback comment screenshot could not be read.",
        error,
        metadata: {
          source,
          fileName: file.name,
          fileSize: file.size,
        },
      });
    };
    reader.readAsDataURL(file);
    return true;
  }

  function attachImageFiles(
    files: Iterable<File>,
    source: "file-picker" | "paste" | "drop",
  ) {
    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );

    if (imageFiles.length === 0) {
      toast.error("Please select an image file.");
      return;
    }

    const remainingSlots = MAX_COMMENT_IMAGES - attachedImages.length;
    if (remainingSlots <= 0) {
      toast.error(`You can attach up to ${MAX_COMMENT_IMAGES} images.`);
      return;
    }

    const filesToAttach = imageFiles.slice(0, remainingSlots);
    if (imageFiles.length > remainingSlots) {
      toast.error(`Only ${MAX_COMMENT_IMAGES} images can be attached.`);
    }

    filesToAttach.forEach((file) => attachImageFile(file, source));
  }

  function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    attachImageFiles(e.target.files, "file-picker");
    e.target.value = "";
  }

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const imageFiles = Array.from(e.clipboardData.items)
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));

    if (imageFiles.length === 0) return;
    e.preventDefault();
    attachImageFiles(imageFiles, "paste");
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    if (!Array.from(e.dataTransfer.items).some((item) => item.type.startsWith("image/"))) {
      return;
    }

    e.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragActive(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    const imageFiles = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith("image/"),
    );

    if (imageFiles.length === 0) return;
    e.preventDefault();
    setDragActive(false);
    attachImageFiles(imageFiles, "drop");
  }

  const filteredUsers = useMemo(() => {
    if (!mentionQuery) return users;
    const q = mentionQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }, [users, mentionQuery]);

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    setValue(text);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = text.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      setShowMentions(true);
      setMentionQuery(atMatch[1]);
      setMentionIndex(0);
    } else {
      setShowMentions(false);
      setMentionQuery("");
    }
  }

  function insertMention(user: UserProfile) {
    const textarea = inputRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    const textAfterCursor = value.slice(cursorPos);
    const mentionText = `@${displayName(user)} `;

    const newValue = value.slice(0, atIndex) + mentionText + textAfterCursor;
    setValue(newValue);
    setShowMentions(false);
    setMentionQuery("");

    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = atIndex + mentionText.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (showMentions && filteredUsers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => Math.min(i + 1, filteredUsers.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredUsers[mentionIndex]);
      } else if (e.key === "Escape") {
        setShowMentions(false);
      }
      return;
    }

    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleSubmit() {
    const trimmed = value.trim();
    if ((!trimmed && attachedImages.length === 0) || submitting) return;
    const mentions = extractMentionIds(trimmed, users);
    onSubmit(
      trimmed || "(image)",
      mentions,
      attachedImages.map((image) => image.dataUrl),
    );
    setValue("");
    setAttachedImages([]);
    setShowMentions(false);
  }

  return (
    <div className="relative">
      {showMentions && filteredUsers.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-sm z-10">
          {filteredUsers.map((user, i) => (
            <Button
              key={user.id}
              type="button"
              variant="ghost"
              size="default"
              className={cn(
                "h-auto w-full justify-start gap-1.5 rounded-none px-2 py-1 text-left text-xs font-normal",
                i === mentionIndex ? "bg-muted" : "hover:bg-muted/50",
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(user);
              }}
              onMouseEnter={() => setMentionIndex(i)}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {getInitials(user)}
              </span>
              <span className="truncate text-xs font-medium text-foreground">
                {displayName(user)}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </Button>
          ))}
        </div>
      )}

      {attachedImages.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachedImages.map((image) => (
            <div key={image.id} className="relative inline-block">
              <img
                src={image.dataUrl}
                alt={image.name}
                className="h-20 w-20 rounded-md border border-border object-cover"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon-xs"
                onClick={() =>
                  setAttachedImages((current) =>
                    current.filter((item) => item.id !== image.id),
                  )
                }
                className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full shadow-sm transition-colors hover:bg-destructive/90"
                aria-label={`Remove ${image.name}`}
              >
                <XCircle className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        aria-label="Attach image"
        className="hidden"
        onChange={handleFileUpload}
      />
      <div
        className={cn(
          "rounded-md border border-border bg-background p-3 focus-within:ring-1 focus-within:ring-ring",
          dragActive && "border-primary/50 ring-1 ring-primary/30",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Textarea
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Add a comment"
          rows={1}
          className="max-h-24 min-h-10 resize-none border-0 bg-transparent p-0 shadow-none"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => fileInputRef.current?.click()}
            className="h-auto px-0 py-0 text-xs font-normal text-primary hover:bg-transparent hover:underline"
          >
            Attach image
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={handleSubmit}
            disabled={(!value.trim() && attachedImages.length === 0) || submitting}
            aria-label={submitting ? "Sending comment" : "Send comment"}
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CommentsSection({
  feedbackItemId,
  commentInputRef,
}: {
  feedbackItemId: string;
  commentInputRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const [comments, setComments] = useState<FeedbackComment[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchComments = useCallback(async () => {
    try {
      const data = await apiFetch<{ comments?: FeedbackComment[] }>(
        `/api/admin/feedback/comments?feedbackItemId=${feedbackItemId}`,
      );
      setComments(data.comments ?? []);
    } catch (err) {
      notifyFeedbackInboxFailure({
        operation: "load-comments",
        title: "Could not load comments",
        fallback: "Feedback comments could not be loaded.",
        error: err,
        metadata: { feedbackItemId },
      });
    } finally {
      setLoading(false);
    }
  }, [feedbackItemId]);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await apiFetch<
        UserProfile[] | { users?: UserProfile[]; data?: UserProfile[] }
      >("/api/users");
      const userList = Array.isArray(data)
        ? data
        : data.users ?? data.data ?? [];
      setUsers(userList);
    } catch (err) {
      notifyFeedbackInboxFailure({
        operation: "load-comment-users",
        title: "Could not load mention users",
        fallback: "Mention user options could not be loaded.",
        error: err,
        metadata: { feedbackItemId },
      });
    }
  }, [feedbackItemId]);

  useEffect(() => {
    setLoading(true);
    setComments([]);
    setCollapsed(false);
    fetchComments();
    fetchUsers();
  }, [fetchComments, fetchUsers]);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }

  async function handleSubmit(
    body: string,
    mentions: string[],
    screenshotDataUrls: string[],
  ) {
    setSubmitting(true);
    try {
      const data = await apiFetch<{
        comment?: FeedbackComment;
        comments?: FeedbackComment[];
      }>(
        "/api/admin/feedback/comments",
        {
          method: "POST",
          body: JSON.stringify({
            feedbackItemId,
            body,
            mentions,
            screenshotDataUrls,
          }),
        },
      );
      const newComments = data.comments ?? (data.comment ? [data.comment] : []);
      setComments((prev) => [...prev, ...newComments]);
      scrollToBottom();
      if (mentions.length > 0) {
        toast.success(
          `Comment added and ${mentions.length} user${mentions.length > 1 ? "s" : ""} notified`,
        );
      }
    } catch (err) {
      notifyFeedbackInboxFailure({
        operation: "add-comment",
        title: "Could not add comment",
        fallback: "The feedback comment could not be saved.",
        error: err,
        metadata: {
          feedbackItemId,
          mentionCount: mentions.length,
          imageCount: screenshotDataUrls.length,
        },
      });
    } finally {
      setSubmitting(false);
    }
  }

  function renderBody(body: string) {
    const parts = body.split(/(@\w+(?:\s\w+)?)/g);
    return parts.map((part) => {
      if (part.startsWith("@")) {
        return (
          <span key={part} className="font-medium text-primary">
            {part}
          </span>
        );
      }
      return part;
    });
  }

  return (
    <div className="space-y-6">
      <SectionRuleHeading
        label="Comments"
        className="mb-0 pb-0"
        actions={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setCollapsed((value) => !value)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand comments" : "Collapse comments"}
            className="text-muted-foreground hover:text-foreground"
          >
            {collapsed ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </Button>
        }
      />

      {!collapsed && (
        <>
          <div ref={scrollRef} className="space-y-6">
            {loading && (
              <div className="flex items-center justify-center py-4">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
              </div>
            )}

            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-4">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {getInitials(comment.author)}
                </span>
                <div className="min-w-0 flex-1 rounded-md bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      {displayName(comment.author)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {relativeTime(comment.created_at)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                    {renderBody(comment.body)}
                  </p>
                  {comment.screenshot_url && (
                    <a
                      href={comment.screenshot_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-block"
                    >
                      <img
                        src={comment.screenshot_url}
                        alt="Comment screenshot"
                        className="max-h-40 max-w-full rounded-lg border border-border object-cover hover:opacity-90 transition-opacity"
                      />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          <CommentInput
            onSubmit={handleSubmit}
            users={users}
            submitting={submitting}
            inputRef={commentInputRef}
          />
        </>
      )}
    </div>
  );
}

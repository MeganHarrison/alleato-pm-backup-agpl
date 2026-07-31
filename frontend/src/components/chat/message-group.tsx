"use client";

import { useMemo, useState } from "react";
import { MessageSquare, Smile, ThumbsUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  content: string;
  user: { name: string };
  createdAt: string;
}

interface MessageGroupProps {
  message: Message;
  isFirstInGroup: boolean;
  isOwnMessage: boolean;
  isSelected?: boolean;
  threadReplyCount?: number;
  reactions?: Record<string, number>;
  isReadOnly?: boolean;
  onSelect?: () => void;
  onReplyInThread?: () => void;
  onAddReaction?: (emoji: string) => void;
}

function renderMentions(text: string) {
  const mentionPattern = /(@[a-z0-9._-]+)/gi;
  const parts = text.split(mentionPattern);
  return parts.map((part) =>
    part.match(mentionPattern) ? (
      <span key={part} className="font-semibold opacity-90">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function HoverActions({
  align,
  onReplyInThread,
  onAddReaction,
}: {
  align: "left" | "right";
  onReplyInThread?: () => void;
  onAddReaction?: (emoji: string) => void;
}) {
  return (
    <div
      className={cn(
        "absolute top-0 z-10 flex -translate-y-1/2 items-center gap-0.5 rounded-xl border border-border bg-background px-1 py-1 shadow-sm",
        align === "right" ? "right-4" : "left-14",
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
        title="Reply in thread"
        onClick={(e) => { e.stopPropagation(); onReplyInThread?.(); }}
      >
        <MessageSquare className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
        title="Thumbs up"
        onClick={(e) => { e.stopPropagation(); onAddReaction?.("👍"); }}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
        title="Add reaction"
        onClick={(e) => { e.stopPropagation(); onAddReaction?.("❤️"); }}
      >
        <Smile className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function MessageGroup({
  message,
  isFirstInGroup,
  isOwnMessage,
  isSelected = false,
  threadReplyCount = 0,
  reactions = {},
  isReadOnly = false,
  onSelect,
  onReplyInThread,
  onAddReaction,
}: MessageGroupProps) {
  const [isHovered, setIsHovered] = useState(false);
  const time = format(parseISO(message.createdAt), "h:mm a");
  const initials = message.user.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const reactionEntries = useMemo(() => Object.entries(reactions), [reactions]);

  /* ── Own message (right-aligned bubble) ── */
  if (isOwnMessage) {
    return (
      <div
        className={cn("group relative px-4 py-0.5", isFirstInGroup && "mt-4")}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex flex-col items-end gap-1">
          {isFirstInGroup && (
            <span className="pr-1 text-[11px] text-muted-foreground">{time}</span>
          )}

          <button
            type="button"
            onClick={onSelect}
            className={cn(
              "max-w-[70%] cursor-pointer rounded-2xl rounded-tr-sm px-4 py-2.5 text-left text-sm leading-relaxed shadow-sm transition-opacity",
              isSelected ? "opacity-80" : "opacity-100",
              "bg-primary text-primary-foreground",
            )}
          >
            {renderMentions(message.content)}
          </button>

          {!isReadOnly && reactionEntries.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1">
              {reactionEntries.map(([emoji, count]) => (
                <Button
                  key={`${message.id}-${emoji}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onAddReaction?.(emoji); }}
                  className="h-6 rounded-full px-2 text-xs"
                >
                  {emoji}
                  <span className="ml-1 text-[11px] text-muted-foreground">{count}</span>
                </Button>
              ))}
            </div>
          )}

          {!isReadOnly && threadReplyCount > 0 && (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onReplyInThread?.(); }}
              className="h-auto p-0 text-xs text-primary"
            >
              {threadReplyCount} {threadReplyCount === 1 ? "reply" : "replies"}
            </Button>
          )}
        </div>

        {!isReadOnly && isHovered && (
          <HoverActions align="right" onReplyInThread={onReplyInThread} onAddReaction={onAddReaction} />
        )}
      </div>
    );
  }

  /* ── Other user's message (left-aligned with avatar) ── */
  return (
    <div
      className={cn("group relative px-4 py-0.5", isFirstInGroup && "mt-4")}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-end gap-2.5">
        {/* Avatar – only on first message in a group */}
        <div className="w-8 shrink-0 self-end">
          {isFirstInGroup ? (
            <Avatar className="h-8 w-8 border border-border/80">
              <AvatarFallback className="bg-muted text-[11px] font-semibold text-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="h-8 w-8" />
          )}
        </div>

        {/* Bubble + meta */}
        <div className="flex max-w-[70%] flex-col gap-1">
          {isFirstInGroup && (
            <div className="flex items-baseline gap-2 pl-1">
              <span className="text-sm font-semibold text-foreground">{message.user.name}</span>
              <span className="text-[11px] text-muted-foreground">{time}</span>
            </div>
          )}

          <button
            type="button"
            onClick={onSelect}
            className={cn(
              "cursor-pointer rounded-2xl rounded-tl-sm px-4 py-2.5 text-left text-sm leading-relaxed shadow-sm transition-colors",
              isSelected
                ? "bg-primary/10 text-foreground ring-1 ring-primary/20"
                : "bg-muted text-foreground hover:bg-muted/80",
            )}
          >
            {renderMentions(message.content)}
          </button>

          {!isReadOnly && reactionEntries.length > 0 && (
            <div className="flex flex-wrap gap-1 pl-1">
              {reactionEntries.map(([emoji, count]) => (
                <Button
                  key={`${message.id}-${emoji}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onAddReaction?.(emoji); }}
                  className="h-6 rounded-full px-2 text-xs"
                >
                  {emoji}
                  <span className="ml-1 text-[11px] text-muted-foreground">{count}</span>
                </Button>
              ))}
            </div>
          )}

          {!isReadOnly && threadReplyCount > 0 && (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onReplyInThread?.(); }}
              className="h-auto justify-start p-0 pl-1 text-xs text-primary"
            >
              {threadReplyCount} {threadReplyCount === 1 ? "reply" : "replies"}
            </Button>
          )}
        </div>
      </div>

      {/* Inline timestamp for non-first messages on hover */}
      {!isFirstInGroup && isHovered && (
        <div className="absolute left-14 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
          {time}
        </div>
      )}

      {!isReadOnly && isHovered && (
        <HoverActions align="left" onReplyInThread={onReplyInThread} onAddReaction={onAddReaction} />
      )}
    </div>
  );
}

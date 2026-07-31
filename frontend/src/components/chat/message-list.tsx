"use client";

import { useEffect, useMemo, useRef } from "react";
import { format, isSameDay, isToday, isYesterday, parseISO } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DateDivider } from "./date-divider";
import { MessageGroup } from "./message-group";

interface Message {
  id: string;
  content: string;
  user: { name: string };
  createdAt: string;
}

interface MessageListProps {
  messages: Message[];
  currentUsername: string;
  selectedMessageId?: string | null;
  threadReplyCountByMessage?: Record<string, number>;
  reactionsByMessage?: Record<string, Record<string, number>>;
  isReadOnly?: boolean;
  onMessageSelect?: (message: Message) => void;
  onReplyInThread?: (message: Message) => void;
  onAddReaction?: (messageId: string, emoji: string) => void;
}

interface GroupedMessage extends Message {
  isFirstInGroup?: boolean;
  showDate?: boolean;
  dateLabel?: string;
}

export function MessageList({
  messages,
  currentUsername,
  selectedMessageId,
  threadReplyCountByMessage = {},
  reactionsByMessage = {},
  isReadOnly = false,
  onMessageSelect,
  onReplyInThread,
  onAddReaction,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(messages.length);

  const groupedMessages = useMemo(() => {
    if (messages.length === 0) {
      return [];
    }

    const grouped: GroupedMessage[] = [];
    let currentDate: Date | null = null;
    let previousUser: string | null = null;
    let previousTime: Date | null = null;

    messages.forEach((message) => {
      const messageDate = parseISO(message.createdAt);
      const messageTime = messageDate.getTime();

      if (!currentDate || !isSameDay(currentDate, messageDate)) {
        currentDate = messageDate;

        const dateLabel = isToday(messageDate)
          ? "Today"
          : isYesterday(messageDate)
            ? "Yesterday"
            : format(messageDate, "MMMM d, yyyy");

        grouped.push({
          ...message,
          showDate: true,
          dateLabel,
          isFirstInGroup: true,
        });

        previousUser = message.user.name;
        previousTime = messageDate;
        return;
      }

      const timeDiffInMinutes = previousTime
        ? (messageTime - previousTime.getTime()) / 1000 / 60
        : Number.POSITIVE_INFINITY;
      const startsNewGroup = previousUser !== message.user.name || timeDiffInMinutes > 5;

      grouped.push({
        ...message,
        isFirstInGroup: startsNewGroup,
      });

      if (startsNewGroup) {
        previousUser = message.user.name;
      }
      previousTime = messageDate;
    });

    return grouped;
  }, [messages]);

  useEffect(() => {
    if (messages.length > prevMessageCount.current && scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );

      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }

    prevMessageCount.current = messages.length;
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            No messages yet. Start this conversation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea ref={scrollRef} className="h-full">
      <div className="space-y-0.5 px-3 pb-4 pt-2">
        {groupedMessages.map((message) => (
          <div key={message.id}>
            {message.showDate ? <DateDivider label={message.dateLabel ?? ""} /> : null}
            <MessageGroup
              message={message}
              isFirstInGroup={message.isFirstInGroup ?? false}
              isOwnMessage={message.user.name === currentUsername}
              isSelected={selectedMessageId === message.id}
              threadReplyCount={threadReplyCountByMessage[message.id] ?? 0}
              reactions={reactionsByMessage[message.id]}
              isReadOnly={isReadOnly}
              onSelect={() => onMessageSelect?.(message)}
              onReplyInThread={() => onReplyInThread?.(message)}
              onAddReaction={(emoji) => onAddReaction?.(message.id, emoji)}
            />
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

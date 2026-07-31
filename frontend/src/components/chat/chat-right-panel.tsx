"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Send, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { TeamChatMessage } from "./chat-main";
import type { TeamChannel } from "./team-chat-data";

export interface ThreadReply {
  id: string;
  content: string;
  userName: string;
  createdAt: string;
}

interface ChatRightPanelProps {
  channel: TeamChannel;
  selectedMessage: TeamChatMessage | null;
  threadReplies: ThreadReply[];
  onAddThreadReply: (content: string) => void;
  onClose: () => void;
}

export function ChatRightPanel({
  channel,
  selectedMessage,
  threadReplies,
  onAddThreadReply,
  onClose,
}: ChatRightPanelProps) {
  const [replyDraft, setReplyDraft] = useState("");

  const selectedMessageTime = useMemo(() => {
    if (!selectedMessage) {
      return "";
    }

    return format(parseISO(selectedMessage.createdAt), "MMM d · h:mm a");
  }, [selectedMessage]);

  const handleSendReply = () => {
    if (!replyDraft.trim() || !selectedMessage) {
      return;
    }

    onAddThreadReply(replyDraft.trim());
    setReplyDraft("");
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="min-w-0">
          {/* eslint-disable-next-line design-system/no-raw-heading */}
          <h3 className="truncate text-sm font-semibold text-foreground">Thread</h3>
          <p className="truncate text-xs text-muted-foreground">#{channel.name}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {selectedMessage ? (
            <>
              <article className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7 border border-border">
                    <AvatarFallback className="text-[11px] font-semibold">
                      {selectedMessage.user.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {selectedMessage.user.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{selectedMessageTime}</p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-foreground">{selectedMessage.content}</p>
              </article>

              <div className="space-y-3">
                {threadReplies.length > 0 ? (
                  threadReplies.map((reply) => (
                    <article key={reply.id} className="space-y-1 rounded-md border border-border/80 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">{reply.userName}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(reply.createdAt), "h:mm a")}
                        </p>
                      </div>
                      <p className="text-sm leading-relaxed text-foreground">{reply.content}</p>
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No replies yet. Use this panel to continue the thread.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="mt-10 text-center px-4">
              <p className="text-sm text-muted-foreground">
                Select a message to open its thread.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border p-3">
        <Textarea
          value={replyDraft}
          onChange={(event) => setReplyDraft(event.target.value)}
          placeholder={selectedMessage ? "Reply in thread" : "Select a message to reply"}
          disabled={!selectedMessage}
          rows={3}
          className="min-h-20 resize-none border-border bg-muted/20"
        />
        <div className="mt-2 flex justify-end">
          <Button
            onClick={handleSendReply}
            disabled={!selectedMessage || !replyDraft.trim()}
            className="h-8 gap-1.5 px-3"
          >
            <Send className="h-3.5 w-3.5" />
            Reply
          </Button>
        </div>
      </div>
    </div>
  );
}

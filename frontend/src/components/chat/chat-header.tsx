"use client";

import { Menu, MessageSquare, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatHeaderProps {
  channelName: string;
  topic: string;
  teamName: string;
  memberCount: number;
  isDm?: boolean;
  dmPartnerName?: string;
  isReadOnly?: boolean;
  onToggleSidebar: () => void;
  onToggleRightPanel: () => void;
  isConnected: boolean;
  messageQuery: string;
  onMessageQueryChange: (value: string) => void;
}

export function ChatHeader({
  channelName,
  topic,
  memberCount,
  isDm,
  dmPartnerName,
  isReadOnly,
  onToggleSidebar,
  onToggleRightPanel,
}: ChatHeaderProps) {
  const displayName = isDm ? (dmPartnerName ?? channelName) : channelName;
  const displayTopic = isReadOnly ? "Read-only comments inbox" : isDm ? "Direct message" : topic;

  return (
    <div className="flex h-14 shrink-0 items-center gap-3 bg-background px-4">
      {/* Mobile sidebar toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleSidebar}
        className="text-muted-foreground hover:text-foreground lg:hidden"
      >
        <Menu className="h-4 w-4" />
      </Button>

      {/* Channel / DM name + subtitle */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="min-w-0">
          {/* eslint-disable-next-line design-system/no-raw-heading */}
          <h2 className="truncate text-sm font-semibold text-foreground">{displayName}</h2>
          <p className="truncate text-xs text-muted-foreground">{displayTopic}</p>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <span className="hidden items-center gap-1 px-1 text-xs text-muted-foreground md:inline-flex">
          <Users className="h-3.5 w-3.5" />
          {memberCount}
        </span>

        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleRightPanel}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title="Thread panel"
        >
          <MessageSquare className="h-4 w-4" />
        </Button>

      </div>
    </div>
  );
}

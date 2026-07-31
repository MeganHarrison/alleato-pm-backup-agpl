"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ChatSidebar } from "./chat-sidebar";
import { ChatMain, type TeamChatMessage } from "./chat-main";
import { ChatRightPanel, type ThreadReply } from "./chat-right-panel";
import { resolveInitialTeamChatChannelId } from "./team-chat-routing";
import type { TeamChannel, TeamChatAdminUser } from "./team-chat-data";

interface ChatLayoutProps {
  username: string;
  initialDiscussionId?: string | null;
  onUsernameChange?: (username: string) => void;
}

interface ChannelListResponse {
  channels: TeamChannel[];
  adminUsers: TeamChatAdminUser[];
  canManageChannels: boolean;
}

export type NavView = "chats" | "channels" | "contacts";

const EMPTY_CHANNEL: TeamChannel = {
  id: "",
  name: "No channels",
  topic: "Create a channel to begin chatting",
  team: "Team Chat",
  section: "channels",
  unread: 0,
  memberCount: 0,
  preview: "",
  lastMessageAt: null,
  deletable: false,
};

export function ChatLayout({ username, initialDiscussionId }: ChatLayoutProps) {
  const [channels, setChannels] = useState<TeamChannel[]>([]);
  const [dms, setDms] = useState<TeamChannel[]>([]);
  const [adminUsers, setAdminUsers] = useState<TeamChatAdminUser[]>([]);
  const [allUsers, setAllUsers] = useState<TeamChatAdminUser[]>([]);
  const [canManageChannels, setCanManageChannels] = useState(false);
  const [activeChannel, setActiveChannel] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<TeamChatMessage | null>(null);
  const [threadRepliesByMessage, setThreadRepliesByMessage] = useState<Record<string, ThreadReply[]>>({});
  const [isMobile, setIsMobile] = useState(false);
  const [activeView] = useState<NavView>("chats");

  const fetchChannels = useCallback(async (): Promise<ChannelListResponse> => {
    const payload = await apiFetch<ChannelListResponse>("/api/team-chat/channels");
    setChannels(payload.channels ?? []);
    setAdminUsers(payload.adminUsers ?? []);
    setCanManageChannels(payload.canManageChannels === true);
    return payload;
  }, []);

  const fetchDms = useCallback(async () => {
    const data = await apiFetch<TeamChannel[]>("/api/team-chat/direct-messages");
    setDms(Array.isArray(data) ? data : []);
  }, []);

  const fetchAllUsers = useCallback(async () => {
    const data = await apiFetch<TeamChatAdminUser[]>("/api/team-chat/users");
    setAllUsers(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) setRightPanelOpen(false);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    fetchChannels().catch(() => {
      setChannels([]);
      setAdminUsers([]);
      setCanManageChannels(false);
    });
    fetchDms().catch(() => setDms([]));
    fetchAllUsers().catch(() => setAllUsers([]));
  }, [fetchChannels, fetchDms, fetchAllUsers]);

  const allChannels = useMemo(() => [...channels, ...dms], [channels, dms]);

  useEffect(() => {
    const nextChannelId = resolveInitialTeamChatChannelId(
      allChannels,
      activeChannel,
      initialDiscussionId,
    );

    if (nextChannelId && nextChannelId !== activeChannel) {
      setActiveChannel(nextChannelId);
      setSelectedMessage(null);
      return;
    }
  }, [allChannels, activeChannel, initialDiscussionId]);

  const activeChannelDetails = useMemo(
    () => allChannels.find((ch) => ch.id === activeChannel) ?? EMPTY_CHANNEL,
    [allChannels, activeChannel],
  );

  const selectedThreadReplies = selectedMessage
    ? (threadRepliesByMessage[selectedMessage.id] ?? [])
    : [];

  const handleAddThreadReply = (content: string) => {
    if (!selectedMessage) return;
    const reply: ThreadReply = {
      id: crypto.randomUUID(),
      content,
      userName: username,
      createdAt: new Date().toISOString(),
    };
    setThreadRepliesByMessage((cur) => ({
      ...cur,
      [selectedMessage.id]: [...(cur[selectedMessage.id] ?? []), reply],
    }));
  };

  const handleCreateChannel = async (name: string, topic: string) => {
    const created = await apiFetch<TeamChannel>("/api/team-chat/channels", {
      method: "POST",
      body: JSON.stringify({ name, topic }),
    });
    await fetchChannels();
    if (created?.id) {
      setActiveChannel(created.id);
      setSelectedMessage(null);
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    await apiFetch(`/api/team-chat/channels/${encodeURIComponent(channelId)}`, {
      method: "DELETE",
    });
    const payload = await fetchChannels();
    if (activeChannel === channelId) {
      const remaining = (payload.channels ?? []).filter((ch) => ch.id !== channelId);
      setActiveChannel(remaining[0]?.id ?? "");
      setSelectedMessage(null);
    }
  };

  const handleOpenDm = async (targetUserId: string) => {
    const dm = await apiFetch<TeamChannel>("/api/team-chat/direct-messages", {
      method: "POST",
      body: JSON.stringify({ targetUserId }),
    });
    await fetchDms();
    if (dm?.id) {
      setActiveChannel(dm.id);
      setSelectedMessage(null);
      setSidebarOpen(false);
    }
  };

  const handleMessageSent = useCallback(() => {
    fetchChannels().catch(() => {});
    fetchDms().catch(() => {});
  }, [fetchChannels, fetchDms]);

  const selectChannel = (channelId: string) => {
    setActiveChannel(channelId);
    setSelectedMessage(null);
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-background text-foreground">
      <div className="hidden lg:block">
        <ChatSidebar
          channels={channels}
          dms={dms}
          adminUsers={adminUsers}
          allUsers={allUsers}
          activeChannel={activeChannel}
          activeView={activeView}
          canManageChannels={canManageChannels}
          onChannelSelect={selectChannel}
          onCreateChannel={handleCreateChannel}
          onDeleteChannel={handleDeleteChannel}
          onOpenDm={handleOpenDm}
        />
      </div>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-95 p-0 sm:max-w-95">
          <ChatSidebar
            channels={channels}
            dms={dms}
            adminUsers={adminUsers}
            allUsers={allUsers}
            activeChannel={activeChannel}
            activeView={activeView}
            canManageChannels={canManageChannels}
            onChannelSelect={(id) => { selectChannel(id); setSidebarOpen(false); }}
            onCreateChannel={handleCreateChannel}
            onDeleteChannel={handleDeleteChannel}
            onOpenDm={handleOpenDm}
          />
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1">
        <ChatMain
          channel={activeChannelDetails}
          username={username}
          focusDiscussionId={activeChannelDetails.readOnly ? initialDiscussionId ?? null : null}
          onToggleSidebar={() => setSidebarOpen(true)}
          onToggleRightPanel={() => setRightPanelOpen((o) => !o)}
          onMessageSelect={(message) => {
            setSelectedMessage(message);
            setRightPanelOpen(true);
          }}
          onMessageSent={handleMessageSent}
          selectedMessageId={selectedMessage?.id ?? null}
          threadReplyCountByMessage={Object.fromEntries(
            Object.entries(threadRepliesByMessage).map(([mid, replies]) => [mid, replies.length]),
          )}
        />
      </div>

      <div
        className={cn(
          "hidden xl:block border-l border-border transition-all duration-150",
          rightPanelOpen ? "w-96" : "w-0",
        )}
      >
        {rightPanelOpen && (
          <ChatRightPanel
            channel={activeChannelDetails}
            selectedMessage={selectedMessage}
            threadReplies={selectedThreadReplies}
            onAddThreadReply={handleAddThreadReply}
            onClose={() => setRightPanelOpen(false)}
          />
        )}
      </div>

      <Sheet open={Boolean(rightPanelOpen && isMobile)} onOpenChange={setRightPanelOpen}>
        <SheetContent side="right" className="w-96 p-0 sm:max-w-96">
          <ChatRightPanel
            channel={activeChannelDetails}
            selectedMessage={selectedMessage}
            threadReplies={selectedThreadReplies}
            onAddThreadReply={handleAddThreadReply}
            onClose={() => setRightPanelOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

"use client";
/* eslint-disable design-system/no-raw-heading */

import { useMemo, useRef, useState } from "react";
import { ChevronRight, MessageSquarePlus, Plus, Search, Trash2, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { NavView } from "./chat-layout";
import type { TeamChannel, TeamChatAdminUser } from "./team-chat-data";

interface ChatSidebarProps {
  channels: TeamChannel[];
  dms: TeamChannel[];
  adminUsers: TeamChatAdminUser[];
  allUsers: TeamChatAdminUser[];
  activeChannel: string;
  activeView: NavView;
  canManageChannels: boolean;
  onChannelSelect: (channelId: string) => void;
  onCreateChannel: (name: string, topic: string) => Promise<void>;
  onDeleteChannel: (channelId: string) => Promise<void>;
  onOpenDm: (targetUserId: string) => Promise<void>;
}

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
];

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "CH"
  );
}

interface ChannelRowProps {
  channel: TeamChannel;
  isActive: boolean;
  canManageChannels: boolean;
  colorClass: string;
  onClick: () => void;
  onDelete: () => void;
}

function ChannelRow({
  channel,
  isActive,
  canManageChannels,
  colorClass,
  onClick,
  onDelete,
}: ChannelRowProps) {
  return (
    <div
      className={cn(
        "group flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors",
        isActive ? "bg-primary/5" : "hover:bg-black/3",
      )}
    >
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback
            className={cn(
              "text-[11px] font-semibold",
              channel.readOnly ? "bg-sky-100 text-sky-700" : colorClass,
            )}
          >
            {getInitials(channel.name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex-1 truncate text-[15px] leading-snug",
                channel.unread > 0 ? "font-semibold text-foreground" : "font-medium text-foreground/80",
              )}
            >
              {channel.name}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <p className="flex-1 truncate text-sm text-muted-foreground">{channel.preview}</p>
            {channel.unread > 0 && (
              <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {channel.unread}
              </span>
            )}
          </div>
        </div>
      </button>

      {canManageChannels && channel.deletable && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-7 w-7 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100"
          title={`Delete ${channel.name}`}
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      )}
    </div>
  );
}

// User picker for new DM
interface DmPickerProps {
  users: TeamChatAdminUser[];
  onSelect: (userId: string) => void;
  onCancel: () => void;
  loading: boolean;
}

function DmPicker({ users, onSelect, onCancel, loading }: DmPickerProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      query.trim()
        ? users.filter((u) => u.name.toLowerCase().includes(query.toLowerCase()))
        : users,
    [users, query],
  );

  return (
    <div className="space-y-2 px-4 pb-4">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Find someone…"
        autoFocus
        className="h-8 text-sm"
      />
      <div className="max-h-48 overflow-y-auto rounded-md border border-border/60 bg-background">
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">No users found.</p>
        ) : (
          filtered.map((user) => (
            <Button
              key={user.id}
              type="button"
              variant="ghost"
              disabled={loading}
              onClick={() => onSelect(user.id)}
              className="h-auto w-full justify-start gap-2.5 rounded-none px-3 py-2 text-left text-sm font-normal"
            >
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarFallback className="bg-muted text-[10px] font-semibold text-foreground">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{user.name}</span>
            </Button>
          ))
        )}
      </div>
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

type SidebarMode = "idle" | "creating-channel" | "creating-dm";

export function ChatSidebar({
  channels,
  dms,
  adminUsers,
  allUsers,
  activeChannel,
  canManageChannels,
  onChannelSelect,
  onCreateChannel,
  onDeleteChannel,
  onOpenDm,
}: ChatSidebarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelTopic, setNewChannelTopic] = useState("");
  const [mode, setMode] = useState<SidebarMode>("idle");
  const [dmLoading, setDmLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filteredChannels = useMemo(() => {
    if (!searchQuery.trim()) return channels;
    const q = searchQuery.toLowerCase();
    return channels.filter(
      (ch) =>
        ch.name.toLowerCase().includes(q) ||
        ch.preview.toLowerCase().includes(q) ||
        ch.topic.toLowerCase().includes(q),
    );
  }, [channels, searchQuery]);

  const filteredDms = useMemo(() => {
    if (!searchQuery.trim()) return dms;
    const q = searchQuery.toLowerCase();
    return dms.filter(
      (dm) => dm.name.toLowerCase().includes(q) || dm.preview.toLowerCase().includes(q),
    );
  }, [dms, searchQuery]);

  const handleCreateChannel = async () => {
    const normalizedName = newChannelName.trim();
    if (!normalizedName) {
      setErrorMessage("Enter a channel name.");
      return;
    }
    try {
      setErrorMessage(null);
      await onCreateChannel(normalizedName, newChannelTopic.trim());
      setNewChannelName("");
      setNewChannelTopic("");
      setMode("idle");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create channel.");
    }
  };

  const handleDeleteChannel = async (channel: TeamChannel) => {
    const confirmed = window.confirm(
      `Delete channel "${channel.name}"? This removes all messages in it.`,
    );
    if (!confirmed) return;
    try {
      setErrorMessage(null);
      await onDeleteChannel(channel.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete channel.");
    }
  };

  const handleOpenDm = async (userId: string) => {
    setDmLoading(true);
    setErrorMessage(null);
    try {
      await onOpenDm(userId);
      setMode("idle");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to open conversation.");
    } finally {
      setDmLoading(false);
    }
  };

  const resetMode = () => {
    setMode("idle");
    setErrorMessage(null);
    setNewChannelName("");
    setNewChannelTopic("");
  };

  return (
    <div className="flex h-full w-72 shrink-0 flex-col overflow-hidden border-r border-border bg-muted/30">
      {/* Header */}
      <div className="flex items-center gap-1 px-4 pb-3 pt-5">
        {searchOpen ? (
          <>
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
              autoFocus
              className="h-7 flex-1 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/60"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearchOpen(false);
                  setSearchQuery("");
                }
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Close search"
              onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
              className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <h2 className="flex-1 text-sm font-semibold text-foreground">Team Chat</h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Search"
              onClick={() => setSearchOpen(true)}
              className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
            >
              <Search className="h-4 w-4" />
            </Button>
            {canManageChannels && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="New"
                    className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => { resetMode(); setMode("creating-channel"); }}>
                    <ChevronRight className="mr-2 h-4 w-4" />
                    New channel
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { resetMode(); setMode("creating-dm"); }}>
                    <MessageSquarePlus className="mr-2 h-4 w-4" />
                    Direct message
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        )}
      </div>

      {/* Inline forms */}
      {mode === "creating-channel" && (
        <div className="space-y-2 px-4 pb-4">
          <Input
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            placeholder="Channel name"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateChannel(); if (e.key === "Escape") resetMode(); }}
          />
          <Input
            value={newChannelTopic}
            onChange={(e) => setNewChannelTopic(e.target.value)}
            placeholder="Topic (optional)"
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateChannel(); if (e.key === "Escape") resetMode(); }}
          />
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={resetMode}>Cancel</Button>
            <Button size="sm" onClick={handleCreateChannel}>Create</Button>
          </div>
        </div>
      )}

      {mode === "creating-dm" && (
        <DmPicker
          users={allUsers}
          onSelect={handleOpenDm}
          onCancel={resetMode}
          loading={dmLoading}
        />
      )}

      {errorMessage && <p className="px-4 pb-3 text-xs text-destructive">{errorMessage}</p>}

      {/* Admins row — clickable avatars open a DM */}
      {adminUsers.length > 0 && mode === "idle" && (
        <div className="px-4 pb-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
            Admins
          </p>
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            {adminUsers.map((admin, idx) => (
              <Button
                key={admin.id}
                type="button"
                variant="ghost"
                title={`Message ${admin.name}`}
                onClick={() => handleOpenDm(admin.id)}
                className="group h-auto shrink-0 flex-col items-center gap-1.5 rounded-lg px-2 py-1.5 font-normal"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback
                    className={cn(
                      "text-[11px] font-semibold transition-opacity group-hover:opacity-80",
                      AVATAR_COLORS[idx % AVATAR_COLORS.length],
                    )}
                  >
                    {getInitials(admin.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="max-w-14 truncate text-[11px] text-muted-foreground">
                  {admin.name.split(" ")[0]}
                </span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Channel + DM lists */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Channels */}
        {filteredChannels.length > 0 && (
          <div className="pb-2">
            <p className="mb-1 px-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              Channels
            </p>
            {filteredChannels.map((channel, idx) => (
              <ChannelRow
                key={channel.id}
                channel={channel}
                canManageChannels={canManageChannels}
                isActive={activeChannel === channel.id}
                colorClass={AVATAR_COLORS[idx % AVATAR_COLORS.length]}
                onClick={() => onChannelSelect(channel.id)}
                onDelete={() => handleDeleteChannel(channel)}
              />
            ))}
          </div>
        )}

        {/* Direct Messages */}
        {filteredDms.length > 0 && (
          <div className="pb-2">
            <p className="mb-1 px-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              Direct Messages
            </p>
            {filteredDms.map((dm) => (
              <div
                key={dm.id}
                role="button"
                tabIndex={0}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 px-5 py-3 transition-colors",
                  activeChannel === dm.id ? "bg-primary/5" : "hover:bg-black/3",
                )}
                onClick={() => onChannelSelect(dm.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onChannelSelect(dm.id);
                }}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback
                    className={cn(
                      "text-[10px] font-semibold",
                      dm.readOnly ? "bg-sky-100 text-sky-700" : "bg-muted text-foreground",
                    )}
                  >
                    {getInitials(dm.dmPartnerName ?? dm.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-foreground/80">
                    {dm.dmPartnerName ?? dm.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{dm.preview}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredChannels.length === 0 && filteredDms.length === 0 && searchQuery && (
          <p className="px-5 py-3 text-sm text-muted-foreground">
            No results for &ldquo;{searchQuery}&rdquo;.
          </p>
        )}
      </div>
    </div>
  );
}

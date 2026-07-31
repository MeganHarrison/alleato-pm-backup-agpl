"use client";

import { Bell, MessageSquare, Trash2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface ActivityFeedItem {
  id: string;
  title: string;
  body: string | null;
  href: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  createdAt: string | number | null;
  avatarLabel: string;
  sourceLabel?: string | null;
  isUnread?: boolean;
  kind?: "project" | "comment";
  onClick?: () => void;
  onDelete?: () => void;
}

function formatTime(value: string | number | null) {
  if (value == null) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7
    ? `${days}d ago`
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function initials(value?: string | null) {
  if (!value) return "?";

  return value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ActivityFeedRow({ item }: { item: ActivityFeedItem }) {
  const isUnread = item.isUnread === true;

  return (
    <div className="group/item relative">
      {isUnread ? (
        <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-primary" />
      ) : null}
      <Link
        href={item.href}
        onClick={item.onClick}
        className={cn(
          "flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50",
          item.secondaryHref ? "pr-24" : "",
        )}
      >
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-medium",
            item.kind === "comment"
              ? "bg-amber-50 text-amber-700"
              : "bg-muted text-muted-foreground",
          )}
        >
          {item.avatarLabel}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-xs leading-snug",
              isUnread ? "font-medium text-foreground" : "text-foreground",
            )}
          >
            {item.title}
          </p>
          {item.body ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
              {item.body}
            </p>
          ) : null}
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground/70">
            {item.kind === "comment" ? (
              <MessageSquare className="h-3 w-3 shrink-0" />
            ) : null}
            {item.sourceLabel ? (
              <span className="truncate">{item.sourceLabel}</span>
            ) : null}
            <span>{formatTime(item.createdAt)}</span>
          </div>
        </div>
      </Link>
      {item.secondaryHref && item.secondaryLabel ? (
        <Link
          href={item.secondaryHref}
          className="absolute right-4 top-3 rounded-full px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {item.secondaryLabel}
        </Link>
      ) : null}
      {item.onDelete ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={item.onDelete}
          aria-label="Delete"
          className="absolute right-2 top-2.5 h-6 w-6 opacity-0 transition-opacity group-hover/item:opacity-100"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      ) : null}
    </div>
  );
}

export function ActivityFeedList({
  items,
  isLoading = false,
  emptyTitle = "No notifications",
  emptyDescription = "You'll be notified about comments, mentions, and project activity.",
}: {
  items: ActivityFeedItem[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (isLoading) {
    return (
      <div className="space-y-0.5 py-2">
        {[1, 2, 3].map((index) => (
          <div key={index} className="flex gap-3 px-4 py-3">
            <Skeleton className="h-7 w-7 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Bell className="h-5 w-5 text-muted-foreground/40" />
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground">{emptyTitle}</p>
          <p className="text-xs text-muted-foreground">{emptyDescription}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/40">
      {items.map((item) => (
        <ActivityFeedRow key={item.id} item={item} />
      ))}
    </div>
  );
}

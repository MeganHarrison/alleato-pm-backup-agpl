"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

import { AppInboxList } from "@/components/collaboration/app-inbox-list";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ds";
import { useCollaborationNotifications } from "@/hooks/use-collaboration-notifications";
import {
  SidePanel,
  SidePanelBody,
  SidePanelContent,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle,
} from "@/components/ui/side-panel";
import { cn } from "@/lib/utils";

function InboxUnreadBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
      {count > 9 ? "9+" : count}
    </span>
  );
}

function MarkAllReadButton({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  if (!count) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto px-0 py-0 text-[11px] text-muted-foreground hover:text-foreground"
      onClick={onClick}
    >
      Mark all read
    </Button>
  );
}

export function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  const { unreadCount, markAllAsRead } = useCollaborationNotifications();

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn(
          "relative h-8 w-8 p-0 transition-colors",
          open
            ? "bg-primary/10 text-primary hover:bg-primary/20"
            : "text-muted-foreground hover:text-foreground",
        )}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        <InboxUnreadBadge count={unreadCount} />
      </Button>

      <SidePanel open={open} onOpenChange={setOpen}>
        <SidePanelContent side="right" size="compact">
          <SidePanelHeader>
            {/* pr-8 clears the SidePanel's built-in close (X) button, which sits
                absolutely at top-4 right-4 — otherwise "Mark all read" collides
                with it. */}
            <div className="flex items-center justify-between gap-3 pr-8">
              <SidePanelTitle>Notifications</SidePanelTitle>
              <MarkAllReadButton
                count={unreadCount}
                onClick={() => {
                  void markAllAsRead();
                }}
              />
            </div>
          </SidePanelHeader>

          <SidePanelBody className="px-0 py-0">
            <React.Suspense
              fallback={
                <div className="px-4 py-6">
                  <EmptyState
                    icon={<Bell className="h-6 w-6" />}
                    title="Notifications unavailable"
                    description="The notification service is temporarily unreachable."
                  />
                </div>
              }
            >
              <AppInboxList onNavigate={() => setOpen(false)} />
            </React.Suspense>
          </SidePanelBody>

          <SidePanelFooter className="border-t border-border/60">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              See all notifications
            </Link>
          </SidePanelFooter>
        </SidePanelContent>
      </SidePanel>
    </>
  );
}

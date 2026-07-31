"use client";

import * as React from "react";
import { Bell, MoreVertical } from "lucide-react";

import { AppInboxList } from "@/components/collaboration/app-inbox-list";
import { EmptyState } from "@/components/ds";
import { PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useCollaborationNotifications } from "@/hooks/use-collaboration-notifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const dynamic = "force-dynamic";

// The unread count is shown once — on the Unread tab. No separate count pill.
function UnreadTabLabel({ count }: { count: number }) {
  return <>Unread{count ? ` (${count})` : ""}</>;
}

// "Mark all read" lives in the overflow menu, not as floating header text.
function NotificationsMenu({
  count,
  onMarkAllRead,
}: {
  count: number;
  onMarkAllRead: () => void;
}) {
  if (!count) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Notification actions"
          className="h-9 w-9 text-muted-foreground"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onMarkAllRead}>
          Mark all read
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function NotificationsPage() {
  const [tab, setTab] = React.useState("all");
  const { unreadCount, markAllAsRead } = useCollaborationNotifications();

  const actions = (
    <NotificationsMenu
      count={unreadCount}
      onMarkAllRead={() => {
        void markAllAsRead();
      }}
    />
  );

  return (
    <PageShell variant="content" title="Notifications" actions={actions}>
      <React.Suspense
        fallback={
          <EmptyState
            icon={<Bell className="h-6 w-6" />}
            title="Notifications unavailable"
            description="The notification service is temporarily unreachable."
          />
        }
      >
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">
              <UnreadTabLabel count={unreadCount} />
            </TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <AppInboxList />
          </TabsContent>
          <TabsContent value="unread">
            <AppInboxList unreadOnly />
          </TabsContent>
        </Tabs>
      </React.Suspense>
    </PageShell>
  );
}

"use client";

/**
 * BottomNavAlertBadge
 *
 * Unread-notification dot for the bottom nav's Alerts tab. Mirrors the header
 * bell's badge but is positioned for the tab icon.
 */

import { useCollaborationNotifications } from "@/hooks/use-collaboration-notifications";

function UnreadDot() {
  const { unreadCount: count } = useCollaborationNotifications();
  if (!count) return null;
  return (
    <span
      className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-none text-primary-foreground"
      aria-label={`${count} unread notifications`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function BottomNavAlertBadge() {
  return <UnreadDot />;
}

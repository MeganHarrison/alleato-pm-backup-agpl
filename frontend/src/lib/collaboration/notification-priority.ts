import type { CollaborationNotification } from "@/hooks/use-collaboration-notifications";

/**
 * Notifications triggered by a real person (comments, replies, mentions — has an
 * `actorId`) rank above system/automated notices (status changes, deadlines, budget
 * alerts, AI approvals — no `actorId`). Sort is stable, so recency order within each
 * group is preserved as long as the input is already newest-first.
 */
export function sortNotificationsByPriority<
  T extends Pick<CollaborationNotification, "actorId">,
>(notifications: T[]): T[] {
  return [...notifications].sort((a, b) => {
    const aIsAutomated = a.actorId ? 0 : 1;
    const bIsAutomated = b.actorId ? 0 : 1;
    return aIsAutomated - bIsAutomated;
  });
}

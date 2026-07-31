import type { CollaborationNotification } from "@/hooks/use-collaboration-notifications";

const ENTITY_ROUTE_SEGMENTS: Record<string, string> = {
  change_events: "change-events",
  invoice: "invoicing",
  invoices: "invoicing",
  rfi: "rfis",
  rfis: "rfis",
  submittal: "submittals",
  submittals: "submittals",
  schedule_task: "schedule",
};

export function getCollaborationNotificationHref(
  notification: Pick<
    CollaborationNotification,
    "projectId" | "entityType" | "entityId"
  >,
) {
  if (!notification.projectId || !notification.entityType) {
    return "/team-chat";
  }

  const segment =
    ENTITY_ROUTE_SEGMENTS[notification.entityType] ?? notification.entityType;
  const suffix = notification.entityType === "schedule_task"
    ? notification.entityId ? `?task_id=${encodeURIComponent(notification.entityId)}` : ""
    : notification.entityId ? `/${notification.entityId}` : "";
  return `/${notification.projectId}/${segment}${suffix}`;
}

export function getCommentDiscussionHref(
  documentId: string | null | undefined,
  annotationId: string | null | undefined,
) {
  if (!annotationId) {
    return "/comments";
  }

  if (!documentId || !documentId.startsWith("/")) {
    return `/comments?thread=${encodeURIComponent(annotationId)}`;
  }

  const params = new URLSearchParams({ discussion: annotationId });
  return documentId === "/"
    ? `/?${params.toString()}`
    : `${documentId}?${params.toString()}`;
}

export function getCommentFollowUpAction(
  annotationId: string | null | undefined,
) {
  if (!annotationId) {
    return {
      href: "/comments",
      label: "Comments workspace",
    };
  }

  const params = new URLSearchParams({ discussion: annotationId });
  return {
    href: `/team-chat?${params.toString()}`,
    label: "Team chat",
  };
}

export function getCommentTeamChatHref(
  annotationId: string | null | undefined,
) {
  return getCommentFollowUpAction(annotationId).href;
}

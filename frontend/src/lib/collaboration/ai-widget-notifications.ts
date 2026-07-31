import type { Json } from "@/types/database.types";
import {
  AI_APPROVAL_QUEUE_NOTIFICATION_KIND,
  isAiApprovalQueueNotification,
} from "./ai-approval-queue";
import { shouldInterruptAiWidget } from "./ai-notification-routing";

export const AI_WIDGET_NOTIFICATION_KINDS = [
  "ai_assistant_welcome",
  "ai_action_ready",
  "ai_notification_decision",
  "rfi_attention",
] as const;

export type AiWidgetNotificationKind =
  (typeof AI_WIDGET_NOTIFICATION_KINDS)[number];

export type AiWidgetNotificationMetadata = {
  prompt?: string;
  actionLabel?: string;
  source?: string;
  eventType?: string;
  requiredAction?: string;
  tier?: string;
};

export type AiWidgetNotificationCandidate = {
  id?: string;
  kind: string;
  title?: string | null;
  body?: string | null;
  readAt: string | null;
  metadata?: Json | null;
};

export type AiWidgetNotificationDraft = {
  id: string;
  prompt: string;
  actionLabel?: string;
  source?: string;
};

const AI_WIDGET_NOTIFICATION_KIND_SET = new Set<string>(
  AI_WIDGET_NOTIFICATION_KINDS,
);

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function isAiWidgetNotificationKind(
  kind: string,
): kind is AiWidgetNotificationKind {
  return AI_WIDGET_NOTIFICATION_KIND_SET.has(kind);
}

export function getAiWidgetNotificationMetadata(
  metadata: Json | null | undefined,
): AiWidgetNotificationMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  const record = metadata as Record<string, unknown>;

  return {
    prompt: cleanString(record.prompt),
    actionLabel: cleanString(record.actionLabel),
    source: cleanString(record.source),
    eventType: cleanString(record.eventType),
    requiredAction: cleanString(record.requiredAction),
    tier: cleanString(record.tier),
  };
}

export function isUnreadAiWidgetNotification(
  notification: AiWidgetNotificationCandidate,
): boolean {
  return (
    !notification.readAt &&
    isAiWidgetNotificationKind(notification.kind) &&
    shouldInterruptAiWidget(notification)
  );
}

export function getUnreadAiWidgetNotifications<
  T extends AiWidgetNotificationCandidate,
>(notifications: T[]): T[] {
  return notifications.filter(isUnreadAiWidgetNotification);
}

export function getUnreadAiApprovalDecisionNotifications<
  T extends AiWidgetNotificationCandidate,
>(notifications: T[]): T[] {
  return notifications.filter(
    (notification) =>
      !notification.readAt &&
      notification.kind === AI_APPROVAL_QUEUE_NOTIFICATION_KIND &&
      isAiApprovalQueueNotification(notification),
  );
}

export function getFirstUnreadAiWidgetNotificationDraft<
  T extends AiWidgetNotificationCandidate & { id: string },
>(notifications: T[]): AiWidgetNotificationDraft | null {
  for (const notification of getUnreadAiWidgetNotifications(notifications)) {
    if (isAiApprovalQueueNotification(notification)) continue;

    const metadata = getAiWidgetNotificationMetadata(notification.metadata);
    const prompt =
      metadata.prompt ?? getAiNotificationDecisionPrompt(notification, metadata);
    if (!prompt) continue;

    return {
      id: notification.id,
      prompt,
      actionLabel: metadata.actionLabel,
      source: metadata.source,
    };
  }

  return null;
}

function getAiNotificationDecisionPrompt(
  notification: AiWidgetNotificationCandidate,
  metadata: AiWidgetNotificationMetadata,
): string | null {
  if (notification.kind !== "ai_notification_decision") return null;

  const title = cleanString(notification.title);
  const body = cleanString(notification.body);
  const requiredAction = metadata.requiredAction;
  const subject = requiredAction ?? body ?? title;

  if (!subject) return null;

  return `Review this AI update: ${subject}`;
}

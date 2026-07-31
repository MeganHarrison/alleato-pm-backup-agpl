import type { Json } from "@/types/database.types";
import type {
  AiNotificationChannel,
  AiNotificationTier,
} from "@/lib/ai/notification-routing";
import {
  AI_APPROVAL_QUEUE_NOTIFICATION_KIND,
  isAiApprovalQueueNotification,
} from "./ai-approval-queue";

export type AiNotificationDeliveryChannel =
  | AiNotificationChannel
  | "approvals_queue";

export type AiNotificationRoutingCandidate = {
  kind: string;
  metadata?: Json | null;
};

export type AiNotificationDeliveryPlan = {
  tier: AiNotificationTier;
  channels: AiNotificationDeliveryChannel[];
  reason: string;
};

const AI_NOTIFICATION_KINDS = new Set([
  "ai_assistant_welcome",
  "ai_action_ready",
  AI_APPROVAL_QUEUE_NOTIFICATION_KIND,
  "rfi_attention",
]);

const INTERRUPT_EVENT_PATTERNS = [
  "awaiting_approval",
  "requires_review",
  "review_needed",
  "ready_to_send",
  "requires_response",
];

const QUIET_EVENT_PATTERNS = [
  "memory_updated",
  "profile_updated",
  "knowledge_saved",
  "sync_completed",
];

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getMetadataRecord(metadata: Json | null | undefined): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return metadata as Record<string, unknown>;
}

function getChannelsSelected(metadata: Json | null | undefined): AiNotificationChannel[] {
  const record = getMetadataRecord(metadata);
  if (!Array.isArray(record.channelsSelected)) return [];

  return record.channelsSelected.filter(
    (channel): channel is AiNotificationChannel =>
      typeof channel === "string" && channel.trim().length > 0,
  );
}

function hasPattern(value: string | undefined, patterns: string[]): boolean {
  return Boolean(value && patterns.some((pattern) => value.includes(pattern)));
}

function explicitTier(value: string | undefined): AiNotificationTier | null {
  if (value === "interrupt") return "interrupt";
  if (value === "quiet") return "quiet";
  if (value === "digest") return "digest";
  if (value === "system") return "system";
  return null;
}

function defaultChannelsForTier(tier: AiNotificationTier): AiNotificationChannel[] {
  if (tier === "interrupt") return ["in_app", "assistant_widget"];
  if (tier === "digest") return ["digest"];
  if (tier === "system") return ["admin_system_queue"];
  return ["quiet_inbox"];
}

export function getAiNotificationDeliveryPlan(
  notification: AiNotificationRoutingCandidate,
): AiNotificationDeliveryPlan | null {
  if (!AI_NOTIFICATION_KINDS.has(notification.kind)) return null;

  const metadata = getMetadataRecord(notification.metadata);
  const eventType = cleanString(metadata.eventType);
  const tierOverride = explicitTier(cleanString(metadata.tier));
  const selectedChannels = getChannelsSelected(notification.metadata);
  const hasSelectedChannels = selectedChannels.length > 0;

  if (notification.kind === "ai_assistant_welcome") {
    return {
      tier: "interrupt",
      channels: hasSelectedChannels ? selectedChannels : ["assistant_widget"],
      reason: "Welcome notifications intentionally introduce the assistant entry point.",
    };
  }

  if (notification.kind === "ai_action_ready") {
    return {
      tier: tierOverride ?? "interrupt",
      channels: hasSelectedChannels ? selectedChannels : ["assistant_widget"],
      reason: "Assistant action notifications are intended to be available from the widget.",
    };
  }

  if (
    notification.kind === AI_APPROVAL_QUEUE_NOTIFICATION_KIND &&
    isAiApprovalQueueNotification(notification)
  ) {
    const channels: AiNotificationDeliveryChannel[] = hasSelectedChannels
      ? ["approvals_queue", ...selectedChannels]
      : ["approvals_queue", "in_app", "assistant_widget"];

    return {
      tier: tierOverride ?? "interrupt",
      channels,
      reason: "AI decision requires human review before a business action proceeds.",
    };
  }

  if (tierOverride) {
    return {
      tier: tierOverride,
      channels: hasSelectedChannels ? selectedChannels : defaultChannelsForTier(tierOverride),
      reason:
        tierOverride === "interrupt"
          ? "Notification requires timely human attention."
          : "Notification is useful context but does not require interruption.",
    };
  }

  if (hasPattern(eventType, INTERRUPT_EVENT_PATTERNS) || notification.kind === "rfi_attention") {
    return {
      tier: "interrupt",
      channels: hasSelectedChannels ? selectedChannels : ["in_app", "assistant_widget"],
      reason:
        notification.kind === "rfi_attention"
          ? "RFI attention notifications can affect project response timing."
          : "Notification requires timely human attention.",
    };
  }

  if (hasPattern(eventType, QUIET_EVENT_PATTERNS)) {
    return {
      tier: "quiet",
      channels: hasSelectedChannels ? selectedChannels : ["quiet_inbox"],
      reason: "Notification is useful context but does not require interruption.",
    };
  }

  return {
    tier: "quiet",
    channels: hasSelectedChannels ? selectedChannels : ["quiet_inbox"],
    reason: "Default AI notification route is quiet until a review or response signal is present.",
  };
}

export function shouldInterruptAiWidget(
  notification: AiNotificationRoutingCandidate,
): boolean {
  const plan = getAiNotificationDeliveryPlan(notification);
  return Boolean(plan?.tier === "interrupt" && plan.channels.includes("assistant_widget"));
}

import { serviceDb } from "@/lib/supabase/service-db";
import {
  routeAiNotification,
  type AiNotificationRoutingDecision,
  type AiNotificationRoutingInput,
} from "@/lib/ai/notification-routing";
import type { Database, Json } from "@/types/database.types";

type CollaborationNotificationInsert =
  Database["public"]["Tables"]["collaboration_notifications"]["Insert"];

export type AiNotificationDecisionRecordInput = AiNotificationRoutingInput & {
  recipientUserId: string;
  projectId?: number | null;
  entityType?: string | null;
  entityId?: string | null;
  actorId?: string | null;
  eventKey?: string | null;
  title?: string | null;
  body?: string | null;
  preview?: unknown;
};

export type AiNotificationDecisionLedgerResult =
  | {
      status: "recorded";
      decision: AiNotificationRoutingDecision;
    }
  | {
      status: "skipped_duplicate";
      decision: AiNotificationRoutingDecision;
      existingId: string;
    }
  | {
      status: "failed";
      decision: AiNotificationRoutingDecision;
      error: {
        code: "missing_recipient" | "duplicate_lookup_failed" | "insert_failed";
        message: string;
      };
    };

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function buildDecisionTitle(input: AiNotificationDecisionRecordInput) {
  return (
    cleanText(input.title) ??
    `AI notification decision: ${input.eventType.replaceAll("_", " ")}`
  );
}

function buildDecisionBody(
  decision: AiNotificationRoutingDecision,
  input: AiNotificationDecisionRecordInput,
) {
  return cleanText(input.body) ?? decision.requiredAction;
}

function cleanJson(value: unknown): Json | null {
  if (value == null) return null;

  try {
    return JSON.parse(JSON.stringify(value)) as Json;
  } catch {
    return null;
  }
}

function buildDecisionMetadata(
  input: AiNotificationDecisionRecordInput,
  decision: AiNotificationRoutingDecision,
): Json {
  return {
    source: "ai_notification_routing",
    eventKey: cleanText(input.eventKey),
    eventType: input.eventType,
    severity: input.severity ?? "normal",
    sourceConfidence: input.sourceConfidence ?? null,
    tier: decision.tier,
    channelsSelected: decision.channels,
    channelsSent: [],
    channelsFailed: [],
    channelsSkipped: [],
    requiredAction: decision.requiredAction,
    reason: decision.reason,
    failureLoudBehavior: decision.failureLoudBehavior,
    preferenceOverrideReason: decision.preferenceOverrideReason,
    preferenceHints: input.preferenceHints ?? {},
    teamsRecipientLinked: input.teamsRecipientLinked ?? null,
    isUserOnRelatedPage: input.isUserOnRelatedPage ?? null,
    hasDeliveryFailure: input.hasDeliveryFailure ?? false,
    preview: cleanJson(input.preview),
    ledgerOnly: true,
  };
}

export async function recordAiNotificationDecision(
  input: AiNotificationDecisionRecordInput,
): Promise<AiNotificationDecisionLedgerResult> {
  const decision = routeAiNotification(input);
  const recipientUserId = cleanText(input.recipientUserId);

  if (!recipientUserId) {
    return {
      status: "failed",
      decision,
      error: {
        code: "missing_recipient",
        message: "AI notification decisions require a recipient user ID.",
      },
    };
  }

    const eventKey = cleanText(input.eventKey);

  if (eventKey) {
    const { data: existing, error: existingError } = await serviceDb.from("collaboration_notifications")
      .select("id")
      .eq("user_id", recipientUserId)
      .eq("kind", "ai_notification_decision")
      .eq("metadata->>eventKey", eventKey)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return {
        status: "failed",
        decision,
        error: {
          code: "duplicate_lookup_failed",
          message: `Failed to check existing AI notification decision (${input.eventType}): ${existingError.message}`,
        },
      };
    }

    if (existing?.id) {
      return {
        status: "skipped_duplicate",
        decision,
        existingId: existing.id,
      };
    }
  }

  const payload: CollaborationNotificationInsert = {
    user_id: recipientUserId,
    actor_id: cleanText(input.actorId),
    project_id: input.projectId ?? null,
    entity_type: cleanText(input.entityType),
    entity_id: cleanText(input.entityId),
    kind: "ai_notification_decision",
    title: buildDecisionTitle(input),
    body: buildDecisionBody(decision, input),
    metadata: buildDecisionMetadata(input, decision),
  };

  const { error } = await serviceDb.from("collaboration_notifications")
    .insert(payload);

  if (error) {
    return {
      status: "failed",
      decision,
      error: {
        code: "insert_failed",
        message: `Failed to record AI notification decision (${input.eventType}): ${error.message}`,
      },
    };
  }

  return {
    status: "recorded",
    decision,
  };
}

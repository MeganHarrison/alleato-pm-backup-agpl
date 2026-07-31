import { recordAiFeedbackEvent } from "@/lib/ai/services/feedback-event-service";
import { serviceDb } from "@/lib/supabase/service-db";
import type { Json } from "@/types/database.types";
import {
  EMAIL_IMPORTANCE_CLEARED_SIGNAL,
  type EmailImportanceFeedbackState,
  type EmailImportanceReasonCategory,
  type EmailImportanceSignal,
} from "@/lib/ai/email-importance-feedback-types";

export interface RecordEmailImportanceFeedbackParams {
  userId: string;
  emailId: number;
  projectId?: number | null;
  signal: EmailImportanceSignal;
  reasonCategory?: EmailImportanceReasonCategory | null;
  reason?: string | null;
  emailSnapshot: Json;
}

export interface ClearEmailImportanceFeedbackParams {
  userId: string;
  emailId: number;
  projectId?: number | null;
  emailSnapshot?: Json;
}

const EVENT_TYPE = "email_importance_feedback_recorded";
const SOURCE_TABLE = "project_emails";
const SUBJECT_TYPE = "project_email";

function signalToFeedbackSignal(signal: EmailImportanceSignal) {
  return signal === "important" ? "positive" : "negative";
}

function metadataSignal(
  value: Json,
): EmailImportanceSignal | typeof EMAIL_IMPORTANCE_CLEARED_SIGNAL | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const signal = (value as Record<string, unknown>).emailImportanceSignal;
  return signal === "important" ||
    signal === "not_important" ||
    signal === EMAIL_IMPORTANCE_CLEARED_SIGNAL
    ? signal
    : null;
}

export async function recordEmailImportanceFeedback(
  params: RecordEmailImportanceFeedbackParams,
) {
  return recordAiFeedbackEvent({
    userId: params.userId,
    projectId: params.projectId ?? null,
    sourceTable: SOURCE_TABLE,
    sourceRecordId: String(params.emailId),
    eventType: EVENT_TYPE,
    eventFamily: "user_preference",
    surface: "outlook_emails",
    subjectType: SUBJECT_TYPE,
    subjectId: String(params.emailId),
    signal: signalToFeedbackSignal(params.signal),
    reasonCategory: params.reasonCategory ?? null,
    freeText: params.reason ?? null,
    afterSnapshot: params.emailSnapshot,
    metadata: {
      emailId: params.emailId,
      emailImportanceSignal: params.signal,
      visibility: "team",
    },
  });
}

export async function clearEmailImportanceFeedback(
  params: ClearEmailImportanceFeedbackParams,
) {
  return recordAiFeedbackEvent({
    userId: params.userId,
    projectId: params.projectId ?? null,
    sourceTable: SOURCE_TABLE,
    sourceRecordId: String(params.emailId),
    eventType: EVENT_TYPE,
    eventFamily: "user_preference",
    surface: "outlook_emails",
    subjectType: SUBJECT_TYPE,
    subjectId: String(params.emailId),
    signal: "ignored",
    reasonCategory: "reverted",
    freeText: null,
    afterSnapshot: params.emailSnapshot ?? null,
    metadata: {
      emailId: params.emailId,
      emailImportanceSignal: EMAIL_IMPORTANCE_CLEARED_SIGNAL,
      visibility: "team",
    },
  });
}

export async function getLatestEmailImportanceFeedback(
  userId: string,
  emailIds: number[],
): Promise<Record<string, EmailImportanceFeedbackState>> {
  if (emailIds.length === 0) return {};

    const distinctIds = Array.from(
    new Set(
      emailIds
        .filter((id) => Number.isInteger(id) && id > 0)
        .map((id) => String(id)),
    ),
  );

  if (distinctIds.length === 0) return {};

  const { data, error } = await serviceDb.from("ai_feedback_events")
    .select(
      "source_record_id, signal, reason_category, free_text, created_at, metadata",
    )
    .eq("user_id", userId)
    .eq("event_type", EVENT_TYPE)
    .eq("source_table", SOURCE_TABLE)
    .in("source_record_id", distinctIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load email importance feedback: ${error.message}`);
  }

  const results: Record<string, EmailImportanceFeedbackState> = {};

  const seen = new Set<string>();

  for (const row of data ?? []) {
    const emailId = row.source_record_id;
    if (!emailId || seen.has(emailId)) continue;
    seen.add(emailId);

    const signalFromMetadata = metadataSignal(row.metadata);

    if (signalFromMetadata === EMAIL_IMPORTANCE_CLEARED_SIGNAL) continue;

    const signal: EmailImportanceSignal =
      signalFromMetadata ??
      (row.signal === "positive" ? "important" : "not_important");

    results[emailId] = {
      signal,
      reasonCategory:
        (row.reason_category as EmailImportanceReasonCategory | null) ?? null,
      reason: row.free_text ?? null,
      createdAt: row.created_at,
    };
  }

  return results;
}

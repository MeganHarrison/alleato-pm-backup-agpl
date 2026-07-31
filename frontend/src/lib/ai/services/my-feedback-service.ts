import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { recordTaskFeedback } from "@/lib/ai/services/task-training-service";
import {
  TASK_FEEDBACK_REASON_CATEGORIES,
  type TaskFeedbackReasonCategory,
  type TaskSnapshot,
} from "@/lib/ai/task-feedback-types";
import type { Database, Json } from "@/types/database.types";
import { logger } from "@/lib/logger";

type AiFeedbackEventRow = Database["public"]["Tables"]["ai_feedback_events"]["Row"];

/**
 * "My feedback" — the unified, user-scoped read/edit/undo layer over the
 * `ai_feedback_events` ledger. Every thumbs-up/down, rating, and correction a
 * user submits anywhere in the app lands in that ledger with a `source_table` +
 * `source_record_id` pointing back at the origin row. This service lets a user
 * SEE what they submitted and FIX a mistake — the capability that was missing
 * (feedback persisted to the DB but was fire-and-forget in the UI).
 *
 * Retract is deliberately conservative:
 *   - dedicated feedback tables (ai_task_feedback, intelligence_reviews) → the
 *     origin row is removed and any derived agent_learning is archived so it
 *     stops influencing the AI.
 *   - content-source surfaces (project_emails, chat_history, ai_memories) → only
 *     the ledger event (the signal itself) is removed. The content is never
 *     touched.
 */

export type MyFeedbackSignalTone = "positive" | "negative" | "neutral";

export interface MyFeedbackItem {
  id: string;
  surfaceKey: string;
  surfaceLabel: string;
  signal: string;
  signalLabel: string;
  signalTone: MyFeedbackSignalTone;
  reasonCategory: string | null;
  reasonLabel: string | null;
  note: string | null;
  subjectType: string;
  itemTitle: string;
  createdAt: string | null;
  projectId: number | null;
  sourceTable: string | null;
  sourceRecordId: string | null;
  /** True when the rating (not just the note) can be changed safely in place. */
  canEditSignal: boolean;
  signalOptions: { value: string; label: string }[];
}

type RetractStrategy = "ledger_only" | "task_feedback" | "delete_source_row";

interface SurfaceAdapter {
  label: string;
  retract: RetractStrategy;
  canEditSignal: boolean;
  /** Rating choices offered in the edit dialog (only when canEditSignal). */
  signalOptions: { value: string; label: string }[];
  titleFrom: (row: AiFeedbackEventRow) => string | null;
}

const TASK_SIGNAL_OPTIONS = [
  { value: "positive", label: "Helpful" },
  { value: "negative", label: "Not helpful" },
];

/**
 * Adapter map keyed by `source_table` — the ledger's stable back-pointer. A
 * surface without an entry falls back to a safe ledger-only default.
 */
const SURFACE_ADAPTERS: Record<string, SurfaceAdapter> = {
  ai_task_feedback: {
    label: "Task feedback",
    retract: "task_feedback",
    canEditSignal: true,
    signalOptions: TASK_SIGNAL_OPTIONS,
    titleFrom: (row) =>
      readString(row.after_snapshot, "name") ??
      readString(row.metadata, "taskId"),
  },
  intelligence_reviews: {
    label: "Insight card feedback",
    retract: "delete_source_row",
    canEditSignal: false,
    signalOptions: [],
    titleFrom: (row) =>
      readString(row.after_snapshot, "title") ??
      readString(row.source_context, "title"),
  },
  project_emails: {
    label: "Email importance",
    retract: "ledger_only",
    canEditSignal: false,
    signalOptions: [],
    titleFrom: (row) =>
      readString(row.source_context, "subject") ??
      readString(row.metadata, "subject"),
  },
  chat_history: {
    label: "AI chat feedback",
    retract: "ledger_only",
    canEditSignal: false,
    signalOptions: [],
    titleFrom: (row) =>
      readString(row.source_context, "question") ??
      readString(row.metadata, "question"),
  },
  ai_memories: {
    label: "AI memory correction",
    retract: "ledger_only",
    canEditSignal: false,
    signalOptions: [],
    titleFrom: (row) =>
      readString(row.after_snapshot, "content") ??
      readString(row.source_context, "content"),
  },
  microsoft_graph_messages: {
    label: "Email draft feedback",
    retract: "ledger_only",
    canEditSignal: false,
    signalOptions: [],
    titleFrom: (row) => readString(row.source_context, "subject"),
  },
};

function fallbackAdapter(surface: string): SurfaceAdapter {
  return {
    label: humanize(surface),
    retract: "ledger_only",
    canEditSignal: false,
    signalOptions: [],
    titleFrom: () => null,
  };
}

function adapterFor(row: AiFeedbackEventRow): SurfaceAdapter {
  const key = row.source_table ?? "";
  return SURFACE_ADAPTERS[key] ?? fallbackAdapter(row.surface);
}

const SIGNAL_LABELS: Record<string, { label: string; tone: MyFeedbackSignalTone }> = {
  positive: { label: "Helpful", tone: "positive" },
  negative: { label: "Not helpful", tone: "negative" },
  corrected: { label: "Corrected", tone: "neutral" },
  accepted: { label: "Accepted", tone: "positive" },
  ignored: { label: "Ignored", tone: "neutral" },
  completed: { label: "Completed", tone: "positive" },
  failed: { label: "Failed", tone: "negative" },
  needs_review: { label: "Needs review", tone: "neutral" },
  stale: { label: "Stale", tone: "negative" },
  conflicting: { label: "Conflicting", tone: "negative" },
};

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function asRecord(value: Json | null | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: Json | null | undefined, key: string): string | null {
  const raw = asRecord(value)[key];
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function toItem(row: AiFeedbackEventRow): MyFeedbackItem {
  const adapter = adapterFor(row);
  const signalMeta = SIGNAL_LABELS[row.signal] ?? {
    label: humanize(row.signal),
    tone: "neutral" as MyFeedbackSignalTone,
  };
  const title = adapter.titleFrom(row);
  return {
    id: row.id,
    surfaceKey: row.surface,
    surfaceLabel: adapter.label,
    signal: row.signal,
    signalLabel: signalMeta.label,
    signalTone: signalMeta.tone,
    reasonCategory: row.reason_category,
    reasonLabel: row.reason_category ? humanize(row.reason_category) : null,
    note: row.free_text,
    subjectType: row.subject_type,
    itemTitle: title ?? humanize(row.subject_type),
    createdAt: row.created_at,
    projectId: row.project_id,
    sourceTable: row.source_table,
    sourceRecordId: row.source_record_id,
    canEditSignal: adapter.canEditSignal,
    signalOptions: adapter.signalOptions,
  };
}

export interface ListMyFeedbackParams {
  userId: string;
  surface?: string;
  signalTone?: MyFeedbackSignalTone;
  limit?: number;
  offset?: number;
}

export interface ListMyFeedbackResult {
  items: MyFeedbackItem[];
  surfaces: { key: string; label: string }[];
  total: number;
}

const POSITIVE_SIGNALS = ["positive", "accepted", "completed"];
const NEGATIVE_SIGNALS = ["negative", "failed", "stale", "conflicting"];

export async function listMyFeedback(
  params: ListMyFeedbackParams,
): Promise<ListMyFeedbackResult> {
  const supabase = createServiceClient();
  const limit = Math.min(500, Math.max(1, params.limit ?? 200));
  const offset = Math.max(0, params.offset ?? 0);

  let query = supabase
    .from("ai_feedback_events")
    .select("*", { count: "exact" })
    .eq("user_id", params.userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.surface) {
    query = query.eq("surface", params.surface);
  }
  if (params.signalTone === "positive") {
    query = query.in("signal", POSITIVE_SIGNALS);
  } else if (params.signalTone === "negative") {
    query = query.in("signal", NEGATIVE_SIGNALS);
  }

  const { data, error, count } = await query;
  if (error) {
    throw new Error(`Failed to load feedback: ${error.message}`);
  }

  const items = (data ?? []).map(toItem);
  const surfaceMap = new Map<string, string>();
  for (const item of items) {
    if (!surfaceMap.has(item.surfaceKey)) {
      surfaceMap.set(item.surfaceKey, item.surfaceLabel);
    }
  }

  return {
    items,
    surfaces: [...surfaceMap.entries()].map(([key, label]) => ({ key, label })),
    total: count ?? items.length,
  };
}

async function loadOwnedEvent(
  userId: string,
  eventId: string,
): Promise<AiFeedbackEventRow> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("ai_feedback_events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (error || !data) {
    throw new MyFeedbackError("not_found", "That feedback no longer exists.");
  }
  if (data.user_id !== userId) {
    throw new MyFeedbackError("forbidden", "You can only change your own feedback.");
  }
  return data;
}

export class MyFeedbackError extends Error {
  constructor(
    public readonly kind: "not_found" | "forbidden" | "invalid",
    message: string,
  ) {
    super(message);
    this.name = "MyFeedbackError";
  }
}

/**
 * Retract (undo) a submitted feedback item. Removes the ledger event and, for
 * dedicated feedback tables, the origin row + archives any derived learning so
 * a mistaken thumbs-down stops teaching the AI.
 */
export async function retractMyFeedback(
  userId: string,
  eventId: string,
): Promise<void> {
  const event = await loadOwnedEvent(userId, eventId);
  const supabase = createServiceClient();
  const adapter = adapterFor(event);

  if (adapter.retract === "task_feedback" && event.source_record_id) {
    const { data: fb } = await supabase
      .from("ai_task_feedback")
      .select("id, learning_id")
      .eq("id", event.source_record_id)
      .maybeSingle();

    if (fb?.learning_id) {
      const { error: learnErr } = await supabase
        .from("agent_learnings")
        .update({ status: "archived" })
        .eq("id", fb.learning_id);
      if (learnErr) {
        logger.warn({
          msg: "[MyFeedback] Failed to archive derived learning on retract",
          error: learnErr.message,
          learningId: fb.learning_id,
        });
      }
    }
    await supabase.from("ai_task_feedback").delete().eq("id", event.source_record_id);
  } else if (adapter.retract === "delete_source_row" && event.source_table && event.source_record_id) {
    await serviceDb
      .from(event.source_table as "intelligence_reviews")
      .delete()
      .eq("id", event.source_record_id);
  }

  const { error } = await supabase
    .from("ai_feedback_events")
    .delete()
    .eq("id", eventId);
  if (error) {
    throw new Error(`Failed to retract feedback: ${error.message}`);
  }
}

export interface EditMyFeedbackParams {
  userId: string;
  eventId: string;
  /** New rating — only honored for surfaces where canEditSignal is true. */
  signal?: "positive" | "negative";
  note?: string | null;
}

/**
 * Edit a submitted feedback item. For task feedback (the surface where a rating
 * change must re-derive the learning) this is implemented as retract +
 * re-record through the exact same write path used at submission time, so the
 * derived learning stays consistent. For every other surface only the free-text
 * note is updated on the ledger event.
 */
export async function editMyFeedback(
  params: EditMyFeedbackParams,
): Promise<void> {
  const event = await loadOwnedEvent(params.userId, params.eventId);
  const adapter = adapterFor(event);
  const supabase = createServiceClient();

  if (adapter.retract === "task_feedback" && event.source_record_id) {
    const { data: fb, error } = await supabase
      .from("ai_task_feedback")
      .select("*")
      .eq("id", event.source_record_id)
      .maybeSingle();
    if (error || !fb) {
      throw new MyFeedbackError("not_found", "That feedback no longer exists.");
    }

    const nextSignal =
      params.signal === "positive"
        ? "good"
        : params.signal === "negative"
          ? "bad"
          : (fb.signal as "good" | "bad");
    const nextReason =
      params.note !== undefined ? (params.note?.trim() || null) : fb.reason;
    const reasonCategory: TaskFeedbackReasonCategory | null =
      fb.reason_category &&
      (TASK_FEEDBACK_REASON_CATEGORIES as readonly string[]).includes(
        fb.reason_category,
      )
        ? (fb.reason_category as TaskFeedbackReasonCategory)
        : null;

    // Reuse the canonical write path: remove the old record + derived learning,
    // then re-record so a flipped rating re-derives (or drops) the learning.
    await retractMyFeedback(params.userId, params.eventId);
    await recordTaskFeedback({
      userId: params.userId,
      projectId: fb.project_id,
      taskId: fb.generated_task_id,
      signal: nextSignal,
      reasonCategory,
      reason: nextReason,
      taskSnapshot: fb.task_snapshot as unknown as TaskSnapshot,
      sessionId: fb.session_id,
    });
    return;
  }

  // Generic surfaces: note-only edit on the ledger event.
  if (params.note === undefined) return;
  const note = params.note?.trim() || null;
  const { error } = await supabase
    .from("ai_feedback_events")
    .update({ free_text: note })
    .eq("id", params.eventId);
  if (error) {
    throw new Error(`Failed to update feedback: ${error.message}`);
  }

  // Mirror the note onto a dedicated review row when one exists.
  if (event.source_table === "intelligence_reviews" && event.source_record_id) {
    await supabase
      .from("intelligence_reviews")
      .update({ review_reason: note ?? "" })
      .eq("id", event.source_record_id);
  }
}

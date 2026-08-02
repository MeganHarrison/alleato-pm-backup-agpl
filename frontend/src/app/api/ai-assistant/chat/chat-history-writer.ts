/**
 * ChatHistoryWriter — one seam for persisting chat_history rows.
 *
 * runChatV2 writes to `chat_history` in ~22 places, each repeating the same
 * row shape (`session_id`, `user_id`, `role`, `content`, `metadata`) and its own
 * ad-hoc error handling — some throw, some silently ignore the error. That drift
 * is exactly where a persisted message can go missing without a trace.
 *
 * This module concentrates the row shape and the failure contract behind a small
 * interface bound once per request to `(supabase, sessionId, userId)`. It accepts
 * the Supabase client (the data seam) rather than constructing one, so it is
 * testable with a fake client and no import-boundary mocks.
 *
 * Failure contract: `persist` returns `{ error }` for callers that want to decide;
 * `persistOrThrow` raises loudly (never silently drops a row) — the default for
 * the user/assistant turn records that the feedback + eval tooling depends on.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";

export type ChatRole = "user" | "assistant";

export interface ChatHistoryWriterContext {
  sessionId: string;
  userId: string;
}

export interface ChatHistoryRecord {
  role: ChatRole;
  content: string;
  metadata?: Record<string, unknown> | Json;
  sources?: Json;
}

/** Compatibility shape for legacy branches while they converge on ChatHistoryRecord. */
export interface BoundChatHistoryRecord extends ChatHistoryRecord {
  session_id: string;
  user_id: string;
}

export interface ChatHistoryWriter {
  /**
   * The sole persistence seam for a chat turn. Context identity is bound when
   * the writer is created, so callers cannot accidentally persist a row for a
   * different session or user while handling the current request.
   */
  persistRecord(record: ChatHistoryRecord): Promise<{ error: string | null }>;
  persistRecordOrThrow(record: ChatHistoryRecord, label?: string): Promise<void>;
  replaceRecordOrThrow(
    recordId: string,
    record: ChatHistoryRecord,
    label?: string,
  ): Promise<void>;
  persistBoundRecord(record: BoundChatHistoryRecord): Promise<{ error: string | null }>;
  persist(
    role: ChatRole,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ error: string | null }>;
  persistOrThrow(
    role: ChatRole,
    content: string,
    metadata?: Record<string, unknown>,
    label?: string,
  ): Promise<void>;
}

export function createChatHistoryWriter(
  supabase: SupabaseClient<Database>,
  ctx: ChatHistoryWriterContext,
): ChatHistoryWriter {
  async function persistRecord(
    record: ChatHistoryRecord,
  ): Promise<{ error: string | null }> {
    const { error } = await supabase.from("chat_history").insert({
      session_id: ctx.sessionId,
      user_id: ctx.userId,
      role: record.role,
      content: record.content,
      ...(record.sources !== undefined ? { sources: record.sources } : {}),
      ...(record.metadata !== undefined
        ? { metadata: record.metadata as Json }
        : {}),
    });
    return { error: error ? error.message : null };
  }

  async function persistRecordOrThrow(
    record: ChatHistoryRecord,
    label = "chat turn",
  ): Promise<void> {
    const { error } = await persistRecord(record);
    if (error) {
      throw new Error(`Persisting the ${label} failed: ${error}`);
    }
  }

  async function replaceRecordOrThrow(
    recordId: string,
    record: ChatHistoryRecord,
    label = "chat turn",
  ): Promise<void> {
    const { error } = await supabase
      .from("chat_history")
      .update({
        role: record.role,
        content: record.content,
        ...(record.sources !== undefined ? { sources: record.sources } : {}),
        ...(record.metadata !== undefined
          ? { metadata: record.metadata as Json }
          : {}),
      })
      .eq("id", recordId)
      .eq("session_id", ctx.sessionId)
      .eq("user_id", ctx.userId);
    if (error) {
      throw new Error(`Replacing the ${label} failed: ${error.message}`);
    }
  }

  async function persistBoundRecord(
    record: BoundChatHistoryRecord,
  ): Promise<{ error: string | null }> {
    if (record.session_id !== ctx.sessionId || record.user_id !== ctx.userId) {
      throw new Error(
        "Chat turn persistence rejected a row whose session or user differs from the active request.",
      );
    }
    const result = await persistRecord(record);
    if (result.error) {
      throw new Error(`Persisting the ${record.role} chat turn failed: ${result.error}`);
    }
    return { error: null };
  }

  async function persist(
    role: ChatRole,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ error: string | null }> {
    return persistRecord({
      role,
      content,
      ...(metadata ? { metadata } : {}),
    });
  }

  async function persistOrThrow(
    role: ChatRole,
    content: string,
    metadata?: Record<string, unknown>,
    label = "message",
  ): Promise<void> {
    const { error } = await persist(role, content, metadata);
    if (error) {
      throw new Error(`Persisting the ${label} failed: ${error}`);
    }
  }

  return {
    persistRecord,
    persistRecordOrThrow,
    replaceRecordOrThrow,
    persistBoundRecord,
    persist,
    persistOrThrow,
  };
}

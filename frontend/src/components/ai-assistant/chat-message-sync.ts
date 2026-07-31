/**
 * Pure decision helper for the AI-assistant chat's live-vs-persisted message
 * sync. Extracted from `rag-chat-page.tsx` so the logic is unit-testable without
 * mounting the client component.
 *
 * `ChatWithSession` keeps two sources of truth: the live `useChat` message list
 * (authoritative while a turn is in flight) and `initialMessages` loaded from
 * the database (authoritative when switching/hydrating a conversation). When
 * `initialMessages` changes, this helper decides whether to overwrite the live
 * list with it.
 */
export function shouldSyncInitialMessages(params: {
  /**
   * True when this `initialMessages` change is the reload we deliberately
   * trigger in `onEnd`. The live list is already the freshest copy (and
   * carries in-memory status/data parts the DB copy lacks), so don't replace it.
   */
  skipPostFinishReload: boolean;
  /** Number of messages in the incoming DB copy. */
  initialCount: number;
  /** Number of messages currently in the live `useChat` list. */
  liveCount: number;
}): boolean {
  if (params.skipPostFinishReload) return false;

  // Never wipe a non-empty live conversation with an empty DB copy. During the
  // new-conversation handoff the parent briefly resets session messages to []
  // (activeSessionId lags pendingSessionId, hitting the session-load effect's
  // `!sessionId → resetSessionMessages()` branch). Applying that empty array
  // erased the just-sent user message mid-stream — the row is persisted and
  // reloads fine, but the live view flickered it away, leaving only the
  // assistant reply. Regression guard for "my first message disappeared".
  if (params.initialCount === 0 && params.liveCount > 0) return false;

  return true;
}

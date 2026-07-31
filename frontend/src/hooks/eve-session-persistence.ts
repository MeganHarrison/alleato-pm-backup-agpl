import type {
  HandleMessageStreamEvent,
  SessionState,
} from "eve/client";

type EveChatStorage = Pick<Storage, "setItem">;

export type PersistedEveChat = {
  events?: readonly HandleMessageStreamEvent[];
  session?: SessionState;
};

function nonEmpty(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Eve follow-up turns require the complete serialized cursor. Interrupted
 * streams can publish a final snapshot with a session id but no continuation
 * token; never let that incomplete snapshot overwrite a resumable cursor.
 */
export function resolvePersistedEveSession(
  previous: SessionState | undefined,
  incoming: SessionState,
): SessionState | undefined {
  if (!nonEmpty(incoming.sessionId)) {
    return incoming;
  }

  if (nonEmpty(incoming.continuationToken)) {
    return incoming;
  }

  if (
    previous?.sessionId === incoming.sessionId &&
    nonEmpty(previous.continuationToken)
  ) {
    return {
      ...incoming,
      continuationToken: previous.continuationToken,
    };
  }

  return undefined;
}

function streamedPartKey(event: HandleMessageStreamEvent): string | null {
  if (
    event.type !== "message.appended" &&
    event.type !== "reasoning.appended" &&
    event.type !== "message.completed" &&
    event.type !== "reasoning.completed"
  ) {
    return null;
  }

  return `${event.type.startsWith("message.") ? "message" : "reasoning"}:${event.data.turnId}:${event.data.stepIndex}`;
}

/**
 * Eve delta events carry the entire text-so-far on every token. Persisting the
 * raw stream therefore grows quadratically and can exhaust browser storage.
 * Keep only the latest in-progress snapshot for each streamed part, and drop
 * that snapshot once its completed event is present.
 */
export function compactPersistedEveEvents(
  events: readonly HandleMessageStreamEvent[],
): readonly HandleMessageStreamEvent[] {
  const compacted: Array<HandleMessageStreamEvent | null> = [];
  const latestStreamEvent = new Map<string, number>();

  for (const event of events) {
    const key = streamedPartKey(event);
    if (key && event.type.endsWith(".appended")) {
      const previousIndex = latestStreamEvent.get(key);
      if (previousIndex !== undefined) compacted[previousIndex] = null;
      latestStreamEvent.set(key, compacted.length);
      compacted.push(event);
      continue;
    }

    if (key && event.type.endsWith(".completed")) {
      const previousIndex = latestStreamEvent.get(key);
      if (previousIndex !== undefined) compacted[previousIndex] = null;
      latestStreamEvent.delete(key);
    }

    compacted.push(event);
  }

  return compacted.filter(
    (event): event is HandleMessageStreamEvent => event !== null,
  );
}

/**
 * Browser storage writes are atomic: a failed setItem leaves the old value in
 * place. Retry against the same key with only the resumable cursor, and never
 * delete the prior value before the fallback has succeeded.
 */
export function writePersistedEveChat(
  storage: EveChatStorage,
  key: string,
  chat: PersistedEveChat,
): void {
  try {
    storage.setItem(key, JSON.stringify(chat));
    return;
  } catch (error) {
    console.warn(
      "Eve event history exceeded browser storage. Retrying with the resumable session cursor only.",
      error,
    );
  }

  if (!chat.session) {
    console.error(
      "Eve chat persistence failed and no resumable session cursor was available. The prior saved chat was preserved.",
    );
    return;
  }

  try {
    storage.setItem(
      key,
      JSON.stringify({ session: chat.session } satisfies PersistedEveChat),
    );
  } catch (error) {
    console.error(
      "Eve session cursor persistence failed. The prior saved chat was preserved.",
      error,
    );
  }
}

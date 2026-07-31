import type { HandleMessageStreamEvent } from "eve/client";
import {
  compactPersistedEveEvents,
  resolvePersistedEveSession,
  writePersistedEveChat,
} from "../eve-session-persistence";

describe("resolvePersistedEveSession", () => {
  it("keeps a complete incoming Eve cursor", () => {
    expect(
      resolvePersistedEveSession(undefined, {
        continuationToken: "continuation-next",
        sessionId: "session-next",
        streamIndex: 42,
      }),
    ).toEqual({
      continuationToken: "continuation-next",
      sessionId: "session-next",
      streamIndex: 42,
    });
  });

  it("preserves the prior token when an interrupted snapshot omits it", () => {
    expect(
      resolvePersistedEveSession(
        {
          continuationToken: "continuation-existing",
          sessionId: "session-existing",
          streamIndex: 40,
        },
        {
          sessionId: "session-existing",
          streamIndex: 41,
        },
      ),
    ).toEqual({
      continuationToken: "continuation-existing",
      sessionId: "session-existing",
      streamIndex: 41,
    });
  });

  it("rejects a tokenless remote session that cannot be resumed", () => {
    expect(
      resolvePersistedEveSession(undefined, {
        sessionId: "session-incomplete",
        streamIndex: 41,
      }),
    ).toBeUndefined();
  });

  it("does not copy a token across different Eve sessions", () => {
    expect(
      resolvePersistedEveSession(
        {
          continuationToken: "continuation-existing",
          sessionId: "session-existing",
          streamIndex: 40,
        },
        {
          sessionId: "session-replacement",
          streamIndex: 1,
        },
      ),
    ).toBeUndefined();
  });

  it("keeps the initial session state before Eve assigns a remote session", () => {
    expect(
      resolvePersistedEveSession(undefined, {
        streamIndex: 0,
      }),
    ).toEqual({ streamIndex: 0 });
  });
});

describe("compactPersistedEveEvents", () => {
  const appended = (
    messageSoFar: string,
    messageDelta: string,
  ): HandleMessageStreamEvent =>
    ({
      type: "message.appended",
      data: {
        messageDelta,
        messageSoFar,
        sequence: 0,
        stepIndex: 1,
        turnId: "turn_0",
      },
    }) as HandleMessageStreamEvent;

  it("keeps only the latest in-progress text snapshot", () => {
    const events = compactPersistedEveEvents([
      appended("A", "A"),
      appended("AB", "B"),
      appended("ABC", "C"),
    ]);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(appended("ABC", "C"));
  });

  it("drops streamed snapshots once the completed message is available", () => {
    const completed = {
      type: "message.completed",
      data: {
        finishReason: "stop",
        message: "ABC",
        sequence: 0,
        stepIndex: 1,
        turnId: "turn_0",
      },
    } as HandleMessageStreamEvent;

    expect(
      compactPersistedEveEvents([
        appended("A", "A"),
        appended("ABC", "BC"),
        completed,
      ]),
    ).toEqual([completed]);
  });
});

describe("writePersistedEveChat", () => {
  const key = "alleato:eve-chat:conversation-1";
  const session = {
    continuationToken: "continuation-next",
    sessionId: "session-next",
    streamIndex: 42,
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("falls back to a cursor-only write after the full chat write fails", () => {
    const values = new Map([[key, "old-chat"]]);
    let writeCount = 0;
    const storage = {
      setItem: jest.fn((storageKey: string, value: string) => {
        writeCount += 1;
        if (writeCount === 1) throw new Error("quota exceeded");
        values.set(storageKey, value);
      }),
    };
    const warn = jest.spyOn(console, "warn").mockImplementation();

    expect(() =>
      writePersistedEveChat(storage, key, {
        events: [{ type: "session.updated", data: session }] as never,
        session,
      }),
    ).not.toThrow();

    expect(storage.setItem).toHaveBeenCalledTimes(2);
    expect(values.get(key)).toBe(JSON.stringify({ session }));
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Retrying"),
      expect.any(Error),
    );
  });

  it("preserves the old value when both writes fail", () => {
    const values = new Map([[key, "last-good-chat"]]);
    const storage = {
      setItem: jest.fn(() => {
        throw new Error("storage unavailable");
      }),
    };
    const warn = jest.spyOn(console, "warn").mockImplementation();
    const error = jest.spyOn(console, "error").mockImplementation();

    expect(() =>
      writePersistedEveChat(storage, key, {
        events: [],
        session,
      }),
    ).not.toThrow();

    expect(storage.setItem).toHaveBeenCalledTimes(2);
    expect(values.get(key)).toBe("last-good-chat");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("prior saved chat was preserved"),
      expect.any(Error),
    );
  });
});

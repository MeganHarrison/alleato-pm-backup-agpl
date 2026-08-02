/** @jest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { HandleMessageStreamEvent, SessionState } from "eve/client";
import { useEveAgent } from "eve/react";
import { apiFetch } from "@/lib/api-client";
import {
  useAskAlleatoChat,
  useAskAlleatoIdentity,
} from "../useAskAlleatoChat";

jest.mock("@/lib/api-client", () => ({
  apiFetch: jest.fn(),
}));

const getSessionMock = jest.fn();
jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(() => ({
    auth: { getSession: (...args: unknown[]) => getSessionMock(...args) },
  })),
}));

jest.mock("eve/react", () => ({
  useEveAgent: jest.fn(),
}));

const mockedApiFetch = jest.mocked(apiFetch);
const mockedUseEveAgent = jest.mocked(useEveAgent);

function mockEveAgentResult(
  send: ReturnType<typeof jest.fn>,
): ReturnType<typeof useEveAgent> {
  return {
    data: { messages: [] },
    error: undefined,
    events: [],
    reset: jest.fn(),
    send,
    session: { streamIndex: 0 },
    status: "ready",
    stop: jest.fn(),
  };
}

describe("Ask Alleato identity gate", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    mockedUseEveAgent.mockReset();
    getSessionMock.mockReset();
    window.localStorage.clear();
  });

  it("resolves the authenticated user without consulting a runtime selector", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { user: { id: "user-a" } } },
      error: null,
    });

    const { result } = renderHook(() => useAskAlleatoIdentity());

    expect(result.current).toEqual({
      error: null,
      userId: null,
      isLoading: true,
    });

    await waitFor(() => expect(result.current.userId).toBe("user-a"));
    expect(mockedApiFetch).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it("fails visibly when authentication is unavailable", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    const { result } = renderHook(() => useAskAlleatoIdentity());
    await waitFor(() => expect(result.current.error).toContain("session expired"));
    expect(result.current.userId).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("routes Eve through the durable app-owned proxy", () => {
    const source = readFileSync(
      join(__dirname, "..", "useAskAlleatoChat.ts"),
      "utf8",
    );
    expect(source).toContain(
      'host: "/api/ai-assistant/eve/proxy"',
    );
  });
});

describe("Ask Alleato Eve reconnect", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    mockedUseEveAgent.mockReset();
    window.localStorage.clear();
  });

  it("restores the conversation, event log, and stream session after remount", async () => {
    const agentOptions: Parameters<typeof useEveAgent>[0][] = [];
    const send = jest.fn().mockResolvedValue(undefined);
    mockedUseEveAgent.mockImplementation((options) => {
      agentOptions.push(options);
      return mockEveAgentResult(send);
    });
    mockedApiFetch.mockResolvedValue({
      conversation: { session_id: "conversation-1265" },
    });

    const firstMount = renderHook(() => useAskAlleatoChat("user-a"));

    await act(async () => {
      await firstMount.result.current.send("Keep working");
    });

    const event: HandleMessageStreamEvent = {
      type: "session.started",
      data: {},
    };
    const session = { streamIndex: 7 } as SessionState;

    act(() => {
      agentOptions[0]?.onEvent?.(event);
      agentOptions[0]?.onSessionChange?.(session);
    });
    firstMount.unmount();

    const secondMount = renderHook(() => useAskAlleatoChat("user-a"));
    const remountedOptions = agentOptions.at(-1);

    expect(secondMount.result.current.sessionId).toBe("conversation-1265");
    expect(remountedOptions?.initialEvents).toEqual([event]);
    expect(remountedOptions?.initialSession).toEqual(session);
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
  });

  it("shows the exact session-creation failure to the user", async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    mockedUseEveAgent.mockReturnValue(mockEveAgentResult(send));
    mockedApiFetch.mockRejectedValue(new Error("Conversation service unavailable"));

    const { result } = renderHook(() => useAskAlleatoChat("user-a"));

    await act(async () => {
      await result.current.send("Keep working");
    });

    expect(result.current.error).toBe("Conversation service unavailable");
    expect(send).not.toHaveBeenCalled();
  });

  it("never restores another authenticated user's local conversation", async () => {
    const agentOptions: Parameters<typeof useEveAgent>[0][] = [];
    mockedUseEveAgent.mockImplementation((options) => {
      agentOptions.push(options);
      return mockEveAgentResult(jest.fn().mockResolvedValue(undefined));
    });
    mockedApiFetch.mockResolvedValue({
      conversation: { session_id: "conversation-user-a" },
    });

    const userAMount = renderHook(() => useAskAlleatoChat("user-a"));
    await act(async () => {
      await userAMount.result.current.send("Private user A question");
    });

    const userAEvent: HandleMessageStreamEvent = {
      type: "session.started",
      data: {},
    };
    const userASession = { streamIndex: 3 } as SessionState;
    act(() => {
      agentOptions[0]?.onEvent?.(userAEvent);
      agentOptions[0]?.onSessionChange?.(userASession);
    });
    userAMount.unmount();

    const userBMount = renderHook(() => useAskAlleatoChat("user-b"));
    const userBOptions = agentOptions.at(-1);

    expect(userBMount.result.current.sessionId).toBeNull();
    expect(userBOptions?.initialEvents).toBeUndefined();
    expect(userBOptions?.initialSession).toBeUndefined();
  });
});

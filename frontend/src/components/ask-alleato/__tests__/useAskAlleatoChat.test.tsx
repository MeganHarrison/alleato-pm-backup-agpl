/**
 * @jest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";

import { ASK_ALLEATO_CHAT_ID, useAskAlleatoChat } from "../useAskAlleatoChat";

const apiFetchMock = jest.fn();
const sendMessageMock = jest.fn();
const useChatMock = jest.fn();
const transportConfigurations: Array<{
  api?: string;
  prepareSendMessagesRequest: (request: { messages: unknown[] }) => {
    body: Record<string, unknown>;
  };
}> = [];

jest.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

jest.mock("@ai-sdk/react", () => ({
  useChat: (options: unknown) => useChatMock(options),
}));

jest.mock("ai", () => ({
  DefaultChatTransport: class DefaultChatTransport {
    constructor(configuration: (typeof transportConfigurations)[number]) {
      transportConfigurations.push(configuration);
    }
  },
  lastAssistantMessageIsCompleteWithApprovalResponses: jest.fn(),
}));

describe("useAskAlleatoChat", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    sendMessageMock.mockReset();
    useChatMock.mockReset();
    transportConfigurations.length = 0;

    apiFetchMock.mockResolvedValue({
      conversation: { session_id: "session-123" },
    });
    useChatMock.mockImplementation(() => ({
      messages: [],
      sendMessage: sendMessageMock,
      status: "ready",
    }));
  });

  it("keeps the UI chat identity stable while creating the backend session", async () => {
    const { result } = renderHook(() => useAskAlleatoChat());

    await act(async () => {
      await result.current.send("Show the latest daily brief");
    });

    const chatIds = useChatMock.mock.calls.map(
      ([options]) => (options as { id: string }).id,
    );
    expect(new Set(chatIds)).toEqual(new Set([ASK_ALLEATO_CHAT_ID]));
    expect(sendMessageMock).toHaveBeenCalledWith({
      text: "Show the latest daily brief",
    });

    const latestTransport = transportConfigurations.at(-1);
    const request = latestTransport?.prepareSendMessagesRequest({
      messages: [
        {
          id: "message-1",
          role: "user",
          parts: [{ type: "text", text: "Show the latest daily brief" }],
        },
      ],
    });

    expect(request?.body).toMatchObject({
      id: "session-123",
    });
    expect(request?.body).not.toHaveProperty("assistantSurface");
    expect(transportConfigurations.at(-1)?.api).toBe(
      "/api/ask-alleato/chat",
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/ai-assistant/conversations?surface=ask_alleato",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

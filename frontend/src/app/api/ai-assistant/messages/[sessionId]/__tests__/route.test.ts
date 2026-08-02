import { NextRequest } from "next/server";
import { createChatHistoryWriter } from "@/app/api/ai-assistant/chat/chat-history-writer";
import { conversationBelongsToSurface } from "@/lib/ai/chat-surface.server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";
import { POST } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
}));
jest.mock("@/lib/guardrails/observability", () => ({
  getOrCreateRequestId: () => "request-1",
  logEvent: jest.fn(),
  notifyOnError: jest.fn(),
}));
jest.mock("@/lib/app-error-telemetry", () => ({
  recordAppErrorEvent: jest.fn(),
}));
jest.mock("@/lib/ai/chat-surface.server", () => ({
  conversationBelongsToSurface: jest.fn(),
}));
jest.mock("@/app/api/ai-assistant/chat/chat-history-writer", () => ({
  createChatHistoryWriter: jest.fn(),
}));
jest.mock("@/lib/supabase/service-db", () => ({
  serviceDb: { from: jest.fn() },
}));

const getUserMock = jest.mocked(getApiRouteUser);
const conversationBelongsMock = jest.mocked(conversationBelongsToSurface);
const createWriterMock = jest.mocked(createChatHistoryWriter);
const serviceFromMock = jest.mocked(serviceDb.from);
const persistRecordOrThrow = jest.fn();
const replaceRecordOrThrow = jest.fn();
const existingMessagesQuery: Record<string, jest.Mock | unknown> = {};
existingMessagesQuery.select = jest.fn(() => existingMessagesQuery);
existingMessagesQuery.eq = jest.fn(() => existingMessagesQuery);

const sessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const routeArgs = { params: Promise.resolve({ sessionId }) };

function request(messages = [
  {
    id: "eve-user-1",
    role: "user",
    content: "Show the selected project.",
    parts: [{ type: "text", text: "Show the selected project." }],
  },
  {
    id: "eve-assistant-1",
    role: "assistant",
    content: "The selected project is available.",
    parts: [
      { type: "dynamic-tool", toolName: "getProjectDetails", state: "output-available" },
      { type: "text", text: "The selected project is available." },
    ],
  },
]) {
  return new NextRequest(`http://localhost/api/ai-assistant/messages/${sessionId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ surface: "alleato_ai", messages }),
  });
}

describe("POST /api/ai-assistant/messages/[sessionId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getUserMock.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      email: "test@example.com",
    });
    conversationBelongsMock.mockResolvedValue(true);
    serviceFromMock.mockReturnValue(existingMessagesQuery as never);
    Object.assign(existingMessagesQuery, { data: [], error: null });
    persistRecordOrThrow.mockResolvedValue(undefined);
    replaceRecordOrThrow.mockResolvedValue(undefined);
    createWriterMock.mockReturnValue({
      persistRecordOrThrow,
      replaceRecordOrThrow,
    } as never);
  });

  it("persists Eve message parts through the canonical history writer", async () => {
    const response = await POST(request(), routeArgs);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ persistedCount: 2, updatedCount: 0 });
    expect(conversationBelongsMock).toHaveBeenCalledWith({
      sessionId,
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      surface: "alleato_ai",
    });
    expect(persistRecordOrThrow).toHaveBeenCalledTimes(2);
    expect(persistRecordOrThrow).toHaveBeenLastCalledWith(
      expect.objectContaining({
        role: "assistant",
        metadata: expect.objectContaining({
          architecture: "eve",
          eve_message_id: "eve-assistant-1",
          eve_parts: expect.arrayContaining([
            expect.objectContaining({
              toolName: "getProjectDetails",
              state: "output-available",
            }),
          ]),
        }),
      }),
      "assistant Eve message",
    );
  });

  it("persists a completed tool-only message", async () => {
    const response = await POST(
      request([
        {
          id: "eve-assistant-tool-only",
          role: "assistant",
          content: "",
          parts: [
            {
              type: "dynamic-tool",
              toolName: "createRFI",
              state: "output-available",
              output: { success: true, recordId: "rfi-1" },
            },
          ],
        },
      ]),
      routeArgs,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      persistedCount: 1,
      updatedCount: 0,
    });
    expect(persistRecordOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "",
        metadata: expect.objectContaining({
          eve_message_id: "eve-assistant-tool-only",
          eve_parts: expect.arrayContaining([
            expect.objectContaining({
              toolName: "createRFI",
              state: "output-available",
            }),
          ]),
        }),
      }),
      "assistant Eve message",
    );
  });

  it("replaces an existing Eve snapshot when its approval state advances", async () => {
    Object.assign(existingMessagesQuery, {
      data: [
        { id: "chat-row-1", metadata: { eve_message_id: "eve-user-1" } },
      ],
      error: null,
    });

    const response = await POST(request(), routeArgs);
    const payload = await response.json();

    expect(payload).toEqual({ persistedCount: 1, updatedCount: 1 });
    expect(persistRecordOrThrow).toHaveBeenCalledTimes(1);
    expect(replaceRecordOrThrow).toHaveBeenCalledWith(
      "chat-row-1",
      expect.objectContaining({ content: "Show the selected project." }),
      "user Eve message",
    );
  });

  it("rejects an unauthenticated persistence request", async () => {
    getUserMock.mockResolvedValueOnce(null);

    const response = await POST(request(), routeArgs);

    expect(response.status).toBe(401);
    expect(createWriterMock).not.toHaveBeenCalled();
  });

  it("rejects a conversation from another assistant surface", async () => {
    conversationBelongsMock.mockResolvedValueOnce(false);

    const response = await POST(request(), routeArgs);

    expect(response.status).toBe(404);
    expect(createWriterMock).not.toHaveBeenCalled();
  });

  it("fails loudly when canonical persistence fails", async () => {
    persistRecordOrThrow.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await POST(request(), routeArgs);

    expect(response.status).toBe(500);
  });
});

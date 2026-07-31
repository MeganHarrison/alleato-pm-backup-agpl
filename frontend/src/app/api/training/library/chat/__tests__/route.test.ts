jest.mock("ai", () => ({
  createUIMessageStream: jest.fn(({ execute }) => {
    const chunks: string[] = [];
    execute({
      writer: {
        write: (part: { type: string; delta?: string }) => {
          if (part.type === "text-delta" && part.delta) chunks.push(part.delta);
        },
      },
    });
    return chunks.join("");
  }),
  createUIMessageStreamResponse: jest.fn(({ stream }) => new Response(stream)),
  generateText: jest.fn(),
}));

import { NextRequest } from "next/server";
import { createChatHistoryWriter } from "@/app/api/ai-assistant/chat/chat-history-writer";
import { conversationBelongsToSurface } from "@/lib/ai/chat-surface.server";
import { retrieveChunks } from "@/lib/ai/retrieval/retrieve-chunks";
import { createToolContext } from "@/lib/ai/tools/tool-context";
import { getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";
import { POST } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
}));
jest.mock("@/lib/ai/chat-surface.server", () => ({
  conversationBelongsToSurface: jest.fn(),
}));
jest.mock("@/lib/ai/retrieval/retrieve-chunks", () => ({
  retrieveChunks: jest.fn(),
}));
jest.mock("@/lib/ai/tools/tool-context", () => ({
  createToolContext: jest.fn(),
}));
jest.mock("@/lib/ai/providers", () => ({
  getLanguageModel: jest.fn(),
}));
jest.mock("@/app/api/ai-assistant/chat/chat-history-writer", () => ({
  createChatHistoryWriter: jest.fn(),
}));
jest.mock("@/lib/supabase/service-db", () => ({
  serviceDb: { from: jest.fn() },
}));

const getUserMock = jest.mocked(getApiRouteUser);
const conversationBelongsMock = jest.mocked(conversationBelongsToSurface);
const retrieveChunksMock = jest.mocked(retrieveChunks);
const createToolContextMock = jest.mocked(createToolContext);
const createWriterMock = jest.mocked(createChatHistoryWriter);
const serviceFromMock = jest.mocked(serviceDb.from);
const persistRecordOrThrow = jest.fn();

function request(question = "How should I build a submittal log?") {
  return new NextRequest("http://localhost/api/training/library/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      messages: [
        {
          id: "message-1",
          role: "user",
          parts: [{ type: "text", text: question }],
        },
      ],
    }),
  });
}

async function callPost(question?: string) {
  return POST(request(question), { params: Promise.resolve({}) });
}

describe("POST /api/training/library/chat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getUserMock.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      email: "learner@example.com",
    });
    conversationBelongsMock.mockResolvedValue(true);
    createToolContextMock.mockReturnValue({
      db: {},
      rag: {},
      openai: {},
      guardrails: {},
    } as never);
    createWriterMock.mockReturnValue({
      persistRecordOrThrow,
    } as never);
    persistRecordOrThrow.mockResolvedValue(undefined);
    retrieveChunksMock.mockResolvedValue([]);

    const timestampQuery = {
      error: null,
      update: jest.fn(),
      eq: jest.fn(),
    };
    timestampQuery.update.mockReturnValue(timestampQuery);
    timestampQuery.eq.mockReturnValue(timestampQuery);
    serviceFromMock.mockReturnValue(timestampQuery as never);
  });

  it("requires authentication before retrieval", async () => {
    getUserMock.mockResolvedValueOnce(null);

    const response = await callPost();

    expect(response.status).toBe(401);
    expect(retrieveChunksMock).not.toHaveBeenCalled();
    expect(createWriterMock).not.toHaveBeenCalled();
  });

  it("retrieves only training source types and returns explicit empty recovery", async () => {
    const response = await callPost();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(conversationBelongsMock).toHaveBeenCalledWith({
      sessionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      surface: "training_library",
    });
    expect(retrieveChunksMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceTypes: ["training_guide", "training_resource"],
      }),
    );
    expect(persistRecordOrThrow).toHaveBeenCalledTimes(2);
    expect(body).toContain("notebooklm.google.com");
  });

  it("fails loudly when the learner question cannot be persisted", async () => {
    persistRecordOrThrow.mockRejectedValueOnce(
      new Error("training chat database unavailable"),
    );

    const response = await callPost();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        where_it_failed: "training/library/chat#POST",
      }),
    );
    expect(retrieveChunksMock).not.toHaveBeenCalled();
  });
});

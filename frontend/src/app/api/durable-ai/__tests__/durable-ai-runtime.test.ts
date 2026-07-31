import type { UIMessage, UIMessageChunk } from "ai";
import { streamText } from "ai";
import { getWritable, getWorkflowMetadata } from "workflow";
import { getRun, start } from "workflow/api";

import { POST } from "@/app/api/durable-ai/chat/route";
import { createAiAssistantMcpTools } from "@/lib/ai/tools/mcp-tools";
import { getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";
import { durableAiChatWorkflow } from "@/workflows/durable-ai-chat/workflow";

jest.mock("ai", () => ({
  convertToModelMessages: jest.fn(async (messages) => messages),
  createUIMessageStreamResponse: ({ headers }: { headers: HeadersInit }) =>
    new Response(null, { status: 200, headers }),
  isStepCount: jest.fn(() => () => false),
  streamText: jest.fn(),
}));

jest.mock("workflow", () => ({
  getWritable: jest.fn(),
  getWorkflowMetadata: jest.fn(),
}));

jest.mock("workflow/api", () => ({
  getRun: jest.fn(),
  start: jest.fn(),
}));

jest.mock("@/lib/ai/assistant-models", () => ({
  DEFAULT_AI_ASSISTANT_MODEL: "test-model",
}));

jest.mock("@/lib/ai/bot-core", () => ({
  assembleSystemPrompt: jest.fn(async () => "system prompt"),
}));

jest.mock("@/lib/ai/orchestrator", () => ({
  createStrategistTools: jest.fn(() => ({})),
}));

jest.mock("@/lib/ai/providers", () => ({
  getLanguageModel: jest.fn(() => ({ provider: "test" })),
}));

jest.mock("@/lib/ai/tools/mcp-tools", () => ({
  createAiAssistantMcpTools: jest.fn(async () => ({
    tools: {},
    trace: [],
    close: jest.fn(async () => undefined),
  })),
}));

jest.mock("@/lib/ai/durable-chat.server", () => ({
  durableConversationBelongsToUser: jest.fn(async () => ({
    belongs: true,
    error: null,
  })),
  durableApiError: (args: {
    status: number;
    code: string;
    message: string;
    where: string;
    runId?: string | null;
    stage?: string | null;
  }) =>
    Response.json(
      {
        error: args.message,
        error_code: args.code,
        where_it_failed: args.where,
        details: { runId: args.runId, stage: args.stage },
      },
      { status: args.status },
    ),
}));

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/supabase/service-db", () => ({
  serviceDb: { from: jest.fn() },
}));

type QueryCall = { method: string; args: unknown[] };
type QueryResult = { data?: unknown; error?: unknown };

function queryChain(result: QueryResult, calls: QueryCall[] = []) {
  const chain: Record<string, unknown> = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "then") {
          return (
            resolve: (value: QueryResult) => unknown,
            reject: (reason: unknown) => unknown,
          ) => Promise.resolve(result).then(resolve, reject);
        }
        return (...args: unknown[]) => {
          calls.push({ method: String(property), args });
          return chain;
        };
      },
    },
  );
  return chain;
}

function configureDb(args: {
  durable: QueryResult[];
  chat?: QueryResult[];
  conversations?: QueryResult[];
  calls?: Record<string, QueryCall[]>;
}) {
  const queues: Record<string, QueryResult[]> = {
    durable_ai_turns: [...args.durable],
    chat_history: [...(args.chat ?? [])],
    conversations: [...(args.conversations ?? [])],
  };
  jest.mocked(serviceDb.from).mockImplementation((table) => {
    const result = queues[table]?.shift();
    if (!result) throw new Error(`No mocked query result for ${table}`);
    const tableCalls = args.calls?.[table] ?? [];
    if (args.calls) args.calls[table] = tableCalls;
    return queryChain(result, tableCalls) as never;
  });
}

function emptyUiStream() {
  return new ReadableStream<UIMessageChunk>({
    start(controller) {
      controller.close();
    },
  });
}

const userMessage: UIMessage = {
  id: "client-message-1",
  role: "user",
  parts: [{ type: "text", text: "Test durable turn" }],
};

describe("durable AI runtime behavior", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getApiRouteUser).mockResolvedValue({ id: "user-1" } as never);
    jest
      .mocked(getRun)
      .mockImplementation(
        (runId) => ({ runId, readable: emptyUiStream() }) as never,
      );
    jest.mocked(getWorkflowMetadata).mockReturnValue({
      workflowRunId: "run-under-test",
    } as never);
  });

  test("reclaims an expired accepted turn and starts exactly one workflow", async () => {
    const calls: Record<string, QueryCall[]> = {};
    configureDb({
      durable: [
        { data: null, error: { code: "23505", message: "duplicate" } },
        {
          data: {
            id: "11111111-1111-4111-8111-111111111111",
            workflow_run_id: null,
            status: "accepted",
            stage: "accepted",
            error_message: null,
            updated_at: "2020-01-01T00:00:00.000Z",
          },
          error: null,
        },
        {
          data: { id: "11111111-1111-4111-8111-111111111111" },
          error: null,
        },
        { error: null },
        {
          data: { id: "11111111-1111-4111-8111-111111111111" },
          error: null,
        },
      ],
      chat: [{ error: null }],
      calls,
    });
    jest.mocked(start).mockResolvedValue({
      runId: "reclaimed-run",
      readable: emptyUiStream(),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/durable-ai/chat", {
        method: "POST",
        body: JSON.stringify({
          id: "session-1",
          messages: [userMessage],
          clientMessageId: userMessage.id,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-workflow-run-id")).toBe("reclaimed-run");
    expect(start).toHaveBeenCalledTimes(1);
    expect(
      calls.durable_ai_turns.some(
        (call) =>
          call.method === "update" &&
          (call.args[0] as { stage?: string }).stage ===
            "workflow-start-reclaimed",
      ),
    ).toBe(true);
    expect(
      calls.chat_history.find((call) => call.method === "upsert")?.args[0],
    ).toMatchObject({ id: "11111111-1111-4111-8111-111111111111" });
  });

  test("a user-message link failure makes the accepted turn terminal", async () => {
    const calls: Record<string, QueryCall[]> = {};
    configureDb({
      durable: [
        {
          data: { id: "11111111-1111-4111-8111-111111111111" },
          error: null,
        },
        { data: null, error: { message: "link failed" } },
        { data: null, error: null },
      ],
      chat: [{ error: null }],
      calls,
    });

    const response = await POST(
      new Request("http://localhost/api/durable-ai/chat", {
        method: "POST",
        body: JSON.stringify({
          id: "session-1",
          messages: [userMessage],
          clientMessageId: userMessage.id,
        }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error_code: "USER_MESSAGE_LINK_FAILED",
      details: { stage: "user-message-link" },
    });
    expect(start).not.toHaveBeenCalled();
    expect(
      calls.durable_ai_turns.some(
        (call) =>
          call.method === "update" &&
          (call.args[0] as { status?: string; stage?: string }).status ===
            "failed" &&
          (call.args[0] as { stage?: string }).stage === "user-message-link",
      ),
    ).toBe(true);
  });

  test("a competing workflow run fails before tool initialization", async () => {
    configureDb({
      durable: [
        { data: null, error: null },
        { data: { workflow_run_id: "winning-run" }, error: null },
        { data: null, error: null },
        { data: null, error: null },
      ],
    });
    const failureWriter = {
      write: jest.fn(async () => undefined),
      close: jest.fn(async () => undefined),
      releaseLock: jest.fn(),
    };
    jest.mocked(getWritable).mockReturnValue({
      getWriter: () => failureWriter,
    } as never);

    await expect(
      durableAiChatWorkflow({
        turnId: "11111111-1111-4111-8111-111111111111",
        userId: "user-1",
        sessionId: "session-1",
        assistantHistoryId: "22222222-2222-4222-8222-222222222222",
        selectedProjectId: null,
        messages: [userMessage],
      }),
    ).rejects.toThrow("refusing duplicate run");

    expect(createAiAssistantMcpTools).not.toHaveBeenCalled();
    expect(failureWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
    );
  });

  test("a pre-claim database failure claims only the unowned turn as failed", async () => {
    const calls: Record<string, QueryCall[]> = {};
    configureDb({
      durable: [
        { data: null, error: { message: "claim database unavailable" } },
        { data: null, error: null },
        { data: null, error: null },
      ],
      calls,
    });
    const failureWriter = {
      write: jest.fn(async () => undefined),
      close: jest.fn(async () => undefined),
      releaseLock: jest.fn(),
    };
    jest.mocked(getWritable).mockReturnValue({
      getWriter: () => failureWriter,
    } as never);

    await expect(
      durableAiChatWorkflow({
        turnId: "11111111-1111-4111-8111-111111111111",
        userId: "user-1",
        sessionId: "session-1",
        assistantHistoryId: "22222222-2222-4222-8222-222222222222",
        selectedProjectId: null,
        messages: [userMessage],
      }),
    ).rejects.toThrow("claim database unavailable");

    expect(
      calls.durable_ai_turns.some(
        (call) =>
          call.method === "update" &&
          (call.args[0] as { status?: string; workflow_run_id?: string })
            .status === "failed" &&
          (call.args[0] as { workflow_run_id?: string }).workflow_run_id ===
            "run-under-test",
      ),
    ).toBe(true);
    expect(failureWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
    );
  });

  test("stream-close failure preserves a completed ledger with a warning", async () => {
    const calls: Record<string, QueryCall[]> = {};
    configureDb({
      durable: [
        {
          data: { id: "11111111-1111-4111-8111-111111111111" },
          error: null,
        },
        { error: null },
        { error: null },
      ],
      chat: [{ error: null }],
      conversations: [{ error: null }],
      calls,
    });
    const responseMessage: UIMessage = {
      id: "assistant-message",
      role: "assistant",
      parts: [{ type: "text", text: "Done" }],
    };
    jest.mocked(streamText).mockReturnValue({
      toUIMessageStream: ({
        onEnd,
      }: {
        onEnd: (args: { responseMessage: UIMessage }) => void;
      }) => {
        onEnd({ responseMessage });
        return emptyUiStream();
      },
    } as never);
    const generationWriter = {
      write: jest.fn(async () => undefined),
      releaseLock: jest.fn(),
    };
    const closeWriter = {
      close: jest.fn(async () => {
        throw new Error("close failed");
      }),
      releaseLock: jest.fn(),
    };
    const warningWriter = {
      write: jest.fn(async () => undefined),
      close: jest.fn(async () => undefined),
      releaseLock: jest.fn(),
    };
    jest
      .mocked(getWritable)
      .mockReturnValueOnce({ getWriter: () => generationWriter } as never)
      .mockReturnValueOnce({ getWriter: () => closeWriter } as never)
      .mockReturnValueOnce({ getWriter: () => warningWriter } as never);

    await expect(
      durableAiChatWorkflow({
        turnId: "11111111-1111-4111-8111-111111111111",
        userId: "user-1",
        sessionId: "session-1",
        assistantHistoryId: "22222222-2222-4222-8222-222222222222",
        selectedProjectId: null,
        messages: [userMessage],
      }),
    ).resolves.toMatchObject({ status: "completed-with-warning" });

    expect(
      calls.durable_ai_turns.some(
        (call) =>
          call.method === "update" &&
          (call.args[0] as { stage?: string }).stage ===
            "completed-stream-close-warning" &&
          (call.args[0] as { status?: string }).status === "completed",
      ),
    ).toBe(true);
    expect(warningWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
    );
  });
});

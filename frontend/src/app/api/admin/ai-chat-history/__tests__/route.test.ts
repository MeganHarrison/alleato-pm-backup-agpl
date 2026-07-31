import {
  inferWriteStatus,
  mapChatHistoryRows,
  type AiChatHistoryToolView,
} from "../route";

describe("admin ai chat history trace projection", () => {
  it("marks preview-only write tools without treating them as committed writes", () => {
    const rows = mapChatHistoryRows(
      [
        {
          id: "message-1",
          session_id: "38000741-56c3-4eaf-b8ae-a70aea4a8368",
          user_id: "user-1",
          role: "assistant",
          content: "Reply confirm and I'll create it.",
          sources: [],
          created_at: "2026-06-25T03:39:05.253648+00:00",
          metadata: {
            langfuse_trace_id: "536e53d1014bf407647fe46cc0cc7b4b",
            model: "openai/gpt-5.4",
            provider_path: "ai-gateway",
            finish_reason: "stop",
            usage: {
              inputTokens: 108033,
              outputTokens: 216,
              totalTokens: 108249,
            },
            response_quality: {
              score: 75,
              reasons: ["multiple successful tool calls"],
            },
            tool_trace: [
              {
                name: "findProject",
                status: "success",
                output: { bestMatch: { id: 67 } },
              },
              {
                name: "createChangeEvent",
                input: { confirmed: false },
                output: {
                  action: "preview",
                  preview: { table: "change_events" },
                },
              },
            ],
          },
        },
      ],
      [
        {
          session_id: "38000741-56c3-4eaf-b8ae-a70aea4a8368",
          title: "Create a change event",
          last_message_at: "2026-06-25T03:39:05.253648+00:00",
        },
      ],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      traceId: "536e53d1014bf407647fe46cc0cc7b4b",
      traceUrl:
        "https://us.cloud.langfuse.com/project/cmp1jdf0o06eead07m0eatqz2/traces/536e53d1014bf407647fe46cc0cc7b4b",
      writeStatus: "preview_only",
      model: "openai/gpt-5.4",
      providerPath: "ai-gateway",
      tokenUsage: {
        inputTokens: 108033,
        outputTokens: 216,
        totalTokens: 108249,
      },
    });
    expect(rows[0]?.tools.map((tool) => [tool.name, tool.status, tool.writeKind]))
      .toEqual([
        ["findProject", "success", "read"],
        ["createChangeEvent", "preview", "write"],
      ]);
    expect(rows[0]?.scores).toEqual([
      {
        name: "response_quality",
        value: 75,
        comment: "multiple successful tool calls",
      },
    ]);
  });

  it("distinguishes confirmed, failed, no-write, and unknown write states", () => {
    const baseTool: AiChatHistoryToolView = {
      name: "createChangeEvent",
      status: "success",
      writeKind: "write",
      input: null,
      output: { success: true },
      error: null,
    };

    expect(inferWriteStatus([baseTool]).writeStatus).toBe("confirmed");
    expect(
      inferWriteStatus([{ ...baseTool, status: "failed", error: "bad write" }])
        .writeStatus,
    ).toBe("failed");
    expect(
      inferWriteStatus([{ ...baseTool, name: "findProject", writeKind: "read" }])
        .writeStatus,
    ).toBe("no_write_tools");
    expect(inferWriteStatus([{ ...baseTool, status: "unknown" }]).writeStatus).toBe(
      "unknown",
    );
  });

  it("fails visibly when a persisted message has no valid trace id", () => {
    const rows = mapChatHistoryRows(
      [
        {
          id: "message-2",
          session_id: "session-2",
          user_id: "user-1",
          role: "assistant",
          content: "No trace here.",
          sources: [],
          created_at: null,
          metadata: {
            langfuse_trace_id: "not-a-valid-trace-id",
            tool_trace: [],
          },
        },
      ],
      [],
    );

    expect(rows[0]?.traceId).toBeNull();
    expect(rows[0]?.traceUrl).toBeNull();
    expect(rows[0]?.writeStatus).toBe("no_write_tools");
  });
});

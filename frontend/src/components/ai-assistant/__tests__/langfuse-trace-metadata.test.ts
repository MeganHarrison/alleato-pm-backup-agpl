import {
  type ChatHistoryMessage,
  extractLangfuseTraceIds,
} from "../chat-history";

function historyMessage(
  metadata: ChatHistoryMessage["metadata"],
): ChatHistoryMessage {
  return {
    id: "chat-history-row",
    role: "assistant",
    content: "Answer",
    sources: null,
    metadata,
    created_at: "2026-06-24T12:00:00.000Z",
  };
}

describe("extractLangfuseTraceIds", () => {
  it("indexes trace ids by persisted row id and response message id", () => {
    const traceIds = extractLangfuseTraceIds([
      historyMessage({
        response_message_id: "sdk-message",
        langfuse_trace_id: "abcdef1234567890abcdef1234567890",
      }),
    ]);

    expect(traceIds).toEqual({
      "chat-history-row": "abcdef1234567890abcdef1234567890",
      "sdk-message": "abcdef1234567890abcdef1234567890",
    });
  });

  it("ignores missing or malformed trace ids", () => {
    expect(
      extractLangfuseTraceIds([
        historyMessage({
          response_message_id: "sdk-message",
          langfuse_trace_id: "not-a-trace-id",
        }),
      ]),
    ).toEqual({});
  });
});

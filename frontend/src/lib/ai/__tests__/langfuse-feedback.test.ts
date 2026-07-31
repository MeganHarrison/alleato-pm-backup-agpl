import {
  extractLangfuseTraceIdFromMetadata,
  metadataMessageIds,
  normalizeLangfuseTraceId,
} from "../langfuse-feedback";

describe("langfuse feedback metadata helpers", () => {
  it("normalizes valid Langfuse trace ids", () => {
    expect(normalizeLangfuseTraceId(" ABCDEF1234567890ABCDEF1234567890 ")).toBe(
      "abcdef1234567890abcdef1234567890",
    );
  });

  it("rejects malformed trace ids", () => {
    expect(normalizeLangfuseTraceId("trace-123")).toBeNull();
    expect(normalizeLangfuseTraceId("abcdef1234567890")).toBeNull();
    expect(normalizeLangfuseTraceId(null)).toBeNull();
  });

  it("extracts a valid trace id from assistant metadata", () => {
    expect(
      extractLangfuseTraceIdFromMetadata({
        langfuse_trace_id: "abcdef1234567890abcdef1234567890",
      }),
    ).toBe("abcdef1234567890abcdef1234567890");
  });

  it("maps both persisted row id and AI SDK response message id", () => {
    expect(
      metadataMessageIds({
        id: "chat-history-row",
        metadata: { response_message_id: "sdk-message" },
      }),
    ).toEqual(["chat-history-row", "sdk-message"]);
  });
});

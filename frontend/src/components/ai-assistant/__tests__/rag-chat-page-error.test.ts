import {
  formatChatError,
  isChatTransportLoadFailure,
} from "../rag-chat-errors";

describe("rag chat transport errors", () => {
  it.each(["Load failed", "Failed to fetch", "NetworkError", "network error"])(
    "classifies browser transport failure: %s",
    (message) => {
      expect(isChatTransportLoadFailure(new Error(message))).toBe(true);
    },
  );

  it("explains that a browser transport failure did not reach the server", () => {
    expect(formatChatError(new Error("Load failed"))).toBe(
      "The assistant connection dropped before the request reached the server. Your message was not saved; retry when the connection is stable.",
    );
  });

  it("keeps provider and route errors visible", () => {
    expect(formatChatError(new Error("AI provider returned 429"))).toBe(
      "The assistant request failed before a response was returned: AI provider returned 429",
    );
  });
});

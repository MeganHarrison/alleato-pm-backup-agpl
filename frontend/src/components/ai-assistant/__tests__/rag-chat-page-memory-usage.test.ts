import {
  extractMemoryUsage,
  type MemoryUsageMetadataMessage,
} from "../memory-usage-metadata";

function historyMessage(
  overrides: Partial<MemoryUsageMetadataMessage> = {},
): MemoryUsageMetadataMessage {
  return {
    id: "db-message-1",
    metadata: {
      response_message_id: "sdk-message-1",
      memory_usage: {
        totalUsed: 1,
        preferencesUsed: 1,
        relevantUsed: 0,
        teamUsed: 0,
        recentConversationsUsed: 0,
        memories: [
          {
            id: "memory-1",
            type: "preference",
            content: "Use concise executive summaries.",
          },
        ],
      },
    },
    ...overrides,
  };
}

describe("extractMemoryUsage", () => {
  it("indexes persisted memory usage by database and streamed response message ids", () => {
    const usageByMessageId = extractMemoryUsage([historyMessage()]);

    expect(usageByMessageId["db-message-1"]?.totalUsed).toBe(1);
    expect(usageByMessageId["sdk-message-1"]?.totalUsed).toBe(1);
  });
});

import { dbMessageToUIMessage, extractSources } from "../chat-history";

describe("Eve chat history", () => {
  it("restores the stable Eve message id and serialized message parts", () => {
    const parts = [
      { type: "text" as const, text: "Budget risk found." },
      {
        type: "tool-query_alleato" as const,
        toolCallId: "tool-1",
        state: "output-available" as const,
        input: { table: "budget_lines" },
        output: { rows: [] },
      },
    ];

    expect(
      dbMessageToUIMessage({
        id: "database-row-id",
        role: "assistant",
        content: "Budget risk found.",
        sources: null,
        metadata: {
          eve_message_id: "eve-message-id",
          eve_parts: parts,
        },
        created_at: "2026-07-24T00:00:00.000Z",
      }),
    ).toEqual({
      id: "eve-message-id",
      role: "assistant",
      parts,
    });
  });

  it("keys restored metadata by the stable Eve message id", () => {
    const message = {
      id: "database-row-id",
      role: "assistant",
      content: "Source-backed answer.",
      sources: [{ title: "Budget report" }],
      metadata: { eve_message_id: "eve-message-id" },
      created_at: "2026-07-24T00:00:00.000Z",
    };

    expect(extractSources([message])).toEqual({
      "eve-message-id": [{ title: "Budget report" }],
    });
  });
});

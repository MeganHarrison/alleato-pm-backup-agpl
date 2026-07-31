import { __test__ } from "../search-past-conversations";

describe("searchPastConversations result mapping", () => {
  it("maps anchored RPC rows into source-labeled session recall results", () => {
    const result = __test__.mapRowsToResult({
      query: "budget decision",
      userId: "11111111-1111-4111-8111-111111111111",
      projectId: 67,
      rows: [
        {
          query: "budget decision",
          scope: {
            userId: "11111111-1111-4111-8111-111111111111",
            projectId: 67,
          },
          result_count: 1,
          status: "ok",
          session_id: "22222222-2222-4222-8222-222222222222",
          lineage_root_session_id: "22222222-2222-4222-8222-222222222222",
          title: "Budget review",
          session_created_at: "2026-06-18T10:00:00.000Z",
          session_last_message_at: "2026-06-18T10:30:00.000Z",
          project_id: 67,
          rank: 0.75,
          headline: "<mark>budget</mark> decision",
          anchor_message_id: "33333333-3333-4333-8333-333333333333",
          anchor_created_at: "2026-06-18T10:10:00.000Z",
          anchor_role: "assistant",
          anchored_window: [
            {
              id: "33333333-3333-4333-8333-333333333333",
              role: "assistant",
              content: "We decided to review the budget exposure.",
              createdAt: "2026-06-18T10:10:00.000Z",
              isAnchor: true,
            },
          ],
          bookend_start: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              role: "user",
              content: "Start of session",
              createdAt: "2026-06-18T10:00:00.000Z",
            },
          ],
          bookend_end: [
            {
              id: "55555555-5555-4555-8555-555555555555",
              role: "assistant",
              content: "End of session",
              createdAt: "2026-06-18T10:30:00.000Z",
            },
          ],
        },
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      status: "ok",
      query: "budget decision",
      scope: {
        userId: "11111111-1111-4111-8111-111111111111",
        projectId: 67,
      },
      resultCount: 1,
      results: [
        {
          sessionId: "22222222-2222-4222-8222-222222222222",
          lineageRootSessionId: "22222222-2222-4222-8222-222222222222",
          sourceRef:
            '[Source: Prior conversation - "Budget review" - 2026-06-18T10:10:00.000Z]',
        },
      ],
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("Expected ok result");
    expect(result.results[0].anchoredWindow).toHaveLength(1);
    expect(result.results[0].bookends.start).toHaveLength(1);
    expect(result.results[0].bookends.end).toHaveLength(1);
  });

  it("returns a loud typed empty result when the RPC has no matches", () => {
    const result = __test__.mapRowsToResult({
      query: "not present",
      userId: "11111111-1111-4111-8111-111111111111",
      projectId: null,
      rows: [
        {
          query: "not present",
          scope: {
            userId: "11111111-1111-4111-8111-111111111111",
            projectId: null,
          },
          result_count: 0,
          status: "empty",
          session_id: null,
          lineage_root_session_id: null,
          title: null,
          session_created_at: null,
          session_last_message_at: null,
          project_id: null,
          rank: null,
          headline: 'No prior chat history matched "not present" for the requested scope.',
          anchor_message_id: null,
          anchor_created_at: null,
          anchor_role: null,
          anchored_window: [],
          bookend_start: [],
          bookend_end: [],
        },
      ],
    });

    expect(result).toEqual({
      ok: true,
      status: "empty",
      query: "not present",
      scope: {
        userId: "11111111-1111-4111-8111-111111111111",
        projectId: null,
      },
      resultCount: 0,
      results: [],
      message: 'No prior chat history matched "not present" for the requested scope.',
    });
  });
});

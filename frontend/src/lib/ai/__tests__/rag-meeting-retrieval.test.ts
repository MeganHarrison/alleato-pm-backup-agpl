/**
 * Regression tests for meeting-intent detection in the AI RAG pipeline.
 *
 * Bug: "review recent meetings" returned meta-commentary filler instead of data
 * because detectSourceSpecificRagRequest did not match general meeting queries.
 * Root cause: three compounding failures — see GitHub issue #282.
 *
 * These tests MUST FAIL on the pre-fix codebase and PASS after.
 *
 * @see CLAUDE.md Rules 14 & 15 — Bug Fix Completion Gate + Regression Test Gate
 */

import {
  detectCrossSourceInvestigationRequest,
  detectRecentEmailInboxRequest,
  detectSourceLookupRecentTeamsRequest,
  detectSourceSpecificRagRequest,
} from "../detect-rag-request";

describe("detectSourceSpecificRagRequest — meeting-intent queries (#282 regression)", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-05-12T16:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns recent_meetings kind for "review recent meetings"', () => {
    const result = detectSourceSpecificRagRequest("review recent meetings");
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("recent_meetings");
  });

  it('returns recent_meetings kind for "show me meetings this week"', () => {
    const result = detectSourceSpecificRagRequest("show me meetings this week");
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("recent_meetings");
    expect(result?.startDate).toBe("2026-05-05");
    expect(result?.endDate).toBe("2026-05-12");
  });

  it("preserves explicit weekly meeting date ranges for source retrieval", () => {
    const result = detectSourceSpecificRagRequest(
      "summarize meeting insights from 2026-05-05 through 2026-05-12",
    );

    expect(result).not.toBeNull();
    expect(result?.kind).toBe("recent_meetings");
    expect(result?.startDate).toBe("2026-05-05");
    expect(result?.endDate).toBe("2026-05-12");
  });

  it("routes last week meeting summaries to the prior seven-day window", () => {
    const result = detectSourceSpecificRagRequest(
      "meeting summaries from last week",
    );

    expect(result).not.toBeNull();
    expect(result?.kind).toBe("recent_meetings");
    expect(result?.startDate).toBe("2026-04-28");
    expect(result?.endDate).toBe("2026-05-05");
  });

  it('returns recent_meetings kind for "tell me about our recent meetings"', () => {
    const result = detectSourceSpecificRagRequest(
      "tell me about our recent meetings",
    );
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("recent_meetings");
  });

  it('returns recent_meetings kind for "what meetings did we have this month"', () => {
    const result = detectSourceSpecificRagRequest(
      "what meetings did we have this month",
    );
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("recent_meetings");
  });

  it('returns recent_meetings kind for "can you show me our meeting notes"', () => {
    const result = detectSourceSpecificRagRequest(
      "can you show me our meeting notes",
    );
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("recent_meetings");
  });

  it('returns recent_meetings kind for "meeting summaries from last week"', () => {
    const result = detectSourceSpecificRagRequest(
      "meeting summaries from last week",
    );
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("recent_meetings");
  });

  it("returns recent_meetings with correct label and limit", () => {
    const result = detectSourceSpecificRagRequest("review recent meetings");
    expect(result?.label).toBe("Recent meeting transcripts");
    expect(result?.limit).toBe(10);
  });

  it('returns meetings_on_date for "meetings completed today"', () => {
    const result = detectSourceSpecificRagRequest(
      "Tell me about the meetings that were completed today",
    );
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("meetings_on_date");
    expect(result?.date).toMatch(/^20\d{2}-\d{2}-\d{2}$/);
  });

  it("returns meetings_on_date for critical-risk meeting questions today", () => {
    const result = detectSourceSpecificRagRequest(
      "Were there any critical risks identified in the meetings today?",
    );
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("meetings_on_date");
  });

  it("still returns meetings_on_date for explicit Friday query", () => {
    const result = detectSourceSpecificRagRequest(
      "what meetings were conducted on friday",
    );
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("meetings_on_date");
  });

  it('returns meetings_on_date for "what meetings were held on friday" (detection-order regression)', () => {
    // Regression: "what meetings were held" is in generalMeetingPhrases. Without the
    // date-specific block running first, this routes to recent_meetings (60-day)
    // instead of meetings_on_date (Friday-specific). Fix: asksForMeetingsOnFriday
    // must be evaluated before generalMeetingPhrases.
    const result = detectSourceSpecificRagRequest(
      "what meetings were held on friday",
    );
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("meetings_on_date");
  });

  it('returns meetings_on_date for "tell me about meetings on friday" (detection-order regression)', () => {
    // "tell me about meetings" is in generalMeetingPhrases — must not swallow date-qualified queries.
    const result = detectSourceSpecificRagRequest(
      "tell me about meetings on friday",
    );
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("meetings_on_date");
  });

  it('returns meetings_on_date for "our meetings on friday" (detection-order regression)', () => {
    // "our meetings" is in generalMeetingPhrases — must not swallow date-qualified queries.
    const result = detectSourceSpecificRagRequest("our meetings on friday");
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("meetings_on_date");
  });

  it("returns null for non-meeting queries", () => {
    const result = detectSourceSpecificRagRequest(
      "what is the current budget for the project",
    );
    expect(result).toBeNull();
  });

  it("returns null for queries with meeting only in unrelated context", () => {
    // "meeting" appears but no intent phrase matches
    const result = detectSourceSpecificRagRequest(
      "we are meeting the deadline tomorrow",
    );
    expect(result).toBeNull();
  });
});

describe("detectSourceSpecificRagRequest — existing patterns not regressed", () => {
  it("returns recent_onedrive_documents for OneDrive queries", () => {
    const result = detectSourceSpecificRagRequest(
      "show me the most recent onedrive documents",
    );
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("recent_onedrive_documents");
  });

  it("does not route recent email queries to source-specific RAG", () => {
    const result = detectSourceSpecificRagRequest(
      "show me the last five emails",
    );
    expect(result).toBeNull();
  });

  it("does not route natural last-five-email wording to source-specific RAG", () => {
    const result = detectSourceSpecificRagRequest(
      "Can you tell me my last five emails?",
    );
    expect(result).toBeNull();
  });

  it("does not route urgent inbox triage wording to source-specific RAG", () => {
    const result = detectSourceSpecificRagRequest(
      "Is there anything urgent in my inbox?",
    );
    expect(result).toBeNull();
  });

  it("does not route important same-day email triage to source-specific RAG", () => {
    const result = detectSourceSpecificRagRequest(
      "what important emails have I received this morning?",
    );
    expect(result).toBeNull();
  });

  it("returns recent_teams_discussions for Teams queries", () => {
    const result = detectSourceSpecificRagRequest(
      "show me recent teams discussions with Brandon",
    );
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("recent_teams_discussions");
    expect(result?.query).toBe("show me recent teams discussions with Brandon");
  });

  it("routes same-day Teams message insight prompts to Teams-specific retrieval", () => {
    const result = detectSourceSpecificRagRequest(
      "what insights can be found in the teams messages today?",
    );

    expect(result).toMatchObject({
      kind: "recent_teams_discussions",
      label: "Teams messages",
      query: "what insights can be found in the teams messages today?",
    });
  });

  it("returns null for general project queries that should use other paths", () => {
    const result = detectSourceSpecificRagRequest("what is the project status");
    expect(result).toBeNull();
  });
});

describe("detectRecentEmailInboxRequest — Outlook inbox routing", () => {
  it.each([
    ["Can you tell me my last five emails?", 1],
    ["Is there anything urgent in my inbox?", 1],
    ["What important emails have I received this morning?", 0],
    ["What came in through Outlook today that needs my attention?", 0],
    ["Show me any emails from today that need a reply.", 0],
    ["What mail arrived today?", 0],
    ["Any important messages I got today?", 0],
  ])("routes %p to structured Outlook intake", (prompt, daysBack) => {
    const result = detectRecentEmailInboxRequest(prompt);

    expect(result).toEqual({
      daysBack,
      limit: 50,
      reason: "structured_outlook_inbox_query",
    });
  });

  it("does not treat Teams messages as Outlook inbox mail", () => {
    const result = detectRecentEmailInboxRequest(
      "What Teams messages came in today?",
    );

    expect(result).toBeNull();
  });
});

describe("detectCrossSourceInvestigationRequest — multi-source investigation routing", () => {
  it.each([
    // The incident: a sudden-resignation question spanning teams + emails + meetings.
    "We had an employee quit this week suddenly saying he didn't feel like he fit in and put his resignation in effective immediately — can you research through the teams messages, emails, and meetings and see where this might have initiated?",
    "Dig through the emails and Teams to trace where this dispute started.",
    "Investigate the meetings and emails and figure out how this issue came about.",
    // Two corpora named at once, even without an explicit investigative verb.
    "Pull together what the emails and meetings say about the budget overrun.",
  ])(
    "routes investigative cross-source wording to semantic vector search: %s",
    (message) => {
      expect(detectCrossSourceInvestigationRequest(message)).toEqual({
        reason: "cross_source_investigation",
      });
    },
  );

  it.each([
    // Single-source triage must keep its tuned fast-path — not hijacked here.
    "What important emails have I received this morning?",
    "Is there anything urgent in my inbox?",
    "Review recent meetings.",
    "What Teams messages came in today?",
    // Diagnosis phrasing that the Teams-recency path owns ("where do you think").
    "Based on all the employees' messages and teams, where do you think is the biggest source of confusion?",
  ])(
    "leaves single-source / non-investigative wording alone: %s",
    (message) => {
      expect(detectCrossSourceInvestigationRequest(message)).toBeNull();
    },
  );
});

describe("detectSourceLookupRecentTeamsRequest — communication diagnosis recency guard", () => {
  const maySecond = new Date("2026-05-02T12:00:00.000Z");

  it("routes employee Teams/message frustration questions to a recent 30-day Teams window", () => {
    const result = detectSourceLookupRecentTeamsRequest(
      "Based on all the employees' messages and teams, where do you think is the biggest source of confusion or lack of communication or frustration?",
      maySecond,
    );

    expect(result).not.toBeNull();
    expect(result?.kind).toBe("recent_teams_discussions");
    expect(result?.query).toContain("employees' messages");
    expect(result?.startDate).toBe("2026-04-02");
    expect(result?.endDate).toBe("2026-05-02");
    expect(result?.limit).toBe(20);
  });

  it("preserves explicit date ranges instead of forcing the default recency window", () => {
    const result = detectSourceLookupRecentTeamsRequest(
      "Based on all employees' Teams messages from April 20 through May 1, 2026, what is the biggest source of frustration?",
      maySecond,
    );

    expect(result?.startDate).toBe("2026-04-20");
    expect(result?.endDate).toBe("2026-05-01");
  });

  it("does not hijack ordinary source-evidence questions", () => {
    const result = detectSourceLookupRecentTeamsRequest(
      "What source evidence supports that?",
      maySecond,
    );

    expect(result).toBeNull();
  });
});

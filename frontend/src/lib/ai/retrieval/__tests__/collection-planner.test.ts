import type { UIMessage } from "ai";

jest.mock("ai", () => ({
  generateText: jest.fn(),
  Output: { object: jest.fn() },
}));
jest.mock("@/lib/ai/providers", () => ({
  getLanguageModel: jest.fn(() => ({})),
}));

import {
  parseCanonicalEntityReference,
  planRetrievalWithSemanticCollections,
  type CollectionInterpretation,
} from "../collection-planner";

function userMessage(text: string): UIMessage {
  return {
    id: crypto.randomUUID(),
    role: "user",
    parts: [{ type: "text", text }],
  } as UIMessage;
}

const annualReviewInterpretation: CollectionInterpretation = {
  isCollectionRequest: true,
  corpus: "meeting_transcripts",
  operation: "analyze",
  scope: "all_matches",
  semanticCriteria:
    "Employee performance review or review-form feedback meetings, excluding unrelated operational reviews.",
  searchTerms: ["performance review", "review form feedback", "employee evaluation"],
  excludeTerms: ["project review", "design review"],
  titleContains: null,
  titleFilterExplicit: false,
  category: null,
  categoryFilterExplicit: false,
  participant: null,
  dateFrom: null,
  dateTo: null,
  requiresExhaustiveCoverage: true,
  rationale: "The user requested analysis across the complete matching collection.",
};

describe("semantic collection planning", () => {
  it("does not let semantic meeting classification bypass a missing selected-project scope", async () => {
    const message =
      "What did we discuss in the most recent meetings for this project?";
    const classify = jest.fn(async () => annualReviewInterpretation);

    const plan = await planRetrievalWithSemanticCollections(
      { message, messages: [userMessage(message)] },
      { classify },
    );

    expect(classify).not.toHaveBeenCalled();
    expect(plan).toMatchObject({
      responseFormat: "project_scope_required",
      reason: "selected_project_context_missing",
      sources: {},
    });
  });

  it("does not let semantic collection planning hijack the first resend after project selection", async () => {
    const message =
      "What did we discuss in the most recent meetings for this project? Cite the source meetings.";
    const messages = [
      userMessage(message),
      {
        id: crypto.randomUUID(),
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "Select a project before I search. No project context reached the assistant.",
          },
        ],
      } as UIMessage,
      userMessage(message),
    ];
    const classify = jest.fn(async () => annualReviewInterpretation);

    const plan = await planRetrievalWithSemanticCollections(
      { message, selectedProjectId: 1097, messages },
      { classify },
    );

    expect(classify).not.toHaveBeenCalled();
    expect(plan).toMatchObject({
      responseFormat: "source_specific_rag",
      reason: "project_context_source_specific_rag_recent_meetings",
      selectedProjectId: 1097,
      sources: {
        sourceSpecificRag: { kind: "recent_meetings" },
      },
    });
  });

  it("keeps yesterday's broad activity question on the executive route", async () => {
    const message = "what were the most important activities that occurred yesterday?";
    const classify = jest.fn(async () => annualReviewInterpretation);

    const plan = await planRetrievalWithSemanticCollections(
      { message, messages: [userMessage(message)] },
      { classify },
    );

    expect(classify).not.toHaveBeenCalled();
    expect(plan.reason).toBe("executive_deep_agent_broad_operator_question");
    expect(plan.sources.meetingCollection).toBeUndefined();
  });

  it("still routes an explicit meeting-transcript source lookup through exhaustive collection", async () => {
    const message = "Search meeting transcripts for annual reviews and summarize them.";

    const plan = await planRetrievalWithSemanticCollections(
      { message, messages: [userMessage(message)] },
      { classify: async () => annualReviewInterpretation },
    );

    expect(plan.reason).toBe("semantic_collection_plan");
    expect(plan.sources.meetingCollection).toMatchObject({
      corpus: "meeting_transcripts",
      scope: "all_matches",
    });
  });

  it("does not let the meeting-only classifier replace an explicit Teams and email research contract", async () => {
    const message =
      "I know Brandon was working on a sprinkler project tonight with Kebba. Read all the Teams messages and emails regarding it from the last couple of days and give me your insights.";
    const classify = jest.fn(async () => annualReviewInterpretation);

    const plan = await planRetrievalWithSemanticCollections(
      { message, messages: [userMessage(message)] },
      { classify },
    );

    expect(classify).not.toHaveBeenCalled();
    expect(plan.reason).toBe("cross_source_investigation_research_contract");
    expect(plan.responseFormat).toBe("source_lookup");
    expect(plan.sources.meetingCollection).toBeUndefined();
    expect(plan.sources.research?.requests.map((request) => request.source)).toEqual([
      "email",
      "teams",
    ]);
  });

  it("resolves a canonical meeting URL to an exact typed entity plan", async () => {
    const url =
      "https://projects.alleatogroup.com/meetings/01KXNHEXBACCR8YVTTRTE07GE7";

    expect(parseCanonicalEntityReference(`read ${url}`)).toEqual({
      entityType: "meeting",
      entityId: "01KXNHEXBACCR8YVTTRTE07GE7",
      canonicalPath: "/meetings/01KXNHEXBACCR8YVTTRTE07GE7",
    });

    const plan = await planRetrievalWithSemanticCollections({
      message: `read ${url}`,
      messages: [userMessage(`read ${url}`)],
    });

    expect(plan.responseFormat).toBe("collection_analysis");
    expect(plan.sources.meetingCollection).toMatchObject({
      scope: "single_entity",
      entityId: "01KXNHEXBACCR8YVTTRTE07GE7",
      requiresExhaustiveCoverage: true,
    });
  });

  it.each([
    "Read all of the annual reviews and tell me your insights",
    "Go through every employee evaluation conversation and summarize the patterns",
    "Compare the complete set of performance feedback meetings",
  ])("routes varied wording through the same typed collection contract: %s", async (message) => {
    const plan = await planRetrievalWithSemanticCollections(
      { message, messages: [userMessage(message)] },
      { classify: async () => annualReviewInterpretation },
    );

    expect(plan.reason).toBe("semantic_collection_plan");
    expect(plan.responseFormat).toBe("collection_analysis");
    expect(plan.sources.meetingCollection).toMatchObject({
      corpus: "meeting_transcripts",
      scope: "all_matches",
      semanticCriteria: annualReviewInterpretation.semanticCriteria,
      requiresExhaustiveCoverage: true,
    });
  });

  it("combines a clarification turn through conversation-aware semantic classification", async () => {
    const messages = [
      userMessage("Read the reviews"),
      userMessage("They are meeting transcripts with review-form feedback in the title"),
    ];
    let receivedMessages: UIMessage[] = [];

    const plan = await planRetrievalWithSemanticCollections(
      { message: "They are meeting transcripts", messages },
      {
        classify: async (input) => {
          receivedMessages = input.messages;
          return annualReviewInterpretation;
        },
      },
    );

    expect(receivedMessages).toBe(messages);
    expect(plan.sources.meetingCollection?.semanticCriteria).toContain(
      "performance review",
    );
  });

  it("refuses a source-free fallback when semantic planning itself fails", async () => {
    const message = "Read the entire relevant collection and analyze it";
    await expect(
      planRetrievalWithSemanticCollections(
        { message, messages: [userMessage(message)] },
        {
          classify: async () => {
            throw new Error("planner unavailable");
          },
        },
      ),
    ).rejects.toThrow("Refusing a source-free answer");
  });
});

import {
  COLLECTION_ADVISOR_CONTRACT_VERSION,
  COLLECTION_SYNTHESIS_MAX_OUTPUT_TOKENS,
  COLLECTION_SYNTHESIS_TIMEOUT_MS,
  renderCollectionAdvisorAnswer,
  splitTranscriptForCollectionAnalysis,
  synthesizeMeetingCollection,
  type CollectionAdvisorDraft,
  type CollectionAdvisorQuality,
} from "../collection-synthesis";
import type { MeetingCollectionResult } from "../types";

jest.mock("ai", () => ({
  generateText: jest.fn(),
  Output: { object: jest.fn() },
}));
jest.mock("@/lib/ai/providers", () => ({
  getLanguageModel: jest.fn(() => ({})),
}));

const passingJudge = {
  thesisSpecificity: 5,
  prioritization: 4,
  businessImplications: 5,
  actionability: 4,
  executiveVoice: 5,
  feedback: [],
};

function advisorDraft(
  overrides: Partial<CollectionAdvisorDraft> = {},
): CollectionAdvisorDraft {
  return {
    executiveRead: {
      thesis:
        "The strongest organizational signal is not a lack of ambition; it is that advancement expectations are outrunning the operating systems needed to turn ambition into dependable leadership capacity.",
      evidenceMeetingIds: ["meeting-1", "meeting-2"],
    },
    prioritySignals: [
      {
        title: "Leadership capacity needs an operating path",
        judgment:
          "Several people are being encouraged toward broader ownership, but the evidence points to uneven definitions of what readiness looks like across roles.",
        implication:
          "Without explicit milestones, leadership investment can become subjective and promotions can arrive before delegation, planning, and accountability habits are dependable.",
        evidenceMeetingIds: ["meeting-1"],
      },
      {
        title: "Delegation is the leverage point",
        judgment:
          "The reviews connect growth to a practical shift from doing more individual work toward assigning, checking, and developing work through other people.",
        implication:
          "That makes delegation a measurable operating capability rather than a generic coaching topic, and it should be developed deliberately.",
        evidenceMeetingIds: ["meeting-2"],
      },
    ],
    actions: [
      {
        action: "Define a 90-day leadership-readiness scorecard",
        rationale:
          "Use observable milestones for planning, delegation, communication, and follow-through so growth conversations result in clear operating commitments.",
        evidenceMeetingIds: ["meeting-1"],
      },
      {
        action: "Make delegation practice part of weekly operating reviews",
        rationale:
          "Ask emerging leaders to name what they delegated, how they verified the result, and what capability they built in another person.",
        evidenceMeetingIds: ["meeting-2"],
      },
    ],
    caveat: {
      text: "The evidence supports a company-wide pattern, but individual readiness decisions still require role-specific performance measures and manager judgment.",
      evidenceMeetingIds: ["meeting-1", "meeting-2"],
    },
    ...overrides,
  };
}

function advisorQuality(): CollectionAdvisorQuality {
  return {
    contractVersion: COLLECTION_ADVISOR_CONTRACT_VERSION,
    passed: true,
    score: 92,
    attempts: 1,
    judgeModel: "openai/gpt-4.1-mini",
    semanticScores: {
      thesisSpecificity: 5,
      prioritization: 4,
      businessImplications: 5,
      actionability: 4,
      executiveVoice: 5,
    },
    reasons: ["typed executive thesis present"],
  };
}

function collection(
  overrides: Partial<MeetingCollectionResult> = {},
): MeetingCollectionResult {
  return {
    request: {
      corpus: "meeting_transcripts",
      operation: "analyze",
      scope: "all_matches",
      originalRequest: "analyze every employee review",
      semanticCriteria: "employee performance reviews",
      searchTerms: [],
      excludeTerms: [],
      requiresExhaustiveCoverage: true,
    },
    status: "complete",
    coverage: {
      enumerated: 2,
      candidateMatches: 2,
      matched: 2,
      retrieved: 2,
      failed: 0,
      transcriptCharacters: 120,
      exhaustive: true,
    },
    items: [
      {
        id: "meeting-1",
        title: "Maria - Review Form Feedback",
        date: "2026-07-16",
        category: null,
        projectId: null,
        project: null,
        participants: "Maria, Megan",
        sourceRef: '[Source: Meeting - "Maria - Review Form Feedback" - 2026-07-16]',
        sourceUrl: "/meetings/meeting-1",
        transcript: "## Transcript\n\nMaria discussed leadership growth.",
        transcriptCharacters: 55,
      },
      {
        id: "meeting-2",
        title: "Andrew - Review Form Feedback",
        date: "2026-07-16",
        category: null,
        projectId: null,
        project: null,
        participants: "Andrew, Megan",
        sourceRef: '[Source: Meeting - "Andrew - Review Form Feedback" - 2026-07-16]',
        sourceUrl: "/meetings/meeting-2",
        transcript: "## Transcript\n\nAndrew discussed delegation goals.",
        transcriptCharacters: 52,
      },
    ],
    failures: [],
    ...overrides,
  };
}

describe("collection synthesis", () => {
  beforeEach(() => {
    const { generateText } = jest.requireMock("ai") as {
      generateText: jest.Mock;
    };
    generateText.mockReset();
  });

  it("chunks long transcripts without dropping text", () => {
    const transcript = `${"a".repeat(70)}\n\n${"b".repeat(70)}`;
    const chunks = splitTranscriptForCollectionAnalysis(transcript, 80);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toBe(transcript);
  });

  it("processes every retrieved transcript before final synthesis", async () => {
    const extractedIds: string[] = [];
    const finalEvidenceIds: string[] = [];
    const result = await synthesizeMeetingCollection({
      collection: collection(),
      model: {} as never,
      extractChunk: async ({ item }) => {
        extractedIds.push(item.id);
        return {
          factualSummary: `${item.title} summary`,
          strengths: [],
          coachingThemes: [],
          commitments: [],
          organizationalSignals: [],
          evidence: [],
        };
      },
      synthesizeFinal: async ({ evidence }) => {
        finalEvidenceIds.push(...evidence.map((item) => item.meetingId));
        return {
          content: "Grounded synthesis [Source: Meeting - review]",
          advisorQuality: advisorQuality(),
        };
      },
    });

    expect(extractedIds.sort()).toEqual(["meeting-1", "meeting-2"]);
    expect(finalEvidenceIds.sort()).toEqual(["meeting-1", "meeting-2"]);
    expect(result.meetingCount).toBe(2);
    expect(result.processedTranscriptCharacters).toBe(107);
    expect(result.evidenceCharacters).toBeGreaterThan(0);
    expect(result.extractionDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.finalSynthesisDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.finalSynthesisMaxOutputTokens).toBe(
      COLLECTION_SYNTHESIS_MAX_OUTPUT_TOKENS,
    );
    expect(result.finalSynthesisMode).toBe("non_reasoning");
    expect(result.finalSynthesisTimeoutMs).toBe(
      COLLECTION_SYNTHESIS_TIMEOUT_MS,
    );
  });

  it("refuses to synthesize an incomplete collection", async () => {
    const incomplete = collection({
      status: "incomplete",
      coverage: {
        enumerated: 2,
        candidateMatches: 2,
        matched: 2,
        retrieved: 1,
        failed: 1,
        transcriptCharacters: 55,
        exhaustive: false,
      },
      failures: [
        {
          id: "meeting-2",
          title: "Andrew - Review Form Feedback",
          code: "transcript_missing",
          message: "No complete transcript",
        },
      ],
    });

    await expect(
      synthesizeMeetingCollection({
        collection: incomplete,
        model: {} as never,
        extractChunk: jest.fn(),
        synthesizeFinal: jest.fn(),
      }),
    ).rejects.toThrow("requires complete, exhaustive retrieval");
  });

  it("bounds the final synthesis model instead of inheriting provider defaults", async () => {
    const { generateText } = jest.requireMock("ai") as {
      generateText: jest.Mock;
    };
    generateText
      .mockResolvedValueOnce({ output: advisorDraft(), finishReason: "stop" })
      .mockResolvedValueOnce({ output: passingJudge, finishReason: "stop" });

    await synthesizeMeetingCollection({
      collection: collection(),
      model: {} as never,
      extractChunk: async ({ item }) => ({
        factualSummary: `${item.title} summary`,
        strengths: [],
        coachingThemes: [],
        commitments: [],
        organizationalSignals: [],
        evidence: [],
      }),
    });

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        maxOutputTokens: COLLECTION_SYNTHESIS_MAX_OUTPUT_TOKENS,
        abortSignal: expect.any(AbortSignal),
      }),
    );
    expect(generateText.mock.calls[0]?.[0]).not.toHaveProperty(
      "providerOptions",
    );
  });

  it("renders a prioritized executive answer before a deterministic evidence footer", async () => {
    const { generateText } = jest.requireMock("ai") as {
      generateText: jest.Mock;
    };
    generateText
      .mockResolvedValueOnce({ output: advisorDraft(), finishReason: "stop" })
      .mockResolvedValueOnce({ output: passingJudge, finishReason: "stop" });

    const result = await synthesizeMeetingCollection({
      collection: collection(),
      model: {} as never,
      extractChunk: async ({ item }) => ({
        factualSummary: `${item.title} summary`,
        strengths: [],
        coachingThemes: [],
        commitments: [],
        organizationalSignals: [],
        evidence: [],
      }),
    });

    expect(result.content).toContain("## Executive read");
    expect(result.content).toContain("## What matters most");
    expect(result.content).toContain("## What I would do next");
    expect(result.content).toContain("_Evidence basis: all 2 matching meetings were reviewed; none were unavailable._");
  });

  it("renders canonical citations from validated meeting ids", () => {
    const content = renderCollectionAdvisorAnswer({
      draft: advisorDraft(),
      coverage: collection().coverage,
      evidence: collection().items.map((item) => ({
        meetingId: item.id,
        sourceRef: item.sourceRef,
      })),
    });

    expect(content).toContain('[Source: Meeting - "Maria - Review Form Feedback" - 2026-07-16]');
    expect(content).toContain('[Source: Meeting - "Andrew - Review Form Feedback" - 2026-07-16]');
  });
});

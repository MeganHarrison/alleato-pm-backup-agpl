import {
  extractTitleKeywords,
  generateAttributionRulePromotionCandidates,
} from "@/lib/ai/services/feedback-event-service";
import { createServiceClient } from "@/lib/supabase/service";

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
  createRagServiceClient: jest.fn(),
}));

jest.mock("@/lib/ai/services/agent-learning-service", () => ({
  upsertAgentLearning: jest.fn(),
}));

jest.mock("@/lib/ai/services/ai-memory-service", () => ({
  writeMemory: jest.fn(),
}));

jest.mock("@/lib/ai/session-id", () => ({
  toSessionUuid: (value: string) => value,
}));

const createServiceClientMock = createServiceClient as jest.Mock;

/** Minimal chainable Supabase query builder that resolves to a fixed result. */
function makeBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "gte", "is", "in", "order", "limit"]) {
    builder[method] = () => builder;
  }
  builder.then = (resolve: (value: unknown) => unknown) => resolve(result);
  return builder;
}

function buildAttributionEvent(
  id: string,
  fromEmail: string,
  projectId: number,
  projectName: string,
) {
  return {
    id,
    project_id: projectId,
    source_context: {
      projectId,
      projectName,
      fromEmail,
      fromDomain: fromEmail.split("@")[1],
      titleKeywords: [],
    },
  };
}

describe("extractTitleKeywords", () => {
  it("keeps salient tokens and drops stopwords, short words, and numbers", () => {
    const keywords = extractTitleKeywords("Weekly Danville Theatre 2026 Update");
    expect(keywords).toContain("danville");
    expect(keywords).toContain("theatre");
    expect(keywords).not.toContain("weekly");
    expect(keywords).not.toContain("update");
    expect(keywords).not.toContain("2026");
  });

  it("returns an empty array for null input", () => {
    expect(extractTitleKeywords(null)).toEqual([]);
  });
});

describe("generateAttributionRulePromotionCandidates", () => {
  beforeEach(() => jest.clearAllMocks());

  it("proposes a domain rule when the same sender domain is repeatedly assigned to one project", async () => {
    const events = [
      buildAttributionEvent("ev-1", "alice@acme.com", 5, "Acme Tower"),
      buildAttributionEvent("ev-2", "bob@acme.com", 5, "Acme Tower"),
      buildAttributionEvent("ev-3", "carol@acme.com", 5, "Acme Tower"),
    ];

    const dataByTable: Record<string, unknown> = {
      ai_feedback_events: events,
      ai_learning_promotions: [],
      project_attribution_rules: [],
    };

    createServiceClientMock.mockReturnValue({
      from: (table: string) =>
        makeBuilder({ data: dataByTable[table] ?? [], error: null }),
    });

    const result = await generateAttributionRulePromotionCandidates({
      minSignals: 3,
      dryRun: true,
    });

    expect(result.candidatesCreated).toBe(0); // dry run
    const domainCandidate = result.candidates.find(
      (candidate) =>
        (candidate.proposedLearning as Record<string, unknown>).ruleType === "domain",
    );
    expect(domainCandidate).toBeDefined();
    expect(domainCandidate?.projectId).toBe(5);
    expect(
      (domainCandidate?.proposedLearning as Record<string, unknown>).pattern,
    ).toBe("acme.com");
  });

  it("does not propose a rule below the signal threshold", async () => {
    const events = [buildAttributionEvent("ev-1", "alice@acme.com", 5, "Acme Tower")];

    const dataByTable: Record<string, unknown> = {
      ai_feedback_events: events,
      ai_learning_promotions: [],
      project_attribution_rules: [],
    };

    createServiceClientMock.mockReturnValue({
      from: (table: string) =>
        makeBuilder({ data: dataByTable[table] ?? [], error: null }),
    });

    const result = await generateAttributionRulePromotionCandidates({
      minSignals: 3,
      dryRun: true,
    });

    expect(result.candidatesFound).toBe(0);
  });
});

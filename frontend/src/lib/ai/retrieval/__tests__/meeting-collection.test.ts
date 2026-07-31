import {
  expandMeetingCandidateSearchTerms,
  enrichMeetingCandidateFamilies,
  expandSelectedMeetingFamilies,
  hasCompiledQueryAlignment,
  deterministicCompiledTitleMatches,
  deterministicCompiledFamilyMatches,
  normalizeMeetingMetadataForMatching,
  filterMeetingCollectionCandidates,
  matchesMeetingCollectionCandidate,
  type MeetingMetadataCandidate,
} from "../meeting-collection";
import type { MeetingCollectionRequest } from "../types";

jest.mock("ai", () => ({
  generateText: jest.fn(),
  Output: { object: jest.fn() },
}));
jest.mock("@/lib/ai/providers", () => ({
  getLanguageModel: jest.fn(() => ({})),
}));

function candidate(
  id: string,
  title: string,
  category: string | null = null,
): MeetingMetadataCandidate {
  return {
    id,
    title,
    date: "2026-07-16T12:00:00Z",
    category,
    meeting_type: null,
    project: null,
    project_id: null,
    participants: null,
    participants_array: null,
    summary: null,
    overview: null,
  };
}

function request(
  overrides: Partial<MeetingCollectionRequest> = {},
): MeetingCollectionRequest {
  return {
    corpus: "meeting_transcripts",
    operation: "analyze",
    scope: "all_matches",
    originalRequest: "analyze every employee review",
    semanticCriteria: "Employee review and performance-feedback meetings",
    searchTerms: ["annual review"],
    excludeTerms: [],
    requiresExhaustiveCoverage: true,
    ...overrides,
  };
}

describe("meeting collection candidate discovery", () => {
  it("uses explicit structured filters when provided", () => {
    const maria = candidate("maria", "Maria - Review Form Feedback", "Annual Review");
    expect(
      matchesMeetingCollectionCandidate(
        maria,
        request({ searchTerms: [], category: "annual review" }),
      ),
    ).toBe(true);
    expect(
      matchesMeetingCollectionCandidate(
        maria,
        request({ searchTerms: [], participant: "Andrew" }),
      ),
    ).toBe(false);
  });

  it("expands planner-produced phrases generically without subject-specific rules", () => {
    expect(expandMeetingCandidateSearchTerms(["annual reviews"])).toEqual([
      "annual review",
      "annual",
      "review",
    ]);
  });

  it("normalizes ordinary plural metadata without phrase-specific aliases", () => {
    expect(normalizeMeetingMetadataForMatching("annual reviews")).toBe(
      "annual review",
    );
    expect(normalizeMeetingMetadataForMatching("employee evaluations")).toBe(
      "employee evaluation",
    );
  });

  it("uses the compiled terms as a high-recall metadata query before semantic selection", () => {
    const rows = [
      candidate("maria", "Maria - Review Form Feedback"),
      candidate("andrew", "Andrew - Employee Evaluation"),
      candidate("risk", "Risk Assessment Review - Vermillion Rise"),
      candidate("oac", "Westfield OAC Meeting"),
    ];

    expect(filterMeetingCollectionCandidates(rows, request()).map((row) => row.id)).toEqual([
      "maria",
      "risk",
    ]);
  });

  it("can use search terms to narrow a non-exhaustive request", () => {
    const rows = [
      candidate("maria", "Maria - Review Form Feedback"),
      candidate("oac", "Westfield OAC Meeting"),
    ];

    expect(
      filterMeetingCollectionCandidates(
        rows,
        request({ requiresExhaustiveCoverage: false, searchTerms: ["review form"] }),
      ).map((row) => row.id),
    ).toEqual(["maria"]);
  });

  it("propagates a semantic decision across repeated title templates", () => {
    const rows = enrichMeetingCandidateFamilies([
      candidate("maria", "Maria - Review Form Feedback"),
      candidate("andrew", "Andrew - Review Form Feedback", "Annual Review"),
      candidate("risk", "Risk Assessment Review - Vermillion Rise", "Annual Review"),
    ]);

    expect(rows[0]?.titleFamily).toBe("review form feedback");
    expect(rows[0]?.siblingCategories).toEqual(["Annual Review"]);
    expect(expandSelectedMeetingFamilies(rows, ["andrew"])).toEqual([
      "andrew",
      "maria",
    ]);
  });

  it("applies planner-compiled exclusion terms without hard-coded subjects", () => {
    const rows = [
      candidate("employee", "Maria - Annual Review"),
      candidate("risk", "Risk Assessment Review - Vermillion Rise"),
    ];
    expect(
      filterMeetingCollectionCandidates(
        rows,
        request({ excludeTerms: ["risk assessment"] }),
      ).map((row) => row.id),
    ).toEqual(["employee"]);
  });

  it("rejects a semantic false positive that lacks compiled query anchors", () => {
    const [employee, , event] = enrichMeetingCandidateFamilies([
      candidate("employee", "Maria - Review Form Feedback", "Annual Review"),
      candidate("employee-2", "Andrew - Review Form Feedback"),
      candidate("event", "Goodwill Volunteer Event - Final Review"),
    ]);
    const compiled = request({
      searchTerms: ["annual review", "employee evaluation", "yearly performance"],
    });

    expect(hasCompiledQueryAlignment(employee!, compiled)).toBe(true);
    expect(hasCompiledQueryAlignment(event!, compiled)).toBe(false);
  });

  it("trusts a specific conflicting title over a lone broad category label", () => {
    const [risk] = enrichMeetingCandidateFamilies([
      candidate(
        "risk",
        "Risk Assessment Review - Vermillion Rise",
        "Annual Review",
      ),
    ]);
    const compiled = request({
      searchTerms: ["annual review", "employee evaluation", "yearly performance"],
    });

    expect(hasCompiledQueryAlignment(risk!, compiled)).toBe(false);
  });

  it("includes exact multiword title predicates even when the semantic selector misses one", () => {
    const rows = [
      candidate("annual", "Annual Review"),
      candidate("risk", "Risk Assessment Review"),
    ];
    expect(
      deterministicCompiledTitleMatches(
        rows,
        request({ searchTerms: ["annual review", "employee evaluation"] }),
      ),
    ).toEqual(["annual"]);
  });

  it("uses repeated-family taxonomy when only sibling rows are categorized", () => {
    const rows = enrichMeetingCandidateFamilies([
      candidate("maria", "Maria - Review Form Feedback"),
      candidate("andrew", "Andrew - Review Form Feedback", "Annual Review"),
      candidate("risk", "Risk Assessment Review", "Annual Review"),
    ]);
    expect(
      deterministicCompiledFamilyMatches(
        rows,
        request({ searchTerms: ["annual reviews", "employee evaluations"] }),
      ),
    ).toEqual(["maria", "andrew"]);
  });
});

jest.mock("server-only", () => ({}));
jest.mock("ai", () => ({
  tool: (definition: unknown) => definition,
}));
jest.mock("@/lib/fmds/fmds-chat.server", () => ({
  searchFmdsEvidence: jest.fn(),
}));
jest.mock("@/lib/fmds/asrs-estimator.server", () => ({
  evaluateAsrsConfiguration: jest.fn(),
}));

import { searchFmdsEvidence } from "@/lib/fmds/fmds-chat.server";
import { evaluateAsrsConfiguration } from "@/lib/fmds/asrs-estimator.server";
import { createAsrsIntelligenceTools } from "../asrs-intelligence";

const executionOptions = { toolCallId: "test", messages: [], context: {} };
const REVISION_ID = "65306e47-c25a-4397-92a0-c44c03903d0f";

describe("createAsrsIntelligenceTools", () => {
  beforeEach(() => jest.resetAllMocks());

  it("returns revision-scoped evidence and records a source trace", async () => {
    (searchFmdsEvidence as jest.Mock).mockResolvedValue({
      corpus: {
        documentCode: "FMDS0834",
        revisionId: REVISION_ID,
        revisionLabel: "2026-04",
        revisionStatus: "staging",
      },
      coverage: { matchedChunks: 4, tables: 1, figures: 1 },
      chunks: [],
      tables: [],
      figures: [],
      answerPolicy: {
        calculationAuthority: "reviewed_evaluator_only",
        unreviewedEvidenceStatus: "pending_review",
      },
    });
    const onTrace = jest.fn();
    const tools = createAsrsIntelligenceTools({
      onTrace,
      revisionId: REVISION_ID,
    });

    const result = await tools.searchFmds2026Evidence.execute!(
      { query: "which FMDS table applies?", matchCount: 8 },
      executionOptions,
    );

    expect(result).toMatchObject({ corpus: { revisionLabel: "2026-04" } });
    expect(onTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "searchFmds2026Evidence",
        status: "success",
        revisionStatus: "staging",
      }),
    );
    expect(searchFmdsEvidence).toHaveBeenCalledWith(
      { query: "which FMDS table applies?", matchCount: 8 },
      { revisionId: REVISION_ID },
    );
  });

  it("preserves evaluator Pending Review status", async () => {
    (evaluateAsrsConfiguration as jest.Mock).mockResolvedValue({
      corpus: {
        coverage: "reviewed_batch_1",
        documentCode: "FMDS0834",
        revisionId: REVISION_ID,
        revisionLabel: "2026-04",
        revisionStatus: "staging",
      },
      requirements: [
        {
          id: "hose-demand",
          label: "Hose demand",
          status: "verified",
          value: "250 gpm for 60 minutes",
          citations: [
            {
              label: "Table 2.1.4.5.4",
              pageNumber: 12,
              sourceType: "table",
              sourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              sourceIdentifier: "2.1.4.5.4",
              ruleKey: "batch1.hose_demand",
              reviewEventId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              href: "/asrs/tables/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            },
          ],
        },
        {
          id: "sprinkler-head-count",
          label: "Sprinkler head count",
          status: "pending_review",
          value: "Pending review.",
          citations: [],
        },
      ],
    });
    const tools = createAsrsIntelligenceTools({ revisionId: REVISION_ID });

    const result = await tools.evaluateFmds2026Configuration.execute!(
      { ceilingSprinklerType: "standard_coverage", designSprinklerCount: 12 },
      executionOptions,
    );

    expect(result).toMatchObject({
      evaluationStatus: "pending_review",
      evaluation: {
        requirements: expect.arrayContaining([
          expect.objectContaining({
            id: "hose-demand",
            citations: [
              expect.objectContaining({
                sourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                ruleKey: "batch1.hose_demand",
                href: "/asrs/tables/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              }),
            ],
          }),
        ]),
      },
      answerPolicy: {
        verifiedOnlyFromReviewedRules: true,
        preservePendingReview: true,
      },
    });
    expect(evaluateAsrsConfiguration).toHaveBeenCalledWith(
      { ceilingSprinklerType: "standard_coverage", designSprinklerCount: 12 },
      { revisionId: REVISION_ID },
    );
  });

  it("rejects a tool response that drifts to another revision", async () => {
    (searchFmdsEvidence as jest.Mock).mockResolvedValue({
      corpus: {
        documentCode: "FMDS0834",
        revisionId: "11111111-1111-4111-8111-111111111111",
        revisionLabel: "other",
        revisionStatus: "staging",
      },
    });
    const tools = createAsrsIntelligenceTools({ revisionId: REVISION_ID });

    await expect(
      tools.searchFmds2026Evidence.execute!(
        { query: "which FMDS table applies?", matchCount: 8 },
        executionOptions,
      ),
    ).rejects.toThrow("different corpus revision than the current ASRS turn");
  });

  it("rejects an evaluator response that drifts to another revision", async () => {
    (evaluateAsrsConfiguration as jest.Mock).mockResolvedValue({
      corpus: {
        coverage: "reviewed_batch_1",
        documentCode: "FMDS0834",
        revisionId: "11111111-1111-4111-8111-111111111111",
        revisionLabel: "other",
        revisionStatus: "staging",
      },
      requirements: [],
    });
    const tools = createAsrsIntelligenceTools({ revisionId: REVISION_ID });

    await expect(
      tools.evaluateFmds2026Configuration.execute!(
        { ceilingSprinklerType: "standard_coverage", designSprinklerCount: 12 },
        executionOptions,
      ),
    ).rejects.toThrow("different corpus revision than the current ASRS turn");
  });
});

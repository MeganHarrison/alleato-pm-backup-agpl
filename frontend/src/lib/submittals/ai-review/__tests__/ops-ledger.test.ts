import {
  completeSubmittalAIReviewOpsRun,
  failSubmittalAIReviewOpsRun,
  startSubmittalAIReviewOpsRun,
} from "../ops-ledger";
import type { SubmittalAIReviewRun } from "../schemas";

const mockLedger = {
  createRun: jest.fn(),
  updateRun: jest.fn(),
  createRunStep: jest.fn(),
  createArtifact: jest.fn(),
};

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(() => ({ service: true })),
}));

jest.mock("@/lib/ai-ops/ledger", () => ({
  createAiOpsLedger: jest.fn(() => mockLedger),
}));

function reviewRun(
  overrides: Partial<SubmittalAIReviewRun> = {},
): SubmittalAIReviewRun {
  return {
    runId: "11111111-1111-4111-8111-111111111111",
    projectId: 25125,
    submittalId: "22222222-2222-4222-8222-222222222222",
    status: "partial",
    focusArea: "door hardware",
    summary: "Review completed with degraded specification context.",
    recommendation: "Revise and Resubmit",
    startedAt: "2026-06-26T10:00:00.000Z",
    completedAt: "2026-06-26T10:01:00.000Z",
    readiness: {
      state: "partial",
      summary: "Specification context is degraded.",
      layers: [
        {
          key: "submittal_text",
          label: "Submittal text",
          state: "ready",
          reasons: [],
          availableCount: 1,
          totalCount: 1,
        },
        {
          key: "spec_context",
          label: "Specification context",
          state: "failed",
          reasons: ["Statement timeout"],
          availableCount: 0,
          totalCount: 1,
        },
      ],
    },
    sourceCoverage: {
      submittalDocumentCount: 1,
      linkedDrawingCount: 1,
      ragChunkCount: 1,
      specSourceCount: 0,
    },
    linkedDrawings: [],
    checks: [],
    error: null,
    ...overrides,
  };
}

describe("submittal AI review ops ledger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLedger.createRun.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
    });
    mockLedger.updateRun.mockResolvedValue(undefined);
    mockLedger.createRunStep.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
    });
    mockLedger.createArtifact.mockResolvedValue({
      id: "55555555-5555-4555-8555-555555555555",
    });
  });

  it("starts a canonical AI Ops run for a submittal review attempt", async () => {
    const context = await startSubmittalAIReviewOpsRun({
      projectId: 25125,
      submittalId: "22222222-2222-4222-8222-222222222222",
      submittalReviewRunId: "11111111-1111-4111-8111-111111111111",
      userId: "66666666-6666-4666-8666-666666666666",
      focusArea: "door hardware",
      modelId: "openai/gpt-5.4-mini",
      startedAt: "2026-06-26T10:00:00.000Z",
    });

    expect(context.runId).toBe("33333333-3333-4333-8333-333333333333");
    expect(mockLedger.createRun).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: "submittal_ai_review",
        status: "running",
        permissionMode: "user_delegated",
        modelPolicy: expect.objectContaining({
          modelId: "openai/gpt-5.4-mini",
        }),
        metadata: expect.objectContaining({
          projectId: 25125,
          submittalReviewRunId: "11111111-1111-4111-8111-111111111111",
        }),
      }),
    );
  });

  it("completes the AI Ops run with source coverage and a review artifact", async () => {
    await completeSubmittalAIReviewOpsRun(
      {
        runId: "33333333-3333-4333-8333-333333333333",
        startedAt: "2026-06-26T10:00:00.000Z",
      },
      reviewRun(),
    );

    expect(mockLedger.updateRun).toHaveBeenCalledWith(
      "33333333-3333-4333-8333-333333333333",
      expect.objectContaining({
        status: "partial_success",
        sourceCounts: {
          submittalDocumentCount: 1,
          linkedDrawingCount: 1,
          ragChunkCount: 1,
          specSourceCount: 0,
        },
        metadata: expect.objectContaining({
          submittalReviewRunId: "11111111-1111-4111-8111-111111111111",
          sourceHealth: expect.arrayContaining([
            expect.objectContaining({
              resourceId: "spec_context",
              status: "failed",
            }),
          ]),
        }),
      }),
    );
    expect(mockLedger.createArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "verification_report",
        storageTable: "submittal_ai_review_runs",
        storageId: "11111111-1111-4111-8111-111111111111",
      }),
    );
    expect(mockLedger.createRunStep).toHaveBeenCalledWith(
      expect.objectContaining({
        stepType: "artifact_persist",
        status: "succeeded",
      }),
    );
  });

  it("records review failures as permanent AI Ops failures", async () => {
    await failSubmittalAIReviewOpsRun(
      {
        runId: "33333333-3333-4333-8333-333333333333",
        startedAt: "2026-06-26T10:00:00.000Z",
      },
      {
        code: "AI_PROVIDER_FAILED",
        message: "Model unavailable",
        sourceCoverage: reviewRun().sourceCoverage,
      },
    );

    expect(mockLedger.updateRun).toHaveBeenCalledWith(
      "33333333-3333-4333-8333-333333333333",
      expect.objectContaining({
        status: "failed_permanent",
        failureCode: "AI_PROVIDER_FAILED",
        failureMessage: "Model unavailable",
        sourceCounts: reviewRun().sourceCoverage,
      }),
    );
  });
});

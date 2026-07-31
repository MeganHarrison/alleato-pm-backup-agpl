jest.mock("server-only", () => ({}));
jest.mock("ai", () => ({
  generateObject: jest.fn(),
}));
jest.mock("@/lib/ai/providers", () => ({
  getLanguageModel: jest.fn((modelId: string) => ({ modelId })),
}));
jest.mock("@/lib/ai/provider-config", () => ({
  formatAIProviderFailure: jest.fn(
    (error: unknown, purpose: string) =>
      `${purpose} failed: ${error instanceof Error ? error.message : String(error)}`,
  ),
}));

import { generateObject } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import { summarizeProjectIntelligence } from "../project-intelligence-summary";

const generateObjectMock = generateObject as jest.MockedFunction<typeof generateObject>;
const getLanguageModelMock = getLanguageModel as jest.MockedFunction<typeof getLanguageModel>;

const validOutput = {
  headline: "Owner approval is blocked by missing cost detail.",
  context:
    "The latest project messages show an owner decision waiting on clearer pricing and schedule impact.",
  risks: [
    {
      title: "Approval delay could push procurement",
      severity: "high" as const,
      recommendedAction: "Send a priced decision packet to the owner.",
      sourceIds: ["email-1"],
    },
  ],
  decisions: [
    {
      title: "Proceed with revised lobby finish pricing",
      owner: "Brandon",
      followUp: "Confirm owner approval after pricing is sent.",
      sourceIds: ["meeting-1"],
    },
  ],
  actionItems: [
    {
      title: "Send revised pricing packet",
      owner: "Brandon",
      dueDate: "2026-05-13",
      priority: "high" as const,
      sourceIds: ["email-1", "meeting-1"],
    },
  ],
  dataGaps: ["No final owner approval is present in the provided sources."],
  confidence: "high" as const,
  operatingSummary: {
    currentExecutiveRead:
      "The project is waiting on pricing detail before the owner can approve the next design move.",
    immediateAttention: [
      {
        title: "Send priced decision packet to owner",
        detail: "Owner approval is blocked until the revised pricing and schedule effect are packaged clearly.",
        priority: "high" as const,
        sourceIds: ["email-1", "meeting-1"],
      },
    ],
    currentFocus: [
      {
        title: "Owner pricing approval",
        status: "Awaiting decision",
        owner: "Brandon",
        summary: "Pricing clarification is the active workstream driving approval timing.",
        nextDecision: "Confirm whether the owner will approve the revised finish package.",
        riskSeverity: "high" as const,
        sourceIds: ["email-1", "meeting-1"],
      },
    ],
    timeline: [
      {
        title: "Owner requested revised pricing",
        occurredAt: "2026-05-11T12:00:00.000Z",
        significance: "Pricing is the next gating item before approval.",
        sourceIds: ["email-1"],
      },
    ],
    recentChanges: [
      {
        title: "Lobby finish pricing moved back into review",
        changedArea: "financial" as const,
        impact: "Owner approval depends on a clearer cost packet.",
        sourceIds: ["email-1"],
      },
    ],
    financialPosition: {
      summary: "Known financial detail is limited to the requested revised pricing packet.",
      knownAmounts: [],
      exposure: [
        {
          title: "Approval depends on revised pricing",
          sourceIds: ["email-1"],
        },
      ],
    },
    scheduleAndProcurement: {
      summary: "Procurement could be delayed if approval waits on pricing.",
      blockers: [
        {
          title: "Pricing packet not yet confirmed as sent",
          sourceIds: ["meeting-1"],
        },
      ],
      upcomingDates: [
        {
          title: "Revised pricing packet target",
          date: "2026-05-13",
          sourceIds: ["meeting-1"],
        },
      ],
    },
    projectControls: {
      rfis: [],
      submittals: [],
      drawings: [],
      specifications: [],
      dailyReports: [],
      tasks: [],
    },
    openQuestions: [
      {
        title: "Has the owner approved the revised finish pricing?",
        owner: null,
        neededBy: null,
        sourceIds: ["email-1"],
      },
    ],
    recommendedFocus: [
      {
        title: "Send the owner a priced decision packet",
        reason: "It is the clearest way to unblock approval.",
        priority: "high" as const,
        sourceIds: ["email-1", "meeting-1"],
      },
    ],
    sourceCoverage: {
      coveredTypes: ["email", "meeting"],
      missingTypes: ["rfi", "submittal", "drawing", "specification", "daily_report"],
      weakestAreas: ["No structured project controls were provided."],
    },
  },
};

describe("summarizeProjectIntelligence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    generateObjectMock.mockResolvedValue({
      object: validOutput,
    } as Awaited<ReturnType<typeof generateObject>>);
  });

  it("uses AI SDK structured output with traceable source context", async () => {
    const summary = await summarizeProjectIntelligence({
      projectName: "Ulta Beauty Fresno",
      focus: "project_brief",
      sources: [
        {
          id: "email-1",
          type: "email",
          title: "Owner pricing request",
          text: "Owner requested revised lobby finish pricing before approving the work.",
          capturedAt: "2026-05-11T12:00:00.000Z",
        },
        {
          id: "meeting-1",
          type: "meeting",
          text: "Brandon said he would send the revised pricing packet by 2026-05-13.",
        },
      ],
    });

    expect(getLanguageModelMock).toHaveBeenCalledWith("openai/gpt-5.5");
    expect(generateObjectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaName: "project_intelligence_summary",
        prompt: expect.stringContaining("Available source IDs: email-1, meeting-1"),
      }),
    );
    expect(generateObjectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("Owner requested revised lobby finish pricing"),
      }),
    );
    expect(generateObjectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: expect.stringContaining(
          "Lead with Brandon-specific priorities whenever the evidence shows something the owner must personally handle",
        ),
      }),
    );
    expect(summary).toMatchObject({
      schema: "project_intelligence_summary_v1",
      model: "openai/gpt-5.5",
      sourceCount: 2,
      sourceIds: ["email-1", "meeting-1"],
      headline: validOutput.headline,
      operatingSummary: expect.objectContaining({
        currentExecutiveRead: validOutput.operatingSummary.currentExecutiveRead,
      }),
    });
  });

  it("fails loudly before model calls when sources are missing", async () => {
    await expect(
      summarizeProjectIntelligence({ sources: [] }),
    ).rejects.toThrow("Project intelligence summary requires at least one source");
    expect(generateObjectMock).not.toHaveBeenCalled();
  });

  it("rejects model output that cites unknown source IDs", async () => {
    generateObjectMock.mockResolvedValueOnce({
      object: {
        ...validOutput,
        actionItems: [
          {
            ...validOutput.actionItems[0],
            sourceIds: ["not-provided"],
          },
        ],
      },
    } as Awaited<ReturnType<typeof generateObject>>);

    await expect(
      summarizeProjectIntelligence({
        sources: [
          {
            id: "email-1",
            type: "email",
            text: "Owner requested revised lobby finish pricing before approval.",
          },
          {
            id: "meeting-1",
            type: "meeting",
            text: "Brandon said he would send the revised pricing packet by 2026-05-13.",
          },
        ],
      }),
    ).rejects.toThrow("Project intelligence summary cited unknown source IDs: not-provided");
  });
});

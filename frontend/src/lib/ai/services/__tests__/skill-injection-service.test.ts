import {
  buildSkillInjectionContext,
  recordSelectedSkillUsage,
} from "../skill-injection-service";
import {
  listActiveVisibleSkills,
  recordSkillUsage,
  type AiSkill,
} from "../skill-library-service";

jest.mock("../skill-library-service", () => ({
  listActiveVisibleSkills: jest.fn(),
  recordSkillUsage: jest.fn(),
  SkillLibraryServiceError: class SkillLibraryServiceError extends Error {
    constructor(
      public readonly table: string,
      public readonly action: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

const listActiveVisibleSkillsMock =
  listActiveVisibleSkills as jest.MockedFunction<typeof listActiveVisibleSkills>;
const recordSkillUsageMock =
  recordSkillUsage as jest.MockedFunction<typeof recordSkillUsage>;

function skill(overrides: Partial<AiSkill> = {}): AiSkill {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    title: "Review stored materials before pay app approval",
    slug: "review-stored-materials-before-pay-app-approval",
    summary: "Compare stored materials against approved SOV balances.",
    body: "Always verify stored materials against approved SOV balances before pay app approval.",
    instructions:
      "Before approving a pay app with stored materials, compare the stored material line to the approved SOV and flag over-billing.",
    category: "pay_app_review",
    scopeType: "project",
    projectId: 1009,
    ownerUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    reviewerUserId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    status: "active",
    version: 2,
    supersedesSkillId: null,
    examples: [
      {
        input: "Pay app includes stored materials.",
        output: "Check approved SOV balance before approval.",
      },
    ],
    sourceEventIds: [],
    riskLevel: "medium",
    usageCount: 3,
    lastUsedAt: null,
    reviewedAt: "2026-06-18T20:00:00.000Z",
    reviewNotes: null,
    metadata: {},
    createdAt: "2026-06-18T20:00:00.000Z",
    updatedAt: "2026-06-18T20:00:00.000Z",
    ...overrides,
  };
}

describe("skill-injection-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("selects relevant visible skills and renders a priority-bounded prompt block", async () => {
    listActiveVisibleSkillsMock.mockResolvedValue([
      skill(),
      skill({
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        title: "Draft RFI with source evidence",
        slug: "draft-rfi-with-source-evidence",
        summary: "Use source evidence before drafting RFIs.",
        instructions: "Do not draft an RFI without source evidence.",
        category: "rfi",
        scopeType: "team",
        projectId: null,
        usageCount: 0,
      }),
    ]);

    const result = await buildSkillInjectionContext({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      messageText: "Can you review this pay app with stored materials?",
      selectedProjectId: 1009,
    });

    expect(listActiveVisibleSkillsMock).toHaveBeenCalledWith({
      viewerUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      viewerProjectIds: [1009],
      limit: 25,
    });
    expect(result.usage?.skills).toHaveLength(1);
    expect(result.usage?.skills[0]).toMatchObject({
      title: "Review stored materials before pay app approval",
      category: "pay_app_review",
      version: 2,
    });
    expect(result.block).toContain("## Approved Skill Library Context");
    expect(result.block).toContain(
      "system/developer instructions > current source evidence",
    );
    expect(result.block).toContain("Review stored materials before pay app approval");
    expect(result.block).not.toContain("Draft RFI with source evidence");
  });

  it("selects app-help skills when the calling surface is app expert", async () => {
    listActiveVisibleSkillsMock.mockResolvedValue([
      skill({
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        title: "Explain where app actions live",
        slug: "explain-where-app-actions-live",
        summary: "Help users understand where app actions and page controls live.",
        instructions: "When users ask about this app, explain the relevant page controls.",
        category: "app_help",
        scopeType: "company",
        projectId: null,
        usageCount: 0,
      }),
      skill({
        id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        category: "pay_app_review",
        scopeType: "company",
        projectId: null,
        usageCount: 0,
      }),
    ]);

    const result = await buildSkillInjectionContext({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      messageText: "What can I do here?",
      surface: "app_expert",
    });

    expect(result.usage?.selectionSurface).toBe("app_expert");
    expect(result.usage?.skills).toHaveLength(1);
    expect(result.usage?.skills[0]).toMatchObject({
      category: "app_help",
      reasons: ["surface:app_expert"],
    });
    expect(result.block).toContain("Explain where app actions live");
    expect(result.block).not.toContain("Review stored materials");
  });

  it("honors category bounds when injecting skills into a specialized surface", async () => {
    listActiveVisibleSkillsMock.mockResolvedValue([
      skill({
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        title: "Explain where app actions live",
        slug: "explain-where-app-actions-live",
        summary: "Help users understand where app actions and page controls live.",
        instructions: "When users ask about this app, explain the relevant page controls.",
        category: "app_help",
        scopeType: "company",
        projectId: null,
        usageCount: 0,
      }),
      skill({
        id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        title: "Review app pay approvals",
        slug: "review-app-pay-approvals",
        summary: "Review pay app approvals in the app before release.",
        instructions: "For pay app approvals, compare stored materials and retainage.",
        category: "pay_app_review",
        scopeType: "company",
        projectId: null,
        usageCount: 10,
      }),
    ]);

    const result = await buildSkillInjectionContext({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      messageText: "Where do I approve pay apps in the app?",
      surface: "app_expert",
      allowedCategories: ["app_help"],
    });

    expect(result.usage?.skills).toHaveLength(1);
    expect(result.usage?.skills[0]).toMatchObject({
      title: "Explain where app actions live",
      category: "app_help",
    });
    expect(result.block).toContain("Explain where app actions live");
    expect(result.block).not.toContain("Review app pay approvals");
  });

  it("limits Microsoft Executive Assistant skill injection to email and Teams categories", async () => {
    listActiveVisibleSkillsMock.mockResolvedValue([
      skill({
        id: "11111111-1111-4111-8111-111111111111",
        title: "Draft Outlook replies from source evidence",
        slug: "draft-outlook-replies-from-source-evidence",
        summary: "Use thread evidence before drafting Outlook replies.",
        instructions: "Draft Outlook replies only from the current email thread.",
        category: "email",
        scopeType: "company",
        projectId: null,
        usageCount: 0,
      }),
      skill({
        id: "22222222-2222-4222-8222-222222222222",
        title: "Escalate Teams threads with concise asks",
        slug: "escalate-teams-threads-with-concise-asks",
        summary: "Summarize Teams escalation asks clearly.",
        instructions: "For Teams escalations, name the ask, owner, and evidence.",
        category: "teams",
        scopeType: "company",
        projectId: null,
        usageCount: 0,
      }),
      skill({
        id: "33333333-3333-4333-8333-333333333333",
        title: "Explain app inbox navigation",
        slug: "explain-app-inbox-navigation",
        summary: "Explain where inbox pages live in the app.",
        instructions: "Explain the app page before giving workflow guidance.",
        category: "app_help",
        scopeType: "company",
        projectId: null,
        usageCount: 10,
      }),
    ]);

    const result = await buildSkillInjectionContext({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      messageText: "Review today's Outlook inbox and draft a Teams escalation.",
      surface: "microsoft_executive_assistant",
      allowedCategories: ["email", "teams"],
    });

    expect(result.usage?.skills.map((item) => item.category).sort()).toEqual([
      "email",
      "teams",
    ]);
    expect(result.block).toContain("Draft Outlook replies from source evidence");
    expect(result.block).toContain("Escalate Teams threads with concise asks");
    expect(result.block).not.toContain("Explain app inbox navigation");
  });

  it("limits backend project Deep Agents skill injection to project operating categories", async () => {
    listActiveVisibleSkillsMock.mockResolvedValue([
      skill({
        id: "44444444-4444-4444-8444-444444444444",
        title: "Chase project schedule risks",
        slug: "chase-project-schedule-risks",
        summary: "Rank project schedule risks by impact and source confidence.",
        instructions: "For schedule risk reviews, separate verified blockers from watch items.",
        category: "schedule",
        scopeType: "project",
        projectId: 1009,
        usageCount: 0,
      }),
      skill({
        id: "55555555-5555-4555-8555-555555555555",
        title: "Explain app schedule page",
        slug: "explain-app-schedule-page",
        summary: "Explain where schedule features live in the app.",
        instructions: "Explain route navigation before workflow guidance.",
        category: "app_help",
        scopeType: "company",
        projectId: null,
        usageCount: 10,
      }),
    ]);

    const result = await buildSkillInjectionContext({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      messageText: "What schedule risks should we chase on this project?",
      selectedProjectId: 1009,
      surface: "backend_deep_agent_project",
      allowedCategories: [
        "drawing",
        "estimate",
        "pay_app_review",
        "rfi",
        "schedule",
        "submittal",
        "task",
        "workflow",
      ],
    });

    expect(result.usage?.skills).toHaveLength(1);
    expect(result.usage?.skills[0]).toMatchObject({
      title: "Chase project schedule risks",
      category: "schedule",
    });
    expect(result.block).toContain("Chase project schedule risks");
    expect(result.block).not.toContain("Explain app schedule page");
  });

  it("does not inject irrelevant skills into unrelated prompts", async () => {
    listActiveVisibleSkillsMock.mockResolvedValue([
      skill({
        category: "pay_app_review",
        summary: "Pay app stored material review.",
      }),
    ]);

    const result = await buildSkillInjectionContext({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      messageText: "What meetings happened yesterday?",
    });

    expect(result.block).toBe("");
    expect(result.usage).toBeNull();
  });

  it("keeps high-risk skills bounded to drafting and review authority", async () => {
    listActiveVisibleSkillsMock.mockResolvedValue([
      skill({
        id: "66666666-6666-4666-8666-666666666666",
        title: "Draft RFI for design conflicts",
        slug: "draft-rfi-for-design-conflicts",
        summary: "Draft RFIs from drawing and source evidence for PM review.",
        instructions:
          "Draft the RFI and recommend review points, but do not create or send the RFI without explicit confirmation.",
        category: "rfi",
        scopeType: "company",
        projectId: null,
        riskLevel: "high",
        usageCount: 0,
      }),
    ]);

    const result = await buildSkillInjectionContext({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      messageText: "Use our RFI skill to draft an RFI for this design conflict.",
      selectedProjectId: 1009,
    });

    expect(result.usage?.skills[0]).toMatchObject({
      category: "rfi",
      riskLevel: "high",
    });
    expect(result.block).toContain("Draft RFI for design conflicts");
    expect(result.block).toContain("(v2, rfi, high risk)");
    expect(result.block).toContain(
      "High-risk skills may guide drafting or review, but they do not authorize irreversible writes without normal confirmation.",
    );
  });

  it("records one usage event for each selected skill", async () => {
    recordSkillUsageMock.mockResolvedValue({ id: "usage-1" } as never);

    await recordSelectedSkillUsage({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      projectId: 1009,
      sessionId: "session-1",
      surface: "ai_assistant_chat",
      usage: {
        totalSelected: 1,
        selectionReason: "category, project, and keyword relevance",
        selectionSurface: "ai_assistant_chat",
        skills: [
          {
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            title: "Review stored materials before pay app approval",
            slug: "review-stored-materials-before-pay-app-approval",
            category: "pay_app_review",
            scope: "project",
            projectId: 1009,
            version: 2,
            riskLevel: "medium",
            score: 120,
            reasons: ["category:pay_app_review", "selected-project"],
          },
        ],
      },
      metadata: { responseMessageId: "message-1" },
    });

    expect(recordSkillUsageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        skillId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        projectId: 1009,
        sessionId: "session-1",
        surface: "ai_assistant_chat",
        outcome: "used",
        metadata: expect.objectContaining({
          responseMessageId: "message-1",
          category: "pay_app_review",
          version: 2,
          score: 120,
        }),
      }),
    );
  });
});

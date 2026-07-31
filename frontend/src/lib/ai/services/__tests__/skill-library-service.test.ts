import { createServiceClient } from "@/lib/supabase/service";
import {
  createSkill,
  listActiveVisibleSkills,
  recordSkillUsage,
  reviewSkill,
  SkillLibraryServiceError,
  type AiSkillRow,
} from "../skill-library-service";

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

const createServiceClientMock = createServiceClient as jest.Mock;

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REVIEWER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SKILL_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const EVENT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function skillRow(overrides: Partial<AiSkillRow> = {}): AiSkillRow {
  return {
    id: SKILL_ID,
    created_at: "2026-06-18T20:00:00.000Z",
    updated_at: "2026-06-18T20:00:00.000Z",
    title: "Review stored materials before pay app approval",
    slug: "review-stored-materials-before-pay-app-approval",
    summary: "Compare stored materials against the approved SOV.",
    body: "Always compare stored materials against the latest approved subcontract SOV.",
    instructions:
      "Always compare stored materials against the latest approved subcontract SOV.",
    category: "pay_app_review",
    scope_type: "project",
    project_id: 1009,
    owner_user_id: USER_ID,
    reviewer_user_id: REVIEWER_ID,
    status: "candidate",
    version: 1,
    supersedes_skill_id: null,
    examples: [
      {
        input: "Pay app includes stored materials.",
        output: "Flag lines over approved SOV balance.",
      },
    ],
    source_event_ids: [EVENT_ID],
    risk_level: "medium",
    usage_count: 0,
    last_used_at: null,
    reviewed_at: null,
    review_notes: null,
    metadata: { source: "unit-test" },
    ...overrides,
  };
}

function createSingleWriteClient(params: {
  table: string;
  row?: unknown;
  error?: { message: string } | null;
}) {
  const single = jest.fn().mockResolvedValue({
    data: params.row ?? null,
    error: params.error ?? null,
  });
  const select = jest.fn(() => ({ single }));
  const insert = jest.fn(() => ({ select }));
  const update = jest.fn(() => ({
    eq: jest.fn(() => ({ select })),
  }));
  const from = jest.fn((table: string) => {
    if (table !== params.table) {
      throw new Error(`Unexpected table: ${table}`);
    }
    return { insert, update };
  });

  createServiceClientMock.mockReturnValue({ from });

  return { from, insert, update, select, single };
}

function createListClient(rows: AiSkillRow[]) {
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    then: jest.fn((resolve: (value: unknown) => unknown) =>
      Promise.resolve(resolve({ data: rows, error: null })),
    ),
  };
  const from = jest.fn((table: string) => {
    if (table !== "ai_skills") {
      throw new Error(`Unexpected table: ${table}`);
    }
    return query;
  });

  createServiceClientMock.mockReturnValue({ from });

  return query;
}

describe("skill-library-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps createSkill input to the ai_skills insert payload", async () => {
    const client = createSingleWriteClient({
      table: "ai_skills",
      row: skillRow(),
    });

    const result = await createSkill({
      title: "Review stored materials before pay app approval",
      summary: "Compare stored materials against the approved SOV.",
      body: "Always compare stored materials against the latest approved subcontract SOV.",
      category: "pay_app_review",
      scopeType: "project",
      projectId: 1009,
      ownerUserId: USER_ID,
      reviewerUserId: REVIEWER_ID,
      examples: [
        {
          input: "Pay app includes stored materials.",
          output: "Flag lines over approved SOV balance.",
        },
      ],
      sourceEventIds: [EVENT_ID],
      riskLevel: "medium",
      metadata: { source: "unit-test" },
    });

    expect(result.id).toBe(SKILL_ID);
    expect(client.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Review stored materials before pay app approval",
        slug: "review-stored-materials-before-pay-app-approval",
        summary: "Compare stored materials against the approved SOV.",
        body: expect.stringContaining("latest approved subcontract SOV"),
        instructions: expect.stringContaining("latest approved subcontract SOV"),
        category: "pay_app_review",
        scope_type: "project",
        project_id: 1009,
        owner_user_id: USER_ID,
        reviewer_user_id: REVIEWER_ID,
        status: "candidate",
        version: 1,
        source_event_ids: [EVENT_ID],
        risk_level: "medium",
        metadata: { source: "unit-test" },
      }),
    );
  });

  it("fails loudly before insert when a project skill has no project id", async () => {
    await expect(
      createSkill({
        title: "Missing project",
        summary: "Project scope must be explicit.",
        body: "Do not save project skills without a project id.",
        category: "guardrail",
        scopeType: "project",
        ownerUserId: USER_ID,
      }),
    ).rejects.toMatchObject({
      table: "ai_skills",
      action: "validate",
      message: expect.stringContaining("project skills require projectId"),
    });

    expect(createServiceClientMock).not.toHaveBeenCalled();
  });

  it("lists active visible skills with personal, project, team, and company filters", async () => {
    const query = createListClient([
      skillRow({
        status: "active",
        usage_count: 12,
      }),
    ]);

    const result = await listActiveVisibleSkills({
      viewerUserId: USER_ID,
      viewerProjectIds: [1009, 1009, 1010],
      category: "pay_app_review",
      scopeTypes: ["project", "team"],
      limit: 25,
    });

    expect(result).toHaveLength(1);
    expect(query.eq).toHaveBeenCalledWith("status", "active");
    expect(query.eq).toHaveBeenCalledWith("category", "pay_app_review");
    expect(query.in).toHaveBeenCalledWith("scope_type", ["project", "team"]);
    expect(query.or).toHaveBeenCalledWith(
      [
        "scope_type.in.(team,company)",
        `and(scope_type.eq.personal,owner_user_id.eq.${USER_ID})`,
        "and(scope_type.eq.project,project_id.in.(1009,1010))",
      ].join(","),
    );
    expect(query.limit).toHaveBeenCalledWith(25);
  });

  it("maps admin review to one ai_skills update payload", async () => {
    const reviewedAt = "2026-06-18T21:00:00.000Z";
    const client = createSingleWriteClient({
      table: "ai_skills",
      row: skillRow({
        status: "active",
        reviewed_at: reviewedAt,
        review_notes: "Approved after checking examples.",
      }),
    });

    const result = await reviewSkill({
      skillId: SKILL_ID,
      reviewerUserId: REVIEWER_ID,
      status: "active",
      reviewedAt,
      reviewNotes: "Approved after checking examples.",
    });

    expect(result.status).toBe("active");
    expect(client.update).toHaveBeenCalledWith({
      reviewer_user_id: REVIEWER_ID,
      status: "active",
      reviewed_at: reviewedAt,
      review_notes: "Approved after checking examples.",
    });
  });

  it("records usage through the usage event table", async () => {
    const client = createSingleWriteClient({
      table: "ai_skill_usage_events",
      row: {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        created_at: "2026-06-18T21:10:00.000Z",
        skill_id: SKILL_ID,
        user_id: USER_ID,
        project_id: 1009,
        session_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        surface: "ai_assistant",
        outcome: "helpful",
        metadata: { source: "unit-test" },
      },
    });

    await recordSkillUsage({
      skillId: SKILL_ID,
      userId: USER_ID,
      projectId: 1009,
      sessionId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      surface: "ai_assistant",
      outcome: "helpful",
      metadata: { source: "unit-test" },
    });

    expect(client.insert).toHaveBeenCalledWith({
      skill_id: SKILL_ID,
      user_id: USER_ID,
      project_id: 1009,
      session_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      surface: "ai_assistant",
      outcome: "helpful",
      metadata: { source: "unit-test" },
    });
  });

  it("includes table and action when Supabase insert fails", async () => {
    createSingleWriteClient({
      table: "ai_skills",
      error: { message: "permission denied for table ai_skills" },
    });

    await expect(
      createSkill({
        title: "Failure example",
        summary: "Insert should fail loudly.",
        body: "Do not swallow database insert failures.",
        category: "guardrail",
        scopeType: "team",
        ownerUserId: USER_ID,
      }),
    ).rejects.toBeInstanceOf(SkillLibraryServiceError);

    await expect(
      createSkill({
        title: "Failure example",
        summary: "Insert should fail loudly.",
        body: "Do not swallow database insert failures.",
        category: "guardrail",
        scopeType: "team",
        ownerUserId: USER_ID,
      }),
    ).rejects.toMatchObject({
      table: "ai_skills",
      action: "insert",
      message: expect.stringContaining("permission denied"),
    });
  });
});

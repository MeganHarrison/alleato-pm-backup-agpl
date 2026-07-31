jest.mock("server-only", () => ({}));
jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

import {
  createContentCalendarDraft,
  createWeeklyMarketingContentWorkflow,
  findMarketingSourceCandidates,
} from "../marketing-service";
import { createServiceClient } from "@/lib/supabase/service";

const createServiceClientMock = createServiceClient as jest.MockedFunction<typeof createServiceClient>;
type ServiceClientMock = Pick<ReturnType<typeof createServiceClient>, "from">;

function mockServiceClient(client: ServiceClientMock) {
  createServiceClientMock.mockReturnValue(client as ReturnType<typeof createServiceClient>);
}

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function createQueryBuilder(result: QueryResult) {
  const builder = {
    select: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    then: jest.fn((resolve: (value: QueryResult) => void) => resolve(result)),
  };

  return builder;
}

function createInsertSingleBuilder(result: QueryResult) {
  return {
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
  };
}

function createInsertManyBuilder(result: QueryResult) {
  const builder = {
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    then: jest.fn((resolve: (value: QueryResult) => void) => resolve(result)),
  };
  return builder;
}

describe("marketing-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("normalizes source candidates from document metadata with project citations", async () => {
    const builders: Record<string, ReturnType<typeof createQueryBuilder>[]> = {
      document_metadata: [
        createQueryBuilder({
          data: [
            {
              id: "doc-1",
              title: "Owner update - lobby turnover",
              summary: "Owner praised the team for a clean lobby turnover.",
              overview: null,
              notes: null,
              date: "2026-05-08",
              captured_at: null,
              project_id: 983,
              project: "Ulta Beauty Fresno",
              source_web_url: "https://example.com/doc",
              url: null,
              type: "owner_update",
              source_system: "graph",
            },
          ],
          error: null,
        }),
      ],
      documents: [createQueryBuilder({ data: [], error: null })],
      ai_insights: [createQueryBuilder({ data: [], error: null })],
      projects: [createQueryBuilder({ data: [], error: null })],
    };
    const supabase = {
      from: jest.fn((table: string) => {
        const builder = builders[table]?.shift();
        if (!builder) throw new Error(`Unexpected table: ${table}`);
        return builder;
      }),
    };
    mockServiceClient(supabase);

    const candidates = await findMarketingSourceCandidates({ topics: ["owner"], limit: 5 });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      sourceTable: "document_metadata",
      sourceId: "doc-1",
      sourceTitle: "Owner update - lobby turnover",
      projectId: 983,
      projectName: "Ulta Beauty Fresno",
      confidence: "high",
      citationText: "Owner update - lobby turnover (2026-05-08)",
    });
  });

  it("fails loudly before inserting an empty content calendar draft", async () => {
    await expect(
      createContentCalendarDraft({
        weekStartDate: "2026-05-18",
        items: [],
      }),
    ).rejects.toThrow("No content calendar items were provided");
    expect(createServiceClientMock).not.toHaveBeenCalled();
  });

  it("creates a sourced weekly content workflow with reviewable draft assets", async () => {
    const sourceQueryBuilders: Record<string, ReturnType<typeof createQueryBuilder>[]> = {
      document_metadata: [
        createQueryBuilder({
          data: [
            {
              id: "doc-1",
              title: "Owner update - system testing milestone",
              summary: "System 3 air testing is nearing completion and opens the next phase of riser work.",
              overview: null,
              notes: null,
              date: "2026-05-08",
              captured_at: null,
              project_id: 983,
              project: "Ulta Beauty Fresno",
              source_web_url: "https://example.com/doc",
              url: null,
              type: "owner_update",
              source_system: "graph",
            },
          ],
          error: null,
        }),
      ],
      documents: [createQueryBuilder({ data: [], error: null })],
      ai_insights: [createQueryBuilder({ data: [], error: null })],
      projects: [createQueryBuilder({ data: [], error: null })],
    };
    const intelligenceInsert = createInsertSingleBuilder({
      data: {
        id: "mi-1",
        title: "Owner update - system testing milestone",
        summary: "System 3 air testing is nearing completion.",
        source_table: "document_metadata",
        source_id: "doc-1",
        source_title: "Owner update - system testing milestone",
        source_url: "https://example.com/doc",
        source_date: "2026-05-08",
        project_id: 983,
        item_type: "owner_update",
        strategic_rationale: "Candidate surfaced for CMO weekly content planning.",
        recommended_use: ["content calendar", "draft asset"],
        confidence: "high",
        status: "new",
        metadata: {},
        company_id: null,
        created_by: "user-1",
        created_at: "2026-05-11T00:00:00.000Z",
        updated_at: "2026-05-11T00:00:00.000Z",
      },
      error: null,
    });
    const calendarInsert = createInsertManyBuilder({
      data: [
        {
          id: "calendar-1",
          planned_date: "2026-05-18",
          channel: "linkedin",
          funnel_stage: "awareness",
          title: "Project progress spotlight: Owner update - system testing milestone",
          angle: "Ulta Beauty Fresno: System 3 air testing is nearing completion.",
          target_audience: "Owners, developers, and prospective clients",
          project_id: 983,
          company_id: null,
          campaign_id: null,
          source_item_ids: ["mi-1"],
          rationale: "CMO Phase 1 selected this source.",
          status: "needs_review",
          owner_user_id: null,
          metadata: {},
          created_by: "user-1",
          created_at: "2026-05-11T00:00:00.000Z",
          updated_at: "2026-05-11T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const assetInsert = createInsertSingleBuilder({
      data: {
        id: "asset-1",
        calendar_item_id: "calendar-1",
        asset_type: "linkedin_post",
        title: "Draft asset: Project progress spotlight",
        body: "Draft body",
        source_citations: [],
        review_notes: null,
        status: "needs_review",
        created_by: "user-1",
        created_at: "2026-05-11T00:00:00.000Z",
        updated_at: "2026-05-11T00:00:00.000Z",
      },
      error: null,
    });
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "document_metadata") return sourceQueryBuilders.document_metadata.shift();
        if (table === "documents") return sourceQueryBuilders.documents.shift();
        if (table === "ai_insights") return sourceQueryBuilders.ai_insights.shift();
        if (table === "projects") return sourceQueryBuilders.projects.shift();
        if (table === "marketing_intelligence_items") return intelligenceInsert;
        if (table === "marketing_content_calendar_items") return calendarInsert;
        if (table === "marketing_content_assets") return assetInsert;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    mockServiceClient(supabase);

    const result = await createWeeklyMarketingContentWorkflow({
      createdBy: "user-1",
      now: new Date("2026-05-11T12:00:00.000Z"),
    });

    expect(result.weekStartDate).toBe("2026-05-18");
    expect(result.intelligenceItems).toHaveLength(1);
    expect(result.calendarItems).toHaveLength(1);
    expect(result.assets).toHaveLength(1);
    expect(result.reviewHref).toBe("/ai-assistant/marketing");
    expect(calendarInsert.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          planned_date: "2026-05-18",
          source_item_ids: ["mi-1"],
          status: "needs_review",
        }),
      ]),
    );
  });
});

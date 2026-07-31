process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest, NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { POST } from "../route";
import { verifyProjectAccess } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/service";

jest.mock("ai", () => ({
  generateText: jest.fn(),
  Output: {
    object: jest.fn((config) => config),
  },
}));

jest.mock("@/lib/ai/providers", () => ({
  getLanguageModel: jest.fn((modelId: string) => ({ modelId })),
}));

jest.mock("@/lib/supabase/auth-guard", () => ({
  verifyProjectAccess: jest.fn(),
  isAuthError: (value: unknown) => value instanceof Response,
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

const generateTextMock = generateText as jest.MockedFunction<typeof generateText>;
const outputObjectMock = Output.object as jest.MockedFunction<typeof Output.object>;
const verifyProjectAccessMock = verifyProjectAccess as jest.MockedFunction<
  typeof verifyProjectAccess
>;
const createServiceClientMock =
  createServiceClient as jest.MockedFunction<typeof createServiceClient>;

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

interface QueryBuilderMock {
  select: jest.Mock;
  eq: jest.Mock;
  is: jest.Mock;
  in: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  maybeSingle: jest.Mock;
}

function createQueryBuilder(result: QueryResult): QueryBuilderMock {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
}

function request(projectId: string, body?: unknown) {
  return new NextRequest(
    `http://localhost/api/projects/${projectId}/meetings/prep-suggestions`,
    body === undefined
      ? { method: "POST" }
      : {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        },
  );
}

function params(projectId: string) {
  return { params: Promise.resolve({ projectId }) };
}

function setupMeetingPrepSupabase() {
  const builders = {
    projects: createQueryBuilder({
      data: {
        id: 42,
        name: "Goodwill Noblesville",
        summary: "Retail construction project",
        stage: "construction",
        phase: "active",
        health_status: "watch",
      },
      error: null,
    }),
    tasks: createQueryBuilder({
      data: [
        {
          id: "task-1",
          title: "Resolve storefront lead time",
          description: null,
          status: "open",
          due_date: "2026-07-09",
          priority: "high",
          assignee_name: "Architect",
        },
      ],
      error: null,
    }),
    rfis: createQueryBuilder({ data: [], error: null }),
    submittals: createQueryBuilder({ data: [], error: null }),
    change_events: createQueryBuilder({ data: [], error: null }),
    schedule_tasks: createQueryBuilder({ data: [], error: null }),
    document_metadata: createQueryBuilder({ data: [], error: null }),
    meeting_segments: createQueryBuilder({ data: [], error: null }),
    meeting_preps: createQueryBuilder({ data: null, error: null }),
    project_intelligence_timeline_events: createQueryBuilder({
      data: [],
      error: null,
    }),
  };
  const supabase = {
    from: jest.fn((table: keyof typeof builders) => {
      const builder = builders[table];
      if (!builder) throw new Error(`Unexpected table: ${table}`);
      return builder;
    }),
  };

  createServiceClientMock.mockReturnValue(
    supabase as ReturnType<typeof createServiceClient>,
  );

  return { builders, supabase };
}

describe("/api/projects/[projectId]/meetings/prep-suggestions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifyProjectAccessMock.mockResolvedValue({
      membership: {
        membershipId: "membership-1",
        personId: "person-planner",
        authUserId: "planner-user",
        projectId: 42,
        permissionTemplateId: null,
        userType: null,
      },
      serviceClient: {} as never,
      userProfile: null,
    } as Awaited<ReturnType<typeof verifyProjectAccess>>);
    setupMeetingPrepSupabase();
  });

  it("returns 403 and reads no project data when the user is not a project member", async () => {
    // Regression guard: this route reads with the service-role client (RLS
    // bypassed). Removing the verifyProjectAccess call must fail this test.
    verifyProjectAccessMock.mockResolvedValue(
      NextResponse.json(
        { error: "You do not have access to this project" },
        { status: 403 },
      ),
    );

    const response = await POST(request("42"), params("42"));

    expect(response.status).toBe(403);
    expect(verifyProjectAccessMock).toHaveBeenCalledWith(42);
    expect(createServiceClientMock).not.toHaveBeenCalled();
    expect(generateTextMock).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body).toEqual({ error: "You do not have access to this project" });
  });

  it("returns 401 when the request is unauthenticated", async () => {
    verifyProjectAccessMock.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const response = await POST(request("42"), params("42"));

    expect(response.status).toBe(401);
    expect(createServiceClientMock).not.toHaveBeenCalled();
  });

  it("returns source-backed suggestions by default without calling the model", async () => {
    const response = await POST(request("42"), params("42"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.generatedBy).toBe("source");
    expect(body.model).toBeNull();
    expect(body.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "task-task-1",
          kind: "task",
          title: "Resolve storefront lead time",
          href: "/42/tasks",
          sourceLabel: "Project task",
        }),
      ]),
    );
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("calls the model only when AI mode is explicitly requested", async () => {
    generateTextMock.mockResolvedValue({
      output: {
        suggestions: [
          {
            sourceIds: ["task-task-1"],
            kind: "task",
            title: "Confirm storefront lead time",
            description: "Resolve the lead-time path before the next lookahead.",
            priority: "high",
          },
        ],
        meetingRecaps: [],
      },
    } as Awaited<ReturnType<typeof generateText>>);

    const response = await POST(request("42", { mode: "ai" }), params("42"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.generatedBy).toBe("ai");
    expect(body.model).toBe("openai/gpt-5.4-mini");
    expect(body.suggestions).toEqual([
      expect.objectContaining({
        id: "ai-task-task-1",
        title: "Confirm storefront lead time",
        href: "/42/tasks",
        sourceLabel: "Project task",
      }),
    ]);
    expect(outputObjectMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "meetingPrepSuggestions" }),
    );
    expect(generateTextMock).toHaveBeenCalledTimes(1);
  });

  it("passes transcript segments and project intelligence as normalized AI source packets", async () => {
    const { builders } = setupMeetingPrepSupabase();
    builders.document_metadata.limit.mockResolvedValue({
      data: [
        {
          id: "meeting-doc-1",
          title: "OAC Meeting 11",
          date: "2026-07-01",
          summary: "Pricing and storefront lead time were reviewed.",
          overview: null,
          action_items: JSON.stringify(["Confirm lighting VE pricing"]),
          bullet_points: null,
          decisions: JSON.stringify(["Use allowance balance before contingency"]),
          participants: "Brandon, Megan, Architect",
          created_at: "2026-07-01T15:00:00.000Z",
        },
      ],
      error: null,
    });
    builders.meeting_segments.limit.mockResolvedValue({
      data: [
        {
          id: "segment-1",
          metadata_id: "meeting-doc-1",
          title: "Lighting package pricing",
          summary: "Brandon was waiting on updated lighting package pricing.",
          decisions: [],
          risks: JSON.stringify(["VE option may affect procurement timing"]),
          tasks: JSON.stringify(["Confirm VE lighting package pricing"]),
          project_ids: [42],
          project_impact: ["Budget", "Procurement"],
          segment_index: 0,
        },
      ],
      error: null,
    });
    builders.project_intelligence_timeline_events.limit.mockResolvedValue({
      data: [
        {
          id: "intel-1",
          title: "Storefront lead time risk",
          summary: "Storefront submittal returned with comments.",
          why_it_matters: "Lead time may affect the next lookahead schedule.",
          event_type: "schedule_risk",
          priority: "high",
          current_status: "open",
          confidence: 0.91,
          event_at: "2026-07-02T12:00:00.000Z",
          source_document_id: "meeting-doc-1",
          related_record_id: null,
          related_record_type: null,
        },
      ],
      error: null,
    });
    generateTextMock.mockResolvedValue({
      output: {
        suggestions: [
          {
            sourceIds: ["meeting-segment-segment-1"],
            kind: "context",
            title: "Confirm lighting VE pricing",
            description: "Use the prior transcript topic to confirm pricing before procurement decisions.",
            priority: "high",
          },
          {
            sourceIds: ["intelligence-event-intel-1"],
            kind: "schedule",
            title: "Resolve storefront lead time risk",
            description: "Close the lead-time risk before the next lookahead schedule is issued.",
            priority: "high",
          },
        ],
        meetingRecaps: [
          {
            sourceMeetingId: "meeting-doc-1",
            title: "OAC Meeting 11",
            summary: "Pricing, allowance use, and storefront lead time were the main carry-forward topics.",
            openThreads: ["Confirm lighting VE pricing"],
            decisions: ["Use allowance balance before contingency"],
          },
        ],
      },
    } as Awaited<ReturnType<typeof generateText>>);

    const response = await POST(request("42", { mode: "ai" }), params("42"));
    const body = await response.json();
    const generationInput = generateTextMock.mock.calls[0]?.[0];

    expect(response.status).toBe(200);
    expect(body.generatedBy).toBe("ai");
    expect(body.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ai-meeting-segment-segment-1",
          href: "/42/intelligence/sources/meeting-doc-1#meeting-segment-segment-1",
          sourceLabel: "Transcript topic 1",
        }),
        expect.objectContaining({
          id: "ai-intelligence-event-intel-1",
          href: "/42/intelligence/sources/meeting-doc-1",
          sourceLabel: "Project intelligence",
        }),
      ]),
    );
    expect(body.meetingRecaps).toEqual([
      expect.objectContaining({
        id: "meeting-doc-1",
        summary:
          "Pricing, allowance use, and storefront lead time were the main carry-forward topics.",
      }),
    ]);
    expect(generationInput?.prompt).toContain("Normalized meeting prep source packets");
    expect(generationInput?.prompt).toContain('"sourceType": "transcript_segment"');
    expect(generationInput?.prompt).toContain('"sourceType": "project_intelligence"');
    expect(generationInput?.prompt).toContain('"id": "meeting-segment-segment-1"');
    expect(generationInput?.prompt).toContain('"id": "intelligence-event-intel-1"');
  });

  it("falls back to source-backed suggestions when explicit AI generation fails", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    generateTextMock.mockRejectedValue(new Error("AI Gateway timeout"));

    const response = await POST(request("42", { mode: "ai" }), params("42"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.generatedBy).toBe("source");
    expect(body.model).toBe("openai/gpt-5.4-mini");
    expect(body.fallbackReason).toBe(
      "AI prep is unavailable. Showing source-backed project suggestions.",
    );
    expect(body.suggestions[0]).toEqual(
      expect.objectContaining({
        id: "task-task-1",
        title: "Resolve storefront lead time",
      }),
    );
    expect(generateTextMock).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });
});

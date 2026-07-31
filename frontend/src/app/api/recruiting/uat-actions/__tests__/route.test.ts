import { NextRequest } from "next/server";

import { POST } from "@/app/api/recruiting/uat-actions/route";
import { requireRecruitingAccess } from "@/lib/recruiting/server";
import { createServiceClient } from "@/lib/supabase/service";

jest.mock("@/lib/recruiting/server", () => ({
  requireRecruitingAccess: jest.fn(),
}));
jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));
jest.mock("@/lib/guardrails/observability", () => ({
  getOrCreateRequestId: jest.fn(() => "request-id"),
  logEvent: jest.fn(),
  notifyOnError: jest.fn(),
}));

const requireAccessMock = requireRecruitingAccess as jest.MockedFunction<
  typeof requireRecruitingAccess
>;
const createServiceClientMock = createServiceClient as jest.MockedFunction<
  typeof createServiceClient
>;

function query(result: { data: unknown; error: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  for (const method of ["select", "eq", "gt", "order", "limit"]) {
    builder[method] = jest.fn(() => builder);
  }
  builder.maybeSingle = jest.fn().mockResolvedValue(result);
  builder.insert = jest.fn().mockResolvedValue(result);
  return builder;
}

function request(action = "sms_preview") {
  return new NextRequest(
    "https://projects.alleatogroup.com/api/recruiting/uat-actions",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        idempotencyKey: "6a375555-9b53-4274-a71a-5d6bc7da5104",
        applicationId: "c6d6db18-19c8-42d2-a789-cac6a8ae9004",
      }),
    },
  );
}

describe("recruiting UAT feature actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAccessMock.mockResolvedValue({
      db: {
        from: jest.fn(() => query({ data: { value: true }, error: null })),
      } as never,
      userEmail: "jgaona@alleatogroup.com",
      viewer: {
        userId: "3019bd67-4068-4b74-acb6-d3166bb070df",
        personId: "ee9a8fb5-3cf6-48db-86a2-b09c07152fef",
        role: "recruiter",
        canRead: true,
        canWrite: true,
        canAdmin: false,
      },
    });
  });

  it("fails loudly when the recruiter has no active synthetic intake", async () => {
    const featureRuns = query({ data: null, error: null });
    const submissions = query({ data: null, error: null });
    createServiceClientMock.mockReturnValue({
      from: jest.fn((table: string) =>
        table === "recruiting_uat_feature_runs"
          ? featureRuns
          : submissions,
      ),
    } as never);

    const response = await POST(request(), { params: Promise.resolve({}) });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error_message).toMatch(/synthetic UAT application/i);
  });

  it("records a no-send result tied to the active UAT submission", async () => {
    const inserted = query({ data: null, error: null });
    const tables = {
      recruiting_uat_feature_runs: query({ data: null, error: null }),
      recruiting_uat_submissions: query({
        data: {
          id: "1f286e09-08a3-4e60-8dd2-98e76f3a1389",
          candidate_id: "c6d6db18-19c8-42d2-a789-cac6a8ae9001",
          document_id: "c6d6db18-19c8-42d2-a789-cac6a8ae9002",
          assigned_requisition_id: "c6d6db18-19c8-42d2-a789-cac6a8ae9003",
          expires_at: "2026-08-01T18:30:00.000Z",
        },
        error: null,
      }),
      recruiting_candidates: query({
        data: { display_name: "[UAT] Resume 01" },
        error: null,
      }),
      recruiting_documents: query({
        data: { original_file_name: "synthetic-resume-01.pdf" },
        error: null,
      }),
      recruiting_requisitions: query({
        data: { title: "Project Manager" },
        error: null,
      }),
    };
    tables.recruiting_uat_feature_runs.insert = inserted.insert;
    createServiceClientMock.mockReturnValue({
      from: jest.fn(
        (table: keyof typeof tables) => tables[table],
      ),
    } as never);

    const response = await POST(request(), { params: Promise.resolve({}) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.result.safety).toEqual({
      delivery: "not_sent",
      employmentDecision: "human_required",
      syntheticDataOnly: true,
    });
    expect(inserted.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        submission_id: "1f286e09-08a3-4e60-8dd2-98e76f3a1389",
        action: "sms_preview",
        initiated_by_person_id: "ee9a8fb5-3cf6-48db-86a2-b09c07152fef",
      }),
    );
  });
});

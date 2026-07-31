import { NextRequest } from "next/server";

import { researchLead } from "@/lib/crm/lead-research";
import { requireCrmAccess } from "@/lib/crm/server";
import { createClient } from "@/lib/supabase/server";

import { POST } from "@/lib/crm/api-handlers/lead-research";

jest.mock("@/lib/crm/lead-research", () => ({ researchLead: jest.fn() }));
jest.mock("@/lib/crm/server", () => ({
  requireCrmAccess: jest.fn(),
  assertCrmOwnerOrAdmin: jest.fn(),
}));
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));

const researchLeadMock = jest.mocked(researchLead);
const requireCrmAccessMock = jest.mocked(requireCrmAccess);
const createClientMock = jest.mocked(createClient);
const leadId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("POST /api/crm/leads/[leadId]/research", () => {
  const insertMock = jest.fn();
  const rpcMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    rpcMock.mockResolvedValue({ data: new Date().toISOString(), error: null });
    createClientMock.mockResolvedValue({ rpc: rpcMock } as never);
    researchLeadMock.mockResolvedValue({
      summary: "Public business summary.",
      suggestions: {
        job_title: "President",
        website_url: "https://example.com",
      },
      citations: [{ title: "Company", url: "https://example.com" }],
    });
    insertMock.mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            artifact_type: "lead_research",
            lead_id: leadId,
            title: "Public-web research",
            content: "Public business summary.",
            citations: [{ title: "Company", url: "https://example.com" }],
            suggestions: { job_title: "President" },
            explanation: "Review first.",
            review_status: "draft",
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    });
    requireCrmAccessMock.mockResolvedValue({
      db: {
        from: jest.fn((table: string) =>
          table === "crm_leads"
            ? {
                select: () => ({
                  eq: () => ({
                    is: () => ({
                      maybeSingle: async () => ({
                        data: {
                          id: leadId,
                          full_name: "Taylor Prospect",
                          prospect_company_name: "Example Company",
                          job_title: null,
                          website_url: null,
                          owner_person_id:
                            "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                        },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }
            : { insert: insertMock },
        ),
      },
      personId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      isAdmin: false,
      user: { id: "auth-user" },
    } as never);
  });

  it("reserves provider capacity and stores a cited draft", async () => {
    const response = await POST(
      new NextRequest(`http://localhost/api/crm/leads/${leadId}/research`, {
        method: "POST",
      }),
      { params: Promise.resolve({ leadId }) },
    );
    expect(response.status).toBe(201);
    expect(rpcMock).toHaveBeenCalledWith("crm_reserve_lead_research", {
      p_lead_id: leadId,
    });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact_type: "lead_research",
        review_status: "draft",
      }),
    );
  });

  it("returns 429 without calling the provider during the cooldown", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message: "Wait five minutes before researching this lead again.",
      },
    });
    const response = await POST(
      new NextRequest(`http://localhost/api/crm/leads/${leadId}/research`, {
        method: "POST",
      }),
      { params: Promise.resolve({ leadId }) },
    );
    expect(response.status).toBe(429);
    expect(researchLeadMock).not.toHaveBeenCalled();
  });
});

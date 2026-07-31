import { NextRequest } from "next/server";

import { requireCrmAccess } from "@/lib/crm/server";

import { POST } from "../route";

jest.mock("@/lib/crm/server", () => ({
  requireCrmAccess: jest.fn(),
}));

const requireCrmAccessMock = jest.mocked(requireCrmAccess);
const insertMock = jest.fn();

function request(body: unknown) {
  return new NextRequest("http://localhost/api/crm/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function callPost(body: unknown) {
  return POST(request(body), { params: Promise.resolve({}) });
}

describe("POST /api/crm/leads", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
  });

  beforeEach(() => {
    jest.clearAllMocks();
    insertMock.mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            full_name: "Taylor Prospect",
            prospect_company_name: "New Prospect Company",
          },
          error: null,
        }),
      }),
    });
    requireCrmAccessMock.mockResolvedValue({
      db: {
        from: jest.fn((table: string) => {
          expect(table).toBe("crm_leads");
          return { insert: insertMock };
        }),
      },
      personId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      isAdmin: false,
      user: { id: "auth-user" },
    } as never);
  });

  it("creates a CRM-owned lead without a company identifier", async () => {
    const response = await callPost({
      full_name: "Taylor Prospect",
      prospect_company_name: "New Prospect Company",
      email: "taylor@example.com",
      phone: "",
      source: "manual",
    });

    expect(response.status).toBe(201);
    expect(insertMock).toHaveBeenCalledWith({
      full_name: "Taylor Prospect",
      prospect_company_name: "New Prospect Company",
      email: "taylor@example.com",
      phone: null,
      source: "manual",
      notes: null,
      job_title: null,
      website_url: null,
      linkedin_url: null,
      facebook_url: null,
      x_url: null,
      owner_person_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(insertMock.mock.calls[0][0]).not.toHaveProperty("company_id");
  });

  it("rejects a missing organization before writing", async () => {
    const response = await callPost({
      full_name: "Taylor Prospect",
      prospect_company_name: "",
      email: "taylor@example.com",
    });

    expect(response.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects a phone number that the database cannot store", async () => {
    const response = await callPost({
      full_name: "Taylor Prospect",
      prospect_company_name: "New Prospect Company",
      phone: "1",
    });

    expect(response.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });
});

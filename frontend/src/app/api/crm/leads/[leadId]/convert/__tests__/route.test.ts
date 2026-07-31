import { NextRequest } from "next/server";

import { requireCrmAccess } from "@/lib/crm/server";
import { createClient } from "@/lib/supabase/server";

import { POST } from "../route";

jest.mock("@/lib/crm/server", () => ({
  requireCrmAccess: jest.fn(),
}));
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

const requireCrmAccessMock = jest.mocked(requireCrmAccess);
const createClientMock = jest.mocked(createClient);
const rpcMock = jest.fn();
const leadId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const companyId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function request(body: unknown) {
  return new NextRequest(`http://localhost/api/crm/leads/${leadId}/convert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function callPost(body: unknown) {
  return POST(request(body), { params: Promise.resolve({ leadId }) });
}

describe("POST /api/crm/leads/[leadId]/convert", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
  });

  beforeEach(() => {
    jest.clearAllMocks();
    rpcMock.mockResolvedValue({
      data: { id: leadId, converted_company_id: companyId },
      error: null,
    });
    requireCrmAccessMock.mockResolvedValue({
      db: {},
      personId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      isAdmin: false,
      user: { id: "auth-user" },
    } as never);
    createClientMock.mockResolvedValue({ rpc: rpcMock } as never);
  });

  it("uses the guarded conversion RPC with optimistic concurrency", async () => {
    const response = await callPost({
      company_id: companyId,
      row_version: 4,
    });

    expect(response.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith("crm_convert_lead_to_company", {
      p_company_id: companyId,
      p_expected_row_version: 4,
      p_lead_id: leadId,
    });
  });

  it("rejects an invalid company before invoking the RPC", async () => {
    const response = await callPost({
      company_id: "not-a-company",
      row_version: 4,
    });

    expect(response.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

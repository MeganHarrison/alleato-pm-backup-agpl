import { NextRequest } from "next/server";

import {
  requireActiveInternalOwner,
  requireCrmAccess,
} from "@/lib/crm/server";

import { POST } from "../route";

jest.mock("@/lib/crm/server", () => {
  const { GuardrailError } = jest.requireActual("@/lib/guardrails/errors");
  return {
    assertCrmOwnerOrAdmin: jest.fn(
      (input: {
        ownerPersonId: string;
        personId: string;
        isAdmin: boolean;
        action: string;
      }) => {
        if (!input.isAdmin && input.ownerPersonId !== input.personId) {
          throw new GuardrailError({
            code: "FORBIDDEN",
            where: input.action,
            message:
              "Only the record owner or a CRM administrator can make this change.",
            status: 403,
          });
        }
      },
    ),
    requireActiveInternalOwner: jest.fn(),
    requireCrmAccess: jest.fn(),
  };
});

const requireCrmAccessMock = jest.mocked(requireCrmAccess);
const requireActiveInternalOwnerMock = jest.mocked(
  requireActiveInternalOwner,
);

const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherOwnerId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const leadId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const pipelineId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const stageId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function request() {
  return new NextRequest("http://localhost/api/crm/deals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "New pursuit",
      company_id: null,
      lead_id: leadId,
      pipeline_id: pipelineId,
      stage_id: stageId,
      owner_person_id: otherOwnerId,
      value_estimate: 100000,
      probability: 10,
      source: "manual",
    }),
  });
}

function queryResult(data: unknown) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    is: jest.fn(() => query),
    maybeSingle: jest.fn(async () => ({ data, error: null })),
  };
  return query;
}

describe("POST /api/crm/deals", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
  });

  beforeEach(() => {
    jest.clearAllMocks();
    requireActiveInternalOwnerMock.mockResolvedValue(undefined);
    requireCrmAccessMock.mockResolvedValue({
      db: {
        from: jest.fn((table: string) => {
          if (table === "crm_stages") {
            return queryResult({
              pipeline_id: pipelineId,
              stage_type: "open",
            });
          }
          if (table === "crm_leads") {
            return queryResult({ owner_person_id: otherOwnerId });
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      },
      personId: ownerId,
      isAdmin: false,
      user: { id: "auth-user" },
    } as never);
  });

  it("rejects a writer creating a deal for another owner's lead", async () => {
    const response = await POST(request(), { params: Promise.resolve({}) });

    expect(response.status).toBe(403);
  });
});

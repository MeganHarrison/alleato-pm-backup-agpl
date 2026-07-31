process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";

import { NextRequest } from "next/server";

import { requirePermission } from "@/lib/permissions-guard";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { POST } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/permissions-guard", () => ({
  requirePermission: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock =
  getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;
const requirePermissionMock =
  requirePermission as jest.MockedFunction<typeof requirePermission>;

const USER_ID = "22222222-2222-4222-8222-222222222222";
const CONTRACT_ID = "11111111-1111-4111-8111-111111111111";

function contractRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CONTRACT_ID,
    project_id: 42,
    contract_number: "PC-0042",
    title: "Owner contract",
    vendor_id: null,
    description: null,
    status: "draft",
    original_contract_value: 25_000,
    revised_contract_value: 25_000,
    start_date: null,
    end_date: null,
    retention_percentage: 10,
    payment_terms: null,
    billing_schedule: null,
    created_by: USER_ID,
    created_at: "2026-07-18T00:00:00.000Z",
    updated_at: "2026-07-18T00:00:00.000Z",
    executed_at: null,
    contractor_id: null,
    architect_engineer_id: null,
    contract_company_id: null,
    substantial_completion_date: null,
    actual_completion_date: null,
    signed_contract_received_date: null,
    contract_termination_date: null,
    is_private: true,
    inclusions: null,
    exclusions: null,
    executed: false,
    client_id: null,
    erp_status: "unsynced",
    allowed_user_ids: [USER_ID],
    allow_sov_view: false,
    estimate_id: null,
    estimate_version: null,
    last_synced_from_estimate_at: null,
    ...overrides,
  };
}

function createDatabaseMock({
  lineItemError = null,
}: {
  lineItemError?: {
    message: string;
    code: string;
    details: string | null;
    hint: string | null;
  } | null;
} = {}) {
  const contractInsert = jest.fn();
  const lineItemInsert = jest.fn();

  const from = jest.fn((table: string) => {
    if (table === "prime_contracts") {
      const query = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
        insert: contractInsert.mockImplementation((payload) => {
          query.insertedPayload = payload;
          return query;
        }),
        insertedPayload: null as Record<string, unknown> | null,
        single: jest.fn().mockImplementation(async () => ({
          data: contractRow(query.insertedPayload ?? {}),
          error: null,
        })),
      };
      return query;
    }

    if (table === "contract_line_items") {
      const query = {
        insert: lineItemInsert.mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue(
          lineItemError
            ? { data: null, error: lineItemError }
            : {
                data: {
                  id: "33333333-3333-4333-8333-333333333333",
                  contract_id: CONTRACT_ID,
                  line_number: 1,
                  description: "General conditions",
                  quantity: 1,
                  unit_cost: 25_000,
                  total_cost: 25_000,
                },
                error: null,
              },
        ),
      };
      return query;
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    client: { from },
    contractInsert,
    lineItemInsert,
  };
}

function requestBody() {
  return {
    contract_number: "PC-0042",
    title: "Owner contract",
    status: "draft",
    original_contract_value: 25_000,
    revised_contract_value: 25_000,
    retention_percentage: 10,
    is_private: true,
    line_items: [
      {
        line_number: 1,
        description: "General conditions",
        quantity: 1,
        unit_cost: 25_000,
      },
    ],
  };
}

describe("/api/projects/[projectId]/contracts POST", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requirePermissionMock.mockResolvedValue({
      denied: false,
    } as Awaited<ReturnType<typeof requirePermission>>);
    getApiRouteUserMock.mockResolvedValue({
      id: USER_ID,
      email: "qa@example.com",
    } as Awaited<ReturnType<typeof getApiRouteUser>>);
  });

  it("keeps the creator authorized when a private contract is created", async () => {
    const database = createDatabaseMock();
    createClientMock.mockResolvedValue(database.client as never);

    const response = await POST(
      new NextRequest("http://localhost/api/projects/42/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody()),
      }),
      { params: Promise.resolve({ projectId: "42" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(database.contractInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        is_private: true,
        allowed_user_ids: [USER_ID],
        created_by: USER_ID,
      }),
    );
    expect(body.creation_receipt).toMatchObject({
      status: "complete",
      lineItems: { attempted: 1, created: 1, failed: [] },
    });
  });

  it("returns a safe partial receipt instead of raw Postgres details", async () => {
    const database = createDatabaseMock({
      lineItemError: {
        message:
          'insert or update on table "contract_line_items" violates foreign key constraint',
        code: "23503",
        details: "Key is not present in table project_budget_codes.",
        hint: null,
      },
    });
    createClientMock.mockResolvedValue(database.client as never);

    const response = await POST(
      new NextRequest("http://localhost/api/projects/42/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody()),
      }),
      { params: Promise.resolve({ projectId: "42" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.creation_receipt).toMatchObject({
      status: "partial",
      lineItems: {
        attempted: 1,
        created: 0,
        failed: [
          {
            lineNumber: 1,
            code: "INVALID_BUDGET_CODE",
            message:
              "Invalid budget code: the selected code does not exist for this project.",
          },
        ],
      },
    });
    expect(JSON.stringify(body)).not.toContain("foreign key");
    expect(JSON.stringify(body)).not.toContain("project_budget_codes");
  });
});

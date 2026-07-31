import { NextRequest } from "next/server";

import { PUT } from "../route";
import { verifyProjectAccess } from "@/lib/supabase/auth-guard";
import { requirePermission } from "@/lib/permissions-guard";
import { createServiceClient } from "@/lib/supabase/service";

jest.mock("@/lib/supabase/auth-guard", () => ({
  verifyProjectAccess: jest.fn(),
  isAuthError: jest.fn((value) => value instanceof Response),
}));

jest.mock("@/lib/permissions-guard", () => ({
  requirePermission: jest.fn(),
}));

const verifyProjectAccessMock = verifyProjectAccess as jest.MockedFunction<
  typeof verifyProjectAccess
>;
const requirePermissionMock = requirePermission as jest.MockedFunction<
  typeof requirePermission
>;

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest(
    "http://localhost/api/projects/42/commitments/00000000-0000-0000-0000-000000000010/line-items",
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

type QueryResult = { data: unknown; error: null | { message: string } };

function createBuilder(result: QueryResult) {
  const builder: Record<string, jest.Mock> & PromiseLike<QueryResult> = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function setAccessResult(supabase: ReturnType<typeof createServiceClient>) {
  verifyProjectAccessMock.mockResolvedValue({
    membership: {
      membershipId: "membership-1",
      personId: "person-1",
      authUserId: "user-1",
      projectId: 42,
      permissionTemplateId: null,
      userType: "admin",
    },
    serviceClient: supabase,
    userProfile: null,
  });
}

describe("commitment line item saves", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
    requirePermissionMock.mockResolvedValue({
      denied: false,
    } as Awaited<ReturnType<typeof requirePermission>>);
  });

  it("writes the canonical project budget code FK when supplied by the client", async () => {
    const insertedRows: unknown[] = [];
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "commitments_unified") {
          return createBuilder({
            data: { id: "commitment-1", commitment_type: "subcontract" },
            error: null,
          });
        }
        if (table === "subcontractor_invoices") {
          return createBuilder({ data: [], error: null });
        }
        if (table === "subcontract_sov_items") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            delete: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({ data: null, error: null }),
            insert: jest.fn((payload: unknown) => {
              insertedRows.push(payload);
              return createBuilder({
                data: { id: "sov-1", ...(payload as object) },
                error: null,
              });
            }),
            then: (resolve: (result: QueryResult) => void) =>
              Promise.resolve({ data: [], error: null }).then(resolve),
          };
        }
        if (table === "project_budget_codes") {
          return createBuilder({
            data: [
              {
                id: "project-budget-code-1",
                cost_code_id: "04-2200",
                cost_type_id: "cost-type-1",
                cost_code_types: { code: "S", description: "Subcontract" },
              },
            ],
            error: null,
          });
        }
        throw new Error(`Unexpected supabase.from("${table}")`);
      }),
    };
    setAccessResult(supabase as ReturnType<typeof createServiceClient>);

    const response = await PUT(
      makeRequest({
        commitmentType: "subcontract",
        lineItems: [
          {
            line_number: 1,
            budget_code: null,
            project_budget_code_id: "project-budget-code-1",
            description: "Masonry",
            amount: 100,
            billed_to_date: 0,
          },
        ],
      }),
      {
        params: Promise.resolve({
          projectId: "42",
          commitmentId: "00000000-0000-0000-0000-000000000010",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toMatchObject({
      subcontract_id: "00000000-0000-0000-0000-000000000010",
      project_budget_code_id: "project-budget-code-1",
      budget_code: "04-2200.S",
    });
  });

  it("rejects ambiguous legacy budget-code text instead of saving a fake link", async () => {
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "commitments_unified") {
          return createBuilder({
            data: { id: "commitment-1", commitment_type: "subcontract" },
            error: null,
          });
        }
        if (table === "subcontractor_invoices") {
          return createBuilder({ data: [], error: null });
        }
        if (table === "subcontract_sov_items") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            delete: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({ data: null, error: null }),
            then: (resolve: (result: QueryResult) => void) =>
              Promise.resolve({ data: [], error: null }).then(resolve),
          };
        }
        if (table === "project_budget_codes") {
          return createBuilder({
            data: [
              {
                id: "project-budget-code-1",
                cost_code_id: "04-2200",
                cost_type_id: "cost-type-1",
                cost_code_types: { code: "S", description: "Subcontract" },
              },
              {
                id: "project-budget-code-2",
                cost_code_id: "04-2200",
                cost_type_id: "cost-type-2",
                cost_code_types: { code: "M", description: "Material" },
              },
            ],
            error: null,
          });
        }
        throw new Error(`Unexpected supabase.from("${table}")`);
      }),
    };
    setAccessResult(supabase as ReturnType<typeof createServiceClient>);

    const response = await PUT(
      makeRequest({
        commitmentType: "subcontract",
        lineItems: [
          {
            line_number: 1,
            budget_code: "04-2200",
            description: "Masonry",
            amount: 100,
            billed_to_date: 0,
          },
        ],
      }),
      {
        params: Promise.resolve({
          projectId: "42",
          commitmentId: "00000000-0000-0000-0000-000000000010",
        }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error_code: "INVALID_PAYLOAD",
      error_message:
        'Line 1: budget code "04-2200" is ambiguous for this project. Select the specific budget code before saving.',
    });
  });
});

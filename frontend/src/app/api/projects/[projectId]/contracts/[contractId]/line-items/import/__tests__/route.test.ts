import { NextRequest } from "next/server";
import { POST } from "../route";
import { verifyProjectAccess } from "@/lib/supabase/auth-guard";
import { requirePermission } from "@/lib/permissions-guard";

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
    "http://localhost/api/projects/42/contracts/contract-1/line-items/import",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

type QueryResult = { data: unknown; error: null | { message: string } };

function createBuilder(result: QueryResult, inserts: unknown[]) {
  const builder: Record<string, jest.Mock> & PromiseLike<QueryResult> = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(result),
    single: jest.fn().mockResolvedValue(result),
    insert: jest.fn((payload: unknown) => {
      inserts.push(payload);
      return builder;
    }),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function createSupabaseMock(options?: {
  budgetLine?: Record<string, unknown>;
  projectBudgetCodeLookup?: QueryResult;
}) {
  const inserts: unknown[] = [];
  const budgetLine = {
    id: "budget-line-1",
    project_budget_code_id: "project-budget-code-1",
    cost_code_id: "01-100",
    cost_type_id: "cost-type-1",
    description: "General Conditions",
    original_amount: 500,
    cost_codes: { title: "General Conditions" },
    cost_code_types: { code: "L", description: "Labor" },
    ...options?.budgetLine,
  };
  const queues: Record<string, QueryResult[]> = {
    prime_contracts: [
      { data: { id: "contract-1", contract_number: "PC-1" }, error: null },
    ],
    budget_lines: [
      {
        data: [budgetLine],
        error: null,
      },
    ],
    contract_line_items: [
      { data: [], error: null },
      {
        data: {
          id: "contract-line-1",
          budget_code_id: "project-budget-code-1",
        },
        error: null,
      },
    ],
    project_budget_codes: options?.projectBudgetCodeLookup
      ? [options.projectBudgetCodeLookup]
      : [],
  };

  return {
    inserts,
    supabase: {
      from: jest.fn((table: string) => {
        const result = queues[table]?.shift();
        if (!result) {
          throw new Error(`Unexpected supabase.from("${table}")`);
        }
        return createBuilder(result, inserts);
      }),
    },
  };
}

describe("contract line item budget import", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
    requirePermissionMock.mockResolvedValue({
      denied: false,
    } as Awaited<ReturnType<typeof requirePermission>>);
  });

  it("preserves budget_lines.project_budget_code_id as contract_line_items.budget_code_id", async () => {
    const { supabase, inserts } = createSupabaseMock();
    verifyProjectAccessMock.mockResolvedValue({
      serviceClient: supabase,
    } as unknown as Awaited<ReturnType<typeof verifyProjectAccess>>);

    const response = await POST(makeRequest({ source: "budget" }), {
      params: Promise.resolve({ projectId: "42", contractId: "contract-1" }),
    });

    expect(response.status).toBe(200);
    expect(inserts).toContainEqual(
      expect.objectContaining({
        contract_id: "contract-1",
        budget_code_id: "project-budget-code-1",
        cost_code_id: "01-100",
      }),
    );
  });

  it("resolves the canonical FK when an older budget line lacks project_budget_code_id", async () => {
    const { supabase, inserts } = createSupabaseMock({
      budgetLine: { project_budget_code_id: null },
      projectBudgetCodeLookup: {
        data: { id: "resolved-project-budget-code" },
        error: null,
      },
    });
    verifyProjectAccessMock.mockResolvedValue({
      serviceClient: supabase,
    } as unknown as Awaited<ReturnType<typeof verifyProjectAccess>>);

    const response = await POST(makeRequest({ source: "budget" }), {
      params: Promise.resolve({ projectId: "42", contractId: "contract-1" }),
    });

    expect(response.status).toBe(200);
    expect(inserts).toContainEqual(
      expect.objectContaining({
        budget_code_id: "resolved-project-budget-code",
      }),
    );
  });
});

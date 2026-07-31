import { NextRequest } from "next/server";
import { POST } from "../route";
import { verifyProjectAccess } from "@/lib/supabase/auth-guard";
import { requirePermission } from "@/lib/permissions-guard";
import { activateBudgetCodes } from "@/lib/estimates/activate-budget-codes";

jest.mock("@/lib/supabase/auth-guard", () => ({
  verifyProjectAccess: jest.fn(),
  isAuthError: jest.fn((value) => value instanceof Response),
}));

jest.mock("@/lib/permissions-guard", () => ({
  requirePermission: jest.fn(),
}));

jest.mock("@/lib/estimates/activate-budget-codes", () => ({
  activateBudgetCodes: jest.fn(),
  BudgetCodeActivationError: class BudgetCodeActivationError extends Error {
    details?: string;

    constructor(message: string, details?: string) {
      super(message);
      this.details = details;
    }
  },
}));

const verifyProjectAccessMock = verifyProjectAccess as jest.MockedFunction<
  typeof verifyProjectAccess
>;
const requirePermissionMock = requirePermission as jest.MockedFunction<
  typeof requirePermission
>;
const activateBudgetCodesMock = activateBudgetCodes as jest.MockedFunction<
  typeof activateBudgetCodes
>;

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest(
    "http://localhost/api/projects/1034/budget/import-from-contract",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

type QueryResult = { data: unknown; error: null | { message: string } };

function createBuilder(result: QueryResult, inserts: unknown[], updates: unknown[]) {
  const builder: Record<string, jest.Mock> & PromiseLike<QueryResult> = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    update: jest.fn((payload: unknown) => {
      updates.push(payload);
      return builder;
    }),
    insert: jest.fn((payload: unknown) => {
      inserts.push(payload);
      return builder;
    }),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function createSupabaseMock() {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  const queues: Record<string, QueryResult[]> = {
    prime_contracts: [
      {
        data: { id: "contract-1", title: "Test PC", contract_number: "PC-001" },
        error: null,
      },
    ],
    contract_line_items: [
      {
        data: [
          {
            id: "base-line",
            line_number: 1,
            description: "Vice President",
            budget_code_id: "base-budget-code",
            cost_code_id: null,
            quantity: 1,
            unit_cost: 100,
            total_cost: 100,
            unit_of_measure: "ls",
            markup_type: null,
          },
          {
            id: "insurance-line",
            line_number: 2,
            description: "Insurance (1.35%)",
            budget_code_id: null,
            cost_code_id: null,
            quantity: 1,
            unit_cost: 25,
            total_cost: 25,
            unit_of_measure: "ls",
            markup_type: "insurance",
          },
          {
            id: "fee-line",
            line_number: 3,
            description: "Fee (5.00%)",
            budget_code_id: null,
            cost_code_id: null,
            quantity: 1,
            unit_cost: 50,
            total_cost: 50,
            unit_of_measure: "ls",
            markup_type: "fee",
          },
        ],
        error: null,
      },
    ],
    project_budget_codes: [
      {
        data: [
          {
            id: "base-budget-code",
            cost_code_id: "01-3120",
            cost_type_id: "revenue-type",
          },
        ],
        error: null,
      },
    ],
    budget_lines: [
      {
        data: [
          {
            id: "existing-base-line",
            project_budget_code_id: "base-budget-code",
            cost_code_id: "01-3120",
            cost_type_id: "revenue-type",
            original_amount: 100,
            source_contract_line_item_id: null,
          },
        ],
        error: null,
      },
      { data: { id: "updated-base-line" }, error: null },
      { data: { id: "inserted-insurance" }, error: null },
      { data: { id: "inserted-fee" }, error: null },
    ],
  };

  return {
    inserts,
    supabase: {
      from: jest.fn((table: string) => {
        const result = queues[table]?.shift();
        if (!result) throw new Error(`Unexpected supabase.from("${table}")`);
        return createBuilder(result, inserts, updates);
      }),
    },
    updates,
  };
}

function createRepeatedBudgetCodeSupabaseMock() {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  const queues: Record<string, QueryResult[]> = {
    prime_contracts: [
      {
        data: { id: "contract-1", title: "Test PC", contract_number: "PC-001" },
        error: null,
      },
    ],
    contract_line_items: [
      {
        data: [
          {
            id: "paint-1",
            line_number: 1,
            description: "Paint Walls",
            budget_code_id: "paint-budget-code",
            cost_code_id: null,
            quantity: 1,
            unit_cost: 100,
            total_cost: 100,
            unit_of_measure: "ls",
            markup_type: null,
          },
          {
            id: "paint-2",
            line_number: 2,
            description: "Paint Doors",
            budget_code_id: "paint-budget-code",
            cost_code_id: null,
            quantity: 1,
            unit_cost: 250,
            total_cost: 250,
            unit_of_measure: "ls",
            markup_type: null,
          },
        ],
        error: null,
      },
    ],
    project_budget_codes: [
      {
        data: [
          {
            id: "paint-budget-code",
            cost_code_id: "09-9123",
            cost_type_id: "revenue-type",
          },
        ],
        error: null,
      },
    ],
    budget_lines: [
      {
        data: [
          {
            id: "existing-paint-line",
            project_budget_code_id: "paint-budget-code",
            cost_code_id: "09-9123",
            cost_type_id: "revenue-type",
            original_amount: 100,
            source_contract_line_item_id: null,
          },
        ],
        error: null,
      },
      { data: { id: "existing-paint-line" }, error: null },
      { data: { id: "inserted-paint-line-2" }, error: null },
    ],
  };

  return {
    inserts,
    updates,
    supabase: {
      from: jest.fn((table: string) => {
        const result = queues[table]?.shift();
        if (!result) throw new Error(`Unexpected supabase.from("${table}")`);
        return createBuilder(result, inserts, updates);
      }),
    },
  };
}

describe("budget import from prime contract SOV", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
    requirePermissionMock.mockResolvedValue({
      denied: false,
    } as Awaited<ReturnType<typeof requirePermission>>);
    activateBudgetCodesMock.mockResolvedValue({
      budgetCodeByKey: new Map([
        ["55-0050|revenue-type", "insurance-budget-code"],
        ["55-0500|revenue-type", "fee-budget-code"],
      ]),
      costTypeIdByCode: new Map([["R", "revenue-type"]]),
      createdCostCodes: 0,
      addedProjectBudgetCodes: 0,
      reactivatedProjectBudgetCodes: 0,
    });
  });

  it("imports fee and insurance markup rows through canonical project budget codes without duplicating existing lines", async () => {
    const { supabase, inserts } = createSupabaseMock();
    verifyProjectAccessMock.mockResolvedValue({
      serviceClient: supabase,
    } as Awaited<ReturnType<typeof verifyProjectAccess>>);

    const response = await POST(makeRequest({ contractId: "contract-1" }), {
      params: Promise.resolve({ projectId: "1034" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.importedCount).toBe(3);
    expect(payload.createdCount).toBe(2);
    expect(payload.updatedCount).toBe(1);
    expect(payload.matchedCount).toBe(0);
    expect(payload.skipped).toBeUndefined();
    expect(activateBudgetCodesMock).toHaveBeenCalledWith(
      expect.anything(),
      1034,
      expect.arrayContaining([
        { costCode: "55-0050", costTypeCode: "R", description: "Insurance" },
        { costCode: "55-0500", costTypeCode: "R", description: "Contractor Fee" },
      ]),
    );
    expect(inserts).toEqual([
      expect.objectContaining({
        source_contract_line_item_id: "insurance-line",
        project_budget_code_id: "insurance-budget-code",
        cost_code_id: "55-0050",
        cost_type_id: "revenue-type",
        description: "Insurance (1.35%)",
      }),
      expect.objectContaining({
        source_contract_line_item_id: "fee-line",
        project_budget_code_id: "fee-budget-code",
        cost_code_id: "55-0500",
        cost_type_id: "revenue-type",
        description: "Fee (5.00%)",
      }),
    ]);
  });

  it("preserves repeated SOV rows as separate budget lines with the same budget code", async () => {
    const { supabase, inserts, updates } = createRepeatedBudgetCodeSupabaseMock();
    verifyProjectAccessMock.mockResolvedValue({
      serviceClient: supabase,
    } as Awaited<ReturnType<typeof verifyProjectAccess>>);

    const response = await POST(makeRequest({ contractId: "contract-1" }), {
      params: Promise.resolve({ projectId: "1034" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.importedCount).toBe(2);
    expect(payload.createdCount).toBe(1);
    expect(payload.updatedCount).toBe(1);
    expect(inserts).toEqual([
      expect.objectContaining({
        source_contract_line_item_id: "paint-2",
        project_budget_code_id: "paint-budget-code",
        cost_code_id: "09-9123",
        cost_type_id: "revenue-type",
        original_amount: 250,
        description: "Paint Doors",
      }),
    ]);
    expect(updates).toEqual([
      expect.objectContaining({
        source_contract_line_item_id: "paint-1",
        project_budget_code_id: "paint-budget-code",
        cost_code_id: "09-9123",
        cost_type_id: "revenue-type",
        original_amount: 100,
        description: "Paint Walls",
      }),
    ]);
  });
});

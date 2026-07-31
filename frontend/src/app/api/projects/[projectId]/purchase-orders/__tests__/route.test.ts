process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";

import { NextRequest } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { POST } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;

describe("/api/projects/[projectId]/purchase-orders POST", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({
      id: "user-123",
      email: "qa@example.com",
    } as Awaited<ReturnType<typeof getApiRouteUser>>);
  });

  it("creates SOV rows with canonical project budget code FK", async () => {
    const sovInsert = jest.fn().mockResolvedValue({ data: null, error: null });
    const purchaseOrderInsertSingle = jest.fn().mockResolvedValue({
      data: {
        id: "po-1",
        project_id: 762,
        contract_number: "PO-001",
        title: "QA Purchase Order",
      },
      error: null,
    });

    const purchaseOrderInsertChain = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: purchaseOrderInsertSingle,
    };

    const projectBudgetCodesResult = {
      data: [
        {
          id: "project-budget-code-1",
          cost_code_id: "04-2200",
          cost_type_id: "cost-type-1",
          cost_code_types: { code: "M", description: "Material" },
        },
      ],
      error: null,
    };
    const projectBudgetCodesChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest
        .fn()
        .mockReturnValueOnce(null)
        .mockResolvedValueOnce(projectBudgetCodesResult),
    };
    projectBudgetCodesChain.eq.mockReset();
    projectBudgetCodesChain.eq
      .mockReturnValueOnce(projectBudgetCodesChain)
      .mockResolvedValueOnce(projectBudgetCodesResult);

    const sovInsertChain = {
      insert: sovInsert,
    };

    const totalsChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: "po-1", title: "QA Purchase Order" },
        error: null,
      }),
    };

    const fromMock = jest.fn((table: string) => {
      if (table === "purchase_orders") return purchaseOrderInsertChain;
      if (table === "project_budget_codes") return projectBudgetCodesChain;
      if (table === "purchase_order_sov_items") return sovInsertChain;
      if (table === "purchase_orders_with_totals") return totalsChain;
      throw new Error(`Unexpected table: ${table}`);
    });

    createClientMock.mockResolvedValue({
      from: fromMock,
    } as never);

    const request = new NextRequest(
      "http://localhost/api/projects/762/purchase-orders",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "QA Purchase Order",
          status: "Draft",
          contractCompanyId: "company-1",
          contractNumber: "PO-001",
          executed: false,
          accountingMethod: "amount",
          sov: [
            {
              lineNumber: 1,
              budgetCodeId: "project-budget-code-1",
              description: "Masonry material",
              amount: 100,
            },
          ],
        }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ projectId: "762" }),
    });

    expect(response.status).toBe(200);
    expect(sovInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        purchase_order_id: "po-1",
        budget_code: "04-2200.M",
        project_budget_code_id: "project-budget-code-1",
      }),
    ]);
  });
});

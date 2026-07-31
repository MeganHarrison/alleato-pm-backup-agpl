import { NextRequest } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { GET, PATCH, PUT } from "../route";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;

function createQueryChain<T>(payload: T) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn(async () => ({ data: payload, error: null })),
    maybeSingle: jest.fn(async () => ({ data: payload, error: null })),
    then: jest.fn(
      (
        resolve: (value: { data: T; error: null }) => void,
      ) => resolve({ data: payload, error: null }),
    ),
  };
  return chain;
}

function createMutationChain<T>(payload: T) {
  const chain = {
    update: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(async () => ({ data: payload, error: null })),
  };
  return chain;
}

describe("/api/commitments/[commitmentId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as never);
  });

  it("returns unit/quantity purchase order detail fields for the SOV table", async () => {
    const unifiedChain = createQueryChain({ commitment_type: "purchase_order" });
    const purchaseOrderChain = createQueryChain({
      id: "po-1",
      project_id: 1010,
      contract_number: "PO-001",
      title: "QA Materials Purchase Order",
      description: null,
      status: "draft",
      executed: false,
      contract_company_id: null,
      contract_date: null,
      signed_po_received_date: null,
      issued_on_date: null,
      default_retainage_percent: 0,
      accounting_method: "unit-quantity",
      is_private: false,
      non_admin_user_ids: [],
      allow_non_admin_view_sov_items: false,
      invoice_contact_ids: [],
      created_by: null,
      created_at: "2026-04-29T00:00:00.000Z",
      updated_at: "2026-04-29T00:00:00.000Z",
      deleted_at: null,
    });
    const totalsChain = createQueryChain({
      total_sov_amount: 50000,
      total_billed_to_date: 0,
      total_amount_remaining: 50000,
      sov_line_count: 1,
    });
    const sovChain = createQueryChain([
      {
        id: "line-1",
        line_number: 1,
        budget_code: "03 00 00",
        description: "Concrete materials",
        amount: 50000,
        quantity: 1,
        uom: "LS",
        unit_cost: 50000,
        billed_to_date: 0,
        sort_order: null,
      },
    ]);
    const changeOrdersChain = createQueryChain([]);

    const fromMock = jest.fn((table: string) => {
      switch (table) {
        case "commitments_unified":
          return unifiedChain;
        case "purchase_orders":
          return purchaseOrderChain;
        case "purchase_orders_with_totals":
          return totalsChain;
        case "purchase_order_sov_items":
          return sovChain;
        case "contract_change_orders":
          return changeOrdersChain;
        case "subcontractor_invoices":
          return createQueryChain([]);
        default:
          throw new Error(`Unexpected table: ${table}`);
      }
    });

    createClientMock.mockResolvedValue({ from: fromMock } as never);

    const response = await GET(
      new NextRequest("http://localhost/api/commitments/po-1"),
      { params: Promise.resolve({ commitmentId: "po-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        accounting_method: "unit-quantity",
        line_items: [
          {
            quantity: 1,
            uom: "LS",
            unit_cost: 50000,
          },
        ],
      },
    });
    expect(sovChain.select).toHaveBeenCalledWith(
      expect.stringContaining("quantity, uom, unit_cost"),
    );
  });

  it("rejects non-status PUT edits when a commitment is approved", async () => {
    const commitmentId = "00000000-0000-0000-0000-000000000001";
    const unifiedChain = createQueryChain({
      commitment_type: "subcontract",
      status: "Approved",
    });
    const updateChain = createMutationChain({ id: commitmentId });

    createClientMock.mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === "commitments_unified") return unifiedChain;
        if (table === "subcontracts") return updateChain;
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await PUT(
      new NextRequest(`http://localhost/api/commitments/${commitmentId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Blocked title edit" }),
      }),
      { params: Promise.resolve({ commitmentId }) },
    );

    expect(response.status).toBe(412);
    await expect(response.json()).resolves.toMatchObject({
      error_code: "PRECONDITION_FAILED",
      error_message: "Approved commitments are read-only. Change the status before editing other fields.",
    });
    expect(updateChain.update).not.toHaveBeenCalled();
  });

  it("allows status-only PATCH updates when a commitment is approved", async () => {
    const commitmentId = "00000000-0000-0000-0000-000000000002";
    const unifiedChain = createQueryChain({
      commitment_type: "subcontract",
      status: "Approved",
    });
    const updateChain = createMutationChain({
      id: commitmentId,
      contract_number: "SC-101",
      title: "Approved subcontract",
      status: "Draft",
      description: null,
      executed: false,
      updated_at: "2026-07-01T19:00:00.000Z",
    });

    createClientMock.mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === "commitments_unified") return unifiedChain;
        if (table === "subcontracts") return updateChain;
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await PATCH(
      new NextRequest(`http://localhost/api/commitments/${commitmentId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "draft" }),
      }),
      { params: Promise.resolve({ commitmentId }) },
    );

    expect(response.status).toBe(200);
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "Draft" }),
    );
  });
});

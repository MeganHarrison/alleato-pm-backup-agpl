import { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { GET, POST } from "../route";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;

function createQueryChain<T>(payload: T) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn(async () => ({ data: payload, error: null })),
    maybeSingle: jest.fn(async () => ({ data: payload, error: null })),
    then: jest.fn((resolve: (value: { data: T; error: null }) => void) =>
      resolve({ data: payload, error: null }),
    ),
  };
}

describe("/api/commitments/[commitmentId]/invoices", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a retainage-aware billing summary for commitment SOV items", async () => {
    const unifiedChain = createQueryChain({ commitment_type: "subcontract" });
    const commitmentChain = createQueryChain({
      project_id: 42,
      default_retainage_percent: 10,
      contract_number: "SC-001",
      title: "Test Subcontract",
      status: "draft",
    });
    const submissionChain = createQueryChain(null);
    const itemsChain = createQueryChain([
      {
        id: "line-1",
        line_number: 1,
        budget_code: "01 00 00",
        description: "Labor",
        amount: 1000,
        billed_to_date: 250,
      },
      {
        id: "line-2",
        line_number: 2,
        budget_code: "02 00 00",
        description: "Materials",
        amount: 500,
        billed_to_date: 100,
      },
    ]);

    const fromMock = jest.fn((table: string) => {
      switch (table) {
        case "commitments_unified":
          return unifiedChain;
        case "subcontracts":
          return commitmentChain;
        case "subcontractor_sov_submissions":
          return submissionChain;
        case "subcontract_sov_items":
          return itemsChain;
        default:
          throw new Error(`Unexpected table: ${table}`);
      }
    });

    createClientMock.mockResolvedValue({ from: fromMock } as never);

    const response = await GET(
      new NextRequest("http://localhost/api/commitments/commitment-1/invoices"),
      { params: Promise.resolve({ commitmentId: "commitment-1" }) },
    );

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual({
      summary: {
        total_contract_amount: 1500,
        gross_billed_to_date: 350,
        retainage_percentage: 10,
        retainage_held: 35,
        net_billed_to_date: 315,
        remaining_to_invoice: 1150,
        net_remaining_balance: 1185,
        percent_invoiced: 23,
      },
      line_items: [
        {
          id: "line-1",
          line_number: 1,
          budget_code: "01 00 00",
          description: "Labor",
          scheduled_value: 1000,
          gross_billed_to_date: 250,
          retainage_percentage: 10,
          retainage_held: 25,
          net_billed_to_date: 225,
          remaining_amount: 750,
          percent_complete: 25,
        },
        {
          id: "line-2",
          line_number: 2,
          budget_code: "02 00 00",
          description: "Materials",
          scheduled_value: 500,
          gross_billed_to_date: 100,
          retainage_percentage: 10,
          retainage_held: 10,
          net_billed_to_date: 90,
          remaining_amount: 400,
          percent_complete: 20,
        },
      ],
      billing_context: {
        commitment_type: "subcontract",
        project_id: 42,
        invoices_enabled: true,
        retainage_enabled: true,
      },
    });

    expect(fromMock).not.toHaveBeenCalledWith("owner_invoices");
  });

  it("rejects POST instead of writing commitment invoices into owner invoice tables", async () => {
    const unifiedChain = createQueryChain({ commitment_type: "purchase_order" });
    const commitmentChain = createQueryChain({
      project_id: 7,
      default_retainage_percent: 12.5,
      contract_number: "PO-100",
      title: "Test Purchase Order",
      status: "draft",
      advanced_settings: {
        enable_invoices: true,
        enable_completed_work_retainage: true,
      },
    });

    const fromMock = jest.fn((table: string) => {
      switch (table) {
        case "commitments_unified":
          return unifiedChain;
        case "purchase_orders":
          return commitmentChain;
        default:
          throw new Error(`Unexpected table: ${table}`);
      }
    });

    createClientMock.mockResolvedValue({ from: fromMock } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/commitments/commitment-2/invoices", {
        method: "POST",
      }),
      { params: Promise.resolve({ commitmentId: "commitment-2" }) },
    );

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toEqual({
      error:
        "Commitment invoice creation is not implemented yet. The retainage billing tab is currently read-only.",
    });
    expect(fromMock).not.toHaveBeenCalledWith("owner_invoices");
  });
});

import { NextRequest } from "next/server";
import { PATCH } from "../route";
import { createClient } from "@/lib/supabase/server";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/lib/permissions-guard", () => ({
  requirePermission: jest.fn(async () => ({
    denied: false,
    userId: "user-1",
    personId: "person-1",
  })),
}));

const createClientMock = createClient as jest.Mock;

const createMutationChain = () => ({
  update: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  single: jest.fn(),
  then: jest.fn((resolve: (value: unknown) => void) => resolve({ error: null })),
});

const createSelectChain = (data: unknown[] | Record<string, unknown> | null) => ({
  update: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  single: jest.fn(async () => ({
    data: Array.isArray(data) ? data[0] ?? null : data,
    error: null,
  })),
  then: jest.fn((resolve: (value: unknown) => void) =>
    resolve({ data, error: null }),
  ),
});

describe("payment application line-items route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const lineItemOneId = "123e4567-e89b-12d3-a456-426614174000";
  const lineItemTwoId = "123e4567-e89b-12d3-a456-426614174001";

  const params = {
    params: Promise.resolve({
      projectId: "42",
      contractId: "84",
      applicationId: "application-1",
    }),
  };

  const buildRequest = (payload: Record<string, unknown>) =>
    new NextRequest(
      "http://localhost/api/projects/42/contracts/84/payment-applications/application-1/line-items",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

  const setupSupabaseMock = () => {
    const lineItemUpdateChain = createMutationChain();
    let lineItemFromCallCount = 0;
    let paymentApplicationFromCallCount = 0;
    const paymentApplicationLookupChain = createSelectChain({
      id: "application-1",
      contract_id: "84",
      project_id: 42,
      billing_period_id: "billing-period-1",
      status: "draft",
      application_number: "001",
      billing_date: "2026-04-01",
      created_at: "2026-04-01T00:00:00.000Z",
    });
    const paymentApplicationSiblingsChain = createSelectChain([
      {
        id: "application-1",
        application_number: "001",
        billing_date: "2026-04-01",
        created_at: "2026-04-01T00:00:00.000Z",
      },
    ]);
    const lineItemFetchChain = createSelectChain([
      {
        id: lineItemOneId,
        scheduled_value: 1000,
        work_completed_previous: 0,
        work_completed_this_period: 250,
        materials_stored: 0,
        retainage_previous_work: 0,
        retainage_previous_materials: 0,
        retainage_this_period_work: 125,
        retainage_this_period_materials: 0,
        retainage_released_work: 0,
        retainage_released_materials: 0,
      },
      {
        id: lineItemTwoId,
        payment_application_id: "application-1",
        scheduled_value: 2000,
        work_completed_previous: 0,
        work_completed_this_period: 500,
        materials_stored: 300,
        retainage_previous_work: 0,
        retainage_previous_materials: 0,
        retainage_this_period_work: 0,
        retainage_this_period_work_pct: 0,
        retainage_this_period_materials: 50,
        retainage_this_period_materials_pct: 0,
        retainage_released_work: 0,
        retainage_released_materials: 10,
      },
    ]);
    const existingItemsChain = createSelectChain([
      {
        id: lineItemOneId,
        payment_application_id: "application-1",
        scheduled_value: 1000,
        work_completed_previous: 0,
        work_completed_this_period: 0,
        materials_stored: 0,
        retainage_previous_work: 0,
        retainage_previous_materials: 0,
        retainage_this_period_work: 0,
        retainage_this_period_work_pct: 10,
        retainage_this_period_materials: 0,
        retainage_this_period_materials_pct: 10,
        retainage_released_work: 0,
        retainage_released_materials: 0,
      },
      {
        id: lineItemTwoId,
        payment_application_id: "application-1",
        scheduled_value: 2000,
        work_completed_previous: 0,
        work_completed_this_period: 500,
        materials_stored: 300,
        retainage_previous_work: 0,
        retainage_previous_materials: 0,
        retainage_this_period_work: 0,
        retainage_this_period_materials: 50,
        retainage_released_work: 0,
        retainage_released_materials: 10,
      },
    ]);
    const lineItemFinalFetchChain = createSelectChain([
      {
        id: lineItemOneId,
        scheduled_value: 1000,
        work_completed_previous: 0,
        work_completed_this_period: 250,
        materials_stored: 0,
        retainage_previous_work: 0,
        retainage_previous_materials: 0,
        retainage_this_period_work: 125,
        retainage_this_period_materials: 0,
        retainage_released_work: 0,
        retainage_released_materials: 0,
      },
      {
        id: lineItemTwoId,
        scheduled_value: 2000,
        work_completed_previous: 0,
        work_completed_this_period: 500,
        materials_stored: 300,
        retainage_previous_work: 0,
        retainage_previous_materials: 0,
        retainage_this_period_work: 0,
        retainage_this_period_materials: 50,
        retainage_released_work: 0,
        retainage_released_materials: 10,
      },
    ]);
    const appUpdateChain = createMutationChain();

    const supabaseMock = {
      from: jest.fn((table: string) => {
        if (table === "payment_application_line_items") {
          lineItemFromCallCount += 1;

          if (lineItemFromCallCount === 1) {
            return existingItemsChain;
          }

          if (lineItemFromCallCount <= 3) {
            return lineItemUpdateChain;
          }

          if (lineItemFromCallCount === 4) {
            return lineItemFetchChain;
          }

          return lineItemFinalFetchChain;
        }

        if (table === "prime_contract_payment_applications") {
          paymentApplicationFromCallCount += 1;
          if (paymentApplicationFromCallCount === 1) {
            return paymentApplicationLookupChain;
          }
          if (paymentApplicationFromCallCount === 2) {
            return paymentApplicationSiblingsChain;
          }
          return appUpdateChain;
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    createClientMock.mockResolvedValue(supabaseMock);

    return {
      lineItemUpdateChain,
      lineItemFetchChain,
      lineItemFinalFetchChain,
      appUpdateChain,
    };
  };

  it.each([
    ["items", "new items payload"],
    ["line_items", "legacy line_items payload"],
  ])("accepts %s payload", async (payloadKey, _label) => {
    const {
      lineItemUpdateChain,
      appUpdateChain,
      lineItemFinalFetchChain,
    } = setupSupabaseMock();

    const response = await PATCH(
      buildRequest({
        [payloadKey]: [
          {
            id: lineItemOneId,
            work_completed_this_period: 250,
            retainage_this_period_work: 125,
          },
          {
            id: lineItemTwoId,
            materials_stored: 300,
            retainage_this_period_materials: 50,
            retainage_released_materials: 10,
          },
        ],
      }),
      params,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        id: lineItemOneId,
        scheduled_value: 1000,
        work_completed_previous: 0,
        work_completed_this_period: 250,
        materials_stored: 0,
        retainage_previous_work: 0,
        retainage_previous_materials: 0,
        retainage_this_period_work: 125,
        retainage_this_period_materials: 0,
        retainage_released_work: 0,
        retainage_released_materials: 0,
      },
      {
        id: lineItemTwoId,
        scheduled_value: 2000,
        work_completed_previous: 0,
        work_completed_this_period: 500,
        materials_stored: 300,
        retainage_previous_work: 0,
        retainage_previous_materials: 0,
        retainage_this_period_work: 0,
        retainage_this_period_materials: 50,
        retainage_released_work: 0,
        retainage_released_materials: 10,
      },
    ]);

    expect(lineItemUpdateChain.update).toHaveBeenNthCalledWith(1, {
      work_completed_this_period: 250,
      retainage_this_period_work: 125,
    });
    expect(lineItemUpdateChain.update).toHaveBeenNthCalledWith(2, {
      materials_stored: 300,
      retainage_this_period_materials: 50,
      retainage_released_materials: 10,
    });
    expect(appUpdateChain.update).toHaveBeenCalledWith({
      amount: 1050,
      retention_amount: 165,
      percent_complete: 35,
    });
    expect(lineItemFinalFetchChain.order).toHaveBeenCalledWith("sort_order", {
      ascending: true,
    });
  });
});

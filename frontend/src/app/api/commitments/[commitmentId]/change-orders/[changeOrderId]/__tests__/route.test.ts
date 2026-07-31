import { NextRequest } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { DELETE, PUT } from "../route";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;

function createFetchChain<T>(payload: T) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(async () => ({ data: payload, error: null })),
  };
}

function createUpdateChain<T>(payload: T) {
  return {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn(async () => ({ data: payload, error: null })),
  };
}

function createListChain<T>(payload: T) {
  const resolved = Promise.resolve({ data: payload, error: null });
  const terminal = jest.fn().mockResolvedValue({ data: payload, error: null });
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockImplementation(() => ({
      eq: terminal,
      then: resolved.then.bind(resolved),
      catch: resolved.catch.bind(resolved),
      finally: resolved.finally.bind(resolved),
    })),
  };
}

function createDeleteChain(payload: { error: null | { message: string }; count?: number | null }) {
  const resolved = Promise.resolve(payload);
  const terminal = jest.fn().mockResolvedValue(payload);
  return {
    delete: jest.fn().mockReturnValue({
      eq: jest.fn().mockImplementation(() => ({
        eq: terminal,
        then: resolved.then.bind(resolved),
        catch: resolved.catch.bind(resolved),
        finally: resolved.finally.bind(resolved),
      })),
    }),
  };
}

const commitmentId = "00000000-0000-0000-0000-0000000000c1";
const changeOrderId = "00000000-0000-0000-0000-0000000000c2";

function putRequest(body: Record<string, unknown>) {
  return new NextRequest(
    `http://localhost/api/commitments/${commitmentId}/change-orders/${changeOrderId}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function deleteRequest() {
  return new NextRequest(
    `http://localhost/api/commitments/${commitmentId}/change-orders/${changeOrderId}`,
    { method: "DELETE" },
  );
}

describe("PUT /api/commitments/[commitmentId]/change-orders/[changeOrderId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as never);
  });

  it("rejects a requested_date that is later than the change order's created_at", async () => {
    const fetchChain = createFetchChain({
      id: changeOrderId,
      status: "draft",
      created_at: "2026-06-01T00:00:00.000Z",
    });

    createClientMock.mockResolvedValue({
      from: jest.fn(() => fetchChain),
    } as never);

    const response = await PUT(putRequest({ requested_date: "2026-06-15" }), {
      params: Promise.resolve({ commitmentId, changeOrderId }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid requested date",
    });
  });

  it("stores approved_date as a plain date (not a full timestamp) when approving", async () => {
    const fetchChain = createFetchChain({
      id: changeOrderId,
      status: "pending",
      created_at: "2026-06-01T00:00:00.000Z",
    });
    const updateChain = createUpdateChain({
      id: changeOrderId,
      status: "approved",
    });

    // First call to `.from()` is the existence check (fetchChain); the second
    // is the update (updateChain).
    let callCount = 0;
    createClientMock.mockResolvedValue({
      from: jest.fn(() => {
        callCount += 1;
        return callCount === 1 ? fetchChain : updateChain;
      }),
    } as never);

    await PUT(putRequest({ status: "approved" }), {
      params: Promise.resolve({ commitmentId, changeOrderId }),
    });

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        approved_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
    );
  });
});

describe("DELETE /api/commitments/[commitmentId]/change-orders/[changeOrderId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as never);
  });

  it("fails loudly when the change order is not in draft status", async () => {
    const fetchChain = createFetchChain({
      id: changeOrderId,
      status: "pending",
      change_order_number: "CCO-001",
    });

    createClientMock.mockResolvedValue({
      from: jest.fn(() => fetchChain),
    } as never);

    const response = await DELETE(deleteRequest(), {
      params: Promise.resolve({ commitmentId, changeOrderId }),
    });

    expect(response.status).toBe(412);
    await expect(response.json()).resolves.toMatchObject({
      error_code: "PRECONDITION_FAILED",
      error_message: expect.stringContaining("Only draft change orders can be deleted"),
      details: {
        code: "CHANGE_ORDER_NOT_DRAFT",
        status: "pending",
      },
    });
  });

  it("blocks delete when subcontractor invoice line items still reference the change order", async () => {
    const fetchChain = createFetchChain({
      id: changeOrderId,
      status: "draft",
      change_order_number: "CCO-001",
    });
    const paymentLineChain = createListChain([
      { id: "pal-1", payment_application_id: 42 },
    ]);

    createClientMock.mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === "contract_change_orders") return fetchChain;
        if (table === "payment_application_line_items") return paymentLineChain;
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await DELETE(deleteRequest(), {
      params: Promise.resolve({ commitmentId, changeOrderId }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error_code: "PRECONDITION_FAILED",
      details: {
        code: "CHANGE_ORDER_HAS_PAYMENT_APPLICATION_LINES",
        references: [{ id: "pal-1", payment_application_id: 42 }],
      },
    });
  });

  it("deletes scoped line items before deleting the draft change order", async () => {
    const fetchChain = createFetchChain({
      id: changeOrderId,
      status: "draft",
      change_order_number: "CCO-001",
    });
    const emptyPaymentLineChain = createListChain([]);
    const lineItemsChain = createListChain([{ id: "line-1" }, { id: "line-2" }]);
    const deleteLineItemsChain = createDeleteChain({ error: null });
    const deleteChangeOrderChain = createDeleteChain({ error: null, count: 1 });

    let contractChangeOrdersCalls = 0;
    createClientMock.mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === "contract_change_orders") {
          contractChangeOrdersCalls += 1;
          return contractChangeOrdersCalls === 1 ? fetchChain : deleteChangeOrderChain;
        }
        if (table === "payment_application_line_items") return emptyPaymentLineChain;
        if (table === "commitment_change_order_lines") {
          return lineItemsChain.select.mock.calls.length === 0
            ? lineItemsChain
            : deleteLineItemsChain;
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await DELETE(deleteRequest(), {
      params: Promise.resolve({ commitmentId, changeOrderId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      deleted_line_item_count: 2,
    });
  });
});

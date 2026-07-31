import { NextRequest } from "next/server";

import { requirePermission } from "@/lib/permissions-guard";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { DELETE, PATCH } from "../[periodId]/route";
import { POST } from "../route";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";

jest.mock("@/lib/permissions-guard", () => ({
  requirePermission: jest.fn(),
}));
jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
  createClient: jest.fn(),
}));
jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

const requirePermissionMock = requirePermission as jest.MockedFunction<
  typeof requirePermission
>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<
  typeof getApiRouteUser
>;
const createClientMock = createClient as jest.Mock;
const createServiceClientMock = createServiceClient as jest.Mock;

function billingPeriodQuery(result: unknown) {
  const query: Record<string, jest.Mock> = {};
  for (const method of ["select", "eq"]) {
    query[method] = jest.fn(() => query);
  }
  query.maybeSingle = jest.fn(async () => result);
  return query;
}

describe("invoicing billing periods route", () => {
  const rpc = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    requirePermissionMock.mockResolvedValue({ denied: false } as never);
    getApiRouteUserMock.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000001",
      email: "pm@example.com",
    } as never);
    createServiceClientMock.mockReturnValue({ rpc });
  });

  it("rejects create requests without due date", async () => {
    const request = new NextRequest(
      "http://localhost/api/projects/876/invoicing/billing-periods",
      {
        method: "POST",
        body: JSON.stringify({
          start_date: "2026-07-01",
          end_date: "2026-07-31",
        }),
      },
    );

    const response = await POST(request, { params: { projectId: "876" } });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Billing period due date is required.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("creates a new open period through the atomic transition RPC", async () => {
    rpc.mockResolvedValue({
      data: { id: "bp-2", is_closed: false, period_number: 2 },
      error: null,
    });
    const request = new NextRequest(
      "http://localhost/api/projects/876/invoicing/billing-periods",
      {
        method: "POST",
        body: JSON.stringify({
          start_date: "2026-07-01",
          end_date: "2026-07-31",
          due_date: "2026-08-05",
        }),
      },
    );

    const response = await POST(request, { params: { projectId: "876" } });
    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("save_billing_period_atomic", {
      p_project_id: 876,
      p_period_id: null,
      p_start_date: "2026-07-01",
      p_end_date: "2026-07-31",
      p_due_date: "2026-08-05",
      p_name: null,
      p_is_closed: false,
      p_actor_id: "00000000-0000-0000-0000-000000000001",
    });
  });

  it("maps duplicate date ranges to an actionable conflict", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });
    const request = new NextRequest(
      "http://localhost/api/projects/876/invoicing/billing-periods",
      {
        method: "POST",
        body: JSON.stringify({
          start_date: "2026-07-01",
          end_date: "2026-07-31",
          due_date: "2026-08-05",
        }),
      },
    );

    const response = await POST(request, { params: { projectId: "876" } });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error:
        "A billing period already uses this From and To date range. Choose a unique range.",
    });
  });

  it("rejects patch requests that blank the due date", async () => {
    createClientMock.mockResolvedValue({
      from: jest.fn(() =>
        billingPeriodQuery({
          data: {
            id: "bp-1",
            period_number: 1,
            start_date: "2026-07-01",
            end_date: "2026-07-31",
            due_date: "2026-08-05",
            name: null,
            is_closed: false,
          },
          error: null,
        }),
      ),
    });
    const request = new NextRequest(
      "http://localhost/api/projects/876/invoicing/billing-periods/bp-1",
      { method: "PATCH", body: JSON.stringify({ due_date: "" }) },
    );

    const response = await PATCH(request, {
      params: { projectId: "876", periodId: "bp-1" },
    });
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reopens a period through the atomic transition instead of blocking", async () => {
    createClientMock.mockResolvedValue({
      from: jest.fn(() =>
        billingPeriodQuery({
          data: {
            id: "bp-2",
            period_number: 2,
            start_date: "2026-08-01",
            end_date: "2026-08-31",
            due_date: "2026-09-05",
            name: null,
            is_closed: true,
          },
          error: null,
        }),
      ),
    });
    rpc.mockResolvedValue({
      data: { id: "bp-2", is_closed: false },
      error: null,
    });
    const request = new NextRequest(
      "http://localhost/api/projects/876/invoicing/billing-periods/bp-2",
      { method: "PATCH", body: JSON.stringify({ is_closed: false }) },
    );

    const response = await PATCH(request, {
      params: { projectId: "876", periodId: "bp-2" },
    });
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "save_billing_period_atomic",
      expect.objectContaining({ p_period_id: "bp-2", p_is_closed: false }),
    );
  });

  it("blocks deletion when any invoice or payment history is linked", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "23503", details: '{"contract_payments":1}' },
    });
    const request = new NextRequest(
      "http://localhost/api/projects/876/invoicing/billing-periods/bp-2",
      { method: "DELETE" },
    );

    const response = await DELETE(request, {
      params: { projectId: "876", periodId: "bp-2" },
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error:
        "This billing period is linked to invoice or payment history and cannot be deleted.",
      details: '{"contract_payments":1}',
    });
  });
});

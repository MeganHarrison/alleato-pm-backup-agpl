import { NextRequest } from "next/server";

import { requirePermission } from "@/lib/permissions-guard";
import { createClient } from "@/lib/supabase/server";
import { POST } from "../route";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";

jest.mock("@/lib/permissions-guard", () => ({
  requirePermission: jest.fn(),
}));
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

const requirePermissionMock = requirePermission as jest.MockedFunction<
  typeof requirePermission
>;
const createClientMock = createClient as jest.Mock;

function billingPeriodQuery(result: unknown) {
  const query: Record<string, jest.Mock> = {};
  for (const method of ["select", "eq"]) {
    query[method] = jest.fn(() => query);
  }
  query.maybeSingle = jest.fn(async () => result);
  return query;
}

describe("owner invoice atomic billing-period guardrail", () => {
  const rpc = jest.fn();
  const periodId = "5a777dcf-f96f-4332-82f2-4521d0b44797";
  const otherPeriodId = "c131fd38-9301-47af-9d31-7bb199302fe9";

  beforeEach(() => {
    jest.clearAllMocks();
    requirePermissionMock.mockResolvedValue({ denied: false } as never);
  });

  it("fails loudly and writes nothing when billing_period_id is missing", async () => {
    createClientMock.mockResolvedValue({ from: jest.fn(), rpc });

    const response = await POST(
      new NextRequest(
        "http://localhost/api/projects/67/invoicing/owner/atomic",
        {
          method: "POST",
          body: JSON.stringify({
            prime_contract_id: "contract-1",
            payment_application: { application_number: "APP-1" },
          }),
        },
      ),
      { params: { projectId: "67" } },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        error_code: "INVALID_PAYLOAD",
        error_message:
          "billing_period_id is required. Select a project billing period before creating the invoice.",
        details: [
          {
            path: "billing_period_id",
            message: "A canonical billing-period record is required.",
          },
        ],
      }),
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects conflicting billing-period IDs before querying or writing", async () => {
    const from = jest.fn();
    createClientMock.mockResolvedValue({ from, rpc });

    const response = await POST(
      new NextRequest(
        "http://localhost/api/projects/67/invoicing/owner/atomic",
        {
          method: "POST",
          body: JSON.stringify({
            prime_contract_id: "contract-1",
            payment_application: {
              application_number: "APP-1",
              billing_period_id: periodId,
            },
            invoice: { billing_period_id: otherPeriodId },
          }),
        },
      ),
      { params: { projectId: "67" } },
    );

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a stale or foreign-project billing period before writing", async () => {
    createClientMock.mockResolvedValue({
      from: jest.fn(() => billingPeriodQuery({ data: null, error: null })),
      rpc,
    });

    const response = await POST(
      new NextRequest(
        "http://localhost/api/projects/67/invoicing/owner/atomic",
        {
          method: "POST",
          body: JSON.stringify({
            prime_contract_id: "contract-1",
            payment_application: {
              application_number: "APP-1",
              billing_period_id: periodId,
            },
          }),
        },
      ),
      { params: { projectId: "67" } },
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error:
        "The selected billing period is not available for this project. Refresh the page and select another period.",
      error_message:
        "No invoice was created because the billing period was missing, stale, or belonged to another project.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("validates one selected record and canonicalizes both invoice date ranges", async () => {
    createClientMock.mockResolvedValue({
      from: jest.fn(() =>
        billingPeriodQuery({
          data: {
            id: periodId,
            start_date: "2026-07-01",
            end_date: "2026-07-31",
            due_date: "2026-08-05",
          },
          error: null,
        }),
      ),
      rpc,
    });
    rpc.mockResolvedValue({ data: { invoice_id: "invoice-1" }, error: null });

    const response = await POST(
      new NextRequest(
        "http://localhost/api/projects/67/invoicing/owner/atomic",
        {
          method: "POST",
          body: JSON.stringify({
            prime_contract_id: "contract-1",
            payment_application: {
              application_number: "APP-1",
              billing_period_id: periodId,
              period_from: "2025-01-01",
              period_to: "2025-01-31",
              billing_date: "2026-07-15",
            },
            invoice: {
              billing_period_id: periodId,
              period_start: "2025-01-01",
              period_end: "2025-01-31",
              billing_date: "2026-07-15",
              due_date: null,
            },
          }),
        },
      ),
      { params: { projectId: "67" } },
    );

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith(
      "create_owner_invoice_atomic",
      expect.objectContaining({
        p_payment_application: expect.objectContaining({
          billing_period_id: periodId,
          period_from: "2026-07-01",
          period_to: "2026-07-31",
          billing_date: "2026-07-15",
        }),
        p_invoice: expect.objectContaining({
          billing_period_id: periodId,
          period_start: "2026-07-01",
          period_end: "2026-07-31",
          billing_date: "2026-07-15",
          due_date: "2026-08-05",
        }),
      }),
    );
  });
});

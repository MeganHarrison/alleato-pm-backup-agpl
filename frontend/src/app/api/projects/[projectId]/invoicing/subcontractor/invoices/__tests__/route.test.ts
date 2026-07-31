import { NextRequest } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { GET, POST } from "../route";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
  createClient: jest.fn(),
}));

const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<
  typeof getApiRouteUser
>;

const createClientMock = createClient as jest.Mock;

type MockQuery = Record<
  string,
  jest.Mock | ((resolve: (value: unknown) => unknown) => Promise<unknown>)
>;

function createQuery(result: unknown, onInsert?: jest.Mock) {
  const query: MockQuery = {};
  const self = query as MockQuery;
  for (const method of [
    "select",
    "eq",
    "in",
    "lt",
    "order",
    "update",
    "delete",
  ]) {
    query[method] = jest.fn(() => self);
  }
  query.insert = jest.fn((rows: unknown) => {
    onInsert?.(rows);
    return self;
  });
  query.single = jest.fn(async () => result);
  query.maybeSingle = jest.fn(async () => result);
  query.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return self;
}

describe("subcontractor invoices POST", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockImplementation(async () => {
      const client = await createClientMock();
      return (await client.auth.getUser()).data.user ?? null;
    });
  });

  it("creates retainage release invoices with prefilled release-only line items", async () => {
    const invoiceInsert = jest.fn();
    const lineItemInsert = jest.fn();
    const queues = new Map<string, MockQuery[]>([
      [
        "subcontracts",
        [
          createQuery({
            data: { id: "sub-1", default_retainage_percent: 10 },
            error: null,
          }),
        ],
      ],
      [
        "subcontractor_invoices",
        [
          createQuery(
            {
              data: {
                id: 99,
                subcontract_id: "sub-1",
                purchase_order_id: null,
                invoice_number: null,
              },
              error: null,
            },
            invoiceInsert,
          ),
          createQuery({ count: 1, error: null }),
          createQuery({ data: null, error: null }),
          createQuery({
            data: [
              {
                id: 1,
                created_at: "2026-04-01T00:00:00Z",
                status: "approved",
                subcontractor_invoice_line_items: [
                  {
                    sort_order: 1,
                    budget_code: "03 00 00",
                    description: "Concrete",
                    scheduled_value: 10000,
                    work_completed_previous: 0,
                    work_completed_period: 5000,
                    materials_stored: 1000,
                    total_completed_stored: 6000,
                    retainage_amount: 500,
                    materials_retainage_amount: 100,
                    previous_work_retainage: 0,
                    previous_materials_retainage: 0,
                    work_retainage_released: 0,
                    materials_retainage_released: 0,
                  },
                ],
              },
            ],
            error: null,
          }),
        ],
      ],
      [
        "billing_periods",
        [
          createQuery({
            data: {
              id: "period-1",
              start_date: "2026-04-01",
              end_date: "2026-04-30",
            },
            error: null,
          }),
        ],
      ],
      [
        "subcontract_sov_items",
        [
          createQuery({
            data: [
              {
                line_number: 1,
                budget_code: "03 00 00",
                description: "Concrete",
                amount: 10000,
                billed_to_date: 6000,
              },
            ],
            error: null,
          }),
        ],
      ],
      [
        "subcontractor_invoice_line_items",
        [createQuery({ data: null, error: null }, lineItemInsert)],
      ],
    ]);

    createClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: "user-1", email: "pm@example.com" } },
          error: null,
        })),
      },
      from: jest.fn((table: string) => {
        const queue = queues.get(table);
        if (!queue?.length) throw new Error(`Unexpected table call: ${table}`);
        return queue.shift();
      }),
    });

    const request = new NextRequest(
      "http://localhost/api/projects/67/invoicing/subcontractor/invoices",
      {
        method: "POST",
        body: JSON.stringify({
          subcontract_id: "sub-1",
          is_retainage_release: true,
        }),
      },
    );

    const response = await POST(request, { params: { projectId: "67" } });
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.data.id).toBe(99);
    expect(invoiceInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "not_invited",
        is_retainage_release: true,
      }),
    );
    expect(lineItemInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        work_completed_period: 0,
        materials_stored: 0,
        retainage_amount: 0,
        materials_retainage_amount: 0,
        previous_work_retainage: 500,
        previous_materials_retainage: 100,
        work_retainage_released: 500,
        materials_retainage_released: 100,
        retainage_released: 600,
      }),
    ]);
  });

  it("fails loudly and writes nothing when no billing period is open", async () => {
    const invoiceInsert = jest.fn();
    const queues = new Map<string, MockQuery[]>([
      [
        "subcontracts",
        [
          createQuery({
            data: { id: "sub-1", default_retainage_percent: 10 },
            error: null,
          }),
        ],
      ],
      ["billing_periods", [createQuery({ data: null, error: null })]],
      [
        "subcontractor_invoices",
        [createQuery({ data: { id: 99 }, error: null }, invoiceInsert)],
      ],
    ]);

    createClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: "user-1", email: "pm@example.com" } },
          error: null,
        })),
      },
      from: jest.fn((table: string) => {
        const queue = queues.get(table);
        if (!queue?.length) throw new Error(`Unexpected table call: ${table}`);
        return queue.shift();
      }),
    });

    const response = await POST(
      new NextRequest(
        "http://localhost/api/projects/67/invoicing/subcontractor/invoices",
        {
          method: "POST",
          body: JSON.stringify({ subcontract_id: "sub-1" }),
        },
      ),
      { params: { projectId: "67" } },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error:
        "No billing period is open for this project. Open or create a billing period before creating an invoice.",
      details:
        "No subcontractor invoice was created because an open billing period is required.",
    });
    expect(invoiceInsert).not.toHaveBeenCalled();
  });
});

describe("subcontractor invoices GET", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses Acumatica commitment payments for paid amount and payment status", async () => {
    const queues = new Map<string, MockQuery[]>([
      [
        "subcontractor_invoices",
        [
          createQuery({
            data: [
              {
                id: 483,
                project_id: 25125,
                invoice_number: "003244",
                status: "pending",
                subcontract_id: "sub-1",
                purchase_order_id: null,
                billing_period_id: null,
                period_start: null,
                period_end: "2026-04-30",
                subcontracts: {
                  contract_number: "SC-1",
                  title: "Roofing",
                  contract_company_id: "company-1",
                },
                purchase_orders: null,
                billing_periods: null,
              },
            ],
            error: null,
          }),
        ],
      ],
      [
        "subcontractor_invoice_line_items",
        [
          createQuery({
            data: [
              {
                invoice_id: 483,
                work_completed_period: 10000,
                materials_stored: 0,
                total_completed_stored: 10000,
                retainage_amount: 1000,
                materials_retainage_amount: 0,
                net_amount_this_period: 9000,
                scheduled_value: 10000,
              },
            ],
            error: null,
          }),
        ],
      ],
      [
        "commitment_payments",
        [
          createQuery({
            data: [
              {
                subcontractor_invoice_id: 483,
                amount: 7024.05,
              },
            ],
            error: null,
          }),
        ],
      ],
      [
        "subcontract_sov_items",
        [
          createQuery({
            data: [
              {
                subcontract_id: "sub-1",
                amount: 10000,
              },
            ],
            error: null,
          }),
        ],
      ],
      [
        "contract_change_orders",
        [
          createQuery({
            data: [],
            error: null,
          }),
        ],
      ],
      [
        "companies",
        [
          createQuery({
            data: [
              {
                id: "company-1",
                name: "Bul-Tec Roofing",
              },
            ],
            error: null,
          }),
        ],
      ],
    ]);

    createClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: "user-1", email: "pm@example.com" } },
          error: null,
        })),
      },
      from: jest.fn((table: string) => {
        const queue = queues.get(table);
        if (!queue?.length) throw new Error(`Unexpected table call: ${table}`);
        return queue.shift();
      }),
    });

    const request = new NextRequest(
      "http://localhost/api/projects/25125/invoicing/subcontractor/invoices",
    );

    const response = await GET(request, { params: { projectId: "25125" } });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toEqual([
      expect.objectContaining({
        id: 483,
        invoice_number: "003244",
        paid_amount: 7024.05,
        payment_status: "partially_paid",
        contract_company_name: "Bul-Tec Roofing",
      }),
    ]);
  });
});

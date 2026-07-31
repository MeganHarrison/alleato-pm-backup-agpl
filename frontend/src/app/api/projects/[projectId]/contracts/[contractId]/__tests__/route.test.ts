import { NextRequest } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions-guard";
import { DELETE } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
  createClient: jest.fn(),
}));

const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;

jest.mock("@/lib/permissions-guard", () => ({
  requirePermission: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const requirePermissionMock = requirePermission as jest.MockedFunction<typeof requirePermission>;

type CountResult = {
  count: number | null;
  error: null | { message: string };
};

type DeleteResult = {
  count: number | null;
  error: null | { message: string };
};

function makeDeleteRequest() {
  return new NextRequest(
    "http://localhost/api/projects/25125/contracts/contract-1",
    { method: "DELETE" },
  );
}

function buildCountQuery(result: CountResult) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue(result),
    or: jest.fn().mockResolvedValue(result),
  };
}

function buildDeleteQuery(result: DeleteResult) {
  const query = {
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn(),
  };
  query.eq.mockReturnValueOnce(query).mockResolvedValueOnce(result);
  return query;
}

function createSupabaseClientStub(
  from: jest.Mock,
): Awaited<ReturnType<typeof createClient>> {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    },
    from,
  } as Awaited<ReturnType<typeof createClient>>;
}

function buildSupabaseMock(results: {
  changeOrders: CountResult;
  paymentApplications: CountResult;
  payments: CountResult;
  ownerInvoices: CountResult;
  deleteResult?: DeleteResult;
}) {
  const queries = {
    changeOrders: buildCountQuery(results.changeOrders),
    paymentApplications: buildCountQuery(results.paymentApplications),
    payments: buildCountQuery(results.payments),
    ownerInvoices: buildCountQuery(results.ownerInvoices),
    primeContracts: buildDeleteQuery(
      results.deleteResult ?? { count: 1, error: null },
    ),
  };

  const from = jest.fn((table: string) => {
    switch (table) {
      case "prime_contract_change_orders":
        return queries.changeOrders;
      case "prime_contract_payment_applications":
        return queries.paymentApplications;
      case "prime_contract_payments":
        return queries.payments;
      case "owner_invoices":
        return queries.ownerInvoices;
      case "prime_contracts":
        return queries.primeContracts;
      default:
        throw new Error(`Unexpected supabase.from("${table}")`);
    }
  });

  return {
    client: createSupabaseClientStub(from),
    from,
    queries,
  };
}

describe("prime contract DELETE route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockImplementation(async () => {
      const client = await createClientMock();
      return (await client.auth.getUser()).data.user ?? null;
    });
    process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
    requirePermissionMock.mockResolvedValue({
      denied: false,
      userId: "user-1",
      personId: "person-1",
    } as Awaited<ReturnType<typeof requirePermission>>);
  });

  it("allows deleting a contract that only has SOV line items", async () => {
    const supabase = buildSupabaseMock({
      changeOrders: { count: 0, error: null },
      paymentApplications: { count: 0, error: null },
      payments: { count: 0, error: null },
      ownerInvoices: { count: 0, error: null },
    });
    createClientMock.mockResolvedValue(supabase.client);

    const response = await DELETE(makeDeleteRequest(), {
      params: Promise.resolve({ projectId: "25125", contractId: "contract-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "Contract deleted successfully",
    });
    expect(supabase.from).not.toHaveBeenCalledWith("contract_line_items");
    expect(supabase.queries.primeContracts.delete).toHaveBeenCalledWith({
      count: "exact",
    });
  });

  it("blocks deleting a contract with financial history", async () => {
    const supabase = buildSupabaseMock({
      changeOrders: { count: 1, error: null },
      paymentApplications: { count: 0, error: null },
      payments: { count: 0, error: null },
      ownerInvoices: { count: 0, error: null },
    });
    createClientMock.mockResolvedValue(supabase.client);

    const response = await DELETE(makeDeleteRequest(), {
      params: Promise.resolve({ projectId: "25125", contractId: "contract-1" }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        details: {
          code: "PRIME_CONTRACT_HAS_FINANCIAL_HISTORY",
          blockerCounts: {
            changeOrders: 1,
            paymentApplications: 0,
            payments: 0,
            ownerInvoices: 0,
          },
        },
      }),
    );
    expect(supabase.from).not.toHaveBeenCalledWith("prime_contracts");
  });
});

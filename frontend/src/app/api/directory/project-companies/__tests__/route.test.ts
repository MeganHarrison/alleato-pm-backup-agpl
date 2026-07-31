import { NextRequest } from "next/server";

import { GET } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

jest.mock("@/lib/guardrails/api", () => ({
  withApiGuardrails:
    (
      _where: string,
      handler: (context: { request: NextRequest }) => Promise<Response>,
    ) =>
    (request: NextRequest) =>
      handler({ request }),
}));

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<
  typeof getApiRouteUser
>;

function makeQuery(result: unknown) {
  const query = {
    select: jest.fn(),
    or: jest.fn(),
    ilike: jest.fn(),
    is: jest.fn(),
    not: jest.fn(),
    in: jest.fn(),
    gte: jest.fn(),
    lte: jest.fn(),
    order: jest.fn(),
    range: jest.fn(),
  };

  query.select.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.ilike.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.not.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.gte.mockReturnValue(query);
  query.lte.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.range.mockResolvedValue(result);

  const supabase = {
    from: jest.fn(() => query),
  };

  createClientMock.mockResolvedValue(supabase as never);
  return { query };
}

describe("GET /api/directory/project-companies", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as never);
  });

  it("returns the hidden Acumatica fields needed by the directory table", async () => {
    const { query } = makeQuery({
      data: [
        {
          id: "company-1",
          name: "Vendor Co.",
          acumatica_vendor_id: "VENDOR-1",
          tax_id: "12-3456789",
          legal_name: "Vendor Company, LLC",
          vendor_class: "Trade",
          terms: "Net 30",
          payment_method: "ACH",
          ap_account: "20000",
          cash_account: "10100",
          is_1099_vendor: true,
          is_foreign_entity: false,
          is_labor_union: false,
          is_tax_agency: false,
          acumatica_sync_at: "2026-07-22T12:00:00.000Z",
          license_number: "LIC-123",
        },
      ],
      error: null,
      count: 1,
    });

    const response = await GET(
      new NextRequest("http://localhost/api/directory/project-companies"),
    );
    const body = await response.json();

    expect(query.select).toHaveBeenCalledWith(
      expect.stringContaining("tax_id, legal_name, vendor_class"),
      { count: "exact" },
    );
    expect(query.select).toHaveBeenCalledWith(
      expect.stringContaining("is_1099_vendor, is_foreign_entity"),
      { count: "exact" },
    );
    expect(body.data[0]).toMatchObject({
      erp_vendor_id: "VENDOR-1",
      tax_id: "12-3456789",
      legal_name: "Vendor Company, LLC",
      vendor_class: "Trade",
      terms: "Net 30",
      payment_method: "ACH",
      ap_account: "20000",
      cash_account: "10100",
      is_1099_vendor: true,
      is_foreign_entity: false,
      is_labor_union: false,
      is_tax_agency: false,
      acumatica_sync_at: "2026-07-22T12:00:00.000Z",
      license_number: "LIC-123",
    });
  });
});

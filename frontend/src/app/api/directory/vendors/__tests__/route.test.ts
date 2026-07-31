import { NextRequest } from "next/server";

import { GET } from "../route";
import { createClient } from "@/lib/supabase/server";

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
}));

const createClientMock = createClient as jest.MockedFunction<
  typeof createClient
>;

function makeQuery(result: unknown) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    or: jest.fn(),
    order: jest.fn(),
    range: jest.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.range.mockResolvedValue(result);

  const supabase = {
    from: jest.fn(() => query),
  };

  createClientMock.mockResolvedValue(supabase as never);

  return { query, supabase };
}

describe("GET /api/directory/vendors", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("accepts unified table filters, sorting, and pagination params", async () => {
    const { query, supabase } = makeQuery({
      data: [{ id: "vendor-1", name: "Active Vendor" }],
      error: null,
      count: 44,
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/api/directory/vendors?search=paint&status=active&vendor_class=Subcontractor&payment_method=ACH&sort=status:desc&page=2&per_page=25",
      ),
      { params: Promise.resolve({}) },
    );
    const body = await response.json();

    expect(supabase.from).toHaveBeenCalledWith("companies");
    expect(query.select).toHaveBeenCalledWith(
      expect.stringContaining("id, name, legal_name"),
      { count: "exact" },
    );
    expect(query.select).toHaveBeenCalledWith(
      expect.not.stringContaining("*"),
      { count: "exact" },
    );
    expect(query.eq).toHaveBeenCalledWith("is_vendor", true);
    expect(query.eq).toHaveBeenCalledWith("status", "active");
    expect(query.eq).toHaveBeenCalledWith("vendor_class", "Subcontractor");
    expect(query.eq).toHaveBeenCalledWith("payment_method", "ACH");
    expect(query.or).toHaveBeenCalledWith(
      expect.stringContaining("name.ilike.%paint%"),
    );
    expect(query.order).toHaveBeenCalledWith("status", { ascending: false });
    expect(query.range).toHaveBeenCalledWith(25, 49);
    expect(body.pagination).toEqual({
      page: 2,
      per_page: 25,
      total: 44,
      total_pages: 2,
    });
  });

  it("falls back to safe pagination and sort values for invalid params", async () => {
    const { query } = makeQuery({
      data: [],
      error: null,
      count: 0,
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/api/directory/vendors?sort=unsupported_field:desc&page=-3&per_page=bad",
      ),
      { params: Promise.resolve({}) },
    );
    const body = await response.json();

    expect(query.order).toHaveBeenCalledWith("name", { ascending: false });
    expect(query.range).toHaveBeenCalledWith(0, 49);
    expect(body.pagination).toEqual({
      page: 1,
      per_page: 50,
      total: 0,
      total_pages: 0,
    });
  });
});

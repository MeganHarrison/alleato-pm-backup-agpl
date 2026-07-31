import { NextRequest } from "next/server";

import { GET } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

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

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;
const createServiceClientMock = createServiceClient as jest.MockedFunction<
  typeof createServiceClient
>;

function mockAuthUsers(
  users: Array<{ email: string; last_sign_in_at: string | null }>,
): void {
  createServiceClientMock.mockReturnValue({
    auth: {
      admin: {
        listUsers: jest.fn().mockResolvedValue({ data: { users }, error: null }),
      },
    },
  } as never);
}

function makeQuery(result: unknown) {
  const query = {
    select: jest.fn(),
    ilike: jest.fn(),
    eq: jest.fn(),
    or: jest.fn(),
    order: jest.fn(),
    range: jest.fn(),
  };

  query.select.mockReturnValue(query);
  query.ilike.mockReturnValue(query);
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

describe("GET /api/directory/employees/table", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<
      ReturnType<typeof getApiRouteUser>
    >);
  });

  it("defaults to active Alleato employees when status is omitted", async () => {
    const { query, supabase } = makeQuery({
      data: [
        {
          id: "person-1",
          first_name: "Active",
          last_name: "Employee",
          email: "active@example.com",
          job_title: null,
          business_unit: "Operations",
          phone_business: null,
          phone_mobile: null,
          status: "active",
          person_type: "employee",
          created_at: "2026-06-29T00:00:00.000Z",
          company: "Alleato Group",
          auth_user_id: "auth-1",
        },
      ],
      error: null,
      count: 1,
    });
    mockAuthUsers([
      { email: "active@example.com", last_sign_in_at: "2026-06-30T00:00:00.000Z" },
    ]);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/directory/employees/table?sort=business_unit&sort_dir=asc&page=1",
      ),
    );
    const body = await response.json();

    expect(supabase.from).toHaveBeenCalledWith("people");
    expect(query.ilike).toHaveBeenCalledWith("company", "%Alleato Group%");
    expect(query.eq).toHaveBeenCalledWith("status", "active");
    expect(query.order).toHaveBeenCalledWith("business_unit", {
      ascending: true,
      nullsFirst: false,
    });
    expect(body.data).toEqual([
      expect.objectContaining({
        id: "person-1",
        full_name: "Active Employee",
        status: "active",
        access_status: "active",
      }),
    ]);
  });

  it("marks an account that has never signed in as invited", async () => {
    makeQuery({
      data: [
        {
          id: "person-2",
          first_name: "Invited",
          last_name: "Employee",
          email: "invited@example.com",
          job_title: null,
          business_unit: null,
          phone_business: null,
          phone_mobile: null,
          status: "active",
          person_type: "employee",
          created_at: "2026-06-29T00:00:00.000Z",
          company: "Alleato Group",
          auth_user_id: "auth-2",
        },
      ],
      error: null,
      count: 1,
    });
    mockAuthUsers([{ email: "invited@example.com", last_sign_in_at: null }]);

    const response = await GET(
      new NextRequest("http://localhost/api/directory/employees/table?page=1"),
    );
    const body = await response.json();

    expect(body.data).toEqual([
      expect.objectContaining({ id: "person-2", access_status: "invited" }),
    ]);
  });

  it("honors an explicit inactive status filter", async () => {
    const { query } = makeQuery({
      data: [],
      error: null,
      count: 0,
    });
    mockAuthUsers([]);

    await GET(
      new NextRequest(
        "http://localhost/api/directory/employees/table?status=inactive&page=1",
      ),
    );

    expect(query.eq).toHaveBeenCalledWith("status", "inactive");
  });
});

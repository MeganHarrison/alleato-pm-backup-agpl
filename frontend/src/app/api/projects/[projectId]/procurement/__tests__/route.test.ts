process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), getApiRouteUser: jest.fn() }));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;
const context = { params: Promise.resolve({ projectId: "43" }) };

function listQuery(result: { data: unknown; error: unknown }) {
  const query: any = { select: jest.fn(), eq: jest.fn(), order: jest.fn() };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.order.mockResolvedValue(result);
  return query;
}

describe("procurement log route", () => {
  beforeEach(() => jest.clearAllMocks());

  it("scopes the log to its project", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as never);
    const query = listQuery({ data: [], error: null });
    createClientMock.mockResolvedValue({ from: jest.fn().mockReturnValue(query) } as never);

    const response = await GET(new NextRequest("http://localhost/api/projects/43/procurement"), context);

    expect(response.status).toBe(200);
    expect(query.eq).toHaveBeenCalledWith("project_id", 43);
  });

  it("rejects unauthenticated creation before calling the RPC", async () => {
    getApiRouteUserMock.mockResolvedValue(null);
    const rpc = jest.fn(); createClientMock.mockResolvedValue({ rpc } as never);

    const response = await POST(new NextRequest("http://localhost/api/projects/43/procurement", { method: "POST", body: JSON.stringify({ title: "Switchgear" }) }), context);

    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("creates items through the guarded canonical RPC", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as never);
    const rpc = jest.fn().mockResolvedValue({ data: { id: "item-1", title: "Switchgear" }, error: null });
    createClientMock.mockResolvedValue({ rpc } as never);

    const response = await POST(new NextRequest("http://localhost/api/projects/43/procurement", { method: "POST", body: JSON.stringify({ title: "Switchgear" }) }), context);

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("create_procurement_item", expect.objectContaining({ p_project_id: 43, p_title: "Switchgear" }));
  });
});

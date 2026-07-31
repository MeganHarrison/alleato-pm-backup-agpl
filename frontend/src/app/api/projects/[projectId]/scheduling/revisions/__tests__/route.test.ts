process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), getApiRouteUser: jest.fn() }));
const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;
const context = { params: Promise.resolve({ projectId: "43" }) };

function query(result: { data: unknown; error: unknown }) {
  const value = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn() };
  value.select.mockReturnValue(value); value.eq.mockReturnValue(value); value.maybeSingle.mockResolvedValue(result);
  return value;
}

describe("current published schedule revision (?current=true)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns only the authorized published revision rather than falling back to a draft", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    const projectQuery = query({ data: { current_schedule_revision_id: "published" }, error: null });
    const revisionQuery = query({ data: { id: "published", status: "published", revision_number: 2 }, error: null });
    const client = { from: jest.fn().mockReturnValueOnce(projectQuery).mockReturnValueOnce(revisionQuery) };
    createClientMock.mockResolvedValue(client as never);

    const response = await GET(new NextRequest("http://localhost/api/projects/43/scheduling/revisions?current=true"), context);

    expect(response.status).toBe(200);
    expect(projectQuery.eq).toHaveBeenCalledWith("id", 43);
    expect(revisionQuery.eq).toHaveBeenCalledWith("id", "published");
    expect(revisionQuery.eq).toHaveBeenCalledWith("status", "published");
    await expect(response.json()).resolves.toEqual({ data: { id: "published", status: "published", revision_number: 2 } });
  });
});

describe("schedule revision collection API", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects an unauthenticated snapshot before invoking the guarded RPC", async () => {
    getApiRouteUserMock.mockResolvedValue(null);
    const rpc = jest.fn();
    createClientMock.mockResolvedValue({ rpc } as never);

    const response = await POST(new NextRequest("http://localhost/api/projects/43/scheduling/revisions", { method: "POST", body: "{}" }), context);

    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("creates a revision snapshot through the database guardrail", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    const rpc = jest.fn().mockResolvedValue({ data: { id: "revision-1", status: "draft" }, error: null });
    createClientMock.mockResolvedValue({ rpc } as never);

    const response = await POST(new NextRequest("http://localhost/api/projects/43/scheduling/revisions", { method: "POST", body: JSON.stringify({}) }), context);

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("create_schedule_revision_snapshot", { p_project_id: 43 });
  });
});

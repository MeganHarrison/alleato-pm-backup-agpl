process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";
import { POST } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), getApiRouteUser: jest.fn() }));
const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;
const context = { params: Promise.resolve({ projectId: "43" }) };

describe("schedule baseline collection API", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects an unauthenticated capture before invoking the guarded RPC", async () => {
    getApiRouteUserMock.mockResolvedValue(null);
    const rpc = jest.fn();
    createClientMock.mockResolvedValue({ rpc } as never);
    const response = await POST(new NextRequest("http://localhost/api/projects/43/scheduling/baselines", { method: "POST", body: "{}" }), context);
    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("validates the baseline name and revision before any write", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    const rpc = jest.fn();
    createClientMock.mockResolvedValue({ rpc } as never);
    const response = await POST(new NextRequest("http://localhost/api/projects/43/scheduling/baselines", { method: "POST", body: JSON.stringify({ name: " ", revision_id: "bad" }) }), context);
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("captures through the manager-guarded database transaction", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    const rpc = jest.fn().mockResolvedValue({ data: { id: "baseline-1", is_active: true }, error: null });
    createClientMock.mockResolvedValue({ rpc } as never);
    const response = await POST(new NextRequest("http://localhost/api/projects/43/scheduling/baselines", { method: "POST", body: JSON.stringify({ name: "Owner baseline", revision_id: "11111111-1111-4111-8111-111111111111", activate: true }) }), context);
    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("capture_schedule_baseline", { p_project_id: 43, p_revision_id: "11111111-1111-4111-8111-111111111111", p_name: "Owner baseline", p_activate: true });
  });
});

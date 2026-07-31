process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";
import { DELETE, POST } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), getApiRouteUser: jest.fn() }));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;
const procurementItemId = "11111111-1111-4111-8111-111111111111";
const submittalId = "22222222-2222-4222-8222-222222222222";
const context = { params: Promise.resolve({ projectId: "43", procurementItemId }) };

describe("procurement item submittal link", () => {
  beforeEach(() => jest.clearAllMocks());

  it("fails closed when the submittal belongs to a different project", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as never);
    createClientMock.mockResolvedValue({ rpc: jest.fn().mockResolvedValue({ data: null, error: { code: "42501", message: "Submittal does not belong to this project." } }) } as never);

    const response = await POST(new NextRequest(`http://localhost/api/projects/43/procurement/${procurementItemId}/submittals`, { method: "POST", body: JSON.stringify({ submittal_id: submittalId }) }), context);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Submittal does not belong to this project." });
  });

  it("removes a source link through the guarded RPC", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as never);
    const rpc = jest.fn().mockResolvedValue({ data: null, error: null });
    createClientMock.mockResolvedValue({ rpc } as never);

    const response = await DELETE(new NextRequest(`http://localhost/api/projects/43/procurement/${procurementItemId}/submittals?submittalId=${submittalId}`, { method: "DELETE" }), context);

    expect(response.status).toBe(204);
    expect(rpc).toHaveBeenCalledWith("unlink_procurement_item_submittal", { p_project_id: 43, p_procurement_item_id: procurementItemId, p_submittal_id: submittalId });
  });
});

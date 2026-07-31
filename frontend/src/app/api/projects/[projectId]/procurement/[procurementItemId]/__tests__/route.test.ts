process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";
import { PATCH } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), getApiRouteUser: jest.fn() }));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;
const procurementItemId = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ projectId: "43", procurementItemId }) };

describe("procurement item route", () => {
  beforeEach(() => jest.clearAllMocks());

  it("maps a same-project missing item from the guarded RPC to not found", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as never);
    createClientMock.mockResolvedValue({ rpc: jest.fn().mockResolvedValue({ data: null, error: { code: "P0002", message: "Procurement item not found in this project." } }) } as never);

    const response = await PATCH(new NextRequest(`http://localhost/api/projects/43/procurement/${procurementItemId}`, { method: "PATCH", body: JSON.stringify({ title: "Switchgear" }) }), context);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Procurement item not found in this project." });
  });
});

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";
import { DELETE, POST } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), getApiRouteUser: jest.fn() }));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;
const procurementItemId = "11111111-1111-4111-8111-111111111111";
const scheduleTaskId = "33333333-3333-4333-8333-333333333333";
const context = { params: Promise.resolve({ projectId: "43", procurementItemId }) };

describe("procurement item schedule task link", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calls the guarded task-link RPC with the selected project", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as never);
    const rpc = jest.fn().mockResolvedValue({ data: { id: "link-1" }, error: null });
    createClientMock.mockResolvedValue({ rpc } as never);

    const response = await POST(new NextRequest(`http://localhost/api/projects/43/procurement/${procurementItemId}/schedule-tasks`, { method: "POST", body: JSON.stringify({ schedule_task_id: scheduleTaskId }) }), context);

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("link_procurement_item_schedule_task", { p_project_id: 43, p_procurement_item_id: procurementItemId, p_schedule_task_id: scheduleTaskId });
  });

  it("removes a schedule link through the guarded RPC", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as never);
    const rpc = jest.fn().mockResolvedValue({ data: null, error: null });
    createClientMock.mockResolvedValue({ rpc } as never);

    const response = await DELETE(new NextRequest(`http://localhost/api/projects/43/procurement/${procurementItemId}/schedule-tasks?scheduleTaskId=${scheduleTaskId}`, { method: "DELETE" }), context);

    expect(response.status).toBe(204);
    expect(rpc).toHaveBeenCalledWith("unlink_procurement_item_schedule_task", { p_project_id: 43, p_procurement_item_id: procurementItemId, p_schedule_task_id: scheduleTaskId });
  });
});

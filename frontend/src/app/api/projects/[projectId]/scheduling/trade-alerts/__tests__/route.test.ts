process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";
import { POST } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), getApiRouteUser: jest.fn() }));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;
const context = { params: Promise.resolve({ projectId: "43" }) };
const body = {
  revisionId: "11111111-1111-4111-8111-111111111111",
  sourceTaskId: "22222222-2222-4222-8222-222222222222",
  changeKind: "date_changed",
  title: "Electrical rough-in dates changed",
};

describe("trade schedule alerts API", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects unauthenticated alert requests before invoking the alert RPC", async () => {
    getApiRouteUserMock.mockResolvedValue(null);
    const rpc = jest.fn();
    createClientMock.mockResolvedValue({ rpc } as never);

    const response = await POST(new NextRequest("http://localhost/api/projects/43/scheduling/trade-alerts", { method: "POST", body: JSON.stringify(body) }), context);

    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reports a replay as a duplicate without another delivery", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    const rpc = jest.fn().mockResolvedValue({ data: null, error: null });
    createClientMock.mockResolvedValue({ rpc } as never);

    const response = await POST(new NextRequest("http://localhost/api/projects/43/scheduling/trade-alerts", { method: "POST", body: JSON.stringify(body) }), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ delivered: false, duplicate: true });
  });

  it("recognizes PostgREST's null composite replay shape", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    const rpc = jest.fn().mockResolvedValue({
      data: { id: null, user_id: null, project_id: null },
      error: null,
    });
    createClientMock.mockResolvedValue({ rpc } as never);

    const response = await POST(new NextRequest("http://localhost/api/projects/43/scheduling/trade-alerts", { method: "POST", body: JSON.stringify(body) }), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ delivered: false, duplicate: true });
  });

  it("fails loudly when the alert RPC returns a malformed notification", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    const rpc = jest.fn().mockResolvedValue({
      data: { id: null, user_id: "unexpected-user", project_id: 43 },
      error: null,
    });
    createClientMock.mockResolvedValue({ rpc } as never);

    const response = await POST(new NextRequest("http://localhost/api/projects/43/scheduling/trade-alerts", { method: "POST", body: JSON.stringify(body) }), context);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error_code: "DB_ERROR",
      error_message: "Schedule alert delivery returned an invalid notification.",
    });
  });

  it("emits one actionable notification from the published schedule source", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    const rpc = jest.fn().mockResolvedValue({ data: { id: "notification-1", metadata: { revision_id: body.revisionId, source_task_id: body.sourceTaskId } }, error: null });
    createClientMock.mockResolvedValue({ rpc } as never);

    const response = await POST(new NextRequest("http://localhost/api/projects/43/scheduling/trade-alerts", { method: "POST", body: JSON.stringify({ ...body, body: "Review the new finish date." }) }), context);

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("emit_schedule_trade_alert", {
      p_project_id: 43,
      p_revision_id: body.revisionId,
      p_source_task_id: body.sourceTaskId,
      p_change_kind: "date_changed",
      p_title: body.title,
      p_body: "Review the new finish date.",
    });
    await expect(response.json()).resolves.toEqual({ delivered: true, notification: { id: "notification-1", metadata: { revision_id: body.revisionId, source_task_id: body.sourceTaskId } } });
  });
});

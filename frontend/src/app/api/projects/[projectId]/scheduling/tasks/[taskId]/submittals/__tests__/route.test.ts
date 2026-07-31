process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";
import { GET, POST, DELETE } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), getApiRouteUser: jest.fn() }));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;
const context = { params: Promise.resolve({ projectId: "43", taskId: "task-1" }) };
const submittalId = "11111111-1111-4111-8111-111111111111";

function chainableQuery(result: { data: unknown; error: unknown }) {
  const query: {
    select: jest.Mock;
    eq: jest.Mock;
    single: jest.Mock;
    then: PromiseLike<unknown>["then"];
  } = {
    select: jest.fn(),
    eq: jest.fn(),
    single: jest.fn(),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.single.mockResolvedValue(result);
  return query;
}

describe("GET schedule task submittal risk", () => {
  beforeEach(() => jest.clearAllMocks());

  it("derives dependent-work project scope through schedule_tasks, not a nonexistent dependency project column", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    const taskQuery = chainableQuery({ data: { id: "task-1", name: "Install", start_date: "2026-07-30" }, error: null });
    const linksQuery = chainableQuery({ data: [], error: null });
    const dependencyQuery = chainableQuery({ data: [{ schedule_tasks: { name: "Inspection", project_id: 43 } }], error: null });
    const from = jest.fn()
      .mockReturnValueOnce(taskQuery)
      .mockReturnValueOnce(linksQuery)
      .mockReturnValueOnce(dependencyQuery);
    createClientMock.mockResolvedValue({ from } as never);

    const response = await GET(new NextRequest("http://localhost/api/projects/43/scheduling/tasks/task-1/submittals"), context);

    expect(response.status).toBe(200);
    expect(dependencyQuery.eq).toHaveBeenCalledWith("schedule_tasks.project_id", 43);
    expect(dependencyQuery.eq).not.toHaveBeenCalledWith("project_id", 43);
  });

  it("fails loudly when the authoritative dependent-work read fails", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    const taskQuery = chainableQuery({ data: { id: "task-1", name: "Install", start_date: "2026-07-30" }, error: null });
    const linksQuery = chainableQuery({ data: [], error: null });
    const dependencyQuery = chainableQuery({ data: null, error: { message: "column schedule_dependencies.project_id does not exist" } });
    const from = jest.fn()
      .mockReturnValueOnce(taskQuery)
      .mockReturnValueOnce(linksQuery)
      .mockReturnValueOnce(dependencyQuery);
    createClientMock.mockResolvedValue({ from } as never);

    const response = await GET(new NextRequest("http://localhost/api/projects/43/scheduling/tasks/task-1/submittals"), context);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "column schedule_dependencies.project_id does not exist" });
  });
});

describe("POST schedule task submittal link", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects an unauthenticated link before invoking the guarded RPC", async () => {
    getApiRouteUserMock.mockResolvedValue(null);
    const rpc = jest.fn();
    createClientMock.mockResolvedValue({ rpc } as never);

    const response = await POST(new NextRequest("http://localhost/api/projects/43/scheduling/tasks/task-1/submittals", { method: "POST", body: JSON.stringify({ submittal_id: submittalId }) }), context);

    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends same-project links through the guarded RPC", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    const client = { rpc: jest.fn().mockResolvedValue({ data: { id: "link-1", task_id: "task-1", submittal_id: submittalId }, error: null }) };
    createClientMock.mockResolvedValue(client as never);

    const response = await POST(new NextRequest("http://localhost/api/projects/43/scheduling/tasks/task-1/submittals", { method: "POST", body: JSON.stringify({ submittal_id: submittalId }) }), context);

    expect(response.status).toBe(201);
    expect(client.rpc).toHaveBeenCalledWith("link_schedule_task_submittal", { p_project_id: 43, p_task_id: "task-1", p_submittal_id: submittalId });
  });

  it("surfaces cross-project links as forbidden", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    createClientMock.mockResolvedValue({ rpc: jest.fn().mockResolvedValue({ data: null, error: { code: "42501", message: "Submittal does not belong to this project." } }) } as never);

    const response = await POST(new NextRequest("http://localhost/api/projects/43/scheduling/tasks/task-1/submittals", { method: "POST", body: JSON.stringify({ submittal_id: submittalId }) }), context);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Submittal does not belong to this project." });
  });
});

describe("DELETE schedule task submittal link", () => {
  beforeEach(() => jest.clearAllMocks());
  it("rejects unauthenticated unlink before invoking the guarded RPC", async () => {
    getApiRouteUserMock.mockResolvedValue(null);
    const rpc = jest.fn(); createClientMock.mockResolvedValue({ rpc } as never);
    const response = await DELETE(new NextRequest(`http://localhost/api/projects/43/scheduling/tasks/task-1/submittals?submittalId=${submittalId}`, { method: "DELETE" }), context);
    expect(response.status).toBe(401); expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects a missing or invalid submittalId before invoking the guarded RPC", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    const rpc = jest.fn(); createClientMock.mockResolvedValue({ rpc } as never);
    const response = await DELETE(new NextRequest("http://localhost/api/projects/43/scheduling/tasks/task-1/submittals", { method: "DELETE" }), context);
    expect(response.status).toBe(400); expect(rpc).not.toHaveBeenCalled();
  });
  it("unlinks through the guarded RPC", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    const rpc = jest.fn().mockResolvedValue({ data: null, error: null }); createClientMock.mockResolvedValue({ rpc } as never);
    const response = await DELETE(new NextRequest(`http://localhost/api/projects/43/scheduling/tasks/task-1/submittals?submittalId=${submittalId}`, { method: "DELETE" }), context);
    expect(response.status).toBe(204);
    expect(rpc).toHaveBeenCalledWith("unlink_schedule_task_submittal", { p_project_id: 43, p_task_id: "task-1", p_submittal_id: submittalId });
  });
});

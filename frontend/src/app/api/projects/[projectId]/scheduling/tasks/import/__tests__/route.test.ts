process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";
import { POST } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const rpcMock = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;

const task = {
  external_id: "1",
  parent_external_id: null,
  predecessors: [],
  name: "Mobilize",
  wbs_code: "1",
  start_date: "2026-08-01",
  finish_date: "2026-08-01",
  duration_days: 1,
  percent_complete: 0,
  status: "not_started",
  is_milestone: false,
  sort_order: 1,
};

function request(body: unknown) {
  return new NextRequest("http://localhost/api/projects/43/scheduling/tasks/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/projects/[projectId]/scheduling/tasks/import", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    createClientMock.mockResolvedValue({ rpc: rpcMock } as never);
    rpcMock.mockResolvedValue({ data: [{ imported: 1, deleted_existing: 2, dependencies_imported: 0 }], error: null });
  });

  it("rejects malformed dependency references before calling the replacement transaction", async () => {
    const response = await POST(request({
      replaceExisting: true,
      tasks: [{ ...task, predecessors: [{ predecessor_external_id: "missing", dependency_type: "finish_to_start", lag_days: 0 }] }],
    }), { params: Promise.resolve({ projectId: "43" }) });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Task "Mobilize" references missing predecessor "missing".',
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("uses one atomic RPC instead of deleting and inserting from the route", async () => {
    const response = await POST(request({ replaceExisting: true, tasks: [task] }), {
      params: Promise.resolve({ projectId: "43" }),
    });

    expect(response.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith("replace_schedule_import_atomic", {
      p_project_id: 43,
      p_tasks: [task],
      p_dependencies: [],
      p_replace_existing: true,
    });
    await expect(response.json()).resolves.toMatchObject({
      imported: 1,
      deletedExisting: 2,
      dependenciesImported: 0,
      failed: 0,
    });
  });
});

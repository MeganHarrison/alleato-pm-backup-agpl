process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";
import { GET } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), getApiRouteUser: jest.fn() }));
const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;
const baselineId = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ projectId: "43", baselineId }) };

function query(result: { data: unknown; error: unknown }) {
  const value = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    maybeSingle: jest.fn(),
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => Promise.resolve(result).then(resolve),
  };
  value.select.mockReturnValue(value);
  value.eq.mockReturnValue(value);
  value.order.mockReturnValue(value);
  value.maybeSingle.mockResolvedValue(result);
  return value;
}

describe("schedule baseline comparison API", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects unauthenticated comparison before reading a baseline", async () => {
    getApiRouteUserMock.mockResolvedValue(null);
    const from = jest.fn();
    createClientMock.mockResolvedValue({ from } as never);
    const response = await GET(new NextRequest(`http://localhost/api/projects/43/scheduling/baselines/${baselineId}/comparison`), context);
    expect(response.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it("does not expose a baseline from another project", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    const baseline = query({ data: null, error: null });
    createClientMock.mockResolvedValue({ from: jest.fn().mockReturnValue(baseline) } as never);
    const response = await GET(new NextRequest(`http://localhost/api/projects/43/scheduling/baselines/${baselineId}/comparison`), context);
    expect(response.status).toBe(404);
    expect(baseline.eq).toHaveBeenCalledWith("project_id", 43);
  });

  it("fails loudly instead of calculating with a missing baseline calendar", async () => {
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    const baseline = query({ data: { id: baselineId, project_id: 43, revision_id: "revision-1", name: "Owner baseline", is_active: true }, error: null });
    const tasks = query({ data: [], error: null });
    const calendar = query({ data: null, error: null });
    const revision = query({ data: { snapshot_context_provenance: "captured" }, error: null });
    const from = jest.fn()
      .mockReturnValueOnce(baseline)
      .mockReturnValueOnce(tasks)
      .mockReturnValueOnce(calendar)
      .mockReturnValueOnce(revision);
    createClientMock.mockResolvedValue({ from } as never);

    const response = await GET(new NextRequest(`http://localhost/api/projects/43/scheduling/baselines/${baselineId}/comparison`), context);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error_code: "PRECONDITION_FAILED",
      error_message: "The baseline calendar snapshot is missing; comparison was not calculated.",
    });
  });
});

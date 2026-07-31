process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";

import { ScheduleResourceService, ScheduleResourceServiceError } from "@/lib/services/schedule-resource-service";
import { previewScheduleResourceLeveling } from "@/lib/scheduling/schedule-resource-leveling-preview";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { DELETE, GET, POST, PUT } from "../route";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), getApiRouteUser: jest.fn() }));
jest.mock("@/lib/services/schedule-resource-service", () => ({
  ...jest.requireActual("@/lib/services/schedule-resource-service"),
  ScheduleResourceService: jest.fn(),
}));
jest.mock("@/lib/scheduling/schedule-resource-leveling-preview", () => ({ previewScheduleResourceLeveling: jest.fn() }));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;
const previewMock = previewScheduleResourceLeveling as jest.MockedFunction<typeof previewScheduleResourceLeveling>;
const getProjectRoster = jest.fn();
const getCapacityRange = jest.fn();
const getCapacityProfile = jest.fn();
const replaceCapacityProfile = jest.fn();
const loadLevelingContext = jest.fn();
const getCostModel = jest.fn();
const upsertCostResource = jest.fn();
const deleteCostResource = jest.fn();
const resourceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const context = { params: Promise.resolve({ projectId: "67" }) };

describe("consolidated schedule resources API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
    createClientMock.mockResolvedValue({} as never);
    (ScheduleResourceService as jest.Mock).mockImplementation(() => ({
      getProjectRoster,
      getCapacityRange,
      getCapacityProfile,
      replaceCapacityProfile,
      loadLevelingContext,
      getCostModel,
      upsertCostResource,
      deleteCostResource,
    }));
  });

  it("requires authentication before creating a database client", async () => {
    getApiRouteUserMock.mockResolvedValue(null);
    const response = await GET(new NextRequest("http://localhost/api/projects/67/scheduling/resources"), context);
    expect(response.status).toBe(401);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid project identifier", async () => {
    const response = await GET(new NextRequest("http://localhost/api/projects/nope/scheduling/resources"), {
      params: Promise.resolve({ projectId: "nope" }),
    });
    expect(response.status).toBe(400);
    expect(getProjectRoster).not.toHaveBeenCalled();
  });

  it("returns the roster when no view is requested", async () => {
    getProjectRoster.mockResolvedValue({ resources: [], candidates: [], assignments: [], can_manage: true, legacy_assignment_count: 0 });
    const response = await GET(new NextRequest("http://localhost/api/projects/67/scheduling/resources"), context);
    expect(response.status).toBe(200);
    expect(getProjectRoster).toHaveBeenCalledWith(67);
    await expect(response.json()).resolves.toMatchObject({ can_manage: true, legacy_assignment_count: 0 });
  });

  it("returns the persisted cost model", async () => {
    getCostModel.mockResolvedValue({
      project_id: 67,
      can_manage: true,
      resources: [],
      assignments: [],
    });
    const response = await GET(
      new NextRequest("http://localhost/api/projects/67/scheduling/resources?view=cost"),
      context,
    );
    expect(response.status).toBe(200);
    expect(getCostModel).toHaveBeenCalledWith(67);
    await expect(response.json()).resolves.toMatchObject({
      project_id: 67,
      can_manage: true,
    });
  });

  it.each([
    ["start=bad&finish=2026-08-10", /valid start and finish/i],
    ["start=2026-08-10&finish=2026-08-01", /must not be before/i],
    ["start=2026-01-01&finish=2026-04-03", /limited to 92/i],
  ])("rejects an invalid or unbounded capacity range: %s", async (query, message) => {
    const response = await GET(new NextRequest(`http://localhost/api/projects/67/scheduling/resources?view=capacity&${query}`), context);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error_message: expect.stringMatching(message) });
    expect(getCapacityRange).not.toHaveBeenCalled();
  });

  it("returns a bounded capacity range", async () => {
    getCapacityRange.mockResolvedValue({ project_id: 67, range: { start: "2026-08-01", finish: "2026-08-10" }, profiles: [] });
    const response = await GET(new NextRequest("http://localhost/api/projects/67/scheduling/resources?view=capacity&start=2026-08-01&finish=2026-08-10"), context);
    expect(response.status).toBe(200);
    expect(getCapacityRange).toHaveBeenCalledWith(67, "2026-08-01", "2026-08-10");
  });

  it("loads one selected capacity profile", async () => {
    getCapacityProfile.mockResolvedValue({
      profile_id: null,
      project_id: 67,
      resource_id: resourceId,
      configured: false,
      version: null,
      coverage_start_date: null,
      coverage_finish_date: null,
      weekday_overrides: [],
      exceptions: [],
    });
    const response = await GET(new NextRequest(`http://localhost/api/projects/67/scheduling/resources?view=capacity-profile&resourceId=${resourceId}`), context);
    expect(response.status).toBe(200);
    expect(getCapacityProfile).toHaveBeenCalledWith(67, resourceId);
  });

  it.each([
    [{ expected_version: null, weekday_overrides: [{ weekday: 1, capacity_percent: 100 }, { weekday: 1, capacity_percent: 50 }], exceptions: [] }, /weekday.*only one/i],
    [{ expected_version: null, weekday_overrides: [], exceptions: [{ date: "2026-08-03", capacity_percent: 100 }, { date: "2026-08-03", capacity_percent: 0 }] }, /date.*only one/i],
    [{ expected_version: null, weekday_overrides: [{ weekday: 1, capacity_percent: 101 }], exceptions: [] }, /0 through 100/i],
    [{ expected_version: null, weekday_overrides: [], exceptions: [{ date: "bad", capacity_percent: 50 }] }, /0 through 100/i],
  ])("rejects malformed capacity replacement input", async (body, message) => {
    const response = await PUT(new NextRequest(`http://localhost/api/projects/67/scheduling/resources?view=capacity-profile&resourceId=${resourceId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }), context);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error_message: expect.stringMatching(message) });
    expect(replaceCapacityProfile).not.toHaveBeenCalled();
  });

  it("replaces one complete capacity profile", async () => {
    const body = {
      expected_version: 3,
      weekday_overrides: [{ weekday: 1, capacity_percent: 80 }],
      exceptions: [{ date: "2026-08-03", capacity_percent: 0, reason: "Vacation" }],
    };
    replaceCapacityProfile.mockResolvedValue({ configured: true, ...body });
    const response = await PUT(new NextRequest(`http://localhost/api/projects/67/scheduling/resources?view=capacity-profile&resourceId=${resourceId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }), context);
    expect(response.status).toBe(200);
    expect(replaceCapacityProfile).toHaveBeenCalledWith(67, resourceId, body);
  });

  it("returns a conflict when a newer capacity profile was saved", async () => {
    replaceCapacityProfile.mockRejectedValue(new ScheduleResourceServiceError(
      "The capacity profile changed after it was loaded.",
      "rpc",
      { code: "40001", message: "The capacity profile changed after it was loaded." },
    ));
    const response = await PUT(new NextRequest(`http://localhost/api/projects/67/scheduling/resources?view=capacity-profile&resourceId=${resourceId}`, {
      method: "PUT",
      body: JSON.stringify({ expected_version: 3, weekday_overrides: [], exceptions: [] }),
    }), context);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error_code: "PRECONDITION_FAILED" });
  });

  it.each([0, 731, 2.5])("rejects an invalid leveling horizon: %s", async (horizonDays) => {
    const response = await POST(new NextRequest("http://localhost/api/projects/67/scheduling/resources?operation=leveling-preview", {
      method: "POST",
      body: JSON.stringify({ horizon_days: horizonDays }),
    }), context);
    expect(response.status).toBe(400);
    expect(loadLevelingContext).not.toHaveBeenCalled();
  });

  it("loads authoritative facts and returns the pure leveling preview", async () => {
    const levelingContext = {
      tasks: [], dependencies: [], resources: [], assignments: [], capacity_profiles: [],
      calendar: { working_weekdays: [1, 2, 3, 4, 5], non_working_dates: [] }, horizon_days: 365,
    };
    const result = { status: "available", proposals: [], diagnostics: [], notice: "Preview only. No schedule dates were changed." } as const;
    loadLevelingContext.mockResolvedValue(levelingContext);
    previewMock.mockReturnValue(result);
    const response = await POST(new NextRequest("http://localhost/api/projects/67/scheduling/resources?operation=leveling-preview", {
      method: "POST",
      body: JSON.stringify({ horizon_days: 365 }),
    }), context);
    expect(response.status).toBe(200);
    expect(loadLevelingContext).toHaveBeenCalledWith(67, 365);
    expect(previewMock).toHaveBeenCalledWith(levelingContext);
    await expect(response.json()).resolves.toEqual({ data: result });
  });

  it("creates an equipment resource with its validated day rate", async () => {
    const body = {
      resource_kind: "equipment",
      display_name: "Tower crane",
      standard_rate: 1250,
      cost_per_use: 300,
      rate_unit: "day",
      expected_cost_version: null,
    };
    upsertCostResource.mockResolvedValue({ id: resourceId, ...body, cost_version: 1 });
    const response = await POST(new NextRequest(
      "http://localhost/api/projects/67/scheduling/resources?operation=cost-resource",
      { method: "POST", body: JSON.stringify(body) },
    ), context);
    expect(response.status).toBe(201);
    expect(upsertCostResource).toHaveBeenCalledWith(67, body);
  });

  it.each([
    [{ resource_kind: "person", display_name: "Person", standard_rate: 75, cost_per_use: null, rate_unit: "hour" }, /equipment or material/i],
    [{ resource_kind: "equipment", display_name: "Crane", standard_rate: 75, cost_per_use: null, rate_unit: "hour" }, /day rate/i],
  ])("rejects invalid new cost-resource input", async (body, message) => {
    const response = await POST(new NextRequest(
      "http://localhost/api/projects/67/scheduling/resources?operation=cost-resource",
      { method: "POST", body: JSON.stringify(body) },
    ), context);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error_message: expect.stringMatching(message),
    });
    expect(upsertCostResource).not.toHaveBeenCalled();
  });

  it("updates a cost resource with an exact version", async () => {
    const body = {
      id: resourceId,
      resource_kind: "equipment",
      display_name: "Tower crane",
      standard_rate: 1400,
      cost_per_use: 300,
      rate_unit: "day",
      expected_cost_version: 4,
    };
    upsertCostResource.mockResolvedValue({ ...body, cost_version: 5 });
    const response = await PUT(new NextRequest(
      "http://localhost/api/projects/67/scheduling/resources?view=cost-resource",
      { method: "PUT", body: JSON.stringify(body) },
    ), context);
    expect(response.status).toBe(200);
    expect(upsertCostResource).toHaveBeenCalledWith(67, body);
  });

  it("maps a stale cost resource PT409 to a conflict response", async () => {
    const body = {
      id: resourceId,
      resource_kind: "equipment",
      display_name: "Tower crane",
      standard_rate: 1400,
      cost_per_use: 300,
      rate_unit: "day",
      expected_cost_version: 4,
    };
    upsertCostResource.mockRejectedValue(new ScheduleResourceServiceError(
      "Cost resource changed since it was loaded.",
      "rpc",
      {
        code: "PT409",
        message: "Cost resource changed since it was loaded.",
      },
    ));
    const response = await PUT(new NextRequest(
      "http://localhost/api/projects/67/scheduling/resources?view=cost-resource",
      { method: "PUT", body: JSON.stringify(body) },
    ), context);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error_code: "PRECONDITION_FAILED",
    });
  });

  it("deletes a cost resource with an exact version", async () => {
    const response = await DELETE(new NextRequest(
      "http://localhost/api/projects/67/scheduling/resources",
      {
        method: "DELETE",
        body: JSON.stringify({
          resource_id: resourceId,
          expected_cost_version: 4,
        }),
      },
    ), context);
    expect(response.status).toBe(200);
    expect(deleteCostResource).toHaveBeenCalledWith(67, resourceId, 4);
  });

  it("rejects unsupported views and operations instead of silently defaulting", async () => {
    const getResponse = await GET(new NextRequest("http://localhost/api/projects/67/scheduling/resources?view=unknown"), context);
    const postResponse = await POST(new NextRequest("http://localhost/api/projects/67/scheduling/resources", { method: "POST" }), context);
    expect(getResponse.status).toBe(400);
    expect(postResponse.status).toBe(400);
  });
});

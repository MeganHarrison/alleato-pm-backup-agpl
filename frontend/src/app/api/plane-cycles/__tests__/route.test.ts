import { NextRequest, NextResponse } from "next/server";
import { DELETE, GET, POST } from "../route";
import { authorizePlaneCycles } from "../access";
import { asPlaneCyclesDb } from "@/features/plane-cycles-domain/server-db";

jest.mock("../access", () => ({
  authorizePlaneCycles: jest.fn(),
}));

jest.mock("@/features/plane-cycles-domain/server-db", () => ({
  asPlaneCyclesDb: jest.fn(),
}));

const authorizeMock = authorizePlaneCycles as jest.MockedFunction<
  typeof authorizePlaneCycles
>;
const asDbMock = asPlaneCyclesDb as jest.MockedFunction<
  typeof asPlaneCyclesDb
>;

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CYCLE_ID = "22222222-2222-4222-8222-222222222222";

function authorized(serviceClient: object = {}) {
  authorizeMock.mockResolvedValue({
    user: { id: USER_ID, email: "member@example.com" },
    serviceClient,
    membership: {},
    userProfile: null,
  } as never);
}

function cycleRow() {
  return {
    id: CYCLE_ID,
    project_id: 31,
    name: "Sprint 1",
    description: "",
    start_date: null,
    end_date: null,
    owned_by: USER_ID,
    timezone: "UTC",
    sort_order: 65_535,
    view_props: {},
    progress_snapshot: {},
    external_source: null,
    external_id: null,
    archived_at: null,
    version: 1,
    created_by: USER_ID,
    updated_by: USER_ID,
    created_at: "2026-07-31T00:00:00Z",
    updated_at: "2026-07-31T00:00:00Z",
  };
}

describe("Plane cycles static API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects a missing project before authorization", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/plane-cycles"),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(400);
    expect(authorizeMock).not.toHaveBeenCalled();
  });

  it("excludes archived cycles from the default project list", async () => {
    authorized({});
    const builder = {
      select: jest.fn(),
      eq: jest.fn(),
      order: jest.fn(),
      is: jest.fn(),
      not: jest.fn(),
      then: jest.fn(
        (
          resolve: (value: { data: unknown[]; error: null }) => unknown,
        ) => Promise.resolve({ data: [cycleRow()], error: null }).then(resolve),
      ),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    builder.is.mockReturnValue(builder);
    builder.not.mockReturnValue(builder);
    asDbMock.mockReturnValue({ from: jest.fn().mockReturnValue(builder) } as never);

    const response = await GET(
      new NextRequest("http://localhost/api/plane-cycles?projectId=31"),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    expect(builder.is).toHaveBeenCalledWith("archived_at", null);
    expect(builder.not).not.toHaveBeenCalled();
  });

  it("returns 404 when a project-scoped cycle cannot be found", async () => {
    authorized({});
    const builder = {
      select: jest.fn(),
      eq: jest.fn(),
      order: jest.fn(),
      is: jest.fn(),
      not: jest.fn(),
      then: jest.fn(
        (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(resolve),
      ),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    builder.is.mockReturnValue(builder);
    builder.not.mockReturnValue(builder);
    asDbMock.mockReturnValue({
      from: jest.fn().mockReturnValue(builder),
    } as never);

    const response = await GET(
      new NextRequest(
        `http://localhost/api/plane-cycles?projectId=31&cycleId=${CYCLE_ID}`,
      ),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Cycle not found.",
    });
  });

  it("returns the canonical write denial before create", async () => {
    authorizeMock.mockResolvedValue(
      NextResponse.json({ error: "Insufficient permissions" }, { status: 403 }),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/plane-cycles", {
        method: "POST",
        body: JSON.stringify({ project_id: 31, name: "Sprint 1" }),
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(403);
    expect(asDbMock).not.toHaveBeenCalled();
  });

  it("rejects an incomplete date range before authorization", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/plane-cycles", {
        method: "POST",
        body: JSON.stringify({
          project_id: 31,
          name: "Sprint 1",
          start_date: "2026-08-01",
        }),
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(400);
    expect(authorizeMock).not.toHaveBeenCalled();
  });

  it("creates a project-scoped cycle through the authorized service client", async () => {
    const serviceClient = {};
    authorized(serviceClient);
    const builder = {
      insert: jest.fn(),
      select: jest.fn(),
      single: jest.fn().mockResolvedValue({ data: cycleRow(), error: null }),
    };
    builder.insert.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    asDbMock.mockReturnValue({ from: jest.fn().mockReturnValue(builder) } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/plane-cycles", {
        method: "POST",
        body: JSON.stringify({ project_id: 31, name: "Sprint 1" }),
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(201);
    expect(authorizeMock).toHaveBeenCalledWith(31, "write");
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 31,
        created_by: USER_ID,
      }),
    );
  });

  it("rejects an invalid cycle ID before delete authorization", async () => {
    const response = await DELETE(
      new NextRequest(
        "http://localhost/api/plane-cycles?projectId=31&cycleId=not-a-uuid",
        { method: "DELETE" },
      ),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(400);
    expect(authorizeMock).not.toHaveBeenCalled();
  });
});

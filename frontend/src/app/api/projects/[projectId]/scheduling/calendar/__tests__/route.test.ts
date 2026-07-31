process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";
import { GET, PUT } from "../route";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), getApiRouteUser: jest.fn() }));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;

describe("GET schedule calendar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
  });

  it("returns an explicit default when the project has no saved calendar", async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    createClientMock.mockResolvedValue({ from: jest.fn().mockReturnValue({ select }) } as never);

    const response = await GET(new NextRequest("http://localhost/api/projects/43/scheduling/calendar"), {
      params: Promise.resolve({ projectId: "43" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      working_weekdays: [1, 2, 3, 4, 5],
      non_working_dates: [],
      working_date_overrides: [],
      exceptions: [],
      timezone_name: "America/Indiana/Indianapolis",
      source: "default",
    });
  });

  it("returns named exceptions so editing the calendar does not discard their reasons", async () => {
    const calendarMaybeSingle = jest.fn().mockResolvedValue({
      data: { working_weekdays: [1, 2, 3, 4, 5] },
      error: null,
    });
    const exceptionRows = [{ exception_date: "2026-12-25", is_working: false, reason: "Christmas Day" }];
    const from = jest.fn()
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ maybeSingle: calendarMaybeSingle }),
        }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: exceptionRows, error: null }),
        }),
      });
    createClientMock.mockResolvedValue({ from } as never);

    const response = await GET(new NextRequest("http://localhost/api/projects/43/scheduling/calendar"), {
      params: Promise.resolve({ projectId: "43" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      exceptions: [{ date: "2026-12-25", is_working: false, reason: "Christmas Day" }],
    });
  });

  it("keeps the Supabase client receiver for calendar table reads", async () => {
    const client = {
      from: jest.fn(function (this: unknown) {
        expect(this).toBe(client);
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          then: (resolve: (value: { data: []; error: null }) => unknown) => Promise.resolve(resolve({ data: [], error: null })),
        };
        return query;
      }),
    };
    createClientMock.mockResolvedValue(client as never);

    const response = await GET(new NextRequest("http://localhost/api/projects/43/scheduling/calendar"), {
      params: Promise.resolve({ projectId: "43" }),
    });

    expect(response.status).toBe(200);
    expect(client.from).toHaveBeenCalledTimes(2);
  });
});

describe("PUT schedule calendar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getApiRouteUser>>);
  });

  it("rejects an empty working week before attempting a database write", async () => {
    const rpc = jest.fn();
    createClientMock.mockResolvedValue({ rpc } as never);

    const response = await PUT(
      new NextRequest("http://localhost/api/projects/43/scheduling/calendar", {
        method: "PUT",
        body: JSON.stringify({ working_weekdays: [], exceptions: [] }),
      }),
      { params: Promise.resolve({ projectId: "43" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Choose at least one working weekday." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an excessive number of dated exceptions before attempting a database write", async () => {
    const rpc = jest.fn();
    createClientMock.mockResolvedValue({ rpc } as never);
    const exceptions = Array.from({ length: 1001 }, (_, index) => ({
      date: `2030-01-${String((index % 28) + 1).padStart(2, "0")}`,
      is_working: false,
    }));

    const response = await PUT(
      new NextRequest("http://localhost/api/projects/43/scheduling/calendar", {
        method: "PUT",
        body: JSON.stringify({ working_weekdays: [1, 2, 3, 4, 5], exceptions }),
      }),
      { params: Promise.resolve({ projectId: "43" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "A schedule calendar can contain at most 1000 dated exceptions.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends one normalized calendar payload to the atomic replacement RPC", async () => {
    const rpc = jest.fn().mockResolvedValue({ error: null });
    const maybeSingle = jest.fn().mockResolvedValue({
      data: { timezone_name: "America/Indiana/Indianapolis" },
      error: null,
    });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    createClientMock.mockResolvedValue({
      rpc,
      from: jest.fn().mockReturnValue({ select }),
    } as never);

    const response = await PUT(
      new NextRequest("http://localhost/api/projects/43/scheduling/calendar", {
        method: "PUT",
        body: JSON.stringify({
          working_weekdays: [1, 2, 3, 4, 5],
          exceptions: [{ date: "2026-12-25", is_working: false, reason: "Christmas Day" }],
        }),
      }),
      { params: Promise.resolve({ projectId: "43" }) },
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("replace_project_schedule_calendar", {
      p_project_id: 43,
      p_working_weekdays: [1, 2, 3, 4, 5],
      p_exceptions: [{ exception_date: "2026-12-25", is_working: false, reason: "Christmas Day" }],
    });
    await expect(response.json()).resolves.toMatchObject({
      exceptions: [{ date: "2026-12-25", is_working: false, reason: "Christmas Day" }],
    });
  });

  it("keeps the Supabase client receiver when invoking the RPC", async () => {
    const client = {
      rpc: jest.fn(function (this: unknown) {
        expect(this).toBe(client);
        return Promise.resolve({ error: null });
      }),
      from: jest.fn(function (this: unknown) {
        expect(this).toBe(client);
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: () => Promise.resolve({
            data: { timezone_name: "America/Indiana/Indianapolis" },
            error: null,
          }),
        };
        return query;
      }),
    };
    createClientMock.mockResolvedValue(client as never);

    const response = await PUT(
      new NextRequest("http://localhost/api/projects/43/scheduling/calendar", {
        method: "PUT",
        body: JSON.stringify({ working_weekdays: [1, 2, 3, 4, 5], exceptions: [] }),
      }),
      { params: Promise.resolve({ projectId: "43" }) },
    );

    expect(response.status).toBe(200);
  });
});

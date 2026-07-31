process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest, NextResponse } from "next/server";

import { DELETE, GET, PATCH, POST } from "../route";
import { requirePermission } from "@/lib/permissions-guard";
import { createClient } from "@/lib/supabase/server";

jest.mock("@/lib/permissions-guard", () => ({
  requirePermission: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn().mockResolvedValue(null),
}));

const requirePermissionMock = requirePermission as jest.MockedFunction<
  typeof requirePermission
>;
const createClientMock = createClient as jest.MockedFunction<
  typeof createClient
>;

const page = {
  id: 21,
  project_id: 31,
  title: "Turnover plan",
  body: "Closeout sequence",
  archived: false,
  created_at: "2026-07-30T12:00:00.000Z",
  created_by: "user-1",
  updated_at: "2026-07-30T13:00:00.000Z",
};

function params() {
  return {
    params: Promise.resolve({}),
  };
}

function request(path: string, method = "GET", body?: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    ...(typeof body === "undefined" ? {} : { body: JSON.stringify(body) }),
  });
}

describe("project notes API authorization and scope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requirePermissionMock.mockResolvedValue({
      denied: false,
      userId: "user-1",
      personId: "person-1",
    });
  });

  it("stops denied reads before querying notes", async () => {
    requirePermissionMock.mockResolvedValue({
      denied: true,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    const response = await GET(request("/api/notes?project_id=31"), params());

    expect(response.status).toBe(403);
    expect(requirePermissionMock).toHaveBeenCalledWith(31, "documents", "read");
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("lists notes only inside the authorized project", async () => {
    const builder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn(),
    };
    builder.order
      .mockReturnValueOnce(builder)
      .mockResolvedValueOnce({ data: [page], error: null });
    createClientMock.mockResolvedValue({
      from: jest.fn().mockReturnValue(builder),
    } as Awaited<ReturnType<typeof createClient>>);

    const response = await GET(request("/api/notes?project_id=31"), params());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: [page] });
    expect(builder.eq).toHaveBeenCalledWith("project_id", 31);
  });

  it("stamps create identity from the permission guard", async () => {
    const builder = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: page, error: null }),
    };
    createClientMock.mockResolvedValue({
      from: jest.fn().mockReturnValue(builder),
    } as Awaited<ReturnType<typeof createClient>>);

    const response = await POST(
      request("/api/notes", "POST", {
        projectId: 31,
        title: "Turnover plan",
        body: "Closeout sequence",
      }),
      params(),
    );

    expect(response.status).toBe(201);
    expect(requirePermissionMock).toHaveBeenCalledWith(
      31,
      "documents",
      "write",
    );
    expect(builder.insert).toHaveBeenCalledWith({
      project_id: 31,
      title: "Turnover plan",
      body: "Closeout sequence",
      archived: false,
      created_by: "user-1",
    });
  });

  it("rejects client attempts to set immutable identity fields", async () => {
    const response = await POST(
      request("/api/notes", "POST", {
        projectId: 31,
        title: "Unsafe",
        project_id: 999,
        created_by: "other-user",
      }),
      params(),
    );

    expect(response.status).toBe(400);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("scopes updates by both project and page id", async () => {
    const builder = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: page, error: null }),
    };
    createClientMock.mockResolvedValue({
      from: jest.fn().mockReturnValue(builder),
    } as Awaited<ReturnType<typeof createClient>>);

    const response = await PATCH(
      request("/api/notes", "PATCH", {
        projectId: 31,
        pageId: 21,
        title: "Updated",
        archived: true,
      }),
      params(),
    );

    expect(response.status).toBe(200);
    expect(builder.eq.mock.calls).toEqual([
      ["project_id", 31],
      ["id", 21],
    ]);
    expect(builder.update).toHaveBeenCalledWith({
      title: "Updated",
      archived: true,
      updated_at: expect.any(String),
    });
  });

  it("scopes deletes by both project and page id", async () => {
    const builder = {
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: 21 },
        error: null,
      }),
    };
    createClientMock.mockResolvedValue({
      from: jest.fn().mockReturnValue(builder),
    } as Awaited<ReturnType<typeof createClient>>);

    const response = await DELETE(
      request("/api/notes?project_id=31&note_id=21", "DELETE"),
      params(),
    );

    expect(response.status).toBe(204);
    expect(builder.eq.mock.calls).toEqual([
      ["project_id", 31],
      ["id", 21],
    ]);
  });

  it("fails loudly when a scoped delete matches no page", async () => {
    const builder = {
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    createClientMock.mockResolvedValue({
      from: jest.fn().mockReturnValue(builder),
    } as Awaited<ReturnType<typeof createClient>>);

    const response = await DELETE(
      request("/api/notes?project_id=31&note_id=21", "DELETE"),
      params(),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        error_code: "NOT_FOUND",
        error_message: "The requested project page was not found.",
      }),
    );
  });

  it("rejects non-canonical numeric route ids before permission lookup", async () => {
    const response = await GET(request("/api/notes?project_id=31x"), params());

    expect(response.status).toBe(400);
    expect(requirePermissionMock).not.toHaveBeenCalled();
  });
});

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";

import { isAuthError, verifyProjectAccess } from "@/lib/supabase/auth-guard";
import { getApiRouteUser } from "@/lib/supabase/server";
import { PATCH } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/supabase/auth-guard", () => ({
  verifyProjectAccess: jest.fn(),
  isAuthError: jest.fn(() => false),
}));

const getApiRouteUserMock = getApiRouteUser as jest.Mock;
const verifyProjectAccessMock = verifyProjectAccess as jest.Mock;
const isAuthErrorMock = isAuthError as jest.Mock;

function params() {
  return {
    params: Promise.resolve({
      projectId: "67",
      drawingId: "drawing-123",
      annotationId: "annotation-123",
    }),
  };
}

function request(body: unknown) {
  return new NextRequest(
    "http://localhost/api/projects/67/drawings/drawing-123/annotations/annotation-123",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function buildServiceClient() {
  const existing = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: { created_by: "00000000-0000-4000-8000-000000000001" },
      error: null,
    }),
  };
  const update = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: {
        id: "annotation-123",
        data: { page_percent: true, start: { x: 10, y: 10 }, end: { x: 20, y: 20 } },
      },
      error: null,
    }),
  };

  return {
    from: jest.fn()
      .mockReturnValueOnce(existing)
      .mockReturnValueOnce(update),
    __update: update,
  };
}

describe("drawing annotation PATCH", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000001" });
    isAuthErrorMock.mockReturnValue(false);
  });

  it.each([
    ["an array", []],
    ["geometry without page_percent", { start: { x: 1, y: 1 }, end: { x: 2, y: 2 } }],
  ])("rejects %s before writing", async (_label, data) => {
    const response = await PATCH(request({ data }), params());
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error_code: "VALIDATION",
      error_message: "data must use the canonical PDF page-percent coordinate contract.",
    });
    expect(verifyProjectAccessMock).not.toHaveBeenCalled();
  });

  it("persists canonical geometry within the full URL ownership boundary", async () => {
    const serviceClient = buildServiceClient();
    verifyProjectAccessMock.mockResolvedValue({ serviceClient });
    const data = {
      page_percent: true,
      start: { x: 10, y: 10 },
      end: { x: 20, y: 20 },
    };

    const response = await PATCH(request({ data }), params());

    expect(response.status).toBe(200);
    expect(serviceClient.__update.update).toHaveBeenCalledWith(expect.objectContaining({ data }));
    expect(serviceClient.__update.eq).toHaveBeenCalledWith("id", "annotation-123");
    expect(serviceClient.__update.eq).toHaveBeenCalledWith("drawing_id", "drawing-123");
    expect(serviceClient.__update.eq).toHaveBeenCalledWith("project_id", 67);
  });
});

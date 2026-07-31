process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";

import { isAuthError, verifyProjectAccess } from "@/lib/supabase/auth-guard";
import { getApiRouteUser } from "@/lib/supabase/server";
import { GET } from "../route";

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

describe("drawing annotation GET", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isAuthErrorMock.mockReturnValue(false);
  });

  it("returns only published annotations or the caller's own personal annotations", async () => {
    const userId = "00000000-0000-4000-8000-000000000001";
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    const serviceClient = { from: jest.fn(() => query) };
    getApiRouteUserMock.mockResolvedValue({ id: userId });
    verifyProjectAccessMock.mockResolvedValue({ serviceClient });

    const response = await GET(
      new NextRequest("http://localhost/api/projects/67/drawings/drawing-123/annotations"),
      { params: Promise.resolve({ projectId: "67", drawingId: "drawing-123" }) },
    );

    expect(response.status).toBe(200);
    expect(query.or).toHaveBeenCalledWith(`is_published.eq.true,created_by.eq.${userId}`);
  });
});

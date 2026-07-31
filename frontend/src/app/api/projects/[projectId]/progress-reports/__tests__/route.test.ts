process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest, NextResponse } from "next/server";
import { GET, POST } from "../route";
import { requireDeveloperApi } from "@/lib/auth/require-developer";
import { getApiRouteUserFromRequest } from "@/lib/supabase/server";
import {
  createProgressReportDraft,
  listProgressReports,
} from "@/lib/progress-reports/server";

jest.mock("@/lib/auth/require-developer", () => ({
  requireDeveloperApi: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUserFromRequest: jest.fn(),
}));

jest.mock("@/lib/progress-reports/server", () => ({
  createProgressReportDraft: jest.fn(),
  listProgressReports: jest.fn(),
}));

jest.mock("@/lib/progress-reports/ai-generate", () => ({
  generateProgressReportSections: jest.fn(),
}));

const requireDeveloperApiMock = requireDeveloperApi as jest.MockedFunction<
  typeof requireDeveloperApi
>;
const getApiRouteUserFromRequestMock =
  getApiRouteUserFromRequest as jest.MockedFunction<
    typeof getApiRouteUserFromRequest
  >;
const createProgressReportDraftMock =
  createProgressReportDraft as jest.MockedFunction<typeof createProgressReportDraft>;
const listProgressReportsMock =
  listProgressReports as jest.MockedFunction<typeof listProgressReports>;

function makeRequest(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`http://localhost${path}`, init);
}

describe("/api/projects/[projectId]/progress-reports", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireDeveloperApiMock.mockResolvedValue(null);
    getApiRouteUserFromRequestMock.mockResolvedValue({
      id: "developer-user",
      email: "dev@example.com",
    });
  });

  it("passes the incoming request to the developer guard on GET", async () => {
    listProgressReportsMock.mockResolvedValue([]);
    const request = makeRequest("/api/projects/876/progress-reports", {
      headers: { authorization: "Bearer token-123" },
    });

    const response = await GET(request, {
      params: Promise.resolve({ projectId: "876" }),
    });

    expect(response.status).toBe(200);
    expect(requireDeveloperApiMock).toHaveBeenCalledWith(request);
    expect(listProgressReportsMock).toHaveBeenCalledWith(876);
  });

  it("passes the incoming request to the developer guard on POST", async () => {
    createProgressReportDraftMock.mockResolvedValue({
      reportId: "report-123",
      action: "created",
    });
    const request = makeRequest("/api/projects/876/progress-reports", {
      method: "POST",
      headers: {
        authorization: "Bearer token-123",
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request, {
      params: Promise.resolve({ projectId: "876" }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(requireDeveloperApiMock).toHaveBeenCalledWith(request);
    expect(createProgressReportDraftMock).toHaveBeenCalledWith({
      projectId: 876,
      userId: "developer-user",
      userEmail: "dev@example.com",
      weekStart: undefined,
      weekEnd: undefined,
    });
    expect(body).toEqual({ reportId: "report-123", action: "created" });
  });

  it("returns the guard response when developer access is denied", async () => {
    requireDeveloperApiMock.mockResolvedValue(
      NextResponse.json({ error: "Developer access required" }, { status: 403 }),
    );

    const response = await GET(makeRequest("/api/projects/876/progress-reports"), {
      params: Promise.resolve({ projectId: "876" }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "Developer access required" });
    expect(listProgressReportsMock).not.toHaveBeenCalled();
  });
});

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";

import { GET } from "../route";
import { listVisibleAiSkills } from "@/lib/ai/services/skill-library-service";
import { getApiRouteUser } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
}));
jest.mock("@/lib/ai/services/skill-library-service", () => ({
  listVisibleAiSkills: jest.fn(),
}));

const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<
  typeof getApiRouteUser
>;
const listVisibleAiSkillsMock = listVisibleAiSkills as jest.MockedFunction<
  typeof listVisibleAiSkills
>;

describe("/api/ai-assistant/skills", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    } as Awaited<ReturnType<typeof getApiRouteUser>>);
    listVisibleAiSkillsMock.mockResolvedValue({
      skills: [
        {
          id: "skill-1",
          title: "Review stored materials",
          summary: "Check stored materials against approved SOV.",
          category: "pay_app_review",
          scope: "team",
          projectId: null,
          projectName: null,
          ownerName: null,
          reviewerName: null,
          version: "v1",
          examples: [],
          usageCount: 0,
          lastUsedAt: null,
          status: "active",
          isActive: true,
          isVisible: true,
        },
      ],
      filters: {
        categories: ["pay_app_review"],
        scopes: ["team"],
        projects: [],
        statuses: ["active"],
      },
    });
  });

  it("loads visible skills for the authenticated user", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/ai-assistant/skills?category=pay_app_review&scope=team",
      ),
      { params: Promise.resolve({}) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.skills).toHaveLength(1);
    expect(listVisibleAiSkillsMock).toHaveBeenCalledWith({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      category: "pay_app_review",
      scope: "team",
      projectId: undefined,
    });
  });

  it("rejects invalid project filters before calling the service", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/ai-assistant/skills?projectId=bad"),
      { params: Promise.resolve({}) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      error_code: "INVALID_PAYLOAD",
      where_it_failed: "/api/ai-assistant/skills#GET",
    });
  });
});

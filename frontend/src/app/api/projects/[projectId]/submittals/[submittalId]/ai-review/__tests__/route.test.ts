import { NextRequest } from "next/server";

import { createSubmittalAIReviewService } from "@/lib/submittals/ai-review/review-run-service";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { GET, POST } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
  createClient: jest.fn(),
}));

const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;

jest.mock("@/lib/submittals/ai-review/review-run-service", () => ({
  createSubmittalAIReviewService: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<
  typeof createClient
>;
const createReviewServiceMock =
  createSubmittalAIReviewService as jest.MockedFunction<
    typeof createSubmittalAIReviewService
  >;

function mockUser(user = { id: "user-1" }) {
  createClientMock.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
  } as never);
}

describe("/api/projects/[projectId]/submittals/[submittalId]/ai-review", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockImplementation(async () => {
      const client = await createClientMock();
      return (await client.auth.getUser()).data.user ?? null;
    });
  });

  it("rejects unauthenticated review requests", async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    } as never);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/projects/876/submittals/abc/ai-review",
      ),
      { params: Promise.resolve({ projectId: "876", submittalId: "abc" }) },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error_code: "UNAUTHORIZED",
    });
  });

  it("loads the latest review through the shared review service", async () => {
    mockUser();
    const getLatestReview = jest.fn().mockResolvedValue({ runId: "run-1" });
    createReviewServiceMock.mockReturnValue({
      parseProjectId: jest.fn().mockReturnValue(876),
      getLatestReview,
    } as never);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/projects/876/submittals/abc/ai-review",
      ),
      { params: Promise.resolve({ projectId: "876", submittalId: "abc" }) },
    );

    expect(response.status).toBe(200);
    expect(getLatestReview).toHaveBeenCalledWith(876, "abc");
    expect(await response.json()).toEqual({ runId: "run-1" });
  });

  it("passes the parsed focus area into a new review run", async () => {
    mockUser();
    const runReview = jest.fn().mockResolvedValue({ runId: "run-2" });
    createReviewServiceMock.mockReturnValue({
      parseProjectId: jest.fn().mockReturnValue(876),
      runReview,
    } as never);

    const response = await POST(
      new NextRequest(
        "http://localhost/api/projects/876/submittals/abc/ai-review",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ focusArea: "fire rating" }),
        },
      ),
      { params: Promise.resolve({ projectId: "876", submittalId: "abc" }) },
    );

    expect(response.status).toBe(200);
    expect(runReview).toHaveBeenCalledWith(876, "abc", "fire rating");
  });
});

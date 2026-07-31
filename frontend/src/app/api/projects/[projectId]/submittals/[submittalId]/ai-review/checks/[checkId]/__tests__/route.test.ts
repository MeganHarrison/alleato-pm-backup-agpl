import { NextRequest } from "next/server";

import { createSubmittalAIReviewService } from "@/lib/submittals/ai-review/review-run-service";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { PATCH } from "../route";

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

describe("/api/projects/[projectId]/submittals/[submittalId]/ai-review/checks/[checkId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockImplementation(async () => {
      const client = await createClientMock();
      return (await client.auth.getUser()).data.user ?? null;
    });
  });

  it("rejects unauthenticated disposition updates", async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    } as never);

    const response = await PATCH(
      new NextRequest(
        "http://localhost/api/projects/876/submittals/sub-1/ai-review/checks/check-1",
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reviewerDisposition: "accepted" }),
        },
      ),
      {
        params: Promise.resolve({
          projectId: "876",
          submittalId: "sub-1",
          checkId: "check-1",
        }),
      },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error_code: "UNAUTHORIZED",
    });
  });

  it("updates a check disposition through the shared review service", async () => {
    mockUser();
    const updateCheckDisposition = jest
      .fn()
      .mockResolvedValue({ runId: "run-1" });
    createReviewServiceMock.mockReturnValue({
      parseProjectId: jest.fn().mockReturnValue(876),
      updateCheckDisposition,
    } as never);

    const response = await PATCH(
      new NextRequest(
        "http://localhost/api/projects/876/submittals/sub-1/ai-review/checks/check-1",
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            reviewerDisposition: "dismissed",
            reviewerNotes: "Reviewed against latest product data.",
          }),
        },
      ),
      {
        params: Promise.resolve({
          projectId: "876",
          submittalId: "sub-1",
          checkId: "check-1",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(updateCheckDisposition).toHaveBeenCalledWith(
      876,
      "sub-1",
      "check-1",
      "dismissed",
      "Reviewed against latest product data.",
    );
    expect(await response.json()).toEqual({ runId: "run-1" });
  });
});

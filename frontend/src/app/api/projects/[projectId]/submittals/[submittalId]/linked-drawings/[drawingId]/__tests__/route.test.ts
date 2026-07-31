import { NextRequest } from "next/server";

import { createSubmittalAIReviewService } from "@/lib/submittals/ai-review/review-run-service";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { DELETE } from "../route";

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

function mockAuthedClient(fromImpl?: jest.Mock) {
  createClientMock.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    },
    from: fromImpl ?? jest.fn(),
  } as never);
}

describe("/api/projects/[projectId]/submittals/[submittalId]/linked-drawings/[drawingId]", () => {
  const drawingId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockImplementation(async () => {
      const client = await createClientMock();
      return (await client.auth.getUser()).data.user ?? null;
    });
  });

  it("validates project scope before deleting a linked drawing", async () => {
    const deleteQuery = {
      eq: jest.fn().mockReturnThis(),
    };
    deleteQuery.eq
      .mockReturnValueOnce(deleteQuery)
      .mockResolvedValueOnce({ error: null });
    const deleteMock = jest.fn().mockReturnValue(deleteQuery);
    const from = jest.fn().mockReturnValue({ delete: deleteMock });
    mockAuthedClient(from);

    const getScopedSubmittal = jest.fn().mockResolvedValue({});
    const getDrawingByScope = jest.fn().mockResolvedValue({});
    createReviewServiceMock.mockReturnValue({
      parseProjectId: jest.fn().mockReturnValue(876),
      getScopedSubmittal,
      getDrawingByScope,
    } as never);

    const response = await DELETE(
      new NextRequest(
        `http://localhost/api/projects/876/submittals/abc/linked-drawings/${drawingId}`,
        { method: "DELETE" },
      ),
      {
        params: Promise.resolve({
          projectId: "876",
          submittalId: "abc",
          drawingId,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(getScopedSubmittal).toHaveBeenCalledWith(876, "abc");
    expect(getDrawingByScope).toHaveBeenCalledWith(876, drawingId);
    expect(deleteMock).toHaveBeenCalled();
    expect(deleteQuery.eq).toHaveBeenCalledWith("submittal_id", "abc");
    expect(deleteQuery.eq).toHaveBeenCalledWith("drawing_id", drawingId);
  });

  it("does not delete when drawing project scope validation fails", async () => {
    const deleteMock = jest.fn();
    const from = jest.fn().mockReturnValue({ delete: deleteMock });
    mockAuthedClient(from);

    const getScopedSubmittal = jest.fn().mockResolvedValue({});
    const getDrawingByScope = jest.fn().mockRejectedValue(new Error("scope mismatch"));
    createReviewServiceMock.mockReturnValue({
      parseProjectId: jest.fn().mockReturnValue(876),
      getScopedSubmittal,
      getDrawingByScope,
    } as never);

    const response = await DELETE(
      new NextRequest(
        `http://localhost/api/projects/876/submittals/abc/linked-drawings/${drawingId}`,
        { method: "DELETE" },
      ),
      {
        params: Promise.resolve({
          projectId: "876",
          submittalId: "abc",
          drawingId,
        }),
      },
    );

    expect(response.status).toBe(500);
    expect(deleteMock).not.toHaveBeenCalled();
  });
});

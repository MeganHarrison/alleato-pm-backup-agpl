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

describe("/api/projects/[projectId]/submittals/[submittalId]/linked-drawings", () => {
  const drawingId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockImplementation(async () => {
      const client = await createClientMock();
      return (await client.auth.getUser()).data.user ?? null;
    });
  });

  it("loads linked drawings through the shared review service", async () => {
    mockAuthedClient();
    const listLinkedDrawings = jest.fn().mockResolvedValue([{ id: "link-1" }]);
    createReviewServiceMock.mockReturnValue({
      parseProjectId: jest.fn().mockReturnValue(876),
      listLinkedDrawings,
    } as never);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/projects/876/submittals/abc/linked-drawings",
      ),
      { params: Promise.resolve({ projectId: "876", submittalId: "abc" }) },
    );

    expect(response.status).toBe(200);
    expect(listLinkedDrawings).toHaveBeenCalledWith(876, "abc");
    expect(await response.json()).toEqual({
      linkedDrawings: [{ id: "link-1" }],
    });
  });

  it("validates project scope before inserting a linked drawing", async () => {
    const selectSingle = jest.fn().mockResolvedValue({
      data: {
        id: "link-1",
        submittal_id: "abc",
        drawing_id: drawingId,
        drawings: {
          drawing_number: "A101",
          title: "Plan",
          discipline: "Architectural",
        },
      },
      error: null,
    });
    const insert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: selectSingle,
      }),
    });
    const from = jest.fn().mockReturnValue({ insert });
    mockAuthedClient(from);

    const getScopedSubmittal = jest.fn().mockResolvedValue({});
    const getDrawingByScope = jest.fn().mockResolvedValue({});
    createReviewServiceMock.mockReturnValue({
      parseProjectId: jest.fn().mockReturnValue(876),
      getScopedSubmittal,
      getDrawingByScope,
    } as never);

    const response = await POST(
      new NextRequest(
        "http://localhost/api/projects/876/submittals/abc/linked-drawings",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            drawingId,
          }),
        },
      ),
      { params: Promise.resolve({ projectId: "876", submittalId: "abc" }) },
    );

    expect(response.status).toBe(201);
    expect(getScopedSubmittal).toHaveBeenCalledWith(876, "abc");
    expect(getDrawingByScope).toHaveBeenCalledWith(876, drawingId);
  });
});

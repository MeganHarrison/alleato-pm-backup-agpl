import { NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";
import { getApiRouteUser } from "@/lib/supabase/server";
import { GET } from "../route";

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<
  typeof getApiRouteUser
>;
const createServiceClientMock = createServiceClient as jest.MockedFunction<
  typeof createServiceClient
>;

describe("/api/projects/[projectId]/specifications/revisions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({ id: "user-1" } as never);
  });

  it("uses the explicit section relationship to avoid ambiguous embeds", async () => {
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    createServiceClientMock.mockReturnValue({
      from: jest.fn(() => query),
    } as never);

    const response = await GET(
      new NextRequest("http://localhost/api/projects/876/specifications/revisions"),
      { params: Promise.resolve({ projectId: "876" }) },
    );

    expect(response.status).toBe(200);
    expect(query.select).toHaveBeenCalledWith(
      expect.stringContaining(
        "specification_sections!specification_section_revisions_section_id_fkey!inner",
      ),
    );
    expect(await response.json()).toEqual({ revisions: [] });
  });
});

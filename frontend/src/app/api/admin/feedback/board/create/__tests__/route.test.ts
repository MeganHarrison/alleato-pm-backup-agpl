import { NextRequest } from "next/server";

import { POST } from "../route";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;
const createServiceClientMock = createServiceClient as jest.MockedFunction<typeof createServiceClient>;

type QueryResult = { data: unknown; error: null | { message: string } };

function makeQuery(result: QueryResult, onInsert?: (payload: Record<string, unknown>) => void) {
  const query = {
    select: jest.fn((..._args: unknown[]) => query),
    eq: jest.fn((..._args: unknown[]) => query),
    order: jest.fn((..._args: unknown[]) => query),
    limit: jest.fn((..._args: unknown[]) => query),
    maybeSingle: jest.fn().mockResolvedValue(result),
    insert: jest.fn((payload: Record<string, unknown>) => {
      onInsert?.(payload);
      return query;
    }),
    single: jest.fn().mockResolvedValue(result),
  };
  return query;
}

describe("/api/admin/feedback/board/create", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({
      id: "admin-user-id",
      email: "admin@example.com",
    } as never);
  });

  it("creates a backlog item with normalized mobile/responsive topics and custom type metadata", async () => {
    let insertedPayload: Record<string, unknown> | null = null;
    let fromCallCount = 0;
    const positionQuery = makeQuery({ data: { position: 1000 }, error: null });
    const insertQuery = makeQuery(
      { data: { id: "new-item-id" }, error: null },
      (payload) => {
        insertedPayload = payload;
      },
    );

    const client = {
      from: jest.fn((table: string) => {
        if (table !== "admin_feedback_items") {
          throw new Error(`Unexpected table: ${table}`);
        }
        fromCallCount += 1;
        return fromCallCount === 1 ? positionQuery : insertQuery;
      }),
    };

    createServiceClientMock.mockReturnValue(client as never);

    const response = await POST(
      new NextRequest("http://localhost/api/admin/feedback/board/create", {
        method: "POST",
      body: JSON.stringify({
        title: "Fix mobile nav overflow",
        description: "The sidebar overflows on small screens.",
        topics: ["responsive", "mobile", "mobile"],
        tool: "   Figma  ",
        category: "  mobile UX ",
        type: "Release risk",
      }),
    }),
  );

    expect(response.status).toBe(201);
    expect(insertedPayload).toMatchObject({
      created_by: "admin-user-id",
      title: "Fix mobile nav overflow",
      comment: "The sidebar overflows on small screens.",
      page_path: "/product-board",
      request_type: "feature_request",
      board_status: "submitted",
      severity: "medium",
        metadata: {
          topics: ["responsive", "mobile"],
          tool: "Figma",
          category: "mobile UX",
          type: "Release risk",
        },
      });
  });
});

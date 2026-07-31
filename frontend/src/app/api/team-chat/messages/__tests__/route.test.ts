import { NextRequest } from "next/server";

import { GET } from "../route";
import { fetchAllComments } from "@/lib/comments/all-comments";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

jest.mock("@/lib/comments/all-comments", () => ({
  fetchAllComments: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<typeof getApiRouteUser>;
const fetchAllCommentsMock = fetchAllComments as jest.MockedFunction<typeof fetchAllComments>;

type QueryResult = {
  data?: unknown;
  error?: { message: string } | null;
};

class SupabaseMock {
  constructor(private readonly results: Record<string, QueryResult[]>) {}

  from(table: string) {
    return new QueryMock(this, table);
  }

  next(table: string, operation: string) {
    const key = `${table}.${operation}`;
    const result = this.results[key]?.shift();
    if (!result) {
      throw new Error(`No mock result queued for ${key}`);
    }
    return result;
  }
}

class QueryMock {
  private operation: "select" | "insert" | null = "select";

  constructor(
    private readonly db: SupabaseMock,
    private readonly table: string,
  ) {}

  select() {
    this.operation = "select";
    return this;
  }

  eq() {
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  maybeSingle() {
    const result = this.db.next(this.table, this.operation ?? "select");
    return Promise.resolve({
      data: result.data ?? null,
      error: result.error ?? null,
    });
  }

  single() {
    return this.maybeSingle();
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    try {
      const result = this.db.next(this.table, this.operation ?? "select");
      return Promise.resolve({
        data: result.data,
        error: result.error ?? null,
      }).then(onfulfilled, onrejected);
    } catch (error) {
      return Promise.reject(error).then(onfulfilled, onrejected);
    }
  }
}

describe("/api/team-chat/messages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({
      id: "admin-user-id",
      email: "admin@example.com",
    } as never);
    fetchAllCommentsMock.mockResolvedValue([
      {
        documentId: "/876/budget",
        annotationId: "comment-1",
        annotationNumber: 1,
        authorName: "Brandon Clymer",
        preview: "Need a faster approval path.",
        statusName: "Open",
        replyCount: 0,
        lastUpdated: Date.UTC(2026, 6, 4, 12, 0, 0),
        messages: [
          {
            commentId: "comment-1",
            authorName: "Brandon Clymer",
            text: "Need a faster approval path.",
            createdAt: Date.UTC(2026, 6, 4, 12, 0, 0),
          },
        ],
      },
    ] as never);
  });

  it("returns imported comment rows for the read-only comments inbox", async () => {
    const supabase = new SupabaseMock({
      "user_profiles.select": [
        {
          data: {
            is_admin: true,
          },
        },
      ],
    });
    createClientMock.mockResolvedValue(supabase as never);

    const response = await GET(
      new NextRequest("http://localhost/api/team-chat/messages?channel=comments-inbox"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      expect.objectContaining({
        id: "comment:comment-1",
        channel_id: "comments-inbox",
        user_name: "Brandon Clymer",
        content: "Need a faster approval path. · 876 / budget",
      }),
    ]);
  });
});

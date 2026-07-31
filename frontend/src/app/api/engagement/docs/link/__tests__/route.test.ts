import { NextRequest } from "next/server";

const mockGetUser = jest.fn();
const mockIssueAssertion = jest.fn();
const mockMaybeSingle = jest.fn();
const mockQuery = {
  select: jest.fn(),
  eq: jest.fn(),
  maybeSingle: mockMaybeSingle,
};
mockQuery.select.mockReturnValue(mockQuery);
mockQuery.eq.mockReturnValue(mockQuery);

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: mockGetUser,
}));
jest.mock("@/lib/analytics/docs-training-assertion", () => ({
  issueDocsTrainingAssertion: mockIssueAssertion,
}));
jest.mock("@/lib/supabase/service-db", () => ({
  serviceDb: { from: jest.fn(() => mockQuery) },
}));
jest.mock("@/lib/guardrails/api", () => ({
  withApiGuardrails:
    (
      where: string,
      handler: (context: { request: NextRequest }) => Promise<Response>,
    ) =>
    async (request: NextRequest) => {
      try {
        return await handler({ request });
      } catch (error) {
        const typed = error as Error & { code?: string; status?: number };
        return Response.json(
          {
            success: false,
            error_code: typed.code ?? "INTERNAL_ERROR",
            error_message: typed.message,
            where_it_failed: where,
          },
          { status: typed.status ?? 500 },
        );
      }
    },
}));

import { GET } from "../route";

describe("GET /api/engagement/docs/link", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      id: "123e4567-e89b-42d3-a456-426614174000",
      email: "not-forwarded@example.com",
    });
    mockIssueAssertion.mockReturnValue("opaque.assertion.value");
    mockQuery.select.mockReturnValue(mockQuery);
    mockQuery.eq.mockReturnValue(mockQuery);
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "4f2bc253-2a31-4c42-b047-b67e62eedb30",
        content_kind: "video",
        source_type: "docs",
      },
      error: null,
    });
  });

  it("places the assertion in the docs URL fragment, never its query string", async () => {
    const response = await GET(
      new NextRequest(
        "https://projects.alleatogroup.com/api/engagement/docs/link?path=%2Fprime-contracts%2Fcreate-a-prime-contract",
      ),
      { params: Promise.resolve({}) },
    );
    const location = new URL(response.headers.get("location") ?? "");

    expect(response.status).toBe(307);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(location.origin).toBe("https://docs.alleatogroup.com");
    expect(location.pathname).toBe("/prime-contracts/create-a-prime-contract");
    expect(location.search).toBe("");
    expect(new URLSearchParams(location.hash.slice(1)).get("alleato_training_assertion"))
      .toBe("opaque.assertion.value");
    expect(mockIssueAssertion).toHaveBeenCalledWith(
      "123e4567-e89b-42d3-a456-426614174000",
      "prime-contracts/create-a-prime-contract",
    );
  });

  it("does not mint an assertion for an uncataloged documentation page", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const response = await GET(
      new NextRequest(
        "https://projects.alleatogroup.com/api/engagement/docs/link?path=%2Fhelp%2Findex",
      ),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(404);
    expect(mockIssueAssertion).not.toHaveBeenCalled();
  });

  it("fails loudly instead of issuing an anonymous attribution link", async () => {
    mockGetUser.mockResolvedValue(null);
    const response = await GET(
      new NextRequest("https://projects.alleatogroup.com/api/engagement/docs/link"),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error_code: "AUTH_EXPIRED",
    });
    expect(mockIssueAssertion).not.toHaveBeenCalled();
  });
});

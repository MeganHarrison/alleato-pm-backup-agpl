import { NextRequest } from "next/server";

const mockVerifyAssertion = jest.fn();
const mockMaybeSingle = jest.fn();
const mockRpc = jest.fn();
const mockQuery = {
  select: jest.fn(),
  eq: jest.fn(),
  maybeSingle: mockMaybeSingle,
};
mockQuery.select.mockReturnValue(mockQuery);
mockQuery.eq.mockReturnValue(mockQuery);

jest.mock("@/lib/analytics/docs-training-assertion", () => ({
  DocsTrainingAssertionError: class DocsTrainingAssertionError extends Error {
    constructor(readonly failure: string) {
      super(failure);
    }
  },
  verifyDocsTrainingAssertion: mockVerifyAssertion,
}));
jest.mock("@/lib/supabase/service-db", () => ({
  serviceDb: { from: jest.fn(() => mockQuery) },
}));
jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(() => ({ rpc: mockRpc })),
}));
jest.mock("@/lib/guardrails/api", () => ({
  parseJsonBody: async (request: Request, schema: { parse: (value: unknown) => unknown }) =>
    schema.parse(await request.json()),
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

import { OPTIONS, POST } from "../route";

const event = {
  schemaVersion: 1,
  event: "training.video.progress",
  sourceId: "prime-contracts/create-a-prime-contract",
  checkpoint: 25,
  positionSeconds: 52,
  watchedSeconds: 11,
};

function request(origin = "https://docs.alleatogroup.com") {
  return new NextRequest("https://projects.alleatogroup.com/api/engagement/docs/progress", {
    method: "POST",
    headers: {
      origin,
      authorization: "Bearer opaque-assertion",
      "content-type": "application/json",
    },
    body: JSON.stringify(event),
  });
}

describe("POST /api/engagement/docs/progress", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.select.mockReturnValue(mockQuery);
    mockQuery.eq.mockReturnValue(mockQuery);
    mockVerifyAssertion.mockReturnValue({
      subject: "123e4567-e89b-42d3-a456-426614174000",
      sourceId: "prime-contracts/create-a-prime-contract",
    });
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "4f2bc253-2a31-4c42-b047-b67e62eedb30",
        content_kind: "video",
        source_type: "docs",
      },
      error: null,
    });
    mockRpc.mockResolvedValue({
      data: [{ checkpoint: 25, completed: false }],
      error: null,
    });
  });

  it("accepts only the minimal event and writes through the canonical progress RPC", async () => {
    const response = await POST(request(), { params: Promise.resolve({}) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin"))
      .toBe("https://docs.alleatogroup.com");
    expect(response.headers.get("access-control-allow-credentials")).toBeNull();
    expect(mockVerifyAssertion).toHaveBeenCalledWith("opaque-assertion", {
      audience: "docs.alleatogroup.com",
    });
    expect(mockRpc).toHaveBeenCalledWith("record_video_learning_progress", {
      p_content_item_id: "4f2bc253-2a31-4c42-b047-b67e62eedb30",
      p_learner_id: "123e4567-e89b-42d3-a456-426614174000",
      p_checkpoint: 25,
      p_position_seconds: 52,
      p_watched_seconds: 11,
    });
    expect(body).toEqual({
      schemaVersion: 1,
      accepted: true,
      checkpoint: 25,
      completed: false,
    });
  });

  it("rejects unapproved origins before assertion or database access", async () => {
    const response = await POST(request("https://untrusted.example"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(mockVerifyAssertion).not.toHaveBeenCalled();
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  it("rejects a valid assertion when the event names a different lesson", async () => {
    mockVerifyAssertion.mockReturnValue({
      subject: "123e4567-e89b-42d3-a456-426614174000",
      sourceId: "invoicing/create-an-owner-invoice",
    });

    const response = await POST(request(), { params: Promise.resolve({}) });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error_code: "FORBIDDEN",
      error_message: expect.stringContaining("different video lesson"),
    });
    expect(mockMaybeSingle).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("provides credential-free preflight headers only to approved docs origins", () => {
    const allowed = OPTIONS(
      new NextRequest("https://projects.alleatogroup.com/api/engagement/docs/progress", {
        method: "OPTIONS",
        headers: { origin: "https://docs.alleatogroup.com" },
      }),
    );
    const blocked = OPTIONS(
      new NextRequest("https://projects.alleatogroup.com/api/engagement/docs/progress", {
        method: "OPTIONS",
        headers: { origin: "https://untrusted.example" },
      }),
    );

    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-headers"))
      .toBe("authorization, content-type");
    expect(allowed.headers.get("access-control-allow-credentials")).toBeNull();
    expect(blocked.status).toBe(403);
  });
});

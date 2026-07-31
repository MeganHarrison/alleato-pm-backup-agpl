import { NextRequest } from "next/server";

import { evaluateAsrsConfiguration } from "@/lib/fmds/asrs-estimator.server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { POST } from "../route";

jest.mock("@/lib/fmds/asrs-estimator.server", () => ({
  evaluateAsrsConfiguration: jest.fn(),
}));
jest.mock("@/lib/supabase/server", () => ({ getApiRouteUser: jest.fn() }));

const evaluateMock = evaluateAsrsConfiguration as jest.MockedFunction<
  typeof evaluateAsrsConfiguration
>;
const getUserMock = getApiRouteUser as jest.MockedFunction<
  typeof getApiRouteUser
>;

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/fm-global/estimator/evaluate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const routeArgs = { params: Promise.resolve({}) };

describe("POST /api/fm-global/estimator/evaluate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  });

  it("requires authentication", async () => {
    getUserMock.mockResolvedValueOnce(null);

    const response = await POST(
      request({
        ceilingSprinklerType: "standard_coverage",
        designSprinklerCount: 12,
      }),
      routeArgs,
    );

    expect(response.status).toBe(401);
    expect(evaluateMock).not.toHaveBeenCalled();
  });

  it("returns the typed estimator response for a valid request", async () => {
    getUserMock.mockResolvedValueOnce({ id: "user-1" } as never);
    evaluateMock.mockResolvedValueOnce({
      corpus: {
        coverage: "batch1_only",
        documentCode: "FMDS0834",
        revisionId: "11111111-1111-4111-8111-111111111111",
        revisionLabel: "2026-04",
        revisionStatus: "staging",
      },
      requirements: [],
    });

    const response = await POST(
      request({
        ceilingSprinklerType: "standard_coverage",
        designSprinklerCount: 12,
      }),
      routeArgs,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        corpus: expect.objectContaining({ documentCode: "FMDS0834" }),
      }),
    );
  });

  it("rejects invalid sprinkler counts before evaluation", async () => {
    getUserMock.mockResolvedValueOnce({ id: "user-1" } as never);

    const response = await POST(
      request({
        ceilingSprinklerType: "standard_coverage",
        designSprinklerCount: 0,
      }),
      routeArgs,
    );

    expect(response.status).toBe(400);
    expect(evaluateMock).not.toHaveBeenCalled();
  });

  it("rejects partial transverse-flue adequacy inputs before evaluation", async () => {
    getUserMock.mockResolvedValueOnce({ id: "user-1" } as never);

    const response = await POST(
      request({
        ceilingSprinklerType: "standard_coverage",
        designSprinklerCount: 12,
        transverseFlue: { verticallyAligned: true, unobstructedFullHeight: false },
      }),
      routeArgs,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining("actual net width"),
            path: "transverseFlue.actualNetWidthIn",
          }),
        ]),
      }),
    );
    expect(evaluateMock).not.toHaveBeenCalled();
  });
});

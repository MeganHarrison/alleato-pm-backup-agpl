import { NextRequest } from "next/server";

import { GET } from "@/app/api/recruiting/integrations/microsoft/callback/route";
import { logEvent } from "@/lib/guardrails/observability";
import {
  completeMicrosoftOAuth,
  verifyMicrosoftOAuthState,
} from "@/lib/recruiting/microsoft-connection";
import { requireRecruitingAccess } from "@/lib/recruiting/server";
import { createServiceClient } from "@/lib/supabase/service";

jest.mock("@/lib/guardrails/observability", () => ({
  getOrCreateRequestId: jest.fn(() => "request-id"),
  logEvent: jest.fn(),
}));
jest.mock("@/lib/recruiting/server", () => ({
  requireRecruitingAccess: jest.fn(),
}));
jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));
jest.mock("@/lib/recruiting/microsoft-connection", () => ({
  MICROSOFT_OAUTH_COOKIE: "recruiting_microsoft_oauth",
  recruitingAppOrigin: jest.fn(() => "https://projects.alleatogroup.com"),
  verifyMicrosoftOAuthState: jest.fn(),
  completeMicrosoftOAuth: jest.fn(),
}));

const requireAccessMock = requireRecruitingAccess as jest.MockedFunction<
  typeof requireRecruitingAccess
>;
const verifyStateMock = verifyMicrosoftOAuthState as jest.MockedFunction<
  typeof verifyMicrosoftOAuthState
>;
const completeOAuthMock = completeMicrosoftOAuth as jest.MockedFunction<
  typeof completeMicrosoftOAuth
>;
const createServiceClientMock = createServiceClient as jest.MockedFunction<
  typeof createServiceClient
>;

function callbackRequest(query: string) {
  return new NextRequest(
    `https://projects.alleatogroup.com/api/recruiting/integrations/microsoft/callback?${query}`,
    {
      headers: {
        cookie: "recruiting_microsoft_oauth=signed-cookie",
      },
    },
  );
}

describe("recruiting Microsoft callback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAccessMock.mockResolvedValue({
      db: {} as never,
      userEmail: "jgaona@alleatogroup.com",
      viewer: {
        userId: "3019bd67-4068-4b74-acb6-d3166bb070df",
        personId: "ee9a8fb5-3cf6-48db-86a2-b09c07152fef",
        role: "recruiter",
        canRead: true,
        canWrite: true,
        canAdmin: false,
      },
    });
    verifyStateMock.mockReturnValue({
      state: "state-value",
      verifier: "v".repeat(43),
      capability: "mail",
      personId: "ee9a8fb5-3cf6-48db-86a2-b09c07152fef",
      expiresAt: Date.now() + 60_000,
    });
    completeOAuthMock.mockResolvedValue({
      tenantId: "4998a178-5591-4354-811e-d0d6c7994f75",
      microsoftUserId: "microsoft-user",
      email: "jgaona@alleatogroup.com",
      displayName: "Jazmin Gaona",
      scopes: ["User.Read", "Mail.Send"],
      accessTokenCiphertext: "v1.access",
      refreshTokenCiphertext: "v1.refresh",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    createServiceClientMock.mockReturnValue({
      rpc: jest.fn().mockResolvedValue({ data: { saved: true }, error: null }),
    } as never);
  });

  it("binds persistence to the authenticated person and expires the exact state cookie path", async () => {
    const response = await GET(
      callbackRequest("code=code-value&state=state-value"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/recruiting?microsoft=connected",
    );
    expect(response.headers.get("set-cookie")).toContain(
      "Path=/api/recruiting/integrations/microsoft",
    );
    expect(response.headers.get("set-cookie")).toContain(
      "Expires=Thu, 01 Jan 1970",
    );
    expect(completeOAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedEmail: "jgaona@alleatogroup.com",
        capability: "mail",
      }),
    );
    expect(
      (createServiceClientMock.mock.results[0].value as { rpc: jest.Mock }).rpc,
    ).toHaveBeenCalledWith(
      "recruiting_admin_upsert_microsoft_connection",
      expect.objectContaining({
        p_person_id: "ee9a8fb5-3cf6-48db-86a2-b09c07152fef",
      }),
    );
  });

  it("verifies state before accepting a provider denial", async () => {
    const response = await GET(
      callbackRequest("error=access_denied&state=state-value"),
    );

    expect(verifyStateMock).toHaveBeenCalled();
    expect(completeOAuthMock).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toContain(
      "/recruiting?microsoft=denied",
    );
  });

  it("records sanitized telemetry while keeping callback errors generic", async () => {
    completeOAuthMock.mockRejectedValue(
      new Error("Microsoft authorization code exchange failed."),
    );

    const response = await GET(
      callbackRequest("code=bad-code&state=state-value"),
    );

    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "recruiting_microsoft_callback_failed",
        requestId: "request-id",
      }),
    );
    expect(response.headers.get("location")).toBe(
      "https://projects.alleatogroup.com/recruiting?microsoft=error",
    );
  });
});

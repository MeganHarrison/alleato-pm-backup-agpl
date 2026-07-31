import { updateSession, shouldBypassSessionMiddleware } from "../middleware";
import type { NextRequest } from "next/server";

jest.mock("@/lib/validation/callback-url", () => ({
  validateCallbackUrl: (value: string) => value,
}));

type TestCookie = {
  name: string;
  value: string;
};

function encodeBase64Url(value: string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function makeJwt(payload: Record<string, unknown>): string {
  return [
    encodeBase64Url(JSON.stringify({ alg: "none", typ: "JWT" })),
    encodeBase64Url(JSON.stringify(payload)),
    "signature",
  ].join(".");
}

function makeAuthCookie(
  expiresAtSeconds: number,
  email = "test@example.com",
): TestCookie {
  const token = makeJwt({
    sub: "user-1",
    email,
    exp: expiresAtSeconds,
  });
  const session = JSON.stringify({ access_token: token });

  return {
    name: "sb-lgveqfnpkxvzbnnwuled-auth-token",
    value: `base64-${encodeBase64Url(session)}`,
  };
}

function makeRequest(pathname: string, cookies: TestCookie[] = []) {
  const url = new URL(`https://projects.alleatogroup.com${pathname}`);
  return {
    nextUrl: {
      pathname: url.pathname,
      search: url.search,
      clone: () => new URL(url),
    },
    cookies: {
      getAll: jest.fn(() => cookies),
      set: jest.fn(),
    },
  } as unknown as NextRequest;
}

describe("supabase middleware", () => {
  it("bypasses API routes before inspecting auth cookies", async () => {
    const request = makeRequest("/api/projects/983/budget");

    await updateSession(request);

    expect(request.cookies.getAll).not.toHaveBeenCalled();
  });

  it("requires an allowed dashboard owner for admin API routes", async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;

    const denied = await updateSession(
      makeRequest("/api/admin/analytics", [
        makeAuthCookie(futureExp, "admin@alleatogroup.com"),
      ]),
    );
    expect(denied.status).toBe(403);

    const allowed = await updateSession(
      makeRequest("/api/admin/analytics", [
        makeAuthCookie(futureExp, "Megan@megankharrison.com"),
      ]),
    );
    expect(allowed.headers.get("location")).toBeNull();
  });

  it("allows authenticated non-admin users through the Velt feedback bridge", async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;

    const response = await updateSession(
      makeRequest("/api/admin/feedback/velt", [
        makeAuthCookie(futureExp, "test1@mail.com"),
      ]),
    );

    expect(response.status).toBe(200);
  });

  it("allows protected pages when a valid Supabase auth cookie exists", async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;

    const response = await updateSession(
      makeRequest("/983/budget", [makeAuthCookie(futureExp)]),
    );

    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects unauthenticated page requests", async () => {
    const response = await updateSession(makeRequest("/983/budget?tab=costs"));

    expect(response.headers.get("location")).toBe(
      "https://projects.alleatogroup.com/auth/login?callbackUrl=%2F983%2Fbudget%3Ftab%3Dcosts",
    );
  });

  it.each(["/auth/login-v2", "/auth/login-v3"])(
    "redirects legacy login route %s to the canonical login and preserves every query parameter",
    async (legacyPath) => {
      const response = await updateSession(
        makeRequest(
          `${legacyPath}?callbackUrl=%2F983%2Fbudget%3Ftab%3Dcosts&source=bookmark&error=expired`,
        ),
      );

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "https://projects.alleatogroup.com/auth/login?callbackUrl=%2F983%2Fbudget%3Ftab%3Dcosts&source=bookmark&error=expired",
      );
    },
  );

  it("redirects nearly expired Supabase auth cookies", async () => {
    const nearlyExpiredExp = Math.floor(Date.now() / 1000) + 5;

    const response = await updateSession(
      makeRequest("/983/budget", [makeAuthCookie(nearlyExpiredExp)]),
    );

    expect(response.headers.get("location")).toBe(
      "https://projects.alleatogroup.com/auth/login?callbackUrl=%2F983%2Fbudget",
    );
  });

  it("allows the AI assistant for authenticated non-developer users", async () => {
    // Guardrail: the AI assistant is open to all authenticated users. The
    // makeAuthCookie JWT carries no developer claim, so this exercises the
    // non-developer path. If "/ai-assistant" is re-added to
    // DEVELOPER_ONLY_COMPANY_PREFIXES this redirects to /access-denied and fails.
    const futureExp = Math.floor(Date.now() / 1000) + 3600;

    const response = await updateSession(
      makeRequest("/ai-assistant", [makeAuthCookie(futureExp)]),
    );

    expect(response.headers.get("location")).toBeNull();
  });

  it("still gates a developer-only company path for non-developers", async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;

    const response = await updateSession(
      makeRequest("/executive", [makeAuthCookie(futureExp)]),
    );

    expect(response.headers.get("location")).toBe(
      "https://projects.alleatogroup.com/access-denied?reason=developer-only",
    );
  });

  it("gates AI Chat History as developer-only for non-developers", async () => {
    // Guardrail: /ai-chat-history is developer-only (not merely admin). The
    // makeAuthCookie JWT carries no developer claim, so a regular admin hitting
    // this path must be redirected to /access-denied.
    const futureExp = Math.floor(Date.now() / 1000) + 3600;

    const response = await updateSession(
      makeRequest("/ai-chat-history", [makeAuthCookie(futureExp)]),
    );

    expect(response.headers.get("location")).toBe(
      "https://projects.alleatogroup.com/access-denied?reason=developer-only",
    );
  });

  it("keeps static assets out of session middleware", () => {
    expect(shouldBypassSessionMiddleware("/_next/static/chunk.js")).toBe(true);
    expect(shouldBypassSessionMiddleware("/images/logo.png")).toBe(true);
    expect(shouldBypassSessionMiddleware("/983/budget")).toBe(false);
  });

  it("lets downloadable public templates bypass auth (no login redirect)", () => {
    // Regression: these are public /public assets served for download. If the
    // auth middleware runs on them it 307-redirects to /auth/login and the
    // in-app `<a download>` click silently downloads nothing.
    expect(shouldBypassSessionMiddleware("/alleato-budget-template.xlsx")).toBe(
      true,
    );
    expect(shouldBypassSessionMiddleware("/alleato-schedule-template.csv")).toBe(
      true,
    );
    expect(
      shouldBypassSessionMiddleware("/templates/commitments-import-template.xlsx"),
    ).toBe(true);
  });

  it("does not redirect unauthenticated template downloads to login", async () => {
    const response = await updateSession(
      makeRequest("/alleato-budget-template.xlsx"),
    );

    expect(response.headers.get("location")).toBeNull();
  });
});

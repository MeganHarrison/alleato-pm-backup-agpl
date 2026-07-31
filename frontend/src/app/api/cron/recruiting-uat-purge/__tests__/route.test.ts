jest.mock("@/lib/guardrails/api", () => ({
  withApiGuardrails:
    (
      _name: string,
      handler: (input: { request: Request }) => Promise<Response>,
    ) =>
    async (request: Request) => {
      try {
        return await handler({ request });
      } catch (error) {
        return new Response(null, {
          status: (error as { status?: number }).status ?? 500,
        });
      }
    },
}));

const purgeMock = jest.fn();
jest.mock("@/lib/recruiting/intake-uat-service", () => ({
  purgeExpiredRecruitingUatSubmissions: (...args: unknown[]) =>
    purgeMock(...args),
}));

const serviceMock = {};
jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => serviceMock,
}));

import { POST } from "../route";

const originalEnv = process.env;

function request(authorization?: string) {
  return new Request("http://localhost/api/cron/recruiting-uat-purge", {
    method: "POST",
    headers: authorization ? { authorization } : undefined,
  });
}

describe("/api/cron/recruiting-uat-purge", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET: "cron-secret" };
    purgeMock.mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("rejects missing or incorrect cron authorization", async () => {
    await expect(POST(request())).resolves.toMatchObject({ status: 403 });
    await expect(
      POST(request("Bearer incorrect")),
    ).resolves.toMatchObject({ status: 403 });
    expect(purgeMock).not.toHaveBeenCalled();
  });

  it("purges expired UAT records with the service client when authorized", async () => {
    const response = await POST(request("Bearer cron-secret"));
    expect(response.status).toBe(200);
    expect(purgeMock).toHaveBeenCalledWith({ service: serviceMock });
    await expect(response.json()).resolves.toMatchObject({ success: true });
  });
});

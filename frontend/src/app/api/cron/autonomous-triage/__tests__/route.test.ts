jest.mock("@/lib/guardrails/api", () => ({
  // Minimal stand-in: run the handler and map a thrown GuardrailError to a
  // status-coded Response so we can assert the auth gate.
  withApiGuardrails:
    (
      _name: string,
      handler: (input: { request: Request; requestId: string }) => Promise<Response>,
    ) =>
    async (request: Request) => {
      try {
        return await handler({ request, requestId: "test" });
      } catch (err) {
        const status = (err as { status?: number }).status ?? 500;
        return new Response(null, { status });
      }
    },
}));

jest.mock("@/lib/guardrails/observability", () => ({ logEvent: jest.fn() }));

const runAutonomousTriageMock = jest.fn();
jest.mock("@/lib/ai/services/autonomous-triage", () => ({
  runAutonomousTriage: (...args: unknown[]) => runAutonomousTriageMock(...args),
}));

import { POST } from "../route";

const ORIGINAL_ENV = process.env;

function req(headers: Record<string, string> = {}, url = "http://localhost/api/cron/autonomous-triage") {
  return new Request(url, { method: "POST", headers });
}

describe("/api/cron/autonomous-triage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: "cron-secret" };
    delete process.env.AUTONOMOUS_TRIAGE_ENABLED;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("rejects with 401 when the cron secret is missing or wrong", async () => {
    const noAuth = await POST(req());
    expect(noAuth.status).toBe(401);
    const wrong = await POST(req({ authorization: "Bearer nope" }));
    expect(wrong.status).toBe(401);
    expect(runAutonomousTriageMock).not.toHaveBeenCalled();
  });

  it("skips (does not run) when the feature flag is off, even when authed", async () => {
    const response = await POST(req({ authorization: "Bearer cron-secret" }));
    await expect(response.json()).resolves.toEqual({
      success: true,
      skipped: "feature_disabled",
    });
    expect(runAutonomousTriageMock).not.toHaveBeenCalled();
  });

  it("runs when authed and the flag is on, passing dryRun through", async () => {
    process.env.AUTONOMOUS_TRIAGE_ENABLED = "true";
    runAutonomousTriageMock.mockResolvedValue({
      scanned: 3,
      promoted: 1,
      archived: 1,
      kept: 1,
      scoringFailed: 0,
      remainingCandidates: 5,
      pendingHumanPromotions: 2,
      promotedTitles: ["x"],
      topRemaining: [],
      teamsSent: false,
      dryRun: true,
    });

    const response = await POST(
      req(
        { authorization: "Bearer cron-secret" },
        "http://localhost/api/cron/autonomous-triage?dryRun=1",
      ),
    );

    expect(runAutonomousTriageMock).toHaveBeenCalledWith({ dryRun: true });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      promoted: 1,
      dryRun: true,
    });
  });

  it("defaults dryRun to false without the query param", async () => {
    process.env.AUTONOMOUS_TRIAGE_ENABLED = "true";
    runAutonomousTriageMock.mockResolvedValue({ dryRun: false });
    await POST(req({ authorization: "Bearer cron-secret" }));
    expect(runAutonomousTriageMock).toHaveBeenCalledWith({ dryRun: false });
  });
});

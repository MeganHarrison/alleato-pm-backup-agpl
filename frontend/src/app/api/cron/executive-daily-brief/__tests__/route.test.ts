jest.mock("@/lib/guardrails/api", () => ({
  withApiGuardrails:
    (_name: string, handler: (input: { request: Request }) => Promise<Response>) =>
    (request: Request) =>
      handler({ request }),
}));

const fetchMock = jest.fn();

import { GET, POST } from "../route";

const ORIGINAL_ENV = process.env;

describe("/api/cron/executive-daily-brief", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      CRON_SECRET: "cron-secret",
    };
    global.fetch = fetchMock;
    fetchMock.mockResolvedValue(
      Response.json(
        {
          ok: true,
          status: "dry_run",
          runId: "run-1",
        },
        { status: 200 },
      ),
    );
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("proxies scheduled POST delivery through the canonical AI Ops gateway", async () => {
    const response = await POST(
      new Request("http://localhost/api/cron/executive-daily-brief", {
        method: "POST",
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "dry_run",
      runId: "run-1",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      new URL(
        "/api/executive/daily-brief/send-teams",
        "http://localhost/api/cron/executive-daily-brief",
      ),
      {
        method: "POST",
        headers: {
          authorization: "Bearer cron-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      },
    );
  });

  it("uses the same gateway path for GET cron compatibility", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/executive-daily-brief", {
        method: "GET",
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      runId: "run-1",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

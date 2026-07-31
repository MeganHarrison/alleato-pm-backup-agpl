jest.mock("@/lib/guardrails/api", () => ({
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
jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const buildIndexMock = jest.fn();
const checkExistenceMock = jest.fn();
jest.mock("@/lib/admin-feedback/github", () => ({
  buildFeedbackPullRequestIndex: (...args: unknown[]) => buildIndexMock(...args),
  checkGitHubIssueExistence: (...args: unknown[]) => checkExistenceMock(...args),
}));

// Helper: build the issue→PR index the cron consumes.
function indexOf(
  entries: Array<[number, { mergedPr?: unknown; openPr?: unknown }]>,
) {
  return new Map(entries);
}

type FeedbackRow = {
  id: string;
  status: string;
  github_issue_number: number | null;
  metadata: Record<string, unknown> | null;
};

let feedbackRows: FeedbackRow[] = [];
const updateMock = jest.fn().mockResolvedValue({ error: null });

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table !== "admin_feedback_items") {
        throw new Error(`unexpected table ${table}`);
      }
      return {
        select: () => ({
          not: () => ({
            not: () => Promise.resolve({ data: feedbackRows, error: null }),
          }),
        }),
        update: (payload: Record<string, unknown>) => ({
          eq: (_column: string, id: string) => {
            updateMock(id, payload);
            const row = feedbackRows.find((r) => r.id === id);
            if (row) row.status = payload.status as string;
            return Promise.resolve({ error: null });
          },
        }),
      };
    },
  }),
}));

import { POST } from "../route";

function req(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/cron/sync-feedback-pr-status", {
    method: "POST",
    headers,
  });
}

const ORIGINAL_ENV = process.env;

describe("/api/cron/sync-feedback-pr-status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: "cron-secret" };
    feedbackRows = [];
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("rejects with 401 when the cron secret is missing or wrong", async () => {
    const noAuth = await POST(req());
    expect(noAuth.status).toBe(401);
    const wrong = await POST(req({ authorization: "Bearer nope" }));
    expect(wrong.status).toBe(401);
    expect(buildIndexMock).not.toHaveBeenCalled();
  });

  it("sets status to pr_created when an open PR links the issue", async () => {
    feedbackRows = [
      { id: "item-1", status: "open", github_issue_number: 545, metadata: {} },
    ];
    buildIndexMock.mockResolvedValue(
      indexOf([
        [545, { openPr: { number: 10, url: "https://github.com/org/repo/pull/10", state: "open", merged: false } }],
      ]),
    );

    const response = await POST(req({ authorization: "Bearer cron-secret" }));
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      checked: 1,
      prCreated: 1,
      resolved: 0,
    });
    expect(updateMock).toHaveBeenCalledWith(
      "item-1",
      expect.objectContaining({
        status: "pr_created",
        metadata: expect.objectContaining({ linkedPrNumber: 10 }),
      }),
    );
    expect(checkExistenceMock).not.toHaveBeenCalled();
  });

  it("sets status to resolved when the linked PR is merged", async () => {
    feedbackRows = [
      { id: "item-2", status: "pr_created", github_issue_number: 546, metadata: {} },
    ];
    buildIndexMock.mockResolvedValue(
      indexOf([
        [546, { mergedPr: { number: 11, url: "https://github.com/org/repo/pull/11", state: "closed", merged: true } }],
      ]),
    );

    const response = await POST(req({ authorization: "Bearer cron-secret" }));
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      checked: 1,
      prCreated: 0,
      resolved: 1,
    });
    expect(updateMock).toHaveBeenCalledWith(
      "item-2",
      expect.objectContaining({ status: "resolved" }),
    );
  });

  it("flags the item when its linked GitHub issue was deleted", async () => {
    feedbackRows = [
      { id: "item-3", status: "submitted", github_issue_number: 582, metadata: {} },
    ];
    buildIndexMock.mockResolvedValue(indexOf([]));
    checkExistenceMock.mockResolvedValue("deleted");

    const response = await POST(req({ authorization: "Bearer cron-secret" }));
    await expect(response.json()).resolves.toMatchObject({ checked: 1, missing: 1 });
    expect(updateMock).toHaveBeenCalledWith(
      "item-3",
      expect.objectContaining({
        metadata: expect.objectContaining({ githubIssueMissing: true }),
      }),
    );
    // Status is NOT auto-changed — deletion is not resolution.
    expect(updateMock.mock.calls[0][1]).not.toHaveProperty("status");
  });

  it("does not re-probe an item already flagged missing, and leaves live-but-unlinked items alone", async () => {
    feedbackRows = [
      { id: "item-4", status: "submitted", github_issue_number: 583, metadata: { githubIssueMissing: true } },
      { id: "item-5", status: "submitted", github_issue_number: 550, metadata: {} },
    ];
    buildIndexMock.mockResolvedValue(indexOf([]));
    checkExistenceMock.mockResolvedValue("exists");

    const response = await POST(req({ authorization: "Bearer cron-secret" }));
    await expect(response.json()).resolves.toMatchObject({ checked: 2, missing: 0 });
    // item-4 skipped (already flagged); item-5 probed but exists → no update.
    expect(checkExistenceMock).toHaveBeenCalledTimes(1);
    expect(checkExistenceMock).toHaveBeenCalledWith(550);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("does not downgrade an already-matching status", async () => {
    feedbackRows = [
      { id: "item-6", status: "pr_created", github_issue_number: 548, metadata: {} },
    ];
    buildIndexMock.mockResolvedValue(
      indexOf([
        [548, { openPr: { number: 12, url: "https://github.com/org/repo/pull/12", state: "open", merged: false } }],
      ]),
    );

    const response = await POST(req({ authorization: "Bearer cron-secret" }));
    await expect(response.json()).resolves.toMatchObject({ prCreated: 0, resolved: 0 });
    expect(updateMock).not.toHaveBeenCalled();
  });
});

import { NextRequest } from "next/server";

import { DELETE, GET, POST } from "../route";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createGitHubIssue } from "@/lib/admin-feedback/github";
import { notifyTeamsWebhook } from "@/lib/admin-feedback/teams-webhook";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

jest.mock("@/lib/admin-feedback/github", () => ({
  createGitHubIssue: jest.fn(),
}));

jest.mock("@/lib/admin-feedback/storage", () => ({
  ensureAdminFeedbackBucket: jest.fn(),
}));

jest.mock("@/lib/admin-feedback/teams-webhook", () => ({
  notifyTeamsWebhook: jest.fn(),
}));

jest.mock("@/lib/admin-feedback/tool-matcher", () => ({
  getToolById: jest.fn(),
  matchFeedbackToTool: jest.fn(),
}));

jest.mock("@/lib/admin-feedback/context-resolver", () => ({
  contextToAgentPayload: jest.fn(),
  resolveToolContext: jest.fn(),
}));

jest.mock("@/lib/ai/services/agent-learning-service", () => ({
  ingestAdminFeedbackLearning: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const getApiRouteUserMock = getApiRouteUser as jest.MockedFunction<
  typeof getApiRouteUser
>;
const createServiceClientMock = createServiceClient as jest.MockedFunction<
  typeof createServiceClient
>;
const createGitHubIssueMock = createGitHubIssue as jest.MockedFunction<
  typeof createGitHubIssue
>;
const notifyTeamsWebhookMock = notifyTeamsWebhook as jest.MockedFunction<
  typeof notifyTeamsWebhook
>;

type QueryResult = { data: unknown; error: null | { message: string } };
type QueryCall = { op: string; args: unknown[] };

function createQuery(result: QueryResult, calls: QueryCall[]) {
  const query = {
    select: jest.fn((...args: unknown[]) => {
      calls.push({ op: "select", args });
      return query;
    }),
    eq: jest.fn((...args: unknown[]) => {
      calls.push({ op: "eq", args });
      return query;
    }),
    neq: jest.fn((...args: unknown[]) => {
      calls.push({ op: "neq", args });
      return query;
    }),
    in: jest.fn((...args: unknown[]) => {
      calls.push({ op: "in", args });
      return query;
    }),
    not: jest.fn((...args: unknown[]) => {
      calls.push({ op: "not", args });
      return query;
    }),
    order: jest.fn((...args: unknown[]) => {
      calls.push({ op: "order", args });
      return query;
    }),
    range: jest.fn((...args: unknown[]) => {
      calls.push({ op: "range", args });
      return query;
    }),
    delete: jest.fn((...args: unknown[]) => {
      calls.push({ op: "delete", args });
      return query;
    }),
    insert: jest.fn((...args: unknown[]) => {
      calls.push({ op: "insert", args });
      return query;
    }),
    update: jest.fn((...args: unknown[]) => {
      calls.push({ op: "update", args });
      return query;
    }),
    maybeSingle: jest.fn().mockResolvedValue(result),
    single: jest.fn().mockResolvedValue(result),
    then: (
      resolve: (value: QueryResult) => unknown,
      reject: (reason?: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

function makeServiceClient(options?: {
  item?: QueryResult;
  commentsDelete?: QueryResult;
  itemDelete?: QueryResult;
}) {
  const calls: Record<string, QueryCall[]> = {
    admin_feedback_items: [],
    admin_feedback_comments: [],
    user_profiles: [],
  };
  const removeMock = jest.fn().mockResolvedValue({ error: null });
  let feedbackItemsCallCount = 0;

  const client = {
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    storage: {
      from: jest.fn(() => ({ remove: removeMock })),
    },
    from: jest.fn((table: string) => {
      if (table === "user_profiles") {
        return createQuery(
          { data: { is_admin: true }, error: null },
          calls.user_profiles,
        );
      }

      if (table === "admin_feedback_items") {
        feedbackItemsCallCount += 1;
        const result =
          feedbackItemsCallCount === 1
            ? options?.item ?? {
                data: {
                  id: "11111111-1111-4111-8111-111111111111",
                  screenshot_path: "feedback/admin/repro.png",
                },
                error: null,
              }
            : options?.itemDelete ?? { data: null, error: null };
        return createQuery(result, calls.admin_feedback_items);
      }

      if (table === "admin_feedback_comments") {
        return createQuery(
          options?.commentsDelete ?? { data: null, error: null },
          calls.admin_feedback_comments,
        );
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return { client, calls, removeMock };
}

function makeDeleteRequest(id = "11111111-1111-4111-8111-111111111111") {
  return new NextRequest("http://localhost/api/admin/feedback", {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });
}

function makeGetRequest(query = "") {
  const suffix = query ? `?${query}` : "";
  return new NextRequest(`http://localhost/api/admin/feedback${suffix}`, {
    method: "GET",
  });
}

describe("/api/admin/feedback DELETE", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({
      id: "admin-user-id",
      email: "admin@example.com",
    } as never);
  });

  it("deletes comments before the feedback item and removes the item screenshot", async () => {
    const { client, calls, removeMock } = makeServiceClient();
    createServiceClientMock.mockReturnValue(client as never);

    const response = await DELETE(makeDeleteRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(client.from).toHaveBeenCalledWith("admin_feedback_comments");
    expect(client.from).toHaveBeenCalledWith("admin_feedback_items");
    expect(calls.admin_feedback_comments).toContainEqual({
      op: "delete",
      args: [],
    });
    expect(calls.admin_feedback_comments).toContainEqual({
      op: "eq",
      args: ["feedback_item_id", "11111111-1111-4111-8111-111111111111"],
    });
    expect(calls.admin_feedback_items).toContainEqual({
      op: "delete",
      args: [],
    });
    expect(removeMock).toHaveBeenCalledWith(["feedback/admin/repro.png"]);
  });

  it("returns the comment delete error without deleting the feedback item", async () => {
    const { client, calls } = makeServiceClient({
      commentsDelete: {
        data: null,
        error: { message: "comment cleanup failed" },
      },
    });
    createServiceClientMock.mockReturnValue(client as never);

    const response = await DELETE(makeDeleteRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).toContain("comment cleanup failed");
    expect(
      calls.admin_feedback_items.filter((call) => call.op === "delete"),
    ).toHaveLength(0);
  });
});

function makePostServiceClient() {
  const calls: Record<string, QueryCall[]> = {
    admin_feedback_items: [],
    user_profiles: [],
  };

  const client = {
    from: jest.fn((table: string) => {
      if (table === "admin_feedback_items") {
        return createQuery(
          {
            data: {
              id: "11111111-1111-4111-8111-111111111111",
              title: "Bug: broken thing",
              status: "open",
              github_issue_number: null,
              github_issue_url: null,
              github_issue_state: null,
            },
            error: null,
          },
          calls.admin_feedback_items,
        );
      }

      if (table === "user_profiles") {
        return createQuery(
          { data: { is_admin: true }, error: null },
          calls.user_profiles,
        );
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return { client, calls };
}

function makePostRequest(overrides: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost/api/admin/feedback", {
    method: "POST",
    body: JSON.stringify({
      comment: "The Save button is cut off on mobile.",
      pageUrl: "http://localhost/876/budget",
      pagePath: "/876/budget",
      requestType: "bug",
      severity: "medium",
      target: { selector: "#save-btn" },
      ...overrides,
    }),
  });
}

describe("/api/admin/feedback POST — quick-capture gate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({
      id: "admin-user-id",
      email: "admin@example.com",
    } as never);
    notifyTeamsWebhookMock.mockResolvedValue({ ok: true } as never);
  });

  it("saves without creating a GitHub issue or Teams ping by default (createIssue omitted)", async () => {
    const { client } = makePostServiceClient();
    createServiceClientMock.mockReturnValue(client as never);

    const response = await POST(makePostRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.captured).toBe(true);
    expect(body.githubIssue).toBeNull();
    expect(body.githubWarning).toBeNull();
    // The whole side-effect block must be skipped — no issue, no Teams webhook.
    expect(createGitHubIssueMock).not.toHaveBeenCalled();
    expect(notifyTeamsWebhookMock).not.toHaveBeenCalled();
  });

  it("does not create an issue when createIssue is explicitly false", async () => {
    const { client } = makePostServiceClient();
    createServiceClientMock.mockReturnValue(client as never);

    const response = await POST(makePostRequest({ createIssue: false }));
    const body = await response.json();

    expect(body.captured).toBe(true);
    expect(createGitHubIssueMock).not.toHaveBeenCalled();
    expect(notifyTeamsWebhookMock).not.toHaveBeenCalled();
  });

  it("creates a GitHub issue only when createIssue is true", async () => {
    const { client } = makePostServiceClient();
    createServiceClientMock.mockReturnValue(client as never);
    createGitHubIssueMock.mockResolvedValue({
      number: 42,
      url: "https://github.com/acme/repo/issues/42",
      state: "open",
    } as never);

    const response = await POST(makePostRequest({ createIssue: true }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.captured).toBe(false);
    expect(createGitHubIssueMock).toHaveBeenCalledTimes(1);
    expect(notifyTeamsWebhookMock).toHaveBeenCalledTimes(1);
    expect(body.githubIssue).toEqual({
      number: 42,
      url: "https://github.com/acme/repo/issues/42",
      state: "open",
    });
  });
});

describe("/api/admin/feedback GET", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiRouteUserMock.mockResolvedValue({
      id: "admin-user-id",
      email: "admin@example.com",
    } as never);
  });

  it("excludes board-authored product items when requested by the inbox", async () => {
    const calls: Record<string, QueryCall[]> = {
      admin_feedback_items: [],
      user_profiles: [],
    };
    const feedbackItems = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        category: "Navigation",
        created_at: "2026-07-02T12:00:00.000Z",
        updated_at: "2026-07-02T12:00:00.000Z",
        created_by: "user-1",
        project_id: null,
        page_url: "/feedback-inbox",
        page_path: "/feedback-inbox",
        page_title: "Feedback Inbox",
        target_id: null,
        target_selector: "feedback-item",
        target_text: null,
        target_tag: null,
        dom_path: null,
        target_rect: null,
        title: "Broken filter",
        comment: "The filter chips are wrong",
        request_type: "bug",
        severity: "medium",
        status: "open",
        screenshot_url: null,
        screenshot_path: null,
        github_issue_number: null,
        github_issue_url: null,
        github_issue_state: null,
        metadata: {},
        tool_id: null,
        agent_context: null,
      },
    ];

    const client = {
      from: jest.fn((table: string) => {
        if (table === "user_profiles") {
          const userProfilesCallCount = calls.user_profiles.filter(
            (call) => call.op === "select",
          ).length;
          const result =
            userProfilesCallCount === 0
              ? { data: { is_admin: true }, error: null }
              : {
                  data: [{ id: "user-1", email: "submitter@example.com", full_name: "Submitter" }],
                  error: null,
                };
          return createQuery(result, calls.user_profiles);
        }

        if (table === "admin_feedback_items") {
          return createQuery(
            { data: feedbackItems, error: null, count: 1 } as QueryResult & {
              count: number;
            },
            calls.admin_feedback_items,
          );
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    createServiceClientMock.mockReturnValue(client as never);

    const response = await GET(makeGetRequest("excludeBoardItems=true&limit=25"));
    expect(response.status).toBe(200);

    expect(calls.admin_feedback_items).toContainEqual({
      op: "neq",
      args: ["page_path", "/product-board"],
    });
  });
  it("filters feedback items by category when requested", async () => {
    const calls: Record<string, QueryCall[]> = {
      admin_feedback_items: [],
      user_profiles: [],
    };
    const feedbackItems = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        category: "Navigation",
        created_at: "2026-07-02T12:00:00.000Z",
        updated_at: "2026-07-02T12:00:00.000Z",
        created_by: "user-1",
        project_id: null,
        page_url: "/feedback-inbox",
        page_path: "/feedback-inbox",
        page_title: "Feedback Inbox",
        target_id: null,
        target_selector: "feedback-item",
        target_text: null,
        target_tag: null,
        dom_path: null,
        target_rect: null,
        title: "Broken filter",
        comment: "The filter chips are wrong",
        request_type: "bug",
        severity: "medium",
        status: "open",
        screenshot_url: null,
        screenshot_path: null,
        github_issue_number: null,
        github_issue_url: null,
        github_issue_state: null,
        metadata: {},
        tool_id: null,
        agent_context: null,
      },
    ];

    const client = {
      from: jest.fn((table: string) => {
        if (table === "user_profiles") {
          const userProfilesCallCount = calls.user_profiles.filter(
            (call) => call.op === "select",
          ).length;
          const result =
            userProfilesCallCount === 0
              ? { data: { is_admin: true }, error: null }
              : {
                  data: [{ id: "user-1", email: "submitter@example.com", full_name: "Submitter" }],
                  error: null,
                };
          return createQuery(result, calls.user_profiles);
        }

        if (table === "admin_feedback_items") {
          return createQuery(
            { data: feedbackItems, error: null, count: 1 } as QueryResult & {
              count: number;
            },
            calls.admin_feedback_items,
          );
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    createServiceClientMock.mockReturnValue(client as never);

    const response = await GET(makeGetRequest("category=Navigation"));
    expect(response.status).toBe(200);

    expect(calls.admin_feedback_items).toContainEqual({
      op: "eq",
      args: ["category", "Navigation"],
    });
  });
});

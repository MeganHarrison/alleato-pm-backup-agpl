import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import { createTrainingDataAccess } from "../data-access";

type FakeResponse = {
  data: unknown;
  error: { message: string } | null;
};

type Operation = {
  table: string;
  method: string;
  args: unknown[];
};

class FakeBuilder {
  constructor(
    private readonly table: string,
    private readonly response: FakeResponse,
    private readonly operations: Operation[],
  ) {}

  private record(method: string, args: unknown[]) {
    this.operations.push({ table: this.table, method, args });
    return this;
  }

  select(...args: unknown[]) {
    return this.record("select", args);
  }

  update(...args: unknown[]) {
    return this.record("update", args);
  }

  eq(...args: unknown[]) {
    return this.record("eq", args);
  }

  in(...args: unknown[]) {
    return this.record("in", args);
  }

  order(...args: unknown[]) {
    return this.record("order", args);
  }

  textSearch(...args: unknown[]) {
    return this.record("textSearch", args);
  }

  maybeSingle() {
    this.record("maybeSingle", []);
    return Promise.resolve(this.response);
  }

  then<TResult1 = FakeResponse, TResult2 = never>(
    onfulfilled?:
      ((value: FakeResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.response).then(onfulfilled, onrejected);
  }
}

function createFakeClient(
  responses: Record<string, FakeResponse[]>,
  operations: Operation[],
  rpcResponses: FakeResponse[] = [],
) {
  const client = createClient<Database>(
    "http://127.0.0.1:54321",
    "training-test-anon-key",
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  jest.spyOn(client, "from").mockImplementation((table) => {
    const response = responses[table]?.shift();
    if (!response) {
      throw new Error(`No fake response queued for ${table}.`);
    }
    return new FakeBuilder(table, response, operations) as never;
  });
  jest.spyOn(client, "rpc").mockImplementation((functionName, args) => {
    operations.push({
      table: "rpc",
      method: functionName,
      args: [args],
    });
    const response = rpcResponses.shift();
    if (!response) {
      throw new Error(`No fake response queued for RPC ${functionName}.`);
    }
    return Promise.resolve(response) as never;
  });

  return client;
}

const resourceRow = {
  id: "resource-1",
  topic_id: "topic-1",
  title: "Change Management Basics",
  description: "An introduction.",
  url: "https://example.com/change-management",
  embed_url: null,
  thumbnail_url: null,
  provider: "Example",
  resource_type: "course",
  level: "intro",
  track: "change_management",
  status: "published",
  duration_minutes: 30,
  created_at: "2026-07-01T00:00:00.000Z",
  metadata: {},
};

const topicRow = {
  id: "topic-1",
  slug: "change-management",
  name: "Change Management",
  description: null,
  sort_order: 1,
  active: true,
  created_at: "2026-07-26T00:00:00Z",
  updated_at: "2026-07-26T00:00:00Z",
};

const roleRow = {
  id: "role-1",
  slug: "project-manager",
  name: "Project Manager",
  description: null,
  aliases: ["PM"],
  sort_order: 1,
  active: true,
  created_at: "2026-07-26T00:00:00Z",
  updated_at: "2026-07-26T00:00:00Z",
};

test("getResources maps published resources and applies every requested filter", async () => {
  const operations: Operation[] = [];
  const requireReviewer = jest.fn().mockResolvedValue(undefined);
  const access = createTrainingDataAccess(
    createFakeClient(
      {
        training_role: [
          { data: { id: "role-1" }, error: null },
          { data: [roleRow], error: null },
        ],
        training_resource_role: [
          { data: [{ resource_id: "resource-1" }], error: null },
          {
            data: [{ resource_id: "resource-1", role_id: "role-1" }],
            error: null,
          },
        ],
        training_resource: [{ data: [resourceRow], error: null }],
        training_topic: [{ data: [topicRow], error: null }],
      },
      operations,
    ),
    requireReviewer,
  );

  await expect(
    access.getResources({
      role: "project-manager",
      track: "change_management",
      type: "course",
      level: "intro",
      query: "change basics",
    }),
  ).resolves.toEqual([
    {
      id: "resource-1",
      topicId: "topic-1",
      topicSlug: "change-management",
      topicName: "Change Management",
      title: "Change Management Basics",
      description: "An introduction.",
      url: "https://example.com/change-management",
      embedUrl: null,
      thumbnailUrl: null,
      provider: "Example",
      type: "course",
      level: "intro",
      track: "change_management",
      status: "published",
      durationMinutes: 30,
      createdAt: "2026-07-01T00:00:00.000Z",
      discovery: null,
      roles: [
        {
          id: "role-1",
          slug: "project-manager",
          name: "Project Manager",
          description: null,
          aliases: ["PM"],
          sortOrder: 1,
        },
      ],
    },
  ]);

  expect(requireReviewer).not.toHaveBeenCalled();
  expect(
    operations.some(
      (operation) =>
        operation.table === "training_role" &&
        operation.method === "eq" &&
        operation.args[0] === "active",
    ),
  ).toBe(false);
  expect(operations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        table: "training_resource",
        method: "eq",
        args: ["status", "published"],
      }),
      expect.objectContaining({
        table: "training_resource",
        method: "in",
        args: ["id", ["resource-1"]],
      }),
      expect.objectContaining({
        table: "training_resource",
        method: "eq",
        args: ["track", "change_management"],
      }),
      expect.objectContaining({
        table: "training_resource",
        method: "eq",
        args: ["resource_type", "course"],
      }),
      expect.objectContaining({
        table: "training_resource",
        method: "eq",
        args: ["level", "intro"],
      }),
      expect.objectContaining({
        table: "training_resource",
        method: "textSearch",
        args: [
          "search_vector",
          "change basics",
          { config: "english", type: "websearch" },
        ],
      }),
    ]),
  );
});

test("getResources requires reviewer authorization before review reads", async () => {
  const requireReviewer = jest.fn().mockResolvedValue(undefined);
  const access = createTrainingDataAccess(
    createFakeClient(
      {
        training_resource: [{ data: [], error: null }],
      },
      [],
    ),
    requireReviewer,
  );

  await expect(access.getResources({ status: "review" })).resolves.toEqual([]);
  expect(requireReviewer).toHaveBeenCalledWith("training.getResources");
});

test("getResources returns no results for an unknown role without querying resources", async () => {
  const operations: Operation[] = [];
  const access = createTrainingDataAccess(
    createFakeClient(
      {
        training_role: [{ data: null, error: null }],
      },
      operations,
    ),
    jest.fn(),
  );

  await expect(access.getResources({ role: "missing-role" })).resolves.toEqual(
    [],
  );
  expect(
    operations.some((operation) => operation.table === "training_resource"),
  ).toBe(false);
});

test("getResources surfaces a named query failure with filter context", async () => {
  const access = createTrainingDataAccess(
    createFakeClient(
      {
        training_resource: [
          { data: null, error: { message: "database unavailable" } },
        ],
      },
      [],
    ),
    jest.fn(),
  );

  await expect(access.getResources({ track: "safety" })).rejects.toThrow(
    'Training data getResources.resources failed for filters {"track":"safety"}: database unavailable',
  );
});

test("getResources fails loudly when RLS hides a linked role", async () => {
  const access = createTrainingDataAccess(
    createFakeClient(
      {
        training_resource: [{ data: [resourceRow], error: null }],
        training_topic: [{ data: [topicRow], error: null }],
        training_resource_role: [
          {
            data: [{ resource_id: "resource-1", role_id: "inactive-role" }],
            error: null,
          },
        ],
        training_role: [{ data: [], error: null }],
      },
      [],
    ),
    jest.fn(),
  );

  await expect(access.getResources()).rejects.toThrow(
    "Training data getResources mapping failed: roles inactive-role are inaccessible for linked resources.",
  );
});

test("getRoles trusts RLS for active/admin visibility and maps sorted rows", async () => {
  const operations: Operation[] = [];
  const access = createTrainingDataAccess(
    createFakeClient(
      {
        training_role: [{ data: [roleRow], error: null }],
      },
      operations,
    ),
    jest.fn(),
  );

  await expect(access.getRoles()).resolves.toEqual([
    {
      id: "role-1",
      slug: "project-manager",
      name: "Project Manager",
      description: null,
      aliases: ["PM"],
      sortOrder: 1,
    },
  ]);
  expect(
    operations.some(
      (operation) =>
        operation.method === "eq" && operation.args[0] === "active",
    ),
  ).toBe(false);
  expect(operations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        table: "training_role",
        method: "order",
        args: ["sort_order", { ascending: true }],
      }),
    ]),
  );
});

test("getTopics surfaces a named taxonomy failure", async () => {
  const access = createTrainingDataAccess(
    createFakeClient(
      {
        training_topic: [
          { data: null, error: { message: "taxonomy unavailable" } },
        ],
      },
      [],
    ),
    jest.fn(),
  );

  await expect(access.getTopics()).rejects.toThrow(
    "Training data getTopics failed: taxonomy unavailable",
  );
});

describe("reviewResource", () => {
  const resourceId = "9b2ce458-b438-4147-96a0-54f28a58b994";
  const reviewerId = "a50665e0-509d-4d87-a930-d2cfd3abc22a";

  it("publishes through the atomic structured-feedback RPC", async () => {
    const operations: Operation[] = [];
    const requireReviewer = jest.fn().mockResolvedValue(reviewerId);
    const access = createTrainingDataAccess(
      createFakeClient({}, operations, [{ data: "published", error: null }]),
      requireReviewer,
    );

    await expect(
      access.reviewResource({
        resourceId,
        decision: "publish",
        reasonCodes: ["field_applicable", "right_depth"],
        ratings: { relevance: 5, depth: 4, quality: 4 },
      }),
    ).resolves.toBe("published");

    expect(requireReviewer).toHaveBeenCalledWith("training.reviewResource");
    expect(operations).toContainEqual({
      table: "rpc",
      method: "review_training_resource_candidate_locked",
      args: [
        {
          p_resource_id: resourceId,
          p_decision: "publish",
          p_reason_codes: ["field_applicable", "right_depth"],
          p_ratings: { relevance: 5, depth: 4, quality: 4 },
          p_notes: undefined,
        },
      ],
    });
  });

  it("archives with structured concerns and written explanation", async () => {
    const operations: Operation[] = [];
    const access = createTrainingDataAccess(
      createFakeClient({}, operations, [{ data: "archived", error: null }]),
      jest.fn().mockResolvedValue(reviewerId),
    );

    await expect(
      access.reviewResource({
        resourceId,
        decision: "archive",
        reasonCodes: ["promotional", "too_short"],
        ratings: { relevance: 2, depth: 1, quality: 2 },
        notes: "The source is paid and lacks sufficient depth.",
      }),
    ).resolves.toBe("archived");

    expect(operations).toContainEqual({
      table: "rpc",
      method: "review_training_resource_candidate_locked",
      args: [
        expect.objectContaining({
          p_reason_codes: ["promotional", "too_short"],
          p_notes: "The source is paid and lacks sufficient depth.",
        }),
      ],
    });
  });

  it("fails before mutation when the caller is not a reviewer", async () => {
    const operations: Operation[] = [];
    const requireReviewer = jest
      .fn()
      .mockRejectedValue(new Error("Admin access required."));
    const access = createTrainingDataAccess(
      createFakeClient({}, operations),
      requireReviewer,
    );

    await expect(
      access.reviewResource({
        resourceId,
        decision: "publish",
        reasonCodes: ["field_applicable"],
        ratings: {},
      }),
    ).rejects.toThrow("Admin access required.");
    expect(operations).toHaveLength(0);
  });

  it("fails loudly when another reviewer already decided the row", async () => {
    const access = createTrainingDataAccess(
      createFakeClient({}, [], [{ data: null, error: null }]),
      jest.fn().mockResolvedValue(reviewerId),
    );

    await expect(
      access.reviewResource({
        resourceId,
        decision: "publish",
        reasonCodes: ["field_applicable"],
        ratings: {},
      }),
    ).rejects.toThrow(
      `Training resource ${resourceId} returned an unexpected decision receipt.`,
    );
  });

  it("surfaces a named mutation failure", async () => {
    const access = createTrainingDataAccess(
      createFakeClient(
        {},
        [],
        [{ data: null, error: { message: "write unavailable" } }],
      ),
      jest.fn().mockResolvedValue(reviewerId),
    );

    await expect(
      access.reviewResource({
        resourceId,
        decision: "archive",
        reasonCodes: ["poor_quality"],
        ratings: {},
        notes: "The presentation quality is unacceptable.",
      }),
    ).rejects.toThrow(
      'Training data reviewResource failed for filters {"status":"review"}: write unavailable',
    );
  });
});

describe("training discovery metrics", () => {
  it("maps the active policy and measured learning outcomes", async () => {
    const operations: Operation[] = [];
    const access = createTrainingDataAccess(
      createFakeClient({}, operations, [
        {
          data: {
            activePolicy: {
              version: "feedback-ranking-v2",
              explorationRate: 0.15,
              activatedAt: "2026-07-30T00:00:00Z",
              evaluation: { sampleSize: 4 },
            },
            runs: 2,
            candidates: 8,
            reviewed: 4,
            published: 3,
            archived: 1,
            duplicates: 2,
            approvalRate: 0.75,
            strategyPerformance: [
              {
                strategy: "role_topic_course",
                reviewed: 4,
                published: 3,
                approval_rate: 0.75,
              },
            ],
          },
          error: null,
        },
      ]),
      jest.fn().mockResolvedValue("admin-1"),
    );

    await expect(access.getDiscoveryMetrics()).resolves.toEqual(
      expect.objectContaining({
        runs: 2,
        approvalRate: 0.75,
        activePolicy: expect.objectContaining({
          version: "feedback-ranking-v2",
        }),
      }),
    );
    expect(operations).toContainEqual({
      table: "rpc",
      method: "get_training_discovery_admin_metrics",
      args: [undefined],
    });
  });
});

describe("training freshness review", () => {
  const checkId = "10eaaf47-e1fc-4867-8954-05911f10f298";

  it("maps pending evidence to its canonical published resource", async () => {
    const requireReviewer = jest.fn().mockResolvedValue("reviewer-1");
    const access = createTrainingDataAccess(
      createFakeClient(
        {
          training_resource_freshness_checks: [
            {
              data: [
                {
                  id: checkId,
                  resource_id: "resource-1",
                  outcome: "unavailable",
                  recommended_action: "archive",
                  occurrence_count: 2,
                  last_seen_at: "2026-07-27T20:00:00Z",
                  http_status: 410,
                  final_url: resourceRow.url,
                  observed_title: null,
                },
              ],
              error: null,
            },
          ],
          training_resource: [{ data: [resourceRow], error: null }],
          training_topic: [{ data: [topicRow], error: null }],
          training_resource_role: [{ data: [], error: null }],
        },
        [],
      ),
      requireReviewer,
    );

    await expect(access.getPendingFreshnessReviews()).resolves.toEqual([
      expect.objectContaining({
        checkId,
        outcome: "unavailable",
        recommendedAction: "archive",
        occurrenceCount: 2,
        httpStatus: 410,
        resource: expect.objectContaining({
          id: "resource-1",
          status: "published",
        }),
      }),
    ]);
    expect(requireReviewer).toHaveBeenCalledWith(
      "training.getPendingFreshnessReviews",
    );
  });

  it("records the decision through the atomic review RPC and verifies its receipt", async () => {
    const operations: Operation[] = [];
    const requireReviewer = jest.fn().mockResolvedValue("reviewer-1");
    const access = createTrainingDataAccess(
      createFakeClient({}, operations, [{ data: "keep", error: null }]),
      requireReviewer,
    );

    await expect(
      access.reviewFreshnessCheck({
        checkId,
        decision: "keep",
        notes: "The redirect is intentional and still reaches the course.",
      }),
    ).resolves.toBe("keep");
    expect(requireReviewer).toHaveBeenCalledWith(
      "training.reviewFreshnessCheck",
    );
    expect(operations).toContainEqual({
      table: "rpc",
      method: "review_training_resource_freshness_check",
      args: [
        {
          p_check_id: checkId,
          p_decision: "keep",
          p_notes: "The redirect is intentional and still reaches the course.",
        },
      ],
    });
  });

  it("fails loudly when the freshness review receipt does not match", async () => {
    const access = createTrainingDataAccess(
      createFakeClient({}, [], [{ data: "archive", error: null }]),
      jest.fn().mockResolvedValue("reviewer-1"),
    );

    await expect(
      access.reviewFreshnessCheck({
        checkId,
        decision: "keep",
        notes: "This evidence was reviewed by an administrator.",
      }),
    ).rejects.toThrow("returned an unexpected decision receipt");
  });
});

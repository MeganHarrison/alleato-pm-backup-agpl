import { createPlaneWorkspaceItemsRepository } from "../plane-workspace-items-repository";

type Operation = {
  name: string;
  args: unknown[];
};

const item = {
  id: "22222222-2222-4222-8222-222222222222",
  user_id: "11111111-1111-4111-8111-111111111111",
  workspace_key: "alleato",
  project_id: 31,
  item_kind: "favorite" as const,
  entity_type: "project",
  entity_identifier: "31",
  name: "All Implementation",
  href: "/31/plane/work-items",
  sort_order: 65535,
  metadata: {},
  last_accessed_at: "2026-07-31T12:00:00.000Z",
  created_at: "2026-07-31T12:00:00.000Z",
  updated_at: "2026-07-31T12:00:00.000Z",
};

class QueryMock {
  readonly operations: Operation[] = [];

  constructor(
    private readonly result: {
      data: unknown;
      error: { message: string } | null;
    },
  ) {}

  private record(name: string, ...args: unknown[]) {
    this.operations.push({ name, args });
    return this;
  }

  select(columns?: string) {
    return this.record("select", columns);
  }

  eq(column: string, value: unknown) {
    return this.record("eq", column, value);
  }

  order(column: string, options?: { ascending?: boolean }) {
    return this.record("order", column, options);
  }

  limit(count: number) {
    return this.record("limit", count);
  }

  upsert(value: Record<string, unknown>, options: { onConflict: string }) {
    return this.record("upsert", value, options);
  }

  update(value: Record<string, unknown>) {
    return this.record("update", value);
  }

  delete() {
    return this.record("delete");
  }

  single() {
    this.record("single");
    return Promise.resolve(this.result);
  }

  maybeSingle() {
    this.record("maybeSingle");
    return Promise.resolve(this.result);
  }

  then<TResult1 = typeof this.result, TResult2 = never>(
    onfulfilled?:
      | ((value: typeof this.result) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

function clientFor(query: QueryMock) {
  return {
    from: jest.fn(() => query),
  };
}

describe("Plane workspace items repository", () => {
  it("scopes favorite lists by user, workspace, project, and kind", async () => {
    const query = new QueryMock({ data: [item], error: null });
    const client = clientFor(query);
    const repository = createPlaneWorkspaceItemsRepository(client);

    const result = await repository.list({
      userId: item.user_id,
      workspaceKey: "alleato",
      projectId: 31,
      itemKind: "favorite",
      limit: 20,
    });

    expect(result.data).toEqual([item]);
    expect(client.from).toHaveBeenCalledWith("user_workspace_items");
    expect(query.operations).toEqual([
      { name: "select", args: ["*"] },
      { name: "eq", args: ["user_id", item.user_id] },
      { name: "eq", args: ["workspace_key", "alleato"] },
      { name: "eq", args: ["project_id", 31] },
      { name: "eq", args: ["item_kind", "favorite"] },
      { name: "order", args: ["sort_order", { ascending: true }] },
      { name: "order", args: ["created_at", { ascending: false }] },
      { name: "order", args: ["id", { ascending: true }] },
      { name: "limit", args: [20] },
    ]);
  });

  it("orders mixed or recent lists by latest access", async () => {
    const query = new QueryMock({ data: [item], error: null });
    const repository = createPlaneWorkspaceItemsRepository(clientFor(query));

    await repository.list({
      userId: item.user_id,
      workspaceKey: "alleato",
      limit: 50,
    });

    expect(query.operations).toContainEqual({
      name: "order",
      args: ["last_accessed_at", { ascending: false }],
    });
    expect(query.operations).toContainEqual({
      name: "order",
      args: ["id", { ascending: true }],
    });
  });

  it("uses the durable entity identity as its idempotency key", async () => {
    const query = new QueryMock({ data: item, error: null });
    const repository = createPlaneWorkspaceItemsRepository(clientFor(query));

    await repository.upsert({
      user_id: item.user_id,
      workspace_key: item.workspace_key,
      project_id: item.project_id,
      item_kind: item.item_kind,
      entity_type: item.entity_type,
      entity_identifier: item.entity_identifier,
      name: item.name,
      href: item.href,
      sort_order: item.sort_order,
      metadata: item.metadata,
      last_accessed_at: item.last_accessed_at,
    });

    expect(query.operations).toContainEqual({
      name: "upsert",
      args: [
        expect.objectContaining({
          user_id: item.user_id,
          entity_identifier: "31",
        }),
        {
          onConflict:
            "user_id,workspace_key,item_kind,entity_type,entity_identifier",
        },
      ],
    });
  });

  it("always adds the authenticated owner filter to update and delete", async () => {
    const updateQuery = new QueryMock({ data: item, error: null });
    const deleteQuery = new QueryMock({ data: null, error: null });
    const client = {
      from: jest
        .fn()
        .mockReturnValueOnce(updateQuery)
        .mockReturnValueOnce(deleteQuery),
    };
    const repository = createPlaneWorkspaceItemsRepository(client);

    await repository.updateOwned(item.id, item.user_id, {
      name: "Renamed",
    });
    await repository.deleteOwned(item.id, item.user_id);

    for (const query of [updateQuery, deleteQuery]) {
      expect(query.operations).toContainEqual({
        name: "eq",
        args: ["id", item.id],
      });
      expect(query.operations).toContainEqual({
        name: "eq",
        args: ["user_id", item.user_id],
      });
    }
  });
});

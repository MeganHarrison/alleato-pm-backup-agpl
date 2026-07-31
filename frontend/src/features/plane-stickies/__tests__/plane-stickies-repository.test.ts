import { createPlaneStickiesRepository } from "../plane-stickies-repository";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const STICKY_ID = "22222222-2222-4222-8222-222222222222";

const sticky = {
  id: STICKY_ID,
  owner_id: OWNER_ID,
  workspace_key: "alleato",
  scope: "project" as const,
  project_id: 31,
  content: "Coordinate the next release",
  background_color: "gray" as const,
  sort_order: 20,
  is_pinned: true,
  archived_at: null,
  created_at: "2026-07-31T12:00:00.000Z",
  updated_at: "2026-07-31T13:00:00.000Z",
};

type MockQuery = {
  select: jest.Mock;
  eq: jest.Mock;
  is: jest.Mock;
  not: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  single: jest.Mock;
  maybeSingle: jest.Mock;
  then: (resolve: (value: unknown) => void) => void;
};

function queryWith(result: { data: unknown; error: null }): MockQuery {
  const query = {} as MockQuery;
  for (const method of [
    "select",
    "eq",
    "is",
    "not",
    "order",
    "limit",
    "insert",
    "update",
    "delete",
  ]) {
    query[
      method as keyof Pick<
        MockQuery,
        | "select"
        | "eq"
        | "is"
        | "not"
        | "order"
        | "limit"
        | "insert"
        | "update"
        | "delete"
      >
    ] = jest.fn(() => query);
  }
  query.single = jest.fn(async () => result);
  query.maybeSingle = jest.fn(async () => result);
  query.then = (resolve: (value: unknown) => void) => {
    void Promise.resolve(result).then(resolve);
  };
  return query;
}

describe("Plane Stickies repository", () => {
  it("uses deterministic pinned, sort, update, and id ordering", async () => {
    const query = queryWith({ data: [sticky], error: null });
    const client = { from: jest.fn(() => query) };
    const repository = createPlaneStickiesRepository(client);

    await repository.list({
      ownerId: OWNER_ID,
      workspaceKey: "alleato",
      scope: "project",
      projectId: 31,
      archived: false,
      limit: 100,
    });

    expect(client.from).toHaveBeenCalledWith("plane_stickies");
    expect(query.eq).toHaveBeenCalledWith("owner_id", OWNER_ID);
    expect(query.eq).toHaveBeenCalledWith("project_id", 31);
    expect(query.is).toHaveBeenCalledWith("archived_at", null);
    expect(query.order.mock.calls).toEqual([
      ["is_pinned", { ascending: false }],
      ["sort_order", { ascending: true }],
      ["updated_at", { ascending: false }],
      ["id", { ascending: true }],
    ]);
  });

  it("always scopes detail mutations to both id and owner", async () => {
    const query = queryWith({ data: sticky, error: null });
    const repository = createPlaneStickiesRepository({
      from: jest.fn(() => query),
    });

    await repository.updateOwned(STICKY_ID, OWNER_ID, { is_pinned: false });

    expect(query.eq).toHaveBeenCalledWith("id", STICKY_ID);
    expect(query.eq).toHaveBeenCalledWith("owner_id", OWNER_ID);
    expect(query.update).toHaveBeenCalledWith({ is_pinned: false });
  });
});

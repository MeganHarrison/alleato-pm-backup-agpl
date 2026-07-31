import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import { createSkillGrowthDataAccess } from "../skill-growth-server";

jest.mock("server-only", () => ({}));

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
  eq(...args: unknown[]) {
    return this.record("eq", args);
  }
  is(...args: unknown[]) {
    return this.record("is", args);
  }
  or(...args: unknown[]) {
    return this.record("or", args);
  }
  order(...args: unknown[]) {
    return this.record("order", args);
  }
  limit(...args: unknown[]) {
    return this.record("limit", args);
  }
  upsert(...args: unknown[]) {
    return this.record("upsert", args);
  }
  maybeSingle() {
    this.record("maybeSingle", []);
    return Promise.resolve(this.response);
  }
  single() {
    this.record("single", []);
    return Promise.resolve(this.response);
  }
  then<TResult1 = FakeResponse, TResult2 = never>(
    onfulfilled?:
      | ((value: FakeResponse) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.response).then(onfulfilled, onrejected);
  }
}

function createFakeClient(
  responses: Record<string, FakeResponse[]>,
  operations: Operation[],
) {
  const client = createClient<Database>(
    "http://127.0.0.1:54321",
    "training-growth-test-anon-key",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  jest.spyOn(client, "from").mockImplementation((table) => {
    const response = responses[table]?.shift();
    if (!response) throw new Error(`No fake response queued for ${table}.`);
    return new FakeBuilder(table, response, operations) as never;
  });

  return client;
}

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const roleId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const roleSkillId = "11111111-1111-4111-8111-111111111111";
const coreSkillId = "22222222-2222-4222-8222-222222222222";

const roleRow = {
  id: roleId,
  slug: "project-manager",
  name: "Project Manager",
  description: null,
  sort_order: 10,
  active: true,
};
const skillRows = [
  {
    id: coreSkillId,
    role_id: null,
    is_core: true,
    name: "Communication",
    description: "Communicate clearly.",
    importance: 4,
    sort_order: 10,
    active: true,
  },
  {
    id: roleSkillId,
    role_id: roleId,
    is_core: false,
    name: "Scheduling",
    description: "Own the schedule.",
    importance: 5,
    sort_order: 10,
    active: true,
  },
];
const duplicateRoleSkill = {
  id: "33333333-3333-4333-8333-333333333333",
  role_id: roleId,
  is_core: false,
  name: " communication ",
  description: "Redundant role copy.",
  importance: 2,
  sort_order: 20,
  active: true,
};

function phases() {
  return [30, 60, 90].map((days) => ({
    days: days as 30 | 60 | 90,
    action: `${days}-day action`,
    measure: `${days}-day measure`,
  }));
}

function input() {
  return {
    roleId,
    checkinDate: "2026-07-26",
    quarterLabel: "Q3 2026",
    feedbackPerson: "Jamie",
    feedbackFrequency: "Every other Friday",
    rescoreDays: 60 as const,
    nextCheckinDate: "2026-09-24",
    makeTimeBy: "Delegate routine filing",
    focusSkillIds: [coreSkillId, roleSkillId],
    scores: [
      { skillId: coreSkillId, score: 40, target: 70 },
      { skillId: roleSkillId, score: 30, target: 80 },
    ],
    plans: skillRows.map((skill) => ({
      skillId: skill.id,
      description: "Client-supplied description",
      evidence: {
        situation: "Weekly coordination meeting",
        behavior: "Prepared the constraint log",
        outcome: "Closed constraints before the next meeting",
      },
      frequency: "Weekly",
      resource: "Look-ahead SOP",
      feedback: "Jamie reviews it the next day",
      phases: phases(),
    })),
  };
}

function savedRow() {
  const request = input();
  return {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    role_id: roleId,
    role_name: "Project Manager",
    checkin_date: request.checkinDate,
    scores: skillRows.map((skill, index) => ({
      skillId: skill.id,
      name: skill.name,
      score: request.scores[index].score,
      target: request.scores[index].target,
      importance: skill.importance,
      isCore: skill.is_core,
    })),
    quarter_label: request.quarterLabel,
    feedback_person: request.feedbackPerson,
    feedback_frequency: request.feedbackFrequency,
    rescore_days: request.rescoreDays,
    next_checkin_date: request.nextCheckinDate,
    make_time_by: request.makeTimeBy,
    skill_plans: skillRows.map((skill, index) => ({
      ...request.plans[index],
      description: skill.description,
      isFocus: true,
      sortOrder: index,
    })),
    created_at: "2026-07-26T12:00:00Z",
    updated_at: "2026-07-26T12:00:00Z",
  };
}

describe("createSkillGrowthDataAccess", () => {
  it("combines universal core skills with each role in one bounded load", async () => {
    const operations: Operation[] = [];
    const access = createSkillGrowthDataAccess(
      createFakeClient(
        {
          training_role: [{ data: [roleRow], error: null }],
          training_role_skill: [
            { data: [...skillRows, duplicateRoleSkill], error: null },
          ],
          training_skill_checkin: [{ data: [], error: null }],
        },
        operations,
      ),
      userId,
    );

    const result = await access.load();

    expect(result.roles[0].skills.map((skill) => skill.name)).toEqual([
      "Communication",
      "Scheduling",
    ]);
    expect(
      operations.filter(
        (operation) =>
          operation.table === "training_skill_checkin" &&
          operation.method === "select",
      ),
    ).toHaveLength(1);
    expect(operations).toContainEqual(
      expect.objectContaining({
        table: "training_skill_checkin",
        method: "limit",
        args: [201],
      }),
    );
    expect(result.historyTruncated).toBe(false);
  });

  it("keeps the page usable when older history is truncated", async () => {
    const history = Array.from({ length: 201 }, (_, index) => ({
      ...savedRow(),
      id: `${String(index).padStart(8, "0")}-eeee-4eee-8eee-eeeeeeeeeeee`,
    }));
    const access = createSkillGrowthDataAccess(
      createFakeClient({
        training_role: [{ data: [roleRow], error: null }],
        training_role_skill: [{ data: skillRows, error: null }],
        training_skill_checkin: [{ data: history, error: null }],
      }, []),
      userId,
    );

    const result = await access.load();

    expect(result.checkins).toHaveLength(200);
    expect(result.historyTruncated).toBe(true);
  });

  it("binds canonical core and role metadata while preserving user focus choices", async () => {
    const operations: Operation[] = [];
    const access = createSkillGrowthDataAccess(
      createFakeClient(
        {
          training_role: [{ data: roleRow, error: null }],
          training_role_skill: [{ data: skillRows, error: null }],
          training_skill_checkin: [{ data: savedRow(), error: null }],
        },
        operations,
      ),
      userId,
    );

    await access.save(input());

    const filter = operations.find(
      (operation) =>
        operation.table === "training_role_skill" && operation.method === "or",
    );
    expect(filter?.args[0]).toContain("role_id.is.null");

    const upsert = operations.find(
      (operation) =>
        operation.table === "training_skill_checkin" &&
        operation.method === "upsert",
    );
    expect(upsert?.args[0]).toEqual(
      expect.objectContaining({
        user_id: userId,
        role_name: "Project Manager",
        skill_plans: [
          expect.objectContaining({
            skillId: coreSkillId,
            description: "Communicate clearly.",
            isFocus: true,
            phases: expect.arrayContaining([
              expect.objectContaining({ days: 30 }),
              expect.objectContaining({ days: 90 }),
            ]),
          }),
          expect.objectContaining({
            skillId: roleSkillId,
            description: "Own the schedule.",
            isFocus: true,
          }),
        ],
      }),
    );
  });

  it("rejects a selected skill without a positive target gap", async () => {
    const operations: Operation[] = [];
    const access = createSkillGrowthDataAccess(
      createFakeClient(
        {
          training_role: [{ data: roleRow, error: null }],
          training_role_skill: [{ data: skillRows, error: null }],
        },
        operations,
      ),
      userId,
    );
    const request = input();
    request.scores[0] = { skillId: coreSkillId, score: 70, target: 70 };

    await expect(access.save(request)).rejects.toMatchObject({
      code: "INVALID_PAYLOAD",
      where: "training.growth.save.focusSelection",
    });
    expect(operations.some((operation) => operation.method === "upsert")).toBe(
      false,
    );
  });

  it("rejects an incomplete 30/60/90 plan before writing", async () => {
    const operations: Operation[] = [];
    const access = createSkillGrowthDataAccess(
      createFakeClient(
        {
          training_role: [{ data: roleRow, error: null }],
          training_role_skill: [{ data: skillRows, error: null }],
        },
        operations,
      ),
      userId,
    );
    const request = input();
    request.plans[0].phases[2].measure = "";

    await expect(access.save(request)).rejects.toMatchObject({
      code: "INVALID_PAYLOAD",
      where: "training.growth.save.focusPlan",
    });
    expect(operations.some((operation) => operation.method === "upsert")).toBe(
      false,
    );
  });
});

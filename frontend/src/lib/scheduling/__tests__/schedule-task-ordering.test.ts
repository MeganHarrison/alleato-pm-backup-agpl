import {
  lastScheduleSiblingTaskId,
  normalizeScheduleTaskOrder,
  planScheduleTaskInsertion,
  planScheduleTaskMove,
  type ScheduleOrderTask,
} from "@/lib/scheduling/schedule-task-ordering";

function task(
  id: string,
  sortOrder: number,
  parentTaskId: string | null = null,
): ScheduleOrderTask {
  return {
    id,
    parent_task_id: parentTaskId,
    sort_order: sortOrder,
    schedule_version: sortOrder + 10,
  };
}

describe("schedule task ordering", () => {
  it("selects the final canonical sibling without being confused by flattened children", () => {
    expect(
      lastScheduleSiblingTaskId(
        [
          task("root-b", 2),
          task("root-a", 1),
          task("child-after-b", 99, "root-b"),
        ],
        null,
      ),
    ).toBe("root-b");
  });

  it("normalizes each sibling group deterministically without mutating inputs", () => {
    const tasks = [
      task("root-b", 10),
      task("root-a", 10),
      task("parent", 30),
      task("child-b", 9, "parent"),
      task("child-a", 2, "parent"),
    ];
    const before = structuredClone(tasks);

    expect(normalizeScheduleTaskOrder(tasks)).toEqual([
      {
        task_id: "child-a",
        parent_task_id: "parent",
        sort_order: 1,
        expected_schedule_version: 12,
      },
      {
        task_id: "child-b",
        parent_task_id: "parent",
        sort_order: 2,
        expected_schedule_version: 19,
      },
      {
        task_id: "parent",
        parent_task_id: null,
        sort_order: 3,
        expected_schedule_version: 40,
      },
      {
        task_id: "root-a",
        parent_task_id: null,
        sort_order: 1,
        expected_schedule_version: 20,
      },
      {
        task_id: "root-b",
        parent_task_id: null,
        sort_order: 2,
        expected_schedule_version: 20,
      },
    ]);
    expect(tasks).toEqual(before);
  });

  it("plans Enter insertion immediately after the anchor and renumbers following siblings", () => {
    const plan = planScheduleTaskInsertion({
      tasks: [task("a", 1), task("b", 2), task("c", 3)],
      new_task_id: "new",
      after_task_id: "a",
    });

    expect(plan).toEqual({
      insert: {
        task_id: "new",
        parent_task_id: null,
        sort_order: 2,
      },
      updates: [
        {
          task_id: "b",
          parent_task_id: null,
          sort_order: 3,
          expected_schedule_version: 12,
        },
        {
          task_id: "c",
          parent_task_id: null,
          sort_order: 4,
          expected_schedule_version: 13,
        },
      ],
      expected_siblings: [
        {
          task_id: "a",
          parent_task_id: null,
          sort_order: 1,
          expected_schedule_version: 11,
        },
        {
          task_id: "b",
          parent_task_id: null,
          sort_order: 2,
          expected_schedule_version: 12,
        },
        {
          task_id: "c",
          parent_task_id: null,
          sort_order: 3,
          expected_schedule_version: 13,
        },
      ],
    });
  });

  it("appends without an anchor and keeps insertion within the requested parent", () => {
    const plan = planScheduleTaskInsertion({
      tasks: [
        task("parent", 1),
        task("child-a", 1, "parent"),
        task("child-b", 2, "parent"),
      ],
      new_task_id: "child-c",
      parent_task_id: "parent",
    });

    expect(plan.insert).toEqual({
      task_id: "child-c",
      parent_task_id: "parent",
      sort_order: 3,
    });
    expect(plan.updates).toEqual([]);
    expect(plan.expected_siblings.map((item) => item.task_id)).toEqual([
      "child-a",
      "child-b",
    ]);
  });

  it("moves within one sibling group using a zero-based target index", () => {
    const plan = planScheduleTaskMove({
      tasks: [task("a", 1), task("b", 2), task("c", 3)],
      task_id: "c",
      target_parent_task_id: null,
      target_index: 0,
    });

    expect(plan).toEqual({
      moved_task_id: "c",
      parent_task_id: null,
      sort_order: 1,
      updates: [
        {
          task_id: "a",
          parent_task_id: null,
          sort_order: 2,
          expected_schedule_version: 11,
        },
        {
          task_id: "b",
          parent_task_id: null,
          sort_order: 3,
          expected_schedule_version: 12,
        },
        {
          task_id: "c",
          parent_task_id: null,
          sort_order: 1,
          expected_schedule_version: 13,
        },
      ],
      expected_siblings: [
        {
          task_id: "a",
          parent_task_id: null,
          sort_order: 1,
          expected_schedule_version: 11,
        },
        {
          task_id: "b",
          parent_task_id: null,
          sort_order: 2,
          expected_schedule_version: 12,
        },
        {
          task_id: "c",
          parent_task_id: null,
          sort_order: 3,
          expected_schedule_version: 13,
        },
      ],
    });
  });

  it("moves across parents and renumbers both affected sibling groups", () => {
    const plan = planScheduleTaskMove({
      tasks: [
        task("p1", 1),
        task("p2", 2),
        task("a", 1, "p1"),
        task("b", 2, "p1"),
        task("c", 1, "p2"),
      ],
      task_id: "a",
      target_parent_task_id: "p2",
      target_index: 1,
    });

    expect(plan.parent_task_id).toBe("p2");
    expect(plan.sort_order).toBe(2);
    expect(plan.updates).toEqual([
      {
        task_id: "a",
        parent_task_id: "p2",
        sort_order: 2,
        expected_schedule_version: 11,
      },
      {
        task_id: "b",
        parent_task_id: "p1",
        sort_order: 1,
        expected_schedule_version: 12,
      },
    ]);
    expect(plan.expected_siblings.map((item) => item.task_id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("rejects invalid hierarchies, targets, and insertion conflicts", () => {
    expect(() =>
      normalizeScheduleTaskOrder([task("a", 1), task("a", 2)]),
    ).toThrow("duplicate task id a");
    expect(() =>
      normalizeScheduleTaskOrder([
        { ...task("a", 1), schedule_version: -1 },
      ]),
    ).toThrow("invalid schedule_version");
    expect(() =>
      normalizeScheduleTaskOrder([task("a", 1, "missing")]),
    ).toThrow("references missing parent");
    expect(() =>
      normalizeScheduleTaskOrder([
        task("a", 1, "b"),
        task("b", 1, "a"),
      ]),
    ).toThrow("contains a cycle");
    expect(() =>
      planScheduleTaskInsertion({
        tasks: [task("a", 1)],
        new_task_id: "a",
      }),
    ).toThrow("already exists");
    expect(() =>
      planScheduleTaskInsertion({
        tasks: [task("parent", 1), task("child", 1, "parent")],
        new_task_id: "new",
        after_task_id: "child",
        parent_task_id: null,
      }),
    ).toThrow("must be siblings");
    expect(() =>
      planScheduleTaskMove({
        tasks: [task("parent", 1), task("child", 1, "parent")],
        task_id: "parent",
        target_parent_task_id: "child",
        target_index: 0,
      }),
    ).toThrow("beneath itself or a descendant");
    expect(() =>
      planScheduleTaskMove({
        tasks: [task("a", 1)],
        task_id: "a",
        target_parent_task_id: null,
        target_index: 2,
      }),
    ).toThrow("exceeds sibling count");
  });
});

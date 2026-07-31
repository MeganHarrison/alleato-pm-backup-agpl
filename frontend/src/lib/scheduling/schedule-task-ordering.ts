export interface ScheduleOrderTask {
  id: string;
  parent_task_id: string | null;
  sort_order: number;
  schedule_version: number;
}

type ScheduleSiblingAnchorTask = Pick<
  ScheduleOrderTask,
  "id" | "parent_task_id" | "sort_order"
>;

export interface ScheduleOrderUpdate {
  task_id: string;
  parent_task_id: string | null;
  sort_order: number;
  expected_schedule_version: number;
}

export interface ScheduleOrderExpectation {
  task_id: string;
  parent_task_id: string | null;
  sort_order: number;
  expected_schedule_version: number;
}

export interface ScheduleInsertPlan {
  insert: {
    task_id: string;
    parent_task_id: string | null;
    sort_order: number;
  };
  updates: ScheduleOrderUpdate[];
  expected_siblings: ScheduleOrderExpectation[];
}

export interface ScheduleMovePlan {
  moved_task_id: string;
  parent_task_id: string | null;
  sort_order: number;
  updates: ScheduleOrderUpdate[];
  expected_siblings: ScheduleOrderExpectation[];
}

function compareTaskOrder(
  left: ScheduleSiblingAnchorTask,
  right: ScheduleSiblingAnchorTask,
): number {
  if (left.sort_order !== right.sort_order) {
    return left.sort_order - right.sort_order;
  }
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

export function lastScheduleSiblingTaskId(
  tasks: readonly ScheduleSiblingAnchorTask[],
  parentTaskId: string | null,
): string | null {
  const siblings = tasks
    .filter((task) => task.parent_task_id === parentTaskId)
    .sort(compareTaskOrder);
  return siblings.at(-1)?.id ?? null;
}

function validateTasks(tasks: ScheduleOrderTask[]): Map<string, ScheduleOrderTask> {
  const tasksById = new Map<string, ScheduleOrderTask>();
  for (const task of tasks) {
    if (!task.id.trim()) throw new Error("Schedule ordering requires a task id.");
    if (!Number.isFinite(task.sort_order)) {
      throw new Error(`Task ${task.id} has an invalid sort_order.`);
    }
    if (
      !Number.isInteger(task.schedule_version) ||
      task.schedule_version < 0
    ) {
      throw new Error(`Task ${task.id} has an invalid schedule_version.`);
    }
    if (tasksById.has(task.id)) {
      throw new Error(`Schedule ordering received duplicate task id ${task.id}.`);
    }
    tasksById.set(task.id, task);
  }
  for (const task of tasks) {
    if (task.parent_task_id && !tasksById.has(task.parent_task_id)) {
      throw new Error(
        `Task ${task.id} references missing parent ${task.parent_task_id}.`,
      );
    }
  }
  for (const task of tasks) {
    const visited = new Set<string>([task.id]);
    let cursor = task.parent_task_id;
    while (cursor) {
      if (visited.has(cursor)) {
        throw new Error(`Schedule hierarchy contains a cycle at task ${cursor}.`);
      }
      visited.add(cursor);
      cursor = tasksById.get(cursor)?.parent_task_id ?? null;
    }
  }
  return tasksById;
}

function groupSiblings(
  tasks: ScheduleOrderTask[],
): Map<string | null, ScheduleOrderTask[]> {
  const siblings = new Map<string | null, ScheduleOrderTask[]>();
  for (const task of tasks) {
    const group = siblings.get(task.parent_task_id) ?? [];
    group.push(task);
    siblings.set(task.parent_task_id, group);
  }
  for (const group of siblings.values()) group.sort(compareTaskOrder);
  return siblings;
}

function updateFor(
  task: ScheduleOrderTask,
  parentTaskId: string | null,
  sortOrder: number,
): ScheduleOrderUpdate {
  return {
    task_id: task.id,
    parent_task_id: parentTaskId,
    sort_order: sortOrder,
    expected_schedule_version: task.schedule_version,
  };
}

function expectationsFor(
  groups: ScheduleOrderTask[][],
): ScheduleOrderExpectation[] {
  const byTaskId = new Map<string, ScheduleOrderExpectation>();
  for (const group of groups) {
    for (const task of group) {
      byTaskId.set(task.id, {
        task_id: task.id,
        parent_task_id: task.parent_task_id,
        sort_order: task.sort_order,
        expected_schedule_version: task.schedule_version,
      });
    }
  }
  return [...byTaskId.values()].sort((left, right) =>
    left.task_id < right.task_id ? -1 : left.task_id > right.task_id ? 1 : 0
  );
}

function changedUpdates(
  originalById: Map<string, ScheduleOrderTask>,
  orderedGroups: Array<{
    parent_task_id: string | null;
    tasks: ScheduleOrderTask[];
  }>,
): ScheduleOrderUpdate[] {
  const updates: ScheduleOrderUpdate[] = [];
  for (const group of orderedGroups) {
    group.tasks.forEach((task, index) => {
      const nextSortOrder = index + 1;
      const original = originalById.get(task.id);
      if (
        !original ||
        original.parent_task_id !== group.parent_task_id ||
        original.sort_order !== nextSortOrder
      ) {
        updates.push(updateFor(task, group.parent_task_id, nextSortOrder));
      }
    });
  }
  return updates.sort((left, right) =>
    left.task_id < right.task_id ? -1 : left.task_id > right.task_id ? 1 : 0
  );
}

export function normalizeScheduleTaskOrder(
  tasks: ScheduleOrderTask[],
): ScheduleOrderUpdate[] {
  const tasksById = validateTasks(tasks);
  const siblings = groupSiblings(tasks);
  return changedUpdates(
    tasksById,
    [...siblings.values()].map((group) => ({
      parent_task_id: group[0]?.parent_task_id ?? null,
      tasks: group,
    })),
  );
}

export function planScheduleTaskInsertion(input: {
  tasks: ScheduleOrderTask[];
  new_task_id: string;
  after_task_id?: string | null;
  parent_task_id?: string | null;
}): ScheduleInsertPlan {
  const tasksById = validateTasks(input.tasks);
  if (!input.new_task_id.trim()) {
    throw new Error("Schedule insertion requires a new_task_id.");
  }
  if (tasksById.has(input.new_task_id)) {
    throw new Error(`Schedule task ${input.new_task_id} already exists.`);
  }

  const afterTask = input.after_task_id
    ? tasksById.get(input.after_task_id)
    : null;
  if (input.after_task_id && !afterTask) {
    throw new Error(`Insertion anchor ${input.after_task_id} does not exist.`);
  }
  const targetParent =
    afterTask?.parent_task_id ?? input.parent_task_id ?? null;
  if (input.parent_task_id !== undefined && afterTask) {
    if (input.parent_task_id !== afterTask.parent_task_id) {
      throw new Error("Insertion anchor and parent_task_id must be siblings.");
    }
  }
  if (targetParent && !tasksById.has(targetParent)) {
    throw new Error(`Insertion parent ${targetParent} does not exist.`);
  }

  const siblings = (groupSiblings(input.tasks).get(targetParent) ?? [])
    .slice();
  const expectedSiblings = expectationsFor([siblings]);
  const insertIndex = afterTask
    ? siblings.findIndex((task) => task.id === afterTask.id) + 1
    : siblings.length;
  const placeholder: ScheduleOrderTask = {
    id: input.new_task_id,
    parent_task_id: targetParent,
    sort_order: insertIndex + 1,
    // The placeholder never escapes the planner or participates in CAS.
    schedule_version: 0,
  };
  siblings.splice(insertIndex, 0, placeholder);
  const updates = changedUpdates(tasksById, [
    { parent_task_id: targetParent, tasks: siblings },
  ]).filter((update) => update.task_id !== input.new_task_id);

  return {
    insert: {
      task_id: input.new_task_id,
      parent_task_id: targetParent,
      sort_order: insertIndex + 1,
    },
    updates,
    expected_siblings: expectedSiblings,
  };
}

export function planScheduleTaskMove(input: {
  tasks: ScheduleOrderTask[];
  task_id: string;
  target_parent_task_id: string | null;
  target_index: number;
}): ScheduleMovePlan {
  const tasksById = validateTasks(input.tasks);
  const movedTask = tasksById.get(input.task_id);
  if (!movedTask) throw new Error(`Schedule task ${input.task_id} does not exist.`);
  if (
    !Number.isInteger(input.target_index) ||
    input.target_index < 0
  ) {
    throw new Error("Schedule move target_index must be a non-negative integer.");
  }
  if (
    input.target_parent_task_id &&
    !tasksById.has(input.target_parent_task_id)
  ) {
    throw new Error(
      `Move parent ${input.target_parent_task_id} does not exist.`,
    );
  }

  let cursor = input.target_parent_task_id;
  while (cursor) {
    if (cursor === movedTask.id) {
      throw new Error("A schedule task cannot move beneath itself or a descendant.");
    }
    cursor = tasksById.get(cursor)?.parent_task_id ?? null;
  }

  const siblings = groupSiblings(input.tasks);
  const sourceParent = movedTask.parent_task_id;
  const originalSourceGroup = siblings.get(sourceParent) ?? [];
  const originalTargetGroup =
    sourceParent === input.target_parent_task_id
      ? originalSourceGroup
      : (siblings.get(input.target_parent_task_id) ?? []);
  const expectedSiblings = expectationsFor([
    originalSourceGroup,
    originalTargetGroup,
  ]);
  const sourceGroup = originalSourceGroup
    .filter((task) => task.id !== movedTask.id);
  const targetGroup =
    sourceParent === input.target_parent_task_id
      ? sourceGroup
      : originalTargetGroup.slice();
  if (input.target_index > targetGroup.length) {
    throw new Error(
      `Schedule move target_index ${input.target_index} exceeds sibling count ${targetGroup.length}.`,
    );
  }
  targetGroup.splice(input.target_index, 0, {
    ...movedTask,
    parent_task_id: input.target_parent_task_id,
  });

  const groups = [
    {
      parent_task_id: input.target_parent_task_id,
      tasks: targetGroup,
    },
  ];
  if (sourceParent !== input.target_parent_task_id) {
    groups.push({ parent_task_id: sourceParent, tasks: sourceGroup });
  }
  const updates = changedUpdates(tasksById, groups);
  const movedUpdate = updates.find((update) => update.task_id === movedTask.id);
  const movedSortOrder =
    movedUpdate?.sort_order ??
    targetGroup.findIndex((task) => task.id === movedTask.id) + 1;

  return {
    moved_task_id: movedTask.id,
    parent_task_id: input.target_parent_task_id,
    sort_order: movedSortOrder,
    updates,
    expected_siblings: expectedSiblings,
  };
}

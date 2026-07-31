import {
  applyPredecessorShorthandEdit,
  applySuccessorShorthandEdit,
  diffDependencyShorthand,
  formatDependencyShorthand,
  parseDependencyShorthand,
} from "../schedule-dependency-shorthand";

const rowNumberToTaskId: Record<number, string> = { 1: "task-A", 2: "task-B", 3: "task-C", 4: "task-D" };
const resolveRowNumber = (rowNumber: number) => rowNumberToTaskId[rowNumber];
const taskIdToRowNumber: Record<string, number> = { "task-A": 1, "task-B": 2, "task-C": 3, "task-D": 4 };
const rowNumberForTaskId = (taskId: string) => taskIdToRowNumber[taskId];

describe("parseDependencyShorthand", () => {
  it("defaults to finish-to-start with zero lag for a bare row number", () => {
    expect(parseDependencyShorthand("3", resolveRowNumber)).toEqual({
      entries: [{ predecessor_task_id: "task-C", dependency_type: "finish_to_start", lag_days: 0 }],
      errors: [],
    });
  });

  it.each([
    ["3FS", "finish_to_start", 0],
    ["3SS", "start_to_start", 0],
    ["3FF", "finish_to_finish", 0],
    ["3SF", "start_to_finish", 0],
    ["3fs", "finish_to_start", 0],
    ["3FS+2", "finish_to_start", 2],
    ["3SS-1", "start_to_start", -1],
  ] as const)("parses %s", (token, type, lag) => {
    const result = parseDependencyShorthand(token, resolveRowNumber);
    expect(result.entries).toEqual([{ predecessor_task_id: "task-C", dependency_type: type, lag_days: lag }]);
    expect(result.errors).toEqual([]);
  });

  it("parses multiple comma-separated entries", () => {
    const result = parseDependencyShorthand("1, 4SS-1", resolveRowNumber);
    expect(result.entries).toEqual([
      { predecessor_task_id: "task-A", dependency_type: "finish_to_start", lag_days: 0 },
      { predecessor_task_id: "task-D", dependency_type: "start_to_start", lag_days: -1 },
    ]);
  });

  it("returns no entries or errors for empty input", () => {
    expect(parseDependencyShorthand("", resolveRowNumber)).toEqual({ entries: [], errors: [] });
    expect(parseDependencyShorthand("   ", resolveRowNumber)).toEqual({ entries: [], errors: [] });
  });

  it("reports a named error for malformed syntax without throwing", () => {
    const result = parseDependencyShorthand("abc", resolveRowNumber);
    expect(result.entries).toEqual([]);
    expect(result.errors).toEqual([expect.stringContaining('"abc" isn\'t a valid entry')]);
  });

  it("reports a named error for a row number with no task", () => {
    const result = parseDependencyShorthand("99", resolveRowNumber);
    expect(result.entries).toEqual([]);
    expect(result.errors).toEqual(["No task at row 99."]);
  });

  it("parses the valid entries and reports errors for the invalid ones in a mixed list", () => {
    const result = parseDependencyShorthand("1, xyz, 99", resolveRowNumber);
    expect(result.entries).toEqual([
      { predecessor_task_id: "task-A", dependency_type: "finish_to_start", lag_days: 0 },
    ]);
    expect(result.errors).toHaveLength(2);
  });
});

describe("formatDependencyShorthand", () => {
  it("round-trips a bare finish-to-start entry without a type suffix", () => {
    const entries = [{ predecessor_task_id: "task-C", dependency_type: "finish_to_start" as const, lag_days: 0 }];
    expect(formatDependencyShorthand(entries, rowNumberForTaskId)).toBe("3");
  });

  it("includes the type and lag suffix when either is non-default", () => {
    const entries = [
      { predecessor_task_id: "task-A", dependency_type: "finish_to_start" as const, lag_days: 2 },
      { predecessor_task_id: "task-D", dependency_type: "start_to_start" as const, lag_days: -1 },
    ];
    expect(formatDependencyShorthand(entries, rowNumberForTaskId)).toBe("1FS+2, 4SS-1");
  });

  it("omits an entry whose task has no known row number", () => {
    const entries = [{ predecessor_task_id: "unknown-task", dependency_type: "finish_to_start" as const, lag_days: 0 }];
    expect(formatDependencyShorthand(entries, rowNumberForTaskId)).toBe("");
  });
});

describe("diffDependencyShorthand", () => {
  it("creates entries with no existing match", () => {
    const result = diffDependencyShorthand([], [
      { predecessor_task_id: "task-A", dependency_type: "finish_to_start", lag_days: 0 },
    ]);
    expect(result).toEqual({
      toCreate: [{ predecessor_task_id: "task-A", dependency_type: "finish_to_start", lag_days: 0 }],
      toUpdate: [],
      toRemove: [],
    });
  });

  it("updates an existing dependency whose type or lag changed", () => {
    const result = diffDependencyShorthand(
      [{ id: "dep-1", predecessor_task_id: "task-A", dependency_type: "finish_to_start", lag_days: 0 }],
      [{ predecessor_task_id: "task-A", dependency_type: "start_to_start", lag_days: 2 }],
    );
    expect(result).toEqual({
      toCreate: [],
      toUpdate: [{ dependencyId: "dep-1", entry: { predecessor_task_id: "task-A", dependency_type: "start_to_start", lag_days: 2 } }],
      toRemove: [],
    });
  });

  it("leaves an unchanged dependency alone", () => {
    const result = diffDependencyShorthand(
      [{ id: "dep-1", predecessor_task_id: "task-A", dependency_type: "finish_to_start", lag_days: 0 }],
      [{ predecessor_task_id: "task-A", dependency_type: "finish_to_start", lag_days: 0 }],
    );
    expect(result).toEqual({ toCreate: [], toUpdate: [], toRemove: [] });
  });

  it("removes an existing dependency missing from the target set", () => {
    const result = diffDependencyShorthand(
      [{ id: "dep-1", predecessor_task_id: "task-A", dependency_type: "finish_to_start", lag_days: 0 }],
      [],
    );
    expect(result).toEqual({ toCreate: [], toUpdate: [], toRemove: ["dep-1"] });
  });

  it("only touches what changed in a multi-predecessor cell", () => {
    const result = diffDependencyShorthand(
      [
        { id: "dep-1", predecessor_task_id: "task-A", dependency_type: "finish_to_start", lag_days: 0 },
        { id: "dep-2", predecessor_task_id: "task-B", dependency_type: "finish_to_start", lag_days: 0 },
      ],
      [
        { predecessor_task_id: "task-A", dependency_type: "finish_to_start", lag_days: 0 },
        { predecessor_task_id: "task-D", dependency_type: "finish_to_start", lag_days: 0 },
      ],
    );
    expect(result).toEqual({
      toCreate: [{ predecessor_task_id: "task-D", dependency_type: "finish_to_start", lag_days: 0 }],
      toUpdate: [],
      toRemove: ["dep-2"],
    });
  });
});

function actionSpies() {
  return {
    onCreateDependency: jest.fn().mockResolvedValue(undefined),
    onUpdateDependency: jest.fn().mockResolvedValue(undefined),
    onRemoveDependency: jest.fn().mockResolvedValue(undefined),
  };
}

describe("applyPredecessorShorthandEdit", () => {
  it("creates a dependency owned by the edited task for a new predecessor entry", async () => {
    const actions = actionSpies();
    await applyPredecessorShorthandEdit("task-C", [], "1FS+2", resolveRowNumber, actions);

    expect(actions.onCreateDependency).toHaveBeenCalledWith("task-C", {
      predecessor_task_id: "task-A",
      dependency_type: "finish_to_start",
      lag_days: 2,
    });
    expect(actions.onUpdateDependency).not.toHaveBeenCalled();
    expect(actions.onRemoveDependency).not.toHaveBeenCalled();
  });

  it("removes a predecessor no longer present in the edited text", async () => {
    const actions = actionSpies();
    const current = [{ id: "dep-1", predecessor_task_id: "task-A", dependency_type: "finish_to_start" as const, lag_days: 0 }];
    await applyPredecessorShorthandEdit("task-C", current, "", resolveRowNumber, actions);

    expect(actions.onRemoveDependency).toHaveBeenCalledWith("task-C", "dep-1");
    expect(actions.onCreateDependency).not.toHaveBeenCalled();
  });

  it("throws on malformed input and calls no mutation", async () => {
    const actions = actionSpies();
    await expect(applyPredecessorShorthandEdit("task-C", [], "not-valid", resolveRowNumber, actions)).rejects.toThrow(
      /isn't a valid entry/,
    );
    expect(actions.onCreateDependency).not.toHaveBeenCalled();
    expect(actions.onUpdateDependency).not.toHaveBeenCalled();
    expect(actions.onRemoveDependency).not.toHaveBeenCalled();
  });
});

describe("applySuccessorShorthandEdit", () => {
  it("creates a dependency owned by the OTHER (successor) task, pointing back at the edited task", async () => {
    const actions = actionSpies();
    await applySuccessorShorthandEdit("task-A", [], "3FS+2", resolveRowNumber, actions);

    // task-C is row 3 — the typed successor — so the dependency is created on task-C,
    // with task-A (the row being edited) as its predecessor.
    expect(actions.onCreateDependency).toHaveBeenCalledWith("task-C", {
      predecessor_task_id: "task-A",
      dependency_type: "finish_to_start",
      lag_days: 2,
    });
  });

  it("updates an existing successor dependency's type/lag in place", async () => {
    const actions = actionSpies();
    const current = [{ id: "dep-1", task_id: "task-C", dependency_type: "finish_to_start" as const, lag_days: 0 }];
    await applySuccessorShorthandEdit("task-A", current, "3SS-1", resolveRowNumber, actions);

    expect(actions.onUpdateDependency).toHaveBeenCalledWith("task-C", "dep-1", {
      predecessor_task_id: "task-A",
      dependency_type: "start_to_start",
      lag_days: -1,
    });
    expect(actions.onCreateDependency).not.toHaveBeenCalled();
  });

  it("removes a successor dependency no longer present in the edited text", async () => {
    const actions = actionSpies();
    const current = [{ id: "dep-1", task_id: "task-C", dependency_type: "finish_to_start" as const, lag_days: 0 }];
    await applySuccessorShorthandEdit("task-A", current, "", resolveRowNumber, actions);

    expect(actions.onRemoveDependency).toHaveBeenCalledWith("task-C", "dep-1");
  });
});

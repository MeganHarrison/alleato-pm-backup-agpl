import type { DependencyType } from "@/types/scheduling";

export interface DependencyShorthandEntry {
  predecessor_task_id: string;
  dependency_type: DependencyType;
  lag_days: number;
}

export interface ParseDependencyShorthandResult {
  entries: DependencyShorthandEntry[];
  errors: string[];
}

const TYPE_BY_ABBREVIATION: Record<string, DependencyType> = {
  FS: "finish_to_start",
  SS: "start_to_start",
  FF: "finish_to_finish",
  SF: "start_to_finish",
};

const ABBREVIATION_BY_TYPE: Record<DependencyType, string> = {
  finish_to_start: "FS",
  start_to_start: "SS",
  finish_to_finish: "FF",
  start_to_finish: "SF",
};

const ENTRY_PATTERN = /^(\d+)\s*(FS|SS|FF|SF)?\s*([+-]\d+)?$/i;

/**
 * Parses Microsoft-Project-style shorthand for a dependency cell — a comma-separated
 * list of `<row number><relationship?><lag?>`, e.g. `"3"`, `"3FS"`, `"3FS+2"`,
 * `"1,4SS-1"`. Relationship defaults to finish-to-start; lag defaults to 0. Row
 * numbers refer to the grid's 1-based display position, resolved to a task id via
 * `resolveRowNumber` (the grid owns that mapping, since it depends on current sort).
 */
export function parseDependencyShorthand(
  text: string,
  resolveRowNumber: (rowNumber: number) => string | undefined,
): ParseDependencyShorthandResult {
  const trimmed = text.trim();
  if (!trimmed) return { entries: [], errors: [] };

  const entries: DependencyShorthandEntry[] = [];
  const errors: string[] = [];

  for (const rawToken of trimmed.split(",")) {
    const token = rawToken.trim();
    if (!token) continue;

    const match = ENTRY_PATTERN.exec(token);
    if (!match) {
      errors.push(`"${token}" isn't a valid entry — expected a row number like "3", "3FS", or "3FS+2".`);
      continue;
    }

    const rowNumber = Number(match[1]);
    const taskId = resolveRowNumber(rowNumber);
    if (!taskId) {
      errors.push(`No task at row ${rowNumber}.`);
      continue;
    }

    entries.push({
      predecessor_task_id: taskId,
      dependency_type: TYPE_BY_ABBREVIATION[(match[2] ?? "FS").toUpperCase()],
      lag_days: match[3] ? Number(match[3]) : 0,
    });
  }

  return { entries, errors };
}

/** Inverse of `parseDependencyShorthand`, for prefilling a cell with its current value. */
export function formatDependencyShorthand(
  entries: DependencyShorthandEntry[],
  rowNumberForTaskId: (taskId: string) => number | undefined,
): string {
  return entries
    .map((entry) => {
      const rowNumber = rowNumberForTaskId(entry.predecessor_task_id);
      if (rowNumber == null) return null;
      const abbreviation = ABBREVIATION_BY_TYPE[entry.dependency_type];
      const typeSuffix = abbreviation === "FS" && entry.lag_days === 0 ? "" : abbreviation;
      const lagSuffix = entry.lag_days ? (entry.lag_days > 0 ? `+${entry.lag_days}` : `${entry.lag_days}`) : "";
      return `${rowNumber}${typeSuffix}${lagSuffix}`;
    })
    .filter((value): value is string => value !== null)
    .join(", ");
}

export interface DependencyDiffOps {
  toCreate: DependencyShorthandEntry[];
  toUpdate: Array<{ dependencyId: string; entry: DependencyShorthandEntry }>;
  toRemove: string[];
}

export interface ExistingDependency {
  id: string;
  predecessor_task_id: string;
  dependency_type: DependencyType;
  lag_days: number;
}

/**
 * Diffs the parsed target set for a cell against its current persisted dependencies
 * (matched by predecessor task id), producing the minimal create/update/remove
 * operations — so editing one entry in a multi-predecessor cell doesn't churn the
 * others.
 */
export function diffDependencyShorthand(
  current: ExistingDependency[],
  target: DependencyShorthandEntry[],
): DependencyDiffOps {
  const currentByPredecessor = new Map(current.map((dependency) => [dependency.predecessor_task_id, dependency]));
  const targetPredecessorIds = new Set(target.map((entry) => entry.predecessor_task_id));

  const toCreate: DependencyShorthandEntry[] = [];
  const toUpdate: DependencyDiffOps["toUpdate"] = [];
  for (const entry of target) {
    const existing = currentByPredecessor.get(entry.predecessor_task_id);
    if (!existing) {
      toCreate.push(entry);
    } else if (existing.dependency_type !== entry.dependency_type || existing.lag_days !== entry.lag_days) {
      toUpdate.push({ dependencyId: existing.id, entry });
    }
  }

  const toRemove = current
    .filter((dependency) => !targetPredecessorIds.has(dependency.predecessor_task_id))
    .map((dependency) => dependency.id);

  return { toCreate, toUpdate, toRemove };
}

export interface DependencyMutationActions {
  onCreateDependency: (taskId: string, input: DependencyShorthandEntry) => Promise<void>;
  onUpdateDependency: (taskId: string, dependencyId: string, input: DependencyShorthandEntry) => Promise<void>;
  onRemoveDependency: (taskId: string, dependencyId: string) => Promise<void>;
}

/**
 * Applies an edit to a task's Predecessors cell: parses the shorthand, diffs it
 * against the task's current predecessor dependencies, and calls the minimal set of
 * create/update/remove mutations. Throws (without calling any mutation) on the first
 * parse error, so a malformed cell never partially applies.
 */
export async function applyPredecessorShorthandEdit(
  taskId: string,
  currentDependencies: ExistingDependency[],
  text: string,
  resolveRowNumber: (rowNumber: number) => string | undefined,
  actions: DependencyMutationActions,
): Promise<void> {
  const { entries, errors } = parseDependencyShorthand(text, resolveRowNumber);
  if (errors.length > 0) throw new Error(errors[0]);

  const diff = diffDependencyShorthand(currentDependencies, entries);
  for (const entry of diff.toCreate) await actions.onCreateDependency(taskId, entry);
  for (const { dependencyId, entry } of diff.toUpdate) await actions.onUpdateDependency(taskId, dependencyId, entry);
  for (const dependencyId of diff.toRemove) await actions.onRemoveDependency(taskId, dependencyId);
}

export interface ExistingSuccessorDependency {
  id: string;
  task_id: string;
  dependency_type: DependencyType;
  lag_days: number;
}

/**
 * Applies an edit to a task's Successors cell — the mirror of
 * `applyPredecessorShorthandEdit`, but the dependency rows being created/updated/
 * removed belong to the OTHER task (the typed successor), since dependencies are
 * always stored on the successor side (`task_id`/`predecessor_task_id`).
 */
export async function applySuccessorShorthandEdit(
  taskId: string,
  currentSuccessorDependencies: ExistingSuccessorDependency[],
  text: string,
  resolveRowNumber: (rowNumber: number) => string | undefined,
  actions: DependencyMutationActions,
): Promise<void> {
  const { entries, errors } = parseDependencyShorthand(text, resolveRowNumber);
  if (errors.length > 0) throw new Error(errors[0]);

  // Reuses the same diff shape as the predecessor cell, but here
  // `predecessor_task_id` holds the OTHER task's id (the successor) — a generic
  // "other side of the link" key, not literally a predecessor.
  const current = currentSuccessorDependencies.map((dependency) => ({
    id: dependency.id,
    predecessor_task_id: dependency.task_id,
    dependency_type: dependency.dependency_type,
    lag_days: dependency.lag_days,
  }));
  const diff = diffDependencyShorthand(current, entries);

  for (const entry of diff.toCreate) {
    await actions.onCreateDependency(entry.predecessor_task_id, {
      predecessor_task_id: taskId,
      dependency_type: entry.dependency_type,
      lag_days: entry.lag_days,
    });
  }
  for (const { dependencyId, entry } of diff.toUpdate) {
    const successorTaskId = currentSuccessorDependencies.find((dependency) => dependency.id === dependencyId)?.task_id;
    if (!successorTaskId) continue;
    await actions.onUpdateDependency(successorTaskId, dependencyId, {
      predecessor_task_id: taskId,
      dependency_type: entry.dependency_type,
      lag_days: entry.lag_days,
    });
  }
  for (const dependencyId of diff.toRemove) {
    const successorTaskId = currentSuccessorDependencies.find((dependency) => dependency.id === dependencyId)?.task_id;
    if (!successorTaskId) continue;
    await actions.onRemoveDependency(successorTaskId, dependencyId);
  }
}

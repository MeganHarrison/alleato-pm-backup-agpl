/**
 * =============================================================================
 * SCHEDULING SERVICE LAYER
 * =============================================================================
 *
 * Business logic layer for Scheduling operations
 * Handles all database interactions, calculations, and business rules
 * Provides type-safe methods for the API layer
 */

import { SupabaseClient } from "@supabase/supabase-js";
import {
  ScheduleTask,
  ScheduleTaskCreate,
  ScheduleTaskUpdate,
  ScheduleDependency,
  ScheduleDependencyCreate,
  ScheduleDependencyUpdate,
  ScheduleDeadline,
  ScheduleDeadlineCreate,
  ScheduleTaskListParams,
  SchedulePaginatedResponse,
  ScheduleSummary,
  ScheduleTaskWithHierarchy,
  GanttChartItem,
} from "@/types/scheduling";
import { analyzeScheduleNetwork } from "@/lib/scheduling/schedule-network-analysis";
import { addWorkingDays, defaultScheduleCalendar, type ScheduleCalendar } from "@/lib/scheduling/schedule-calendar";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  computeAutoScheduleUpdates,
  computeAutoScheduleUpdatesForDependencyChange,
  computeAutoScheduleUpdatesForDependencyReassignment,
  type AutoScheduleResult,
} from "@/lib/scheduling/schedule-auto-scheduler";
import {
  planScheduleTaskInsertion,
  planScheduleTaskMove,
  type ScheduleOrderExpectation,
  type ScheduleOrderTask,
  type ScheduleOrderUpdate,
} from "@/lib/scheduling/schedule-task-ordering";
import type { Database, Json } from "@/types/database.types";

const AUTO_SCHEDULE_TRIGGER_FIELDS = [
  "start_date",
  "finish_date",
  "duration_days",
  "is_milestone",
  "constraint_type",
  "constraint_date",
] as const satisfies ReadonlyArray<keyof ScheduleTaskUpdate>;

type CalendarRow = { working_weekdays: number[] };
type CalendarExceptionRow = { exception_date: string; is_working: boolean };
const SCHEDULE_QUERY_PAGE_SIZE = 500;

function assertAutoScheduleAvailable(result: AutoScheduleResult): void {
  if (result.status !== "unavailable") return;
  if (result.reason === "circular_dependency") {
    throw new GuardrailError({
      code: "PRECONDITION_FAILED",
      where: "SchedulingService auto-schedule analysis",
      message:
        "Auto-scheduling could not calculate this change because the affected dependency chain is circular. Remove a circular dependency, then retry.",
    });
  }
  if (result.reason === "invalid_anchor_set") {
    throw new GuardrailError({
      code: "PRECONDITION_FAILED",
      where: "SchedulingService auto-schedule analysis",
      message:
        "Auto-scheduling could not calculate this dependency change because it has no valid predecessor anchor.",
    });
  }
  throw new GuardrailError({
    code: "PRECONDITION_FAILED",
    where: "SchedulingService auto-schedule analysis",
    message:
      "Auto-scheduling could not calculate this change. Complete valid dates and duration for every affected task, then retry.",
  });
}

type AuthoritativeMutationKind =
  | "task_create"
  | "task_update"
  | "task_delete"
  | "dependency_create"
  | "dependency_update"
  | "dependency_delete";

type CascadeOutcome =
  | "applied"
  | "no_change"
  | "skipped_constraint"
  | "skipped_unavailable";

interface AuthoritativeMutationResult {
  mutation_kind: AuthoritativeMutationKind;
  cascade_outcome: CascadeOutcome;
  task: ScheduleTask | null;
  dependency: ScheduleDependency | null;
  task_versions: Record<string, number>;
}

export interface SchedulingMutationContext {
  actorUserId: string;
  mutationClient: SupabaseClient<Database>;
}

function dependencySnapshot(dependencies: ScheduleDependency[]): Json {
  return dependencies
    .map((dependency) => ({
      id: dependency.id,
      task_id: dependency.task_id,
      predecessor_task_id: dependency.predecessor_task_id,
      dependency_type: dependency.dependency_type,
      lag_days: dependency.lag_days,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function requireScheduleVersion(task: ScheduleTask): number {
  if (
    !Number.isInteger(task.schedule_version) ||
    Number(task.schedule_version) < 0
  ) {
    throw new GuardrailError({
      code: "PRECONDITION_FAILED",
      where: "SchedulingService authoritative mutation",
      message: `Schedule task ${task.id} is missing a valid concurrency version. Refresh the schedule, then retry.`,
    });
  }
  return Number(task.schedule_version);
}

function expectedTaskVersions(tasks: ScheduleTask[]): Json {
  return Object.fromEntries(
    tasks.map((task) => [task.id, requireScheduleVersion(task)]),
  );
}

function orderTask(task: ScheduleTask): ScheduleOrderTask {
  return {
    id: task.id,
    parent_task_id: task.parent_task_id,
    sort_order: task.sort_order,
    schedule_version: requireScheduleVersion(task),
  };
}

function orderingSnapshot(
  expectations: ScheduleOrderExpectation[],
): Json {
  return expectations.map((expectation) => ({
    id: expectation.task_id,
    parent_task_id: expectation.parent_task_id,
    sort_order: expectation.sort_order,
    schedule_version: expectation.expected_schedule_version,
  }));
}

function orderingUpdates(updates: ScheduleOrderUpdate[]): Json {
  return updates.map((update) => ({
    id: update.task_id,
    parent_task_id: update.parent_task_id,
    sort_order: update.sort_order,
  }));
}

function cascadeOutcome(result: AutoScheduleResult | null): CascadeOutcome {
  if (!result || result.status === "no_change") return "no_change";
  if (result.status === "applied") {
    return result.updates.length > 0 ? "applied" : "no_change";
  }
  if (result.status === "blocked") return "skipped_constraint";
  return "skipped_unavailable";
}

function isAuthoritativeConflict(error: {
  code?: string | null;
}): boolean {
  // PT409 is PostgREST's explicit HTTP-conflict SQLSTATE. The scheduling
  // migration rewrites PostgreSQL's transaction-conflict 40001 to PT409 so
  // PostgREST does not classify an expected optimistic-concurrency rejection
  // as a server failure. Keep 40001 for compatible pre-rewrite databases.
  return error.code === "PT409" || error.code === "40001";
}

function jsonRecord(value: Json | undefined): Record<string, Json | undefined> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function parseMutationTask(value: Json | undefined): ScheduleTask | null {
  const task = jsonRecord(value);
  if (
    !task ||
    typeof task.id !== "string" ||
    typeof task.project_id !== "number" ||
    typeof task.name !== "string" ||
    typeof task.percent_complete !== "number" ||
    typeof task.status !== "string" ||
    typeof task.is_milestone !== "boolean" ||
    typeof task.sort_order !== "number" ||
    typeof task.created_at !== "string" ||
    typeof task.updated_at !== "string"
  ) {
    return null;
  }
  return {
    id: task.id,
    project_id: task.project_id,
    parent_task_id: typeof task.parent_task_id === "string" ? task.parent_task_id : null,
    name: task.name,
    start_date: typeof task.start_date === "string" ? task.start_date : null,
    finish_date: typeof task.finish_date === "string" ? task.finish_date : null,
    duration_days: typeof task.duration_days === "number" ? task.duration_days : null,
    percent_complete: task.percent_complete,
    status: task.status as ScheduleTask["status"],
    is_milestone: task.is_milestone,
    constraint_type:
      typeof task.constraint_type === "string"
        ? task.constraint_type as ScheduleTask["constraint_type"]
        : null,
    constraint_date:
      typeof task.constraint_date === "string" ? task.constraint_date : null,
    wbs_code: typeof task.wbs_code === "string" ? task.wbs_code : null,
    sort_order: task.sort_order,
    created_at: task.created_at,
    updated_at: task.updated_at,
    actual_start_date:
      typeof task.actual_start_date === "string" ? task.actual_start_date : null,
    actual_finish_date:
      typeof task.actual_finish_date === "string" ? task.actual_finish_date : null,
    forecast_start_date:
      typeof task.forecast_start_date === "string" ? task.forecast_start_date : null,
    forecast_finish_date:
      typeof task.forecast_finish_date === "string" ? task.forecast_finish_date : null,
    remaining_duration_days:
      typeof task.remaining_duration_days === "number"
        ? task.remaining_duration_days
        : null,
    assignee: typeof task.assignee === "string" ? task.assignee : null,
    assignee_person_id:
      typeof task.assignee_person_id === "string" ? task.assignee_person_id : null,
    priority: typeof task.priority === "string" ? task.priority : null,
    work_minutes: typeof task.work_minutes === "number" ? task.work_minutes : null,
    allow_leveling_split:
      typeof task.allow_leveling_split === "boolean"
        ? task.allow_leveling_split
        : false,
    leveling_priority:
      typeof task.leveling_priority === "number" ? task.leveling_priority : 500,
    schedule_version:
      typeof task.schedule_version === "number" ? task.schedule_version : undefined,
    schedule_mode:
      typeof task.schedule_mode === "string"
        ? task.schedule_mode as ScheduleTask["schedule_mode"]
        : "auto",
  };
}

function parseMutationDependency(
  value: Json | undefined,
): ScheduleDependency | null {
  const dependency = jsonRecord(value);
  if (
    !dependency ||
    typeof dependency.id !== "string" ||
    typeof dependency.task_id !== "string" ||
    typeof dependency.predecessor_task_id !== "string" ||
    typeof dependency.dependency_type !== "string" ||
    typeof dependency.lag_days !== "number"
  ) {
    return null;
  }
  return {
    id: dependency.id,
    task_id: dependency.task_id,
    predecessor_task_id: dependency.predecessor_task_id,
    dependency_type:
      dependency.dependency_type as ScheduleDependency["dependency_type"],
    lag_days: dependency.lag_days,
    created_at:
      typeof dependency.created_at === "string" ? dependency.created_at : "",
  };
}

function parseTaskVersions(
  value: Json | undefined,
): Record<string, number> {
  const versions = jsonRecord(value);
  if (!versions) return {};
  return Object.fromEntries(
    Object.entries(versions).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number",
    ),
  );
}

export class SchedulingService {
  constructor(
    private supabase: SupabaseClient,
    private mutationContext?: SchedulingMutationContext,
  ) {}

  // =============================================================================
  // TASK OPERATIONS
  // =============================================================================

  /**
   * List all tasks for a project with pagination and filtering
   */
  async listTasks(
    projectId: string,
    params: ScheduleTaskListParams = {}
  ): Promise<SchedulePaginatedResponse<ScheduleTask>> {
    const {
      page = 1,
      limit = 50,
      sort = "sort_order",
      order = "asc",
      status,
      parent_task_id,
      is_milestone,
      search,
    } = params;

    // Build the main query
    let query = this.supabase
      .from("schedule_tasks")
      .select("*", { count: "exact" })
      .eq("project_id", projectId);

    // Apply filters
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (parent_task_id !== undefined) {
      if (parent_task_id === null) {
        query = query.is("parent_task_id", null);
      } else {
        query = query.eq("parent_task_id", parent_task_id);
      }
    }

    if (is_milestone !== undefined) {
      query = query.eq("is_milestone", is_milestone);
    }

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    // Apply sorting
    const sortField = this.mapSortField(sort);
    query = query.order(sortField, { ascending: order === "asc" });

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch tasks: ${error.message}`);
    }

    return {
      data: (data || []) as ScheduleTask[],
      pagination: {
        current_page: page,
        per_page: limit,
        total_records: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
        has_next_page: (count || 0) > offset + limit,
        has_prev_page: page > 1,
      },
    };
  }

  /**
   * Get tasks as a hierarchical tree structure
   */
  async getTasksHierarchy(projectId: string): Promise<ScheduleTaskWithHierarchy[]> {
    const tasks: ScheduleTask[] = [];

    for (let offset = 0; ; offset += SCHEDULE_QUERY_PAGE_SIZE) {
      const { data, error } = await this.supabase
        .from("schedule_tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true })
        .range(offset, offset + SCHEDULE_QUERY_PAGE_SIZE - 1);

      if (error) {
        throw new Error(`Failed to fetch tasks: ${error.message}`);
      }

      const page = (data ?? []) as ScheduleTask[];
      tasks.push(...page);
      if (page.length < SCHEDULE_QUERY_PAGE_SIZE) break;
    }

    const tasksWithAssigneeLabels = await this.withAssigneeLabels(tasks);
    const [dependencies, deadlines, segments] = await Promise.all([
      this.getDependencies(projectId),
      this.getDeadlines(projectId),
      this.getTaskSegments(projectId),
    ]);
    const dependenciesByTaskId = new Map<string, ScheduleDependency[]>();
    for (const dependency of dependencies) {
      dependenciesByTaskId.set(dependency.task_id, [
        ...(dependenciesByTaskId.get(dependency.task_id) ?? []),
        dependency,
      ]);
    }
    const deadlineByTaskId = new Map(deadlines.map((deadline) => [deadline.task_id, deadline]));
    const segmentsByTaskId = new Map<string, ScheduleTask["segments"]>();
    for (const segment of segments) {
      segmentsByTaskId.set(segment.task_id, [...(segmentsByTaskId.get(segment.task_id) ?? []), segment]);
    }
    return this.buildHierarchy(tasksWithAssigneeLabels.map((task) => ({
      ...task,
      dependencies: dependenciesByTaskId.get(task.id) ?? [],
      deadline: deadlineByTaskId.get(task.id),
      segments: segmentsByTaskId.get(task.id) ?? [],
    })));
  }

  /**
   * Get a single task by ID
   */
  async getTaskById(
    projectId: string,
    taskId: string
  ): Promise<ScheduleTask | null> {
    const { data, error } = await this.supabase
      .from("schedule_tasks")
      .select("*")
      .eq("project_id", projectId)
      .eq("id", taskId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to fetch task: ${error.message}`);
    }

    return data as ScheduleTask;
  }

  /**
   * Create a new task
   */
  async createTask(
    projectId: string,
    data: ScheduleTaskCreate
  ): Promise<ScheduleTask> {
    const { tasks, dependencies } = await this.fetchScheduleGraph(projectId);
    const taskId = globalThis.crypto.randomUUID();
    const plan = planScheduleTaskInsertion({
      tasks: tasks.map(orderTask),
      new_task_id: taskId,
      after_task_id: data.after_task_id,
      parent_task_id: data.parent_task_id ?? null,
    });
    const { after_task_id: _afterTaskId, project_id: _projectId, ...values } = data;
    const result = await this.applyAuthoritativeMutation({
      projectId,
      mutation: {
        kind: "task_create",
        task_id: taskId,
        values: {
          ...values,
          parent_task_id: plan.insert.parent_task_id,
          sort_order: plan.insert.sort_order,
        },
      },
      tasks,
      dependencies,
      orderingExpectations: plan.expected_siblings,
      orderingPlan: [
        {
          task_id: taskId,
          parent_task_id: plan.insert.parent_task_id,
          sort_order: plan.insert.sort_order,
          expected_schedule_version: 0,
        },
        ...plan.updates,
      ],
    });
    if (!result.task) {
      throw new Error("Authoritative schedule task creation returned no task.");
    }
    return result.task;
  }

  /**
   * Update an existing task
   */
  async updateTask(
    projectId: string,
    taskId: string,
    data: ScheduleTaskUpdate
  ): Promise<ScheduleTask | null> {
    const {
      tasks,
      dependencies,
      calendar = defaultScheduleCalendar,
    } = await this.fetchScheduleGraph(projectId);
    const current = tasks.find((task) => task.id === taskId);
    if (!current) return null;

    const {
      expected_schedule_version: expectedScheduleVersion,
      ...requestedChanges
    } = data;
    const normalized: ScheduleTaskUpdate = { ...requestedChanges };
    if (normalized.is_milestone === true) {
      normalized.duration_days = 0;
      const milestoneDate = normalized.start_date ?? current.start_date;
      if (milestoneDate) normalized.finish_date = milestoneDate;
    }

    let orderingExpectations: ScheduleOrderExpectation[] = [];
    let orderingPlan: ScheduleOrderUpdate[] = [];
    if (
      normalized.parent_task_id !== undefined ||
      normalized.sort_order !== undefined ||
      normalized.target_index !== undefined
    ) {
      const targetParent = normalized.parent_task_id ?? current.parent_task_id;
      const targetSiblings = tasks.filter(
        (task) => task.parent_task_id === targetParent && task.id !== taskId,
      );
      const targetIndex =
        normalized.target_index ??
        (normalized.sort_order === undefined
          ? targetSiblings.length
          : Math.max(0, normalized.sort_order - 1));
      const plan = planScheduleTaskMove({
        tasks: tasks.map(orderTask),
        task_id: taskId,
        target_parent_task_id: targetParent,
        target_index: targetIndex,
      });
      orderingExpectations = plan.expected_siblings;
      orderingPlan = plan.updates;
      normalized.parent_task_id = plan.parent_task_id;
      normalized.sort_order = plan.sort_order;
    }
    delete normalized.target_index;

    // Auto-scheduling: a date/duration/constraint edit cascades to this task's
    // successors (see schedule-auto-scheduler.ts). Computed against the graph
    // BEFORE this task's own update is persisted, and blocked entirely (nothing
    // written, including this task's own change) if it would violate a downstream
    // constraint — never silently overwrite a constrained task's date.
    const triggersAutoSchedule = AUTO_SCHEDULE_TRIGGER_FIELDS.some(
      (field) => normalized[field] !== undefined,
    );
    const cascade = triggersAutoSchedule
      ? computeAutoScheduleUpdates({
          taskId,
          tasks,
          dependencies,
          update: normalized,
          calendar,
        })
      : null;
    if (cascade) {
      assertAutoScheduleAvailable(cascade);
      if (cascade.status === "blocked") {
        const conflict = cascade.constraint_conflicts[0];
        throw new Error(
          conflict?.message ??
            "This change conflicts with a downstream task's schedule constraint.",
        );
      }
    }

    const expectedTasks =
      expectedScheduleVersion === undefined
        ? tasks
        : tasks.map((task) =>
            task.id === taskId
              ? { ...task, schedule_version: expectedScheduleVersion }
              : task,
          );
    const result = await this.applyAuthoritativeMutation({
      projectId,
      mutation: {
        kind: "task_update",
        task_id: taskId,
        changes: normalized,
      },
      tasks: expectedTasks,
      dependencies,
      cascade,
      orderingExpectations,
      orderingPlan,
    });
    return result.task;
  }

  /**
   * Delete a task
   */
  async deleteTask(projectId: string, taskId: string): Promise<boolean> {
    const { tasks, dependencies } = await this.fetchScheduleGraph(projectId);
    const deleted = tasks.find((task) => task.id === taskId);
    if (!deleted) return false;
    const siblings = tasks
      .filter((task) => task.parent_task_id === deleted.parent_task_id)
      .sort((left, right) =>
        left.sort_order === right.sort_order
          ? left.id.localeCompare(right.id)
          : left.sort_order - right.sort_order,
      );
    const orderingExpectations = siblings.map((task) => ({
      task_id: task.id,
      parent_task_id: task.parent_task_id,
      sort_order: task.sort_order,
      expected_schedule_version: requireScheduleVersion(task),
    }));
    const orderingPlan = siblings
      .filter((task) => task.id !== taskId)
      .map((task, index) => ({
        task_id: task.id,
        parent_task_id: task.parent_task_id,
        sort_order: index + 1,
        expected_schedule_version: requireScheduleVersion(task),
      }))
      .filter((update) => {
        const task = tasks.find((item) => item.id === update.task_id);
        return task?.sort_order !== update.sort_order;
      });
    await this.applyAuthoritativeMutation({
      projectId,
      mutation: { kind: "task_delete", task_id: taskId },
      tasks,
      dependencies,
      orderingExpectations,
      orderingPlan,
    });
    return true;
  }

  // =============================================================================
  // DEPENDENCY OPERATIONS
  // =============================================================================

  /**
   * Get all dependencies for a project
   */
  async getDependencies(projectId: string): Promise<ScheduleDependency[]> {
    const { data: tasks, error: tasksError } = await this.supabase
      .from("schedule_tasks")
      .select("id")
      .eq("project_id", projectId);

    if (tasksError) throw new Error(`Failed to verify schedule tasks: ${tasksError.message}`);
    const taskIds = (tasks ?? []).map((task) => task.id);
    if (taskIds.length === 0) return [];

    const { data, error } = await this.supabase
      .from("schedule_dependencies")
      .select("*")
      .in("task_id", taskIds)
      .in("predecessor_task_id", taskIds);

    if (error) {
      throw new Error(`Failed to fetch dependencies: ${error.message}`);
    }

    return (data || []) as ScheduleDependency[];
  }

  /**
   * Create a new dependency
   */
  async createDependency(
    projectId: string,
    data: ScheduleDependencyCreate
  ): Promise<ScheduleDependency> {
    if (data.task_id === data.predecessor_task_id) {
      throw new Error("A task cannot depend on itself. Select another predecessor.");
    }
    const {
      tasks,
      dependencies,
      calendar = defaultScheduleCalendar,
    } = await this.fetchScheduleGraph(projectId);
    const task = tasks.find((item) => item.id === data.task_id);
    const predecessor = tasks.find(
      (item) => item.id === data.predecessor_task_id,
    );
    if (!task || !predecessor) {
      throw new Error("Both the task and predecessor must belong to this project.");
    }
    if (this.wouldCreateDependencyCycleInGraph(
      dependencies,
      data.task_id,
      data.predecessor_task_id,
    )) {
      throw new Error("Cannot create dependency: this predecessor would create a circular dependency chain.");
    }
    const pendingDependency: ScheduleDependency = {
      id: "pending",
      task_id: data.task_id,
      predecessor_task_id: data.predecessor_task_id,
      dependency_type: data.dependency_type || "finish_to_start",
      lag_days: data.lag_days ?? 0,
      created_at: new Date(0).toISOString(),
    };
    const cascade = computeAutoScheduleUpdatesForDependencyChange({
      predecessorTaskId: data.predecessor_task_id,
      tasks,
      dependenciesBefore: dependencies,
      dependenciesAfter: [...dependencies, pendingDependency],
      calendar,
    });
    assertAutoScheduleAvailable(cascade);
    if (cascade.status === "blocked") {
      const conflict = cascade.constraint_conflicts[0];
      throw new Error(conflict?.message ?? "This dependency conflicts with a downstream task's schedule constraint.");
    }
    const result = await this.applyAuthoritativeMutation({
      projectId,
      mutation: {
        kind: "dependency_create",
        task_id: data.task_id,
        predecessor_task_id: data.predecessor_task_id,
        dependency_type: data.dependency_type || "finish_to_start",
        lag_days: data.lag_days ?? 0,
      },
      tasks,
      dependencies,
      cascade,
    });
    if (!result.dependency) {
      throw new Error("Authoritative dependency creation returned no dependency.");
    }
    return result.dependency;
  }

  /**
   * Delete a dependency
   */
  async deleteDependency(projectId: string, taskId: string, dependencyId: string): Promise<boolean> {
    const {
      tasks,
      dependencies,
      calendar = defaultScheduleCalendar,
    } = await this.fetchScheduleGraph(projectId);
    if (!tasks.some((task) => task.id === taskId)) {
      throw new Error("Task not found for this project.");
    }
    const deleted = dependencies.find(
      (dependency) =>
        dependency.id === dependencyId && dependency.task_id === taskId,
    );
    if (!deleted) {
      throw new Error("Dependency not found for this schedule task.");
    }
    const dependenciesAfter = dependencies.filter(
      (dependency) => dependency.id !== dependencyId,
    );
    const cascade = deleted
      ? computeAutoScheduleUpdatesForDependencyChange({
          predecessorTaskId: deleted.predecessor_task_id,
          tasks,
          dependenciesBefore: dependencies,
          dependenciesAfter,
          calendar,
        })
      : null;
    await this.applyAuthoritativeMutation({
      projectId,
      mutation: {
        kind: "dependency_delete",
        task_id: taskId,
        dependency_id: dependencyId,
      },
      tasks,
      dependencies,
      cascade,
      allowSkippedCascade: true,
    });
    return true;
  }

  /**
   * Update a dependency without changing its ownership or task scope.
   */
  async updateDependency(
    projectId: string,
    taskId: string,
    dependencyId: string,
    data: ScheduleDependencyUpdate,
  ): Promise<ScheduleDependency> {
    const {
      tasks,
      dependencies,
      calendar = defaultScheduleCalendar,
    } = await this.fetchScheduleGraph(projectId);
    const existing = dependencies.find(
      (dependency) => dependency.id === dependencyId && dependency.task_id === taskId,
    );
    if (!existing) throw new Error("Dependency not found for this schedule task.");

    const predecessorTaskId = data.predecessor_task_id ?? existing.predecessor_task_id;
    if (predecessorTaskId === taskId) {
      throw new Error("A task cannot depend on itself. Select another predecessor.");
    }
    if (data.predecessor_task_id && data.predecessor_task_id !== existing.predecessor_task_id) {
      if (!tasks.some((task) => task.id === data.predecessor_task_id)) {
        throw new Error("The predecessor must belong to this project.");
      }
      if (this.wouldCreateDependencyCycleInGraph(
        dependencies.filter((dependency) => dependency.id !== dependencyId),
        taskId,
        predecessorTaskId,
      )) {
        throw new Error("Cannot update dependency: this predecessor would create a circular dependency chain.");
      }
    }

    const pendingDependency: ScheduleDependency = {
      ...existing,
      predecessor_task_id: predecessorTaskId,
      dependency_type: data.dependency_type ?? existing.dependency_type,
      lag_days: data.lag_days ?? existing.lag_days,
    };
    // Reconcile both the old and replacement predecessor closures so moving a
    // dependency can shift the successor network earlier or later atomically.
    const dependenciesAfter = dependencies.map((dependency) =>
      dependency.id === dependencyId ? pendingDependency : dependency,
    );
    const cascade = computeAutoScheduleUpdatesForDependencyReassignment({
      predecessorTaskIds: [
        existing.predecessor_task_id,
        predecessorTaskId,
      ],
      tasks,
      dependenciesBefore: dependencies,
      dependenciesAfter,
      calendar,
    });
    assertAutoScheduleAvailable(cascade);
    if (cascade.status === "blocked") {
      const conflict = cascade.constraint_conflicts[0];
      throw new Error(conflict?.message ?? "This dependency conflicts with a downstream task's schedule constraint.");
    }

    const result = await this.applyAuthoritativeMutation({
      projectId,
      mutation: {
        kind: "dependency_update",
        task_id: taskId,
        dependency_id: dependencyId,
        changes: data,
      },
      tasks,
      dependencies,
      cascade,
    });
    if (!result.dependency) {
      throw new Error("Authoritative dependency update returned no dependency.");
    }
    return result.dependency;
  }

  // =============================================================================
  // DEADLINE OPERATIONS
  // =============================================================================

  /**
   * Set or update a deadline for a task
   */
  async setDeadline(projectId: string, data: ScheduleDeadlineCreate): Promise<ScheduleDeadline> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Authentication required");
    if (!(await this.getTaskById(projectId, data.task_id))) {
      throw new Error("Task not found for this project.");
    }

    const { data: deadline, error } = await this.supabase
      .from("schedule_deadlines")
      .upsert(
        {
          task_id: data.task_id,
          deadline_date: data.deadline_date,
        },
        { onConflict: "task_id" }
      )
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to set deadline: ${error.message}`);
    }

    return deadline as ScheduleDeadline;
  }

  /**
   * Remove a deadline from a task
   */
  async removeDeadline(projectId: string, taskId: string): Promise<boolean> {
    if (!(await this.getTaskById(projectId, taskId))) {
      throw new Error("Task not found for this project.");
    }
    const { error } = await this.supabase
      .from("schedule_deadlines")
      .delete()
      .eq("task_id", taskId);

    if (error) {
      throw new Error(`Failed to remove deadline: ${error.message}`);
    }

    return true;
  }

  async getDeadlines(projectId: string): Promise<ScheduleDeadline[]> {
    const { data: tasks, error: tasksError } = await this.supabase
      .from("schedule_tasks")
      .select("id")
      .eq("project_id", projectId);
    if (tasksError) throw new Error(`Failed to verify schedule tasks: ${tasksError.message}`);
    const taskIds = (tasks ?? []).map((task) => task.id);
    if (taskIds.length === 0) return [];

    const { data, error } = await this.supabase
      .from("schedule_deadlines")
      .select("*")
      .in("task_id", taskIds);
    if (error) throw new Error(`Failed to fetch schedule deadlines: ${error.message}`);
    return (data ?? []) as ScheduleDeadline[];
  }

  // =============================================================================
  // HIERARCHY OPERATIONS
  // =============================================================================

  /**
   * Indent a task (make it a child of the previous sibling)
   */
  async indentTask(
    projectId: string,
    taskId: string
  ): Promise<ScheduleTask | null> {
    // Get the task and its siblings
    const task = await this.getTaskById(projectId, taskId);
    if (!task) throw new Error("Task not found");

    const { data: siblings } = await this.supabase
      .from("schedule_tasks")
      .select("*")
      .eq("project_id", projectId)
      .eq("parent_task_id", task.parent_task_id)
      .lt("sort_order", task.sort_order)
      .order("sort_order", { ascending: false })
      .limit(1);

    if (!siblings || siblings.length === 0) {
      throw new Error("Cannot indent: no previous sibling to become parent");
    }

    const newParentId = siblings[0].id;
    return this.updateTask(projectId, taskId, { parent_task_id: newParentId });
  }

  /**
   * Outdent a task (move it up one level in hierarchy)
   */
  async outdentTask(
    projectId: string,
    taskId: string
  ): Promise<ScheduleTask | null> {
    const task = await this.getTaskById(projectId, taskId);
    if (!task) throw new Error("Task not found");

    if (!task.parent_task_id) {
      throw new Error("Cannot outdent: task is already at root level");
    }

    // Get the parent task to find the grandparent
    const parent = await this.getTaskById(projectId, task.parent_task_id);
    if (!parent) throw new Error("Parent task not found");

    return this.updateTask(projectId, taskId, {
      parent_task_id: parent.parent_task_id,
    });
  }

  // =============================================================================
  // SUMMARY & ANALYTICS
  // =============================================================================

  /**
   * Get schedule summary statistics
   */
  async getSummary(projectId: string): Promise<ScheduleSummary> {
    const { data: tasks, error } = await this.supabase
      .from("schedule_tasks")
      .select("*")
      .eq("project_id", projectId);

    if (error) {
      throw new Error(`Failed to fetch summary: ${error.message}`);
    }

    if (!tasks || tasks.length === 0) {
      return {
        total_tasks: 0,
        completed_tasks: 0,
        in_progress_tasks: 0,
        not_started_tasks: 0,
        milestones_count: 0,
        overdue_tasks: 0,
        overall_percent_complete: 0,
      };
    }

    const total_tasks = tasks.length;
    const completed_tasks = tasks.filter((t) => t.status === "complete").length;
    const in_progress_tasks = tasks.filter(
      (t) => t.status === "in_progress"
    ).length;
    const not_started_tasks = tasks.filter(
      (t) => t.status === "not_started"
    ).length;
    const milestones_count = tasks.filter((t) => t.is_milestone).length;
    const today = new Date().toISOString().split("T")[0];
    const overdue_tasks = tasks.filter(
      (t) => t.status !== "complete" && t.finish_date && t.finish_date < today
    ).length;

    // Calculate weighted average percent complete
    const totalPercent = tasks.reduce(
      (sum, t) => sum + (t.percent_complete || 0),
      0
    );
    const overall_percent_complete = Math.round(totalPercent / total_tasks);

    return {
      total_tasks,
      completed_tasks,
      in_progress_tasks,
      not_started_tasks,
      milestones_count,
      overdue_tasks,
      overall_percent_complete,
    };
  }

  /**
   * Get data formatted for Gantt chart rendering
   */
  async getProjectScheduleCalendar(projectId: string): Promise<ScheduleCalendar> {
    const calendarResult = await this.supabase
      .from("project_schedule_calendars")
      .select("working_weekdays")
      .eq("project_id", projectId)
      .maybeSingle() as { data: CalendarRow | null; error: { message: string } | null };
    if (calendarResult.error) throw new Error(`Failed to fetch project schedule calendar: ${calendarResult.error.message}`);

    const exceptionsResult = await this.supabase
      .from("project_schedule_calendar_exceptions")
      .select("exception_date,is_working")
      .eq("project_id", projectId) as { data: CalendarExceptionRow[] | null; error: { message: string } | null };
    if (exceptionsResult.error) throw new Error(`Failed to fetch project schedule calendar exceptions: ${exceptionsResult.error.message}`);

    const exceptions = exceptionsResult.data ?? [];
    return {
      working_weekdays: calendarResult.data?.working_weekdays ?? defaultScheduleCalendar.working_weekdays,
      non_working_dates: exceptions.filter((exception) => !exception.is_working).map((exception) => exception.exception_date),
      working_date_overrides: exceptions.filter((exception) => exception.is_working).map((exception) => exception.exception_date),
    };
  }

  /**
   * A task with only a start date and duration (no explicit finish date) is a valid,
   * common state — auto-scheduling deliberately never writes a predecessor's own
   * finish date (only its successors'), and a freshly created task may have only a
   * duration. Falling back straight to `today` for a missing date (as this used to)
   * produces an inverted, nonsensical interval whenever the task's real start is not
   * today — e.g. start=2026-08-03, missing finish -> {start: 2026-08-03, finish:
   * today}, finish before start — which breaks the Gantt bar's position and any
   * dependency line anchored to it. Derive the missing date from duration_days using
   * the same working-day math as the auto-scheduler. If neither endpoint can be
   * derived, preserve the null facts so the renderer can label the task
   * Unscheduled without inventing a date or dependency endpoint.
   */
  private deriveGanttDates(
    task: ScheduleTask,
    calendar: ScheduleCalendar,
  ): { start_date: string | null; finish_date: string | null } {
    if (task.start_date && task.finish_date) {
      return { start_date: task.start_date, finish_date: task.finish_date };
    }
    const duration = task.duration_days && task.duration_days > 0 ? Math.round(task.duration_days) : null;
    if (task.start_date && duration) {
      return { start_date: task.start_date, finish_date: addWorkingDays(task.start_date, duration - 1, calendar) };
    }
    if (task.finish_date && duration) {
      return { start_date: addWorkingDays(task.finish_date, -(duration - 1), calendar), finish_date: task.finish_date };
    }
    return {
      start_date: task.start_date ?? null,
      finish_date: task.finish_date ?? null,
    };
  }

  async getGanttData(projectId: string): Promise<GanttChartItem[]> {
    const { data: tasks, error: tasksError } = await this.supabase
      .from("schedule_tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true });

    if (tasksError) {
      throw new Error(`Failed to fetch gantt data: ${tasksError.message}`);
    }

    if (!tasks) return [];

    const today = new Date().toISOString().split("T")[0];

    // Build hierarchy to get levels
    const labeledTasks = await this.withAssigneeLabels(tasks as ScheduleTask[]);
    const hierarchy = this.buildHierarchy(labeledTasks);
    const levelMap = new Map<string, number>();
    this.assignLevels(hierarchy, levelMap, 0);

    const [dependencies, deadlines, calendar, segments] = await Promise.all([
      this.getDependencies(projectId),
      this.getDeadlines(projectId),
      this.getProjectScheduleCalendar(projectId),
      this.getTaskSegments(projectId),
    ]);
    const dependenciesByTaskId = new Map<string, GanttChartItem["dependencies"]>();
    for (const dependency of dependencies) {
      const current = dependenciesByTaskId.get(dependency.task_id) ?? [];
      current.push({ predecessor_id: dependency.predecessor_task_id, type: dependency.dependency_type, lag_days: dependency.lag_days });
      dependenciesByTaskId.set(dependency.task_id, current);
    }
    const deadlineByTaskId = new Map(deadlines.map((deadline) => [deadline.task_id, deadline.deadline_date]));
    const segmentsByTaskId = new Map<string, GanttChartItem["segments"]>();
    for (const segment of segments) {
      segmentsByTaskId.set(segment.task_id, [...(segmentsByTaskId.get(segment.task_id) ?? []), segment]);
    }
    const networkAnalysis = analyzeScheduleNetwork({
      tasks: labeledTasks,
      dependencies,
      deadlines,
      calendar,
    });

    return labeledTasks.map((task) => {
      const analysis = networkAnalysis.tasks[task.id];
      const { start_date, finish_date } = this.deriveGanttDates(task, calendar);
      return {
        id: task.id,
        name: task.name,
        start_date,
        finish_date,
        duration_days: task.duration_days ?? null,
        percent_complete: task.percent_complete || 0,
        assignee: task.assignee ?? null,
        status: (task.status || "not_started") as "not_started" | "in_progress" | "complete",
        is_milestone: task.is_milestone || false,
        parent_task_id: task.parent_task_id,
        level: levelMap.get(task.id) || 0,
        dependencies: dependenciesByTaskId.get(task.id) ?? [],
        deadline: deadlineByTaskId.get(task.id),
        is_overdue: task.status !== "complete" && !!task.finish_date && task.finish_date < today,
        is_critical_path: analysis?.is_critical_path ?? false,
        total_float_days: analysis?.total_float_days ?? 0,
        schedule_warnings: analysis?.schedule_warnings ?? [],
        segments: segmentsByTaskId.get(task.id) ?? [],
      };
    });
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private async getTaskSegments(projectId: string) {
    const { data, error } = await this.supabase
      .from("schedule_task_segments")
      .select("id,task_id,segment_index,starts_at,ends_at,planned_minutes,lock_reason")
      .eq("project_id", projectId)
      .order("task_id")
      .order("segment_index");
    if (error) throw new Error(`Failed to load task segments: ${error.message}`);
    return (data ?? []).map((segment) => ({
      ...segment,
      lock_reason: segment.lock_reason as "fixed" | "progressed" | null,
    }));
  }

  /**
   * Fetches the full task + dependency graph for a project, with segments attached
   * to each task — the shape the auto-scheduling engine (`schedule-auto-scheduler.ts`)
   * needs to compute a cascade and to exclude segmented/manual/actual-dated tasks.
   */
  private async fetchScheduleGraph(
    projectId: string,
  ): Promise<{
    tasks: ScheduleTask[];
    dependencies: ScheduleDependency[];
    calendar: ScheduleCalendar;
  }> {
    const tasks: ScheduleTask[] = [];
    for (let offset = 0; ; offset += SCHEDULE_QUERY_PAGE_SIZE) {
      const { data, error } = await this.supabase
        .from("schedule_tasks")
        .select("*")
        .eq("project_id", projectId)
        .range(offset, offset + SCHEDULE_QUERY_PAGE_SIZE - 1);
      if (error) throw new Error(`Failed to fetch tasks: ${error.message}`);
      const page = (data ?? []) as ScheduleTask[];
      tasks.push(...page);
      if (page.length < SCHEDULE_QUERY_PAGE_SIZE) break;
    }

    const [dependencies, segments, calendar] = await Promise.all([
      this.getDependencies(projectId),
      this.getTaskSegments(projectId),
      this.getProjectScheduleCalendar(projectId),
    ]);
    const segmentsByTaskId = new Map<string, ScheduleTask["segments"]>();
    for (const segment of segments) {
      segmentsByTaskId.set(segment.task_id, [...(segmentsByTaskId.get(segment.task_id) ?? []), segment]);
    }

    return {
      tasks: tasks.map((task) => ({ ...task, segments: segmentsByTaskId.get(task.id) ?? [] })),
      dependencies,
      calendar,
    };
  }

  /**
   * Persists auto-scheduling cascade updates directly (not via `updateTask`, which
   * would recompute and re-trigger the cascade — this is the terminal write).
   */
  private async getMutationIdentity(): Promise<{
    actorUserId: string;
    client: SupabaseClient<Database>;
  }> {
    if (!this.mutationContext) {
      throw new GuardrailError({
        code: "PRECONDITION_FAILED",
        where: "SchedulingService authoritative mutation",
        message:
          "The server scheduling mutation boundary is not configured. Retry from a supported scheduling action.",
      });
    }
    return {
      actorUserId: this.mutationContext.actorUserId,
      client: this.mutationContext.mutationClient,
    };
  }

  private async applyAuthoritativeMutation(input: {
    projectId: string;
    mutation: Record<string, unknown>;
    tasks: ScheduleTask[];
    dependencies: ScheduleDependency[];
    cascade?: AutoScheduleResult | null;
    allowSkippedCascade?: boolean;
    orderingExpectations?: ScheduleOrderExpectation[];
    orderingPlan?: ScheduleOrderUpdate[];
  }): Promise<AuthoritativeMutationResult> {
    const outcome = cascadeOutcome(input.cascade ?? null);
    if (
      !input.allowSkippedCascade &&
      (outcome === "skipped_constraint" || outcome === "skipped_unavailable")
    ) {
      if (input.cascade) assertAutoScheduleAvailable(input.cascade);
      throw new GuardrailError({
        code: "PRECONDITION_FAILED",
        where: "SchedulingService authoritative mutation",
        message: "The schedule mutation could not produce a safe cascade.",
      });
    }
    const identity = await this.getMutationIdentity();
    const cascadeUpdates =
      input.cascade?.status === "applied" ? input.cascade.updates : [];
    const args: Database["public"]["Functions"]["apply_authoritative_schedule_cascade_mutation"]["Args"] = {
      p_actor_user_id: identity.actorUserId,
      p_project_id: Number(input.projectId),
      p_mutation: input.mutation as Json,
      p_expected_task_versions: expectedTaskVersions(input.tasks),
      p_expected_dependencies: dependencySnapshot(input.dependencies),
      p_cascade_updates: cascadeUpdates.map((update) => ({
        task_id: update.task_id,
        start_date: update.start_date,
        finish_date: update.finish_date,
      })),
      p_cascade_outcome: outcome,
      p_ordering_snapshot: orderingSnapshot(
        input.orderingExpectations ?? [],
      ),
      p_ordering_updates: orderingUpdates(input.orderingPlan ?? []),
    };
    const { data, error } = await identity.client.rpc(
      "apply_authoritative_schedule_cascade_mutation",
      args,
    );
    if (error) {
      if (error.code === "42501") {
        throw new GuardrailError({
          code: "AUTH_FORBIDDEN",
          where: "SchedulingService authoritative mutation",
          message: error.message,
          cause: error,
        });
      }
      if (isAuthoritativeConflict(error)) {
        throw new GuardrailError({
          code: "PRECONDITION_FAILED",
          where: "SchedulingService authoritative mutation",
          message: `${error.message}. Refresh the schedule, then retry.`,
          status: 409,
          cause: error,
        });
      }
      if (error.code === "P0002") {
        throw new GuardrailError({
          code: "NOT_FOUND",
          where: "SchedulingService authoritative mutation",
          message: error.message,
          cause: error,
        });
      }
      if (error.code === "22023" || error.code === "23514") {
        throw new GuardrailError({
          code: "VALIDATION",
          where: "SchedulingService authoritative mutation",
          message: error.message,
          status: 422,
          cause: error,
        });
      }
      throw new Error(`Authoritative schedule mutation failed: ${error.message}`);
    }
    if (!data || Array.isArray(data) || typeof data !== "object") {
      throw new Error("Authoritative schedule mutation returned an invalid response.");
    }
    const result = data as Record<string, Json | undefined>;
    const mutationKind = result.mutation_kind;
    const resultOutcome = result.cascade_outcome;
    if (
      typeof mutationKind !== "string" ||
      ![
        "task_create",
        "task_update",
        "task_delete",
        "dependency_create",
        "dependency_update",
        "dependency_delete",
      ].includes(mutationKind) ||
      typeof resultOutcome !== "string" ||
      ![
        "applied",
        "no_change",
        "skipped_constraint",
        "skipped_unavailable",
      ].includes(resultOutcome)
    ) {
      throw new Error("Authoritative schedule mutation returned an invalid contract.");
    }
    return {
      mutation_kind: mutationKind as AuthoritativeMutationKind,
      cascade_outcome: resultOutcome as CascadeOutcome,
      task: parseMutationTask(result.task),
      dependency: parseMutationDependency(result.dependency),
      task_versions: parseTaskVersions(result.task_versions),
    };
  }

  private async withAssigneeLabels(tasks: ScheduleTask[]): Promise<ScheduleTask[]> {
    const personIds = [...new Set(tasks.map((task) => task.assignee_person_id).filter((id): id is string => Boolean(id)))];
    if (personIds.length === 0) return tasks;
    const { data, error } = await this.supabase.from("people").select("id, first_name, last_name, email").in("id", personIds);
    if (error) throw new Error(`Failed to load schedule assignees: ${error.message}`);
    const labels = new Map((data ?? []).map((person) => [person.id, [person.first_name, person.last_name].filter(Boolean).join(" ") || person.email || "Unnamed"]));
    return tasks.map((task) => ({ ...task, assignee: task.assignee_person_id ? labels.get(task.assignee_person_id) ?? "Unavailable member" : null }));
  }

  private mapSortField(sort: string): string {
    const mapping: Record<string, string> = {
      name: "name",
      start_date: "start_date",
      finish_date: "finish_date",
      percent_complete: "percent_complete",
      status: "status",
      created_at: "created_at",
      sort_order: "sort_order",
    };
    return mapping[sort] || "sort_order";
  }

  private wouldCreateDependencyCycleInGraph(
    dependencies: ScheduleDependency[],
    taskId: string,
    predecessorTaskId: string,
  ): boolean {
    const predecessorIdsByTaskId = new Map<string, string[]>();
    for (const dependency of dependencies) {
      const current = predecessorIdsByTaskId.get(dependency.task_id) ?? [];
      current.push(dependency.predecessor_task_id);
      predecessorIdsByTaskId.set(dependency.task_id, current);
    }
    const pending = [predecessorTaskId];
    const visited = new Set<string>();
    while (pending.length > 0) {
      const current = pending.pop()!;
      if (current === taskId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      pending.push(...(predecessorIdsByTaskId.get(current) ?? []));
    }
    return false;
  }

  private buildHierarchy(tasks: ScheduleTask[]): ScheduleTaskWithHierarchy[] {
    const taskMap = new Map<string, ScheduleTaskWithHierarchy>();
    const roots: ScheduleTaskWithHierarchy[] = [];

    // First pass: create all nodes
    for (const task of tasks) {
      taskMap.set(task.id, {
        ...task,
        children: [],
        level: 0,
        expanded: true,
      });
    }

    // Second pass: build tree
    for (const task of tasks) {
      const node = taskMap.get(task.id)!;

      if (task.parent_task_id && taskMap.has(task.parent_task_id)) {
        const parent = taskMap.get(task.parent_task_id)!;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    // Third pass: assign levels
    this.assignLevels(roots, new Map(), 0);

    return roots;
  }

  private assignLevels(
    nodes: ScheduleTaskWithHierarchy[],
    levelMap: Map<string, number>,
    level: number
  ): void {
    for (const node of nodes) {
      node.level = level;
      levelMap.set(node.id, level);

      if (node.children.length > 0) {
        this.assignLevels(node.children, levelMap, level + 1);
      }
    }
  }
}

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
  ScheduleTaskBulkUpdate,
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
import {
  computeAutoScheduleUpdates,
  computeAutoScheduleUpdatesForDependencyChange,
  type AutoScheduleUpdate,
} from "@/lib/scheduling/schedule-auto-scheduler";

const AUTO_SCHEDULE_TRIGGER_FIELDS = [
  "start_date",
  "finish_date",
  "duration_days",
  "constraint_type",
  "constraint_date",
] as const satisfies ReadonlyArray<keyof ScheduleTaskUpdate>;

type CalendarRow = { working_weekdays: number[] };
type CalendarExceptionRow = { exception_date: string; is_working: boolean };
const SCHEDULE_QUERY_PAGE_SIZE = 500;

export class SchedulingService {
  constructor(private supabase: SupabaseClient) {}

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
    // Get current user
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Authentication required");

    // Get max sort_order for the parent level
    const sortOrder = await this.getNextSortOrder(
      projectId,
      data.parent_task_id || null
    );

    const { data: task, error } = await this.supabase
      .from("schedule_tasks")
      .insert({
        project_id: data.project_id,
        parent_task_id: data.parent_task_id || null,
        name: data.name,
        start_date: data.start_date || null,
        finish_date: data.finish_date || null,
        duration_days: data.duration_days || null,
        percent_complete: data.percent_complete || 0,
        status: data.status || "not_started",
        is_milestone: data.is_milestone || false,
        constraint_type: data.constraint_type || null,
        constraint_date: data.constraint_date || null,
        wbs_code: data.wbs_code || null,
        sort_order: data.sort_order ?? sortOrder,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create task: ${error.message}`);
    }

    return task as ScheduleTask;
  }

  /**
   * Update an existing task
   */
  async updateTask(
    projectId: string,
    taskId: string,
    data: ScheduleTaskUpdate
  ): Promise<ScheduleTask | null> {
    // Get current user
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Authentication required");

    // Validate hierarchy constraints
    if (data.parent_task_id !== undefined) {
      await this.validateParentChange(taskId, data.parent_task_id);
    }

    // Validate milestone constraints
    if (data.is_milestone === true) {
      data.duration_days = 0;
      if (data.start_date) {
        data.finish_date = data.start_date;
      }
    }

    // Auto-scheduling: a date/duration/constraint edit cascades to this task's
    // successors (see schedule-auto-scheduler.ts). Computed against the graph
    // BEFORE this task's own update is persisted, and blocked entirely (nothing
    // written, including this task's own change) if it would violate a downstream
    // constraint — never silently overwrite a constrained task's date.
    const triggersAutoSchedule = AUTO_SCHEDULE_TRIGGER_FIELDS.some((field) => data[field] !== undefined);
    let cascadeUpdates: AutoScheduleUpdate[] = [];
    if (triggersAutoSchedule) {
      const { tasks, dependencies } = await this.fetchScheduleGraph(projectId);
      const result = computeAutoScheduleUpdates({ taskId, tasks, dependencies, update: data });
      if (result.status === "blocked") {
        const conflict = result.constraint_conflicts[0];
        throw new Error(conflict?.message ?? "This change conflicts with a downstream task's schedule constraint.");
      }
      if (result.status === "applied") cascadeUpdates = result.updates;
    }

    const updateData: Record<string, unknown> = {
      ...data,
    };

    const { data: task, error } = await this.supabase
      .from("schedule_tasks")
      .update(updateData)
      .eq("id", taskId)
      .eq("project_id", projectId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update task: ${error.message}`);
    }

    if (cascadeUpdates.length > 0) {
      await this.applyAutoScheduleUpdates(projectId, cascadeUpdates);
    }

    return task as ScheduleTask;
  }

  /**
   * Delete a task
   */
  async deleteTask(projectId: string, taskId: string): Promise<boolean> {
    // Delete will cascade to dependencies and deadlines
    const { error } = await this.supabase
      .from("schedule_tasks")
      .delete()
      .eq("id", taskId)
      .eq("project_id", projectId);

    if (error) {
      throw new Error(`Failed to delete task: ${error.message}`);
    }

    return true;
  }

  /**
   * Bulk update multiple tasks
   */
  async bulkUpdateTasks(
    projectId: string,
    bulkUpdate: ScheduleTaskBulkUpdate
  ): Promise<{
    success: string[];
    failed: Array<{ id: string; error: string }>;
  }> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Authentication required");

    const success: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const id of bulkUpdate.ids) {
      try {
        const { error } = await this.supabase
          .from("schedule_tasks")
          .update({
            ...bulkUpdate.updates,
          })
          .eq("id", id)
          .eq("project_id", projectId);

        if (error) {
          failed.push({ id, error: error.message });
        } else {
          success.push(id);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "an unexpected error occurred";
        failed.push({ id, error: message });
      }
    }

    return { success, failed };
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
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Authentication required");

    if (data.task_id === data.predecessor_task_id) {
      throw new Error("A task cannot depend on itself. Select another predecessor.");
    }

    const [task, predecessor] = await Promise.all([
      this.getTaskById(projectId, data.task_id),
      this.getTaskById(projectId, data.predecessor_task_id),
    ]);
    if (!task || !predecessor) {
      throw new Error("Both the task and predecessor must belong to this project.");
    }

    const wouldCreateCycle = await this.wouldCreateDependencyCycle(
      projectId,
      data.task_id,
      data.predecessor_task_id,
    );
    if (wouldCreateCycle) {
      throw new Error("Cannot create dependency: this predecessor would create a circular dependency chain.");
    }

    // Check the auto-scheduling cascade BEFORE writing, so a blocked cascade
    // rejects the whole operation instead of leaving an orphaned dependency row
    // behind a thrown error.
    const dependenciesBefore = await this.getDependencies(projectId);
    const pendingDependency: ScheduleDependency = {
      id: "pending",
      task_id: data.task_id,
      predecessor_task_id: data.predecessor_task_id,
      dependency_type: data.dependency_type || "finish_to_start",
      lag_days: data.lag_days ?? 0,
      created_at: new Date(0).toISOString(),
    };
    const cascade = await this.computeDependencyCascade(
      projectId,
      data.predecessor_task_id,
      dependenciesBefore,
      [...dependenciesBefore, pendingDependency],
    );
    if (cascade.status === "blocked") {
      const conflict = cascade.constraint_conflicts[0];
      throw new Error(conflict?.message ?? "This dependency conflicts with a downstream task's schedule constraint.");
    }

    const { data: dependency, error } = await this.supabase
      .from("schedule_dependencies")
      .insert({
        task_id: data.task_id,
        predecessor_task_id: data.predecessor_task_id,
        dependency_type: data.dependency_type || "finish_to_start",
        lag_days: data.lag_days ?? 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create dependency: ${error.message}`);
    }

    if (cascade.status === "applied") {
      await this.applyAutoScheduleUpdates(projectId, cascade.updates);
    }

    return dependency as ScheduleDependency;
  }

  /**
   * Delete a dependency
   */
  async deleteDependency(projectId: string, taskId: string, dependencyId: string): Promise<boolean> {
    if (!(await this.getTaskById(projectId, taskId))) {
      throw new Error("Task not found for this project.");
    }
    const dependenciesBefore = await this.getDependencies(projectId);
    const deleted = dependenciesBefore.find((dependency) => dependency.id === dependencyId);
    const dependenciesAfter = dependenciesBefore.filter((dependency) => dependency.id !== dependencyId);

    // Removing a dependency only ever relaxes the schedule, so unlike create/update
    // it never blocks: if the cascade it implies would conflict with a downstream
    // constraint, the deletion still proceeds and the auto-cascade is simply skipped
    // for this trigger (existing constraint-violation warnings on the Gantt still
    // surface the issue for a human to resolve).
    const cascade = deleted
      ? await this.computeDependencyCascade(projectId, deleted.predecessor_task_id, dependenciesBefore, dependenciesAfter)
      : null;

    const { error } = await this.supabase
      .from("schedule_dependencies")
      .delete()
      .eq("id", dependencyId)
      .eq("task_id", taskId);

    if (error) {
      throw new Error(`Failed to delete dependency: ${error.message}`);
    }

    if (cascade?.status === "applied") {
      await this.applyAutoScheduleUpdates(projectId, cascade.updates);
    }

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
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Authentication required");

    const dependenciesBefore = await this.getDependencies(projectId);
    const existing = dependenciesBefore.find(
      (dependency) => dependency.id === dependencyId && dependency.task_id === taskId,
    );
    if (!existing) throw new Error("Dependency not found for this schedule task.");

    const predecessorTaskId = data.predecessor_task_id ?? existing.predecessor_task_id;
    if (predecessorTaskId === taskId) {
      throw new Error("A task cannot depend on itself. Select another predecessor.");
    }
    if (data.predecessor_task_id && data.predecessor_task_id !== existing.predecessor_task_id) {
      if (!(await this.getTaskById(projectId, data.predecessor_task_id))) {
        throw new Error("The predecessor must belong to this project.");
      }
      if (await this.wouldCreateDependencyCycle(projectId, taskId, predecessorTaskId)) {
        throw new Error("Cannot update dependency: this predecessor would create a circular dependency chain.");
      }
    }

    const pendingDependency: ScheduleDependency = {
      ...existing,
      predecessor_task_id: predecessorTaskId,
      dependency_type: data.dependency_type ?? existing.dependency_type,
      lag_days: data.lag_days ?? existing.lag_days,
    };
    // Anchored at the (possibly new) predecessor. If the predecessor itself changed
    // (rare — most updates only touch lag/type on an existing link), the "before"
    // computation is anchored at the new predecessor too, so it won't fully capture
    // the old predecessor's prior influence — an acceptable inaccuracy for that edge
    // case rather than a two-anchor reconciliation.
    const cascade = await this.computeDependencyCascade(
      projectId,
      predecessorTaskId,
      dependenciesBefore,
      dependenciesBefore.map((dependency) => (dependency.id === dependencyId ? pendingDependency : dependency)),
    );
    if (cascade.status === "blocked") {
      const conflict = cascade.constraint_conflicts[0];
      throw new Error(conflict?.message ?? "This dependency conflicts with a downstream task's schedule constraint.");
    }

    const { data: dependency, error } = await this.supabase
      .from("schedule_dependencies")
      .update({
        ...(data.predecessor_task_id === undefined ? {} : { predecessor_task_id: data.predecessor_task_id }),
        ...(data.dependency_type === undefined ? {} : { dependency_type: data.dependency_type }),
        ...(data.lag_days === undefined ? {} : { lag_days: data.lag_days }),
      })
      .eq("id", dependencyId)
      .eq("task_id", taskId)
      .select()
      .single();
    if (error) throw new Error(`Failed to update dependency: ${error.message}`);

    if (cascade.status === "applied") {
      await this.applyAutoScheduleUpdates(projectId, cascade.updates);
    }

    return dependency as ScheduleDependency;
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
   * the same working-day math as the auto-scheduler before resorting to `today`.
   */
  private deriveGanttDates(
    task: ScheduleTask,
    calendar: ScheduleCalendar,
    today: string,
  ): { start_date: string; finish_date: string } {
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
    return { start_date: task.start_date || today, finish_date: task.finish_date || today };
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
      const { start_date, finish_date } = this.deriveGanttDates(task, calendar, today);
      return {
        id: task.id,
        name: task.name,
        start_date,
        finish_date,
        duration_days: task.duration_days || 0,
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
  ): Promise<{ tasks: ScheduleTask[]; dependencies: ScheduleDependency[] }> {
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

    const [dependencies, segments] = await Promise.all([
      this.getDependencies(projectId),
      this.getTaskSegments(projectId),
    ]);
    const segmentsByTaskId = new Map<string, ScheduleTask["segments"]>();
    for (const segment of segments) {
      segmentsByTaskId.set(segment.task_id, [...(segmentsByTaskId.get(segment.task_id) ?? []), segment]);
    }

    return {
      tasks: tasks.map((task) => ({ ...task, segments: segmentsByTaskId.get(task.id) ?? [] })),
      dependencies,
    };
  }

  /**
   * Persists auto-scheduling cascade updates directly (not via `updateTask`, which
   * would recompute and re-trigger the cascade — this is the terminal write).
   */
  private async applyAutoScheduleUpdates(projectId: string, updates: AutoScheduleUpdate[]): Promise<void> {
    for (const update of updates) {
      const { error } = await this.supabase
        .from("schedule_tasks")
        .update({ start_date: update.start_date, finish_date: update.finish_date })
        .eq("id", update.task_id)
        .eq("project_id", projectId);
      if (error) {
        throw new Error(`Failed to auto-schedule task ${update.task_id}: ${error.message}`);
      }
    }
  }

  /**
   * Computes (but does not write) the auto-scheduling cascade for a dependency
   * change, given the dependency set before and after. Callers check this BEFORE
   * persisting the dependency change itself, so a blocked cascade rejects the whole
   * operation instead of leaving an orphaned dependency row behind a thrown error.
   */
  private async computeDependencyCascade(
    projectId: string,
    predecessorTaskId: string,
    dependenciesBefore: ScheduleDependency[],
    dependenciesAfter: ScheduleDependency[],
  ): Promise<ReturnType<typeof computeAutoScheduleUpdatesForDependencyChange>> {
    const { tasks } = await this.fetchScheduleGraph(projectId);
    return computeAutoScheduleUpdatesForDependencyChange({ predecessorTaskId, tasks, dependenciesBefore, dependenciesAfter });
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

  private async getNextSortOrder(
    projectId: string,
    parentTaskId: string | null
  ): Promise<number> {
    let query = this.supabase
      .from("schedule_tasks")
      .select("sort_order")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: false })
      .limit(1);

    if (parentTaskId === null) {
      query = query.is("parent_task_id", null);
    } else {
      query = query.eq("parent_task_id", parentTaskId);
    }

    const { data } = await query;

    if (data && data.length > 0) {
      return (data[0].sort_order || 0) + 1;
    }

    return 0;
  }

  private async validateParentChange(
    taskId: string,
    newParentId: string | null
  ): Promise<void> {
    if (!newParentId) return;

    // Check for circular reference
    if (newParentId === taskId) {
      throw new Error("Cannot set a task as its own parent");
    }

    // Check if the new parent is a descendant of this task
    const descendants = await this.getDescendants(taskId);
    if (descendants.includes(newParentId)) {
      throw new Error("Cannot set a descendant as the parent");
    }
  }

  private async getDescendants(taskId: string): Promise<string[]> {
    const { data } = await this.supabase
      .from("schedule_tasks")
      .select("id")
      .eq("parent_task_id", taskId);

    if (!data || data.length === 0) return [];

    const descendants: string[] = data.map((d) => d.id);

    for (const child of data) {
      const childDescendants = await this.getDescendants(child.id);
      descendants.push(...childDescendants);
    }

    return descendants;
  }

  private async wouldCreateDependencyCycle(
    projectId: string,
    taskId: string,
    predecessorTaskId: string,
  ): Promise<boolean> {
    const dependencies = await this.getDependencies(projectId);
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

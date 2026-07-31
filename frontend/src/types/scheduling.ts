/**
 * =============================================================================
 * SCHEDULING MODULE TYPES
 * =============================================================================
 *
 * TypeScript interfaces for the scheduling module
 * Based on Procore crawl data and schema.sql specifications
 */

// Task status enum
export type TaskStatus = "not_started" | "in_progress" | "complete";

// Constraint types for task scheduling
export type ConstraintType =
  | "none"
  | "start_no_earlier_than"
  | "finish_no_later_than"
  | "must_start_on"
  | "must_finish_on";

// Auto-scheduling mode, mirrors Microsoft Project's Auto/Manually Scheduled toggle
export type ScheduleMode = "auto" | "manual";

// Dependency types
export type DependencyType =
  | "finish_to_start"
  | "start_to_start"
  | "finish_to_finish"
  | "start_to_finish";

export type ScheduleWarningCode =
  | "dependency_violation"
  | "deadline_missed"
  | "constraint_violation"
  | "missing_dates"
  | "circular_dependency";

/**
 * Main Schedule Task interface
 * Represents a single task in the project schedule
 */
export interface ScheduleTask {
  id: string;
  project_id: number;
  parent_task_id: string | null;
  name: string;
  start_date: string | null;
  finish_date: string | null;
  duration_days: number | null;
  percent_complete: number;
  status: TaskStatus;
  is_milestone: boolean;
  constraint_type: ConstraintType | null;
  constraint_date: string | null;
  wbs_code: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  actual_start_date?: string | null;
  actual_finish_date?: string | null;
  forecast_start_date?: string | null;
  forecast_finish_date?: string | null;
  remaining_duration_days?: number | null;
  assignee?: string | null;
  assignee_person_id?: string | null;
  priority?: string | null;
  work_minutes?: number | null;
  allow_leveling_split?: boolean;
  leveling_priority?: number;
  schedule_version?: number;
  schedule_mode?: ScheduleMode;
  segments?: ScheduleTaskSegment[];
  // Derived/joined fields
  children?: ScheduleTask[];
  dependencies?: ScheduleDependency[];
  deadline?: ScheduleDeadline;
}

export interface ScheduleTaskSegment {
  id: string;
  task_id: string;
  segment_index: number;
  starts_at: string;
  ends_at: string;
  planned_minutes: number;
  lock_reason: "fixed" | "progressed" | null;
}

export interface ScheduleTaskSegmentInput extends Omit<
  ScheduleTaskSegment,
  "id" | "task_id"
> {}

export interface ScheduleTaskSegmentsResponse {
  task_id: string;
  task_version: number;
  state: {
    task: Record<string, unknown>;
    segments: ScheduleTaskSegment[];
  };
}

export interface ScheduleWeeklyWorkInterval {
  weekday: number;
  start_minute: number;
  end_minute: number;
  capacity_percent: number;
}

export interface ScheduleDatedWorkInterval {
  local_date: string;
  start_minute: number;
  end_minute: number;
  capacity_percent: number;
  reason: string | null;
}

export interface SchedulePersonWorkCalendar {
  person_id: string;
  calendar_id: string | null;
  timezone_name: string;
  slot_minutes: number;
  version: number | null;
  weekly_intervals: ScheduleWeeklyWorkInterval[];
  date_intervals: ScheduleDatedWorkInterval[];
}

export interface SchedulePersonWorkCalendarInput {
  timezone_name: string;
  expected_version: number | null;
  weekly_intervals: ScheduleWeeklyWorkInterval[];
  date_intervals: ScheduleDatedWorkInterval[];
}

export interface ScheduleEnterpriseReservation {
  person_id: string;
  project_id: number | null;
  task_id: string | null;
  project_name: string | null;
  task_name: string | null;
  redacted: boolean;
  starts_at: string;
  ends_at: string;
  allocation_percent: number;
}

export interface ScheduleEnterpriseCapacityResponse {
  project_id: number;
  source_token: string;
  range: { start: string; finish: string };
  person_revisions: Record<string, number>;
  calendars: SchedulePersonWorkCalendar[];
  reservations: ScheduleEnterpriseReservation[];
}

export interface ScheduleLevelingChangeInput {
  task_id: string;
  expected_task_version: number;
  after_state: Record<string, unknown>;
  reasons: string[];
}

export interface ScheduleLevelingRunInput {
  range_start: string;
  range_finish: string;
}

export interface ScheduleLevelingRunRecord {
  id: string;
  project_id: number;
  algorithm_version: string;
  source_token: string;
  configuration: Record<string, unknown>;
  diagnostics: Array<Record<string, unknown>>;
  expires_at: string;
  created_at: string;
}

export interface ScheduleLevelingRunResponse {
  run: ScheduleLevelingRunRecord;
  changes: Array<Record<string, unknown>>;
}

export interface ScheduleLevelingEventRecord {
  id: string;
  project_id: number;
  run_id: string;
  event_type: "applied" | "undone";
  related_event_id: string | null;
  reason: string | null;
  created_at: string;
}

export interface ScheduleLevelingEventResponse {
  event: ScheduleLevelingEventRecord;
  source_revision?: Record<string, unknown>;
  target_revision?: Record<string, unknown>;
}

export interface ScheduleLevelingHistoryItem {
  event: ScheduleLevelingEventRecord;
  run: ScheduleLevelingRunRecord;
  change_count: number;
  can_undo: boolean;
}

export interface ScheduleResource {
  id: string;
  project_id: number;
  person_id: string;
  display_name: string;
  email: string | null;
  job_title: string | null;
  person_status: "active" | "inactive";
  membership_status: "active" | "inactive";
  eligible: boolean;
}

export interface ScheduleResourceCandidate {
  person_id: string;
  resource_id: string | null;
  display_name: string;
  email: string | null;
  job_title: string | null;
}

export interface ScheduleTaskAssignment {
  id: string;
  project_id: number;
  task_id: string;
  resource_id: string;
  person_id: string;
  allocation_percent: number;
}

export interface ScheduleResourceRoster {
  resources: ScheduleResource[];
  candidates: ScheduleResourceCandidate[];
  assignments: ScheduleTaskAssignment[];
}

export interface ScheduleResourceRosterResponse extends ScheduleResourceRoster {
  can_manage: boolean;
  can_manage_enterprise_calendars?: boolean;
  legacy_assignment_count: number;
}

export interface ScheduleTaskAssignmentInput {
  person_id: string;
  allocation_percent: number;
}

export interface ScheduleResourceWeekdayCapacityOverride {
  weekday: number;
  capacity_percent: number;
}

export interface ScheduleResourceCapacityException {
  date: string;
  capacity_percent: number;
  reason: string | null;
}

/**
 * Project-scoped capacity facts for one schedule resource. A configured profile
 * can be range-bounded when it came from an allocation/preview read. Null
 * coverage bounds mean the caller loaded the complete exception history.
 */
export interface ScheduleResourceCapacityProfile {
  profile_id: string | null;
  project_id: number;
  resource_id: string;
  configured: boolean;
  version: number | null;
  coverage_start_date: string | null;
  coverage_finish_date: string | null;
  weekday_overrides: ScheduleResourceWeekdayCapacityOverride[];
  exceptions: ScheduleResourceCapacityException[];
}

export interface ScheduleResourceCapacityProfileInput {
  expected_version: number | null;
  weekday_overrides: ScheduleResourceWeekdayCapacityOverride[];
  exceptions: ScheduleResourceCapacityException[];
}

export interface ScheduleResourceCapacityRangeResponse {
  project_id: number;
  range: { start: string; finish: string };
  profiles: ScheduleResourceCapacityProfile[];
}

export type ScheduleResourceCapacitySource =
  | "project_non_working"
  | "date_exception"
  | "weekday_override"
  | "inherited"
  | "resource_inactive"
  | "unavailable";

export interface ScheduleResourceCapacityResolution {
  capacity_percent: number;
  source: ScheduleResourceCapacitySource;
  reason: string | null;
  available: boolean;
}

export type ScheduleResourceCapacityDiagnosticCode =
  | "invalid_capacity_fact"
  | "duplicate_capacity_fact"
  | "duplicate_capacity_profile"
  | "uncovered_capacity_range";

export interface ScheduleResourceCapacityDiagnostic {
  code: ScheduleResourceCapacityDiagnosticCode;
  resource_id: string;
  fact_type?: "profile" | "weekday" | "exception" | "coverage";
  key?: string;
  date?: string;
  message: string;
}

export interface ResourceDailyAllocation {
  resource_id: string;
  date: string;
  capacity_percent: number;
  capacity_source: ScheduleResourceCapacitySource;
  capacity_reason: string | null;
  assigned_percent: number;
  available_percent: number;
  overallocated_percent: number;
  task_allocations: Array<{
    task_id: string;
    task_name: string;
    allocation_percent: number;
  }>;
}

export interface ResourceAllocationSummary {
  resource_id: string;
  peak_assigned_percent: number;
  overallocated_dates: string[];
}

export interface ResourceAllocationDiagnostic {
  code:
    | "missing_task"
    | "missing_resource"
    | "inactive_resource"
    | "unscheduled_task"
    | "invalid_date_range"
    | ScheduleResourceCapacityDiagnosticCode;
  assignment_id?: string;
  task_id?: string;
  resource_id?: string;
  date?: string;
  fact_type?: ScheduleResourceCapacityDiagnostic["fact_type"];
  key?: string;
  message?: string;
}

export interface ScheduleResourceAllocationResult {
  daily: ResourceDailyAllocation[];
  summaries: ResourceAllocationSummary[];
  diagnostics: ResourceAllocationDiagnostic[];
}

export interface ScheduleResourceLevelingPreviewRequest {
  horizon_days?: number;
}

export type ScheduleResourceLevelingReason =
  | "project_calendar"
  | "dependency"
  | "constraint"
  | "resource_capacity";

export interface ScheduleResourceLevelingProposal {
  task_id: string;
  task_name: string;
  previous_start_date: string;
  previous_finish_date: string;
  proposed_start_date: string;
  proposed_finish_date: string;
  delay_working_days: number;
  reasons: ScheduleResourceLevelingReason[];
  constraining_resource_ids: string[];
}

export type ScheduleResourceLevelingDiagnosticCode =
  | "invalid_horizon"
  | "missing_task"
  | "missing_resource"
  | "inactive_resource"
  | "invalid_assignment"
  | "invalid_dependency"
  | "invalid_task_dates"
  | "circular_dependency"
  | "unresolved_predecessor"
  | "hard_constraint_conflict"
  | "constraint_conflict"
  | "fixed_dependency_conflict"
  | "fixed_capacity_conflict"
  | "horizon_exhausted"
  | ScheduleResourceCapacityDiagnosticCode;

export interface ScheduleResourceLevelingDiagnostic {
  code: ScheduleResourceLevelingDiagnosticCode;
  message: string;
  task_id?: string;
  resource_id?: string;
  resource_ids?: string[];
  dependency_id?: string;
  assignment_id?: string;
  date?: string;
  fact_type?: ScheduleResourceCapacityDiagnostic["fact_type"];
  key?: string;
}

export type ScheduleResourceLevelingPreviewStatus =
  | "available"
  | "partial"
  | "unavailable";

export interface ScheduleResourceLevelingPreviewResult {
  status: ScheduleResourceLevelingPreviewStatus;
  proposals: ScheduleResourceLevelingProposal[];
  diagnostics: ScheduleResourceLevelingDiagnostic[];
  notice: "Preview only. No schedule dates were changed.";
}

/**
 * Task dependency relationship
 * Defines predecessor/successor relationships between tasks
 */
export interface ScheduleDependency {
  id: string;
  task_id: string;
  predecessor_task_id: string;
  dependency_type: DependencyType;
  lag_days: number;
  created_at: string;
}

/**
 * Task deadline
 * Marks a specific date that a task should not exceed
 */
export interface ScheduleDeadline {
  id: string;
  task_id: string;
  deadline_date: string;
  created_at: string;
}

/**
 * Task creation payload
 * Used when creating a new task
 */
export interface ScheduleTaskCreate {
  name: string;
  project_id: number;
  parent_task_id?: string | null;
  start_date?: string | null;
  finish_date?: string | null;
  duration_days?: number | null;
  percent_complete?: number;
  status?: TaskStatus;
  is_milestone?: boolean;
  constraint_type?: ConstraintType | null;
  constraint_date?: string | null;
  wbs_code?: string | null;
  sort_order?: number;
  assignee_person_id?: string | null;
  schedule_mode?: ScheduleMode;
}

/**
 * Task update payload
 * Used for partial updates to existing tasks
 */
export interface ScheduleTaskUpdate {
  name?: string;
  parent_task_id?: string | null;
  start_date?: string | null;
  finish_date?: string | null;
  duration_days?: number | null;
  percent_complete?: number;
  status?: TaskStatus;
  is_milestone?: boolean;
  constraint_type?: ConstraintType | null;
  constraint_date?: string | null;
  wbs_code?: string | null;
  sort_order?: number;
  schedule_mode?: ScheduleMode;
  assignee_person_id?: string | null;
}

/**
 * Bulk update payload
 * Used for updating multiple tasks at once
 */
export interface ScheduleTaskBulkUpdate {
  ids: string[];
  updates: ScheduleTaskUpdate;
}

/**
 * Dependency creation payload
 */
export interface ScheduleDependencyCreate {
  task_id: string;
  predecessor_task_id: string;
  dependency_type?: DependencyType;
  lag_days?: number;
}

export interface ScheduleDependencyUpdate {
  predecessor_task_id?: string;
  dependency_type?: DependencyType;
  lag_days?: number;
}

/**
 * Deadline creation payload
 */
export interface ScheduleDeadlineCreate {
  task_id: string;
  deadline_date: string;
}

/**
 * Task list query parameters
 */
export interface ScheduleTaskListParams {
  page?: number;
  limit?: number;
  sort?:
    | "name"
    | "start_date"
    | "finish_date"
    | "percent_complete"
    | "status"
    | "created_at"
    | "sort_order";
  order?: "asc" | "desc";
  status?: TaskStatus | "all";
  parent_task_id?: string | null;
  is_milestone?: boolean;
  search?: string;
}

/**
 * Paginated response wrapper for scheduling module
 * Note: This is distinct from the general PaginatedResponse in @/app/api/types
 * which uses different field names (meta instead of pagination, page instead of current_page, etc.)
 */
export interface SchedulePaginatedResponse<T> {
  data: T[];
  pagination: {
    current_page: number;
    per_page: number;
    total_records: number;
    total_pages: number;
    has_next_page: boolean;
    has_prev_page: boolean;
  };
}

/**
 * Schedule summary statistics
 */
export interface ScheduleSummary {
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  not_started_tasks: number;
  milestones_count: number;
  overdue_tasks: number;
  overall_percent_complete: number;
}

/**
 * Task with full hierarchy loaded
 * Used for tree view rendering
 */
export interface ScheduleTaskWithHierarchy extends ScheduleTask {
  children: ScheduleTaskWithHierarchy[];
  level: number;
  expanded?: boolean;
}

/**
 * Gantt chart data item
 * Flattened task data for Gantt rendering
 */
export interface GanttChartItem {
  id: string;
  name: string;
  start_date: string;
  finish_date: string;
  duration_days: number;
  percent_complete: number;
  assignee?: string | null;
  status: TaskStatus;
  is_milestone: boolean;
  parent_task_id: string | null;
  level: number;
  dependencies: Array<{
    predecessor_id: string;
    type: DependencyType;
    lag_days: number;
  }>;
  deadline?: string;
  is_overdue: boolean;
  is_critical_path?: boolean;
  total_float_days?: number;
  schedule_warnings?: ScheduleWarningCode[];
  baseline_start_date?: string | null;
  baseline_finish_date?: string | null;
  baseline_duration_days?: number | null;
  start_variance_days?: number | null;
  finish_variance_days?: number | null;
  duration_variance_days?: number | null;
  comparison_status?: "unchanged" | "changed" | "added" | "removed";
  segments?: ScheduleTaskSegment[];
}

/**
 * Context menu action
 * Represents available actions in the task context menu
 */
export type ScheduleContextAction =
  | "add_task"
  | "edit_task"
  | "delete_task"
  | "copy_task"
  | "cut_task"
  | "paste_task"
  | "indent_task"
  | "outdent_task"
  | "convert_to_milestone"
  | "set_deadline"
  | "scroll_to_task"
  | "bulk_edit_tasks"
  | "import_schedule"
  | "export_schedule";

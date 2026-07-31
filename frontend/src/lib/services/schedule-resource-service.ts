import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type {
  ScheduleDependency,
  ScheduleResource,
  ScheduleResourceCandidate,
  ScheduleResourceCapacityProfile,
  ScheduleResourceCapacityException,
  ScheduleResourceCapacityProfileInput,
  ScheduleResourceWeekdayCapacityOverride,
  ScheduleResourceCapacityRangeResponse,
  ScheduleResourceRosterResponse,
  ScheduleEnterpriseCapacityResponse,
  ScheduleEnterpriseReservation,
  ScheduleLevelingEventResponse,
  ScheduleLevelingHistoryItem,
  ScheduleLevelingRunInput,
  ScheduleLevelingRunResponse,
  SchedulePersonWorkCalendarInput,
  SchedulePersonWorkCalendar,
  ScheduleTask,
  ScheduleTaskAssignment,
  ScheduleTaskAssignmentExpectation,
  ScheduleTaskAssignmentInput,
  ScheduleTaskSegmentInput,
  ScheduleTaskSegmentsResponse,
} from "@/types/scheduling";
import type { ScheduleResourceLevelingInput } from "@/lib/scheduling/schedule-resource-leveling-preview";
import type { ScheduleCalendar } from "@/lib/scheduling/schedule-calendar";
import {
  buildEnterpriseCapacitySlots,
  expandPersonWorkCalendarSlots,
  expandProjectWorkingCalendarSlots,
  localDateParts,
  previewHourlyResourceLeveling,
  zonedLocalTimestamp,
  type HourlyLevelingResult,
  type TaskScheduleSegment,
} from "@/lib/scheduling/schedule-hourly-leveling";

type DatabaseError = {
  code?: string | null;
  message: string;
};

/**
 * Supabase function Args do not encode SQL nullability for required
 * PostgreSQL parameters. Preserve the runtime null while narrowing only the
 * generated client-side type.
 */
function sqlNullableArgument<T>(value: T | null): T {
  return value!;
}

type PersonRow = Pick<
  Database["public"]["Tables"]["people"]["Row"],
  "id" | "first_name" | "last_name" | "email" | "job_title" | "status"
>;

type MembershipRow = Pick<
  Database["public"]["Tables"]["project_directory_memberships"]["Row"],
  "project_id" | "person_id" | "status"
>;

type ResourceRow = Pick<
  Database["public"]["Tables"]["schedule_resources"]["Row"],
  "id" | "project_id" | "person_id"
>;

type AssignmentRow = Pick<
  Database["public"]["Tables"]["schedule_task_assignments"]["Row"],
  | "id"
  | "project_id"
  | "task_id"
  | "resource_id"
  | "allocation_percent"
  | "cost_version"
>;

export type ScheduleCostResourceRecord = Pick<
  Database["public"]["Tables"]["schedule_resources"]["Row"],
  | "id"
  | "project_id"
  | "person_id"
  | "resource_kind"
  | "display_name"
  | "standard_rate"
  | "cost_per_use"
  | "rate_unit"
  | "cost_version"
>;

export type ScheduleCostAssignmentRecord = Pick<
  Database["public"]["Tables"]["schedule_task_assignments"]["Row"],
  | "id"
  | "project_id"
  | "task_id"
  | "resource_id"
  | "allocation_percent"
  | "planned_units"
  | "actual_units"
  | "actual_rate"
  | "actual_cost"
  | "cost_version"
>;

export interface ScheduleCostModel {
  project_id: number;
  can_manage: boolean;
  resources: ScheduleCostResourceRecord[];
  assignments: ScheduleCostAssignmentRecord[];
}

export interface ScheduleCostResourceInput {
  id?: string | null;
  resource_kind: "person" | "equipment" | "material";
  display_name: string;
  standard_rate: number | null;
  cost_per_use: number | null;
  rate_unit: "hour" | "day" | "unit" | null;
  expected_cost_version?: number | null;
}

export interface ScheduleCostAssignmentInput {
  task_id: string;
  resource_id: string;
  allocation_percent: number;
  planned_units: number | null;
  actual_units: number | null;
  actual_rate: number | null;
  actual_cost: number | null;
  expected_cost_version?: number | null;
}

const QUERY_PAGE_SIZE = 500;
const PEOPLE_ID_BATCH_SIZE = 100;
const DAY_MS = 86_400_000;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type ScheduleResourceReadModel = {
  project_id: number;
  range: { start: string | null; finish: string | null };
  resources: ScheduleResource[];
  capacity_profiles: ScheduleResourceCapacityProfile[];
  tasks: ScheduleTask[];
  dependencies: ScheduleDependency[];
  assignments: ScheduleTaskAssignment[];
  calendar: ScheduleCalendar;
};

type HourlyLevelingContextTask = {
  id: string;
  name: string;
  start_date: string | null;
  finish_date: string | null;
  forecast_start_date: string | null;
  forecast_finish_date: string | null;
  duration_days: number | null;
  remaining_duration_days: number | null;
  percent_complete: number;
  status: string;
  is_milestone: boolean;
  actual_start_date: string | null;
  actual_finish_date: string | null;
  constraint_type: string | null;
  constraint_date: string | null;
  work_minutes: number | null;
  allow_leveling_split: boolean;
  leveling_priority: number;
  schedule_version: number;
  segments: TaskScheduleSegment[];
};

type HourlyLevelingContext = ScheduleEnterpriseCapacityResponse & {
  project_timezone: string;
  tasks: HourlyLevelingContextTask[];
  dependencies: Array<{
    task_id: string;
    predecessor_task_id: string;
    dependency_type:
      | "finish_to_start"
      | "start_to_start"
      | "finish_to_finish"
      | "start_to_finish";
    lag_minutes: number;
  }>;
  assignments: Array<{
    task_id: string;
    person_id: string;
    allocation_percent: number;
  }>;
};

export type AuthoritativeHourlyLevelingResponse = {
  preview: HourlyLevelingResult;
  run: ScheduleLevelingRunResponse | null;
  timezone_name: string;
};

export type LevelingRunAuthority = {
  client: SupabaseClient<Database>;
  actorUserId: string;
};

type UntypedRpc = (
  functionName: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: DatabaseError | null }>;

function untypedRpc(client: SupabaseClient<Database>): UntypedRpc {
  return client.rpc.bind(client) as UntypedRpc;
}

export class ScheduleResourceServiceError extends Error {
  constructor(
    message: string,
    readonly operation: "database" | "rpc" | "integrity",
    readonly databaseError?: DatabaseError,
  ) {
    super(message);
    this.name = "ScheduleResourceServiceError";
  }
}

function requireProjectScope(
  rows: Array<{ project_id: number }>,
  projectId: number,
  label: string,
): void {
  if (rows.some((row) => row.project_id !== projectId)) {
    throw new ScheduleResourceServiceError(
      `${label} returned data outside project ${projectId}.`,
      "integrity",
    );
  }
}

function normalizeStatus(value: string | null): "active" | "inactive" {
  return value?.toLowerCase() === "active" ? "active" : "inactive";
}

function displayName(person: PersonRow): string {
  return (
    [person.first_name, person.last_name]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" ") ||
    person.email ||
    "Unnamed resource"
  );
}

function throwDatabaseFailure(label: string, error: DatabaseError): never {
  throw new ScheduleResourceServiceError(
    `${label}: ${error.message}`,
    "database",
    error,
  );
}

function parseIsoDate(value: string, label: string): number {
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new ScheduleResourceServiceError(
      `${label} must use YYYY-MM-DD format.`,
      "integrity",
    );
  }
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== value
  ) {
    throw new ScheduleResourceServiceError(
      `${label} must be a valid calendar date.`,
      "integrity",
    );
  }
  return timestamp;
}

function assertProjectId(projectId: number): void {
  if (!Number.isSafeInteger(projectId) || projectId <= 0) {
    throw new ScheduleResourceServiceError(
      "Project identifier must be a positive integer.",
      "integrity",
    );
  }
}

async function loadAllRows<T>(
  label: string,
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: DatabaseError | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += QUERY_PAGE_SIZE) {
    const result = await fetchPage(from, from + QUERY_PAGE_SIZE - 1);
    if (result.error) throwDatabaseFailure(label, result.error);
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < QUERY_PAGE_SIZE) return rows;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) &&
    Object.values(value).every((item) => typeof item === "number");
}

function isWeekdayCapacityOverride(
  value: unknown,
): value is ScheduleResourceWeekdayCapacityOverride {
  return isRecord(value) &&
    typeof value.weekday === "number" &&
    typeof value.capacity_percent === "number";
}

function isCapacityException(
  value: unknown,
): value is ScheduleResourceCapacityException {
  return isRecord(value) &&
    typeof value.date === "string" &&
    typeof value.capacity_percent === "number" &&
    isNullableString(value.reason);
}

function parseCapacityProfile(
  value: unknown,
  projectId: number,
  resourceId?: string,
): ScheduleResourceCapacityProfile {
  if (
    !isRecord(value) ||
    value.project_id !== projectId ||
    typeof value.resource_id !== "string" ||
    (resourceId !== undefined && value.resource_id !== resourceId) ||
    typeof value.configured !== "boolean" ||
    !isNullableString(value.profile_id) ||
    !isNullableNumber(value.version) ||
    !isNullableString(value.coverage_start_date) ||
    !isNullableString(value.coverage_finish_date) ||
    !Array.isArray(value.weekday_overrides) ||
    !value.weekday_overrides.every(isWeekdayCapacityOverride) ||
    !Array.isArray(value.exceptions) ||
    !value.exceptions.every(isCapacityException)
  ) {
    throw new ScheduleResourceServiceError(
      `Resource capacity RPC returned malformed data for project ${projectId}.`,
      "integrity",
    );
  }
  return {
    profile_id: value.profile_id,
    project_id: value.project_id,
    resource_id: value.resource_id,
    configured: value.configured,
    version: value.version,
    coverage_start_date: value.coverage_start_date,
    coverage_finish_date: value.coverage_finish_date,
    weekday_overrides: value.weekday_overrides,
    exceptions: value.exceptions,
  };
}

function isPersonWorkCalendar(value: unknown): value is SchedulePersonWorkCalendar {
  return isRecord(value) &&
    typeof value.person_id === "string" &&
    isNullableString(value.calendar_id) &&
    typeof value.timezone_name === "string" &&
    value.slot_minutes === 15 &&
    isNullableNumber(value.version) &&
    Array.isArray(value.weekly_intervals) &&
    Array.isArray(value.date_intervals);
}

function isEnterpriseReservation(value: unknown): value is ScheduleEnterpriseReservation {
  return isRecord(value) &&
    typeof value.person_id === "string" &&
    isNullableNumber(value.project_id) &&
    isNullableString(value.task_id) &&
    isNullableString(value.project_name) &&
    isNullableString(value.task_name) &&
    typeof value.redacted === "boolean" &&
    typeof value.starts_at === "string" &&
    typeof value.ends_at === "string" &&
    typeof value.allocation_percent === "number" &&
    (!value.redacted || (
      value.project_id === null &&
      value.task_id === null &&
      value.project_name === null &&
      value.task_name === null
    ));
}

function parseReadModel(
  value: unknown,
  projectId: number,
): ScheduleResourceReadModel {
  if (
    !isRecord(value) ||
    value.project_id !== projectId ||
    !isRecord(value.range) ||
    !Array.isArray(value.resources) ||
    !Array.isArray(value.capacity_profiles) ||
    !Array.isArray(value.tasks) ||
    !Array.isArray(value.dependencies) ||
    !Array.isArray(value.assignments) ||
    !isRecord(value.calendar)
  ) {
    throw new ScheduleResourceServiceError(
      `Schedule read-model RPC returned malformed data for project ${projectId}.`,
      "integrity",
    );
  }

  const model = value as ScheduleResourceReadModel;
  requireProjectScope(
    model.resources,
    projectId,
    "Schedule read-model resources",
  );
  requireProjectScope(
    model.capacity_profiles,
    projectId,
    "Schedule read-model capacity profiles",
  );
  requireProjectScope(model.tasks, projectId, "Schedule read-model tasks");
  requireProjectScope(
    model.assignments,
    projectId,
    "Schedule read-model assignments",
  );
  model.capacity_profiles.forEach((profile) =>
    parseCapacityProfile(profile, projectId),
  );
  return model;
}

function parseEnterpriseCapacity(
  value: unknown,
  projectId: number,
): ScheduleEnterpriseCapacityResponse {
  if (
    !isRecord(value) ||
    value.project_id !== projectId ||
    typeof value.source_token !== "string" ||
    !isRecord(value.range) ||
    typeof value.range.start !== "string" ||
    typeof value.range.finish !== "string" ||
    !isNumberRecord(value.person_revisions) ||
    !Array.isArray(value.calendars) ||
    !value.calendars.every(isPersonWorkCalendar) ||
    !Array.isArray(value.reservations) ||
    !value.reservations.every(isEnterpriseReservation)
  ) {
    throw new ScheduleResourceServiceError(
      `Enterprise capacity RPC returned malformed data for project ${projectId}.`,
      "integrity",
    );
  }
  return {
    project_id: value.project_id,
    source_token: value.source_token,
    range: { start: value.range.start, finish: value.range.finish },
    person_revisions: value.person_revisions,
    calendars: value.calendars,
    reservations: value.reservations,
  };
}

function parseHourlyLevelingContext(
  value: unknown,
  projectId: number,
): HourlyLevelingContext {
  const capacity = parseEnterpriseCapacity(value, projectId);
  if (
    !isRecord(value) ||
    typeof value.project_timezone !== "string" ||
    !Array.isArray(value.tasks) ||
    !Array.isArray(value.dependencies) ||
    !Array.isArray(value.assignments)
  ) {
    throw new ScheduleResourceServiceError(
      "Hourly leveling context returned malformed data.",
      "integrity",
    );
  }
  return { ...capacity, ...value } as HourlyLevelingContext;
}

function taskBounds(
  task: HourlyLevelingContextTask,
  timezone: string,
): { startsAt: string; endsAt: string } | null {
  if (task.segments.length > 0) {
    return {
      startsAt: task.segments[0].starts_at,
      endsAt: task.segments.at(-1)!.ends_at,
    };
  }
  const startDate = task.forecast_start_date ?? task.start_date;
  const finishDate = task.forecast_finish_date ?? task.finish_date;
  if (!startDate || !finishDate) return null;
  return {
    startsAt: new Date(
      zonedLocalTimestamp(startDate, 480, timezone),
    ).toISOString(),
    endsAt: new Date(
      zonedLocalTimestamp(finishDate, 1020, timezone),
    ).toISOString(),
  };
}

function dateAtLocalMinute(
  date: string,
  minute: number,
  timezone: string,
): string {
  return new Date(zonedLocalTimestamp(date, minute, timezone)).toISOString();
}

function stateFromProposal(
  task: HourlyLevelingContextTask,
  segments: TaskScheduleSegment[],
  timezone: string,
): Record<string, unknown> {
  const normalizedSegments = segments.map(
    ({ id: _id, task_id: _taskId, ...segment }) => segment,
  );
  const first = normalizedSegments[0];
  const last = normalizedSegments.at(-1)!;
  return {
    task: {
      start_date: localDateParts(Date.parse(first.starts_at), timezone).date,
      finish_date: localDateParts(Date.parse(last.ends_at) - 1, timezone).date,
      forecast_start_date: localDateParts(Date.parse(first.starts_at), timezone)
        .date,
      forecast_finish_date: localDateParts(
        Date.parse(last.ends_at) - 1,
        timezone,
      ).date,
      work_minutes: normalizedSegments.reduce(
        (sum, segment) => sum + segment.planned_minutes,
        0,
      ),
      allow_leveling_split: task.allow_leveling_split,
      leveling_priority: task.leveling_priority,
    },
    segments: normalizedSegments,
  };
}

function parseObjectResult<T>(value: unknown, label: string): T {
  if (!isRecord(value)) {
    throw new ScheduleResourceServiceError(
      `${label} returned malformed data.`,
      "integrity",
    );
  }
  return value as T;
}

function parseArrayResult<T>(value: unknown, label: string): T[] {
  if (!Array.isArray(value)) {
    throw new ScheduleResourceServiceError(
      `${label} returned malformed data.`,
      "integrity",
    );
  }
  return value as T[];
}

export class ScheduleResourceService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async getProjectRoster(
    projectId: number,
  ): Promise<ScheduleResourceRosterResponse> {
    assertProjectId(projectId);

    const [
      memberships,
      resourceRows,
      assignmentRows,
      legacyResult,
      capabilityResult,
      enterpriseAdminResult,
    ] = await Promise.all([
      loadAllRows<MembershipRow>(
        "Unable to load project directory memberships",
        (from, to) =>
          this.client
            .from("project_directory_memberships")
            .select("project_id,person_id,status")
            .eq("project_id", projectId)
            .order("person_id")
            .range(from, to),
      ),
      loadAllRows<ResourceRow>(
        "Unable to load schedule resources",
        (from, to) =>
          this.client
            .from("schedule_resources")
            .select("id,project_id,person_id")
            .eq("project_id", projectId)
            .eq("resource_kind", "person")
            .order("id")
            .range(from, to),
      ),
      loadAllRows<AssignmentRow>(
        "Unable to load schedule assignments",
        (from, to) =>
          this.client
            .from("schedule_task_assignments")
            .select("id,project_id,task_id,resource_id,allocation_percent,cost_version")
            .eq("project_id", projectId)
            .order("id")
            .range(from, to),
      ),
      this.client
        .from("schedule_tasks")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .or("assignee.not.is.null,assignee_person_id.not.is.null"),
      this.client.rpc("current_can_manage_schedule", {
        p_project_id: projectId,
      }),
      this.client.rpc("current_is_app_admin"),
    ]);

    if (legacyResult.error)
      throwDatabaseFailure(
        "Unable to inspect legacy schedule assignments",
        legacyResult.error,
      );
    if (capabilityResult.error)
      throwDatabaseFailure(
        "Unable to resolve schedule management capability",
        capabilityResult.error,
      );
    if (enterpriseAdminResult.error)
      throwDatabaseFailure(
        "Unable to resolve enterprise calendar capability",
        enterpriseAdminResult.error,
      );

    requireProjectScope(memberships, projectId, "Project memberships");
    requireProjectScope(resourceRows, projectId, "Schedule resources");
    requireProjectScope(assignmentRows, projectId, "Schedule assignments");

    const personIds = [
      ...new Set([
        ...memberships.map((membership) => membership.person_id),
        ...resourceRows.flatMap((resource) =>
          resource.person_id ? [resource.person_id] : [],
        ),
      ]),
    ];
    const peopleRows: PersonRow[] = [];
    for (
      let index = 0;
      index < personIds.length;
      index += PEOPLE_ID_BATCH_SIZE
    ) {
      const peopleResult = await this.client
        .from("people")
        .select("id,first_name,last_name,email,job_title,status")
        .in("id", personIds.slice(index, index + PEOPLE_ID_BATCH_SIZE))
        .order("id");
      if (peopleResult.error)
        throwDatabaseFailure(
          "Unable to load schedule resource people",
          peopleResult.error,
        );
      peopleRows.push(...((peopleResult.data ?? []) as PersonRow[]));
    }

    const peopleById = new Map(peopleRows.map((person) => [person.id, person]));
    const membershipsByPersonId = new Map(
      memberships.map((membership) => [membership.person_id, membership]),
    );
    const resourceByPersonId = new Map(
      resourceRows.flatMap((resource) =>
        resource.person_id ? [[resource.person_id, resource] as const] : [],
      ),
    );

    const resources: ScheduleResource[] = resourceRows
      .map((resource) => {
        if (!resource.person_id) {
          throw new ScheduleResourceServiceError(
            `Person schedule resource ${resource.id} has no person identifier.`,
            "integrity",
          );
        }
        const person = peopleById.get(resource.person_id);
        if (!person) {
          throw new ScheduleResourceServiceError(
            `Schedule resource ${resource.id} has no resolvable person record.`,
            "integrity",
          );
        }
        const membershipStatus = normalizeStatus(
          membershipsByPersonId.get(resource.person_id)?.status ?? null,
        );
        const personStatus = normalizeStatus(person.status);
        return {
          id: resource.id,
          project_id: resource.project_id,
          person_id: resource.person_id,
          display_name: displayName(person),
          email: person.email,
          job_title: person.job_title,
          person_status: personStatus,
          membership_status: membershipStatus,
          eligible: personStatus === "active" && membershipStatus === "active",
        };
      })
      .sort(
        (left, right) =>
          left.display_name.localeCompare(right.display_name) ||
          left.id.localeCompare(right.id),
      );

    const candidates: ScheduleResourceCandidate[] = memberships
      .flatMap((membership) => {
        const person = peopleById.get(membership.person_id);
        if (
          !person ||
          normalizeStatus(membership.status) !== "active" ||
          normalizeStatus(person.status) !== "active"
        ) {
          return [];
        }
        return [
          {
            person_id: person.id,
            resource_id: resourceByPersonId.get(person.id)?.id ?? null,
            display_name: displayName(person),
            email: person.email,
            job_title: person.job_title,
          },
        ];
      })
      .sort(
        (left, right) =>
          left.display_name.localeCompare(right.display_name) ||
          left.person_id.localeCompare(right.person_id),
      );

    const resourcesById = new Map(
      resources.map((resource) => [resource.id, resource]),
    );
    const assignments: ScheduleTaskAssignment[] = assignmentRows
      .filter((assignment) => resourcesById.has(assignment.resource_id))
      .map((assignment) => {
        const resource = resourcesById.get(assignment.resource_id);
        if (!resource) {
          throw new ScheduleResourceServiceError(
            `Schedule assignment ${assignment.id} has no resource in project ${projectId}.`,
            "integrity",
          );
        }
        return {
          id: assignment.id,
          project_id: assignment.project_id,
          task_id: assignment.task_id,
          resource_id: assignment.resource_id,
          person_id: resource.person_id,
          allocation_percent: assignment.allocation_percent,
          cost_version: assignment.cost_version,
        };
      })
      .sort(
        (left, right) =>
          left.task_id.localeCompare(right.task_id) ||
          left.resource_id.localeCompare(right.resource_id),
      );

    return {
      resources,
      candidates,
      assignments,
      can_manage: capabilityResult.data === true,
      can_manage_enterprise_calendars: enterpriseAdminResult.data === true,
      legacy_assignment_count: legacyResult.count ?? 0,
    };
  }

  private async loadReadModel(
    projectId: number,
    options: {
      start: string | null;
      finish: string | null;
      resourceId: string | null;
      horizonDays: number | null;
      includeLeveling: boolean;
    },
  ): Promise<ScheduleResourceReadModel> {
    const rpc = untypedRpc(this.client);
    const result = await rpc("get_schedule_resource_read_model", {
      p_project_id: projectId,
      p_start: options.start,
      p_finish: options.finish,
      p_resource_id: options.resourceId,
      p_horizon_days: options.horizonDays,
      p_include_leveling: options.includeLeveling,
    });
    if (result.error) {
      throw new ScheduleResourceServiceError(
        `Unable to load the coherent schedule resource read model: ${result.error.message}`,
        "rpc",
        result.error,
      );
    }
    return parseReadModel(result.data, projectId);
  }

  async getCapacityRange(
    projectId: number,
    start: string,
    finish: string,
  ): Promise<ScheduleResourceCapacityRangeResponse> {
    assertProjectId(projectId);
    const startTime = parseIsoDate(start, "Project-capacity start");
    const finishTime = parseIsoDate(finish, "Project-capacity finish");
    if (finishTime < startTime) {
      throw new ScheduleResourceServiceError(
        "Project-capacity finish must not be before its start.",
        "integrity",
      );
    }
    if ((finishTime - startTime) / DAY_MS > 91) {
      throw new ScheduleResourceServiceError(
        "Project-capacity ranges are limited to 92 calendar days.",
        "integrity",
      );
    }
    const model = await this.loadReadModel(projectId, {
      start,
      finish,
      resourceId: null,
      horizonDays: null,
      includeLeveling: false,
    });
    if (model.range.start !== start || model.range.finish !== finish) {
      throw new ScheduleResourceServiceError(
        `Schedule read-model range does not match ${start} through ${finish}.`,
        "integrity",
      );
    }
    return {
      project_id: projectId,
      range: { start, finish },
      profiles: model.capacity_profiles,
    };
  }

  async getEnterpriseCapacity(
    projectId: number,
    personIds: string[],
    rangeStart: string,
    rangeFinish: string,
  ): Promise<ScheduleEnterpriseCapacityResponse> {
    assertProjectId(projectId);
    if (
      personIds.length > 100 ||
      new Set(personIds).size !== personIds.length
    ) {
      throw new ScheduleResourceServiceError(
        "Enterprise capacity accepts at most 100 unique people.",
        "integrity",
      );
    }
    const startsAt = Date.parse(rangeStart);
    const endsAt = Date.parse(rangeFinish);
    if (
      !Number.isFinite(startsAt) ||
      !Number.isFinite(endsAt) ||
      endsAt <= startsAt
    ) {
      throw new ScheduleResourceServiceError(
        "Enterprise capacity requires an ascending timestamp range.",
        "integrity",
      );
    }
    if ((endsAt - startsAt) / DAY_MS > 92) {
      throw new ScheduleResourceServiceError(
        "Enterprise capacity ranges are limited to 92 calendar days.",
        "integrity",
      );
    }
    const rpc = untypedRpc(this.client);
    const result = await rpc("get_schedule_enterprise_capacity", {
      p_project_id: projectId,
      p_person_ids: personIds,
      p_range_start: rangeStart,
      p_range_finish: rangeFinish,
    });
    if (result.error) {
      throw new ScheduleResourceServiceError(
        `Unable to load enterprise capacity: ${result.error.message}`,
        "rpc",
        result.error,
      );
    }
    return parseEnterpriseCapacity(result.data, projectId);
  }

  async replacePersonWorkCalendar(
    projectId: number,
    personId: string,
    input: SchedulePersonWorkCalendarInput,
  ): Promise<Record<string, unknown>> {
    assertProjectId(projectId);
    const rpc = untypedRpc(this.client);
    const result = await rpc("replace_schedule_person_work_calendar", {
      p_project_id: projectId,
      p_person_id: personId,
      p_timezone_name: input.timezone_name,
      p_weekly_intervals: input.weekly_intervals,
      p_date_intervals: input.date_intervals,
      p_expected_version: input.expected_version,
    });
    if (result.error) {
      throw new ScheduleResourceServiceError(
        `Unable to replace the person work calendar: ${result.error.message}`,
        "rpc",
        result.error,
      );
    }
    return parseObjectResult<Record<string, unknown>>(
      result.data,
      "Person work calendar RPC",
    );
  }

  async replaceTaskSegments(
    projectId: number,
    taskId: string,
    input: {
      expected_task_version: number;
      segments: ScheduleTaskSegmentInput[];
    },
  ): Promise<ScheduleTaskSegmentsResponse> {
    assertProjectId(projectId);
    const rpc = untypedRpc(this.client);
    const result = await rpc("replace_schedule_task_segments", {
      p_project_id: projectId,
      p_task_id: taskId,
      p_segments: input.segments,
      p_expected_task_version: input.expected_task_version,
    });
    if (result.error) {
      throw new ScheduleResourceServiceError(
        `Unable to replace task segments: ${result.error.message}`,
        "rpc",
        result.error,
      );
    }
    return parseObjectResult<ScheduleTaskSegmentsResponse>(
      result.data,
      "Task segment RPC",
    );
  }

  async getTaskSegments(
    projectId: number,
    taskId: string,
  ): Promise<ScheduleTaskSegmentsResponse> {
    assertProjectId(projectId);
    const [taskResult, segmentResult] = await Promise.all([
      this.client
        .from("schedule_tasks")
        .select(
          "id,project_id,start_date,finish_date,forecast_start_date,forecast_finish_date,work_minutes,allow_leveling_split,leveling_priority,schedule_version",
        )
        .eq("project_id", projectId)
        .eq("id", taskId)
        .maybeSingle(),
      this.client
        .from("schedule_task_segments")
        .select(
          "id,project_id,task_id,segment_index,starts_at,ends_at,planned_minutes,lock_reason",
        )
        .eq("project_id", projectId)
        .eq("task_id", taskId)
        .order("segment_index"),
    ]);
    if (taskResult.error)
      throwDatabaseFailure(
        "Unable to load the task segment version",
        taskResult.error,
      );
    if (segmentResult.error)
      throwDatabaseFailure("Unable to load task segments", segmentResult.error);
    if (!taskResult.data) {
      throw new ScheduleResourceServiceError(
        "Schedule task was not found in this project.",
        "integrity",
      );
    }
    if (
      taskResult.data.project_id !== projectId ||
      (segmentResult.data ?? []).some(
        (segment) =>
          segment.project_id !== projectId || segment.task_id !== taskId,
      )
    ) {
      throw new ScheduleResourceServiceError(
        "Task segment data escaped the selected project.",
        "integrity",
      );
    }
    return {
      task_id: taskId,
      task_version: taskResult.data.schedule_version,
      state: {
        task: {
          start_date: taskResult.data.start_date,
          finish_date: taskResult.data.finish_date,
          forecast_start_date: taskResult.data.forecast_start_date,
          forecast_finish_date: taskResult.data.forecast_finish_date,
          work_minutes: taskResult.data.work_minutes,
          allow_leveling_split: taskResult.data.allow_leveling_split,
          leveling_priority: taskResult.data.leveling_priority,
        },
        segments: (segmentResult.data ?? []).map((segment) => ({
          id: segment.id,
          task_id: segment.task_id,
          segment_index: segment.segment_index,
          starts_at: segment.starts_at,
          ends_at: segment.ends_at,
          planned_minutes: segment.planned_minutes,
          lock_reason: segment.lock_reason as "fixed" | "progressed" | null,
        })),
      },
    };
  }

  async createLevelingRun(
    projectId: number,
    input: ScheduleLevelingRunInput,
    authority?: LevelingRunAuthority,
  ): Promise<AuthoritativeHourlyLevelingResponse> {
    assertProjectId(projectId);
    const rangeStart = Date.parse(input.range_start);
    const rangeFinish = Date.parse(input.range_finish);
    if (
      !Number.isFinite(rangeStart) ||
      !Number.isFinite(rangeFinish) ||
      rangeFinish <= rangeStart
    ) {
      throw new ScheduleResourceServiceError(
        "Hourly leveling requires an ascending timestamp range.",
        "integrity",
      );
    }
    if ((rangeFinish - rangeStart) / DAY_MS > 92) {
      throw new ScheduleResourceServiceError(
        "Hourly leveling ranges are limited to 92 calendar days.",
        "integrity",
      );
    }

    const rpc = untypedRpc(this.client);
    const contextResult = await rpc("get_schedule_hourly_leveling_context", {
      p_project_id: projectId,
      p_range_start: input.range_start,
      p_range_finish: input.range_finish,
    });
    if (contextResult.error) {
      throw new ScheduleResourceServiceError(
        `Unable to load the authoritative leveling context: ${contextResult.error.message}`,
        "rpc",
        contextResult.error,
      );
    }
    const context = parseHourlyLevelingContext(contextResult.data, projectId);
    const [calendarResult, calendarExceptionsResult] = await Promise.all([
      this.client
        .from("project_schedule_calendars")
        .select("working_weekdays,timezone_name")
        .eq("project_id", projectId)
        .maybeSingle(),
      this.client
        .from("project_schedule_calendar_exceptions")
        .select("exception_date,is_working")
        .eq("project_id", projectId),
    ]);
    if (calendarResult.error || calendarExceptionsResult.error) {
      const databaseError = calendarResult.error ?? calendarExceptionsResult.error!;
      throw new ScheduleResourceServiceError(
        `Unable to load the project working calendar: ${databaseError.message}`,
        "database",
        databaseError,
      );
    }
    const projectCalendar: ScheduleCalendar = {
      working_weekdays: calendarResult.data?.working_weekdays ?? [1, 2, 3, 4, 5],
      non_working_dates: (calendarExceptionsResult.data ?? [])
        .filter((item) => !item.is_working)
        .map((item) => item.exception_date),
      working_date_overrides: (calendarExceptionsResult.data ?? [])
        .filter((item) => item.is_working)
        .map((item) => item.exception_date),
      timezone_name: calendarResult.data?.timezone_name ?? context.project_timezone,
    };
    const assignmentsByTask = new Map<
      string,
      HourlyLevelingContext["assignments"]
    >();
    for (const assignment of context.assignments) {
      assignmentsByTask.set(assignment.task_id, [
        ...(assignmentsByTask.get(assignment.task_id) ?? []),
        assignment,
      ]);
    }
    const taskById = new Map(context.tasks.map((task) => [task.id, task]));
    const boundsByTask = new Map(
      context.tasks.flatMap((task) => {
        const bounds = taskBounds(task, context.project_timezone);
        return bounds ? [[task.id, bounds] as const] : [];
      }),
    );
    const fixedTaskIds = new Set(
      context.tasks
        .filter(
          (task) =>
            task.percent_complete > 0 ||
            task.status !== "not_started" ||
            task.actual_start_date !== null ||
            task.actual_finish_date !== null ||
            task.leveling_priority === 1000 ||
            task.constraint_type === "must_start_on" ||
            task.constraint_type === "must_finish_on" ||
            task.constraint_type === "finish_no_later_than",
        )
        .map((task) => task.id),
    );
    const eligibleTasks = context.tasks.filter(
      (task) =>
        !task.is_milestone &&
        boundsByTask.has(task.id) &&
        (assignmentsByTask.get(task.id)?.length ?? 0) > 0,
    );
    const movableTaskIds = new Set(
      eligibleTasks
        .filter((task) => !fixedTaskIds.has(task.id))
        .map((task) => task.id),
    );

    const baseSlots = context.calendars.flatMap((calendar) =>
      expandPersonWorkCalendarSlots({
        calendar,
        range_start: context.range.start,
        range_finish: context.range.finish,
      }),
    );
    const reservations = context.reservations.filter(
      (reservation) =>
        reservation.project_id !== projectId ||
        reservation.task_id === null ||
        !movableTaskIds.has(reservation.task_id),
    );
    const capacitySlots = buildEnterpriseCapacitySlots({
      base_slots: baseSlots,
      reservations,
      authorized_project_ids: context.reservations.flatMap((reservation) =>
        reservation.project_id === null ? [] : [reservation.project_id],
      ),
    });
    const dependenciesByTask = new Map<
      string,
      HourlyLevelingContext["dependencies"]
    >();
    for (const dependency of context.dependencies) {
      dependenciesByTask.set(dependency.task_id, [
        ...(dependenciesByTask.get(dependency.task_id) ?? []),
        dependency,
      ]);
    }

    const unresolvedDependencies = new Map<string, string[]>();
    for (const task of eligibleTasks) {
      const missing = (dependenciesByTask.get(task.id) ?? [])
        .filter((dependency) => !boundsByTask.has(dependency.predecessor_task_id))
        .map((dependency) => dependency.predecessor_task_id);
      if (missing.length > 0) unresolvedDependencies.set(task.id, missing);
    }

    const maximumLagMinutes = context.dependencies.reduce(
      (maximum, dependency) => Math.max(maximum, Math.abs(dependency.lag_minutes)),
      0,
    );
    const lagBufferDays = Math.ceil(maximumLagMinutes / 480) * 3 + 14;
    const boundTimestamps = [...boundsByTask.values()].flatMap((bounds) => [
      Date.parse(bounds.startsAt),
      Date.parse(bounds.endsAt),
    ]);
    const projectWorkingSlots = expandProjectWorkingCalendarSlots({
      calendar: projectCalendar,
      timezone_name: projectCalendar.timezone_name ?? context.project_timezone,
      range_start: new Date(
        Math.min(rangeStart, ...boundTimestamps) - lagBufferDays * DAY_MS,
      ).toISOString(),
      range_finish: new Date(
        Math.max(rangeFinish, ...boundTimestamps) + lagBufferDays * DAY_MS,
      ).toISOString(),
      slot_minutes: 15,
    });

    const calculatedPreview = previewHourlyResourceLeveling({
      tasks: eligibleTasks
        .filter((task) => !unresolvedDependencies.has(task.id))
        .map((task) => {
        const bounds = boundsByTask.get(task.id)!;
        const constraintStart =
          task.constraint_type === "start_no_earlier_than" &&
          task.constraint_date
            ? dateAtLocalMinute(
                task.constraint_date,
                480,
                context.project_timezone,
              )
            : bounds.startsAt;
        return {
          task_id: task.id,
          task_name: task.name,
          earliest_start_at:
            Date.parse(constraintStart) > Date.parse(bounds.startsAt)
              ? constraintStart
              : bounds.startsAt,
          current_start_at: bounds.startsAt,
          current_finish_at: bounds.endsAt,
          work_minutes:
            task.work_minutes ??
            Math.max(
              1,
              task.remaining_duration_days ?? task.duration_days ?? 1,
            ) * 480,
          allow_split: task.allow_leveling_split,
          fixed: fixedTaskIds.has(task.id),
          leveling_priority: task.leveling_priority,
          assignments: (assignmentsByTask.get(task.id) ?? []).map(
            (assignment) => ({
              person_id: assignment.person_id,
              allocation_percent: assignment.allocation_percent,
            }),
          ),
          predecessors: (dependenciesByTask.get(task.id) ?? []).flatMap(
            (dependency) => {
              const predecessor = taskById.get(dependency.predecessor_task_id);
              const predecessorBounds = boundsByTask.get(
                dependency.predecessor_task_id,
              );
              if (!predecessor || !predecessorBounds) return [];
              return [
                {
                  task_id: dependency.predecessor_task_id,
                  dependency_type: dependency.dependency_type,
                  lag_minutes: dependency.lag_minutes,
                  current_start_at: predecessorBounds.startsAt,
                  current_finish_at: predecessorBounds.endsAt,
                },
              ];
            },
          ),
        };
      }),
      capacity_slots: capacitySlots,
      project_working_slots: projectWorkingSlots,
      slot_minutes: 15,
    });
    const preview: HourlyLevelingResult = {
      proposals: calculatedPreview.proposals,
      diagnostics: [
        ...[...unresolvedDependencies].map(([taskId, predecessorIds]) => ({
          code: "constraint_blocked" as const,
          task_id: taskId,
          message: `Task could not be leveled because predecessor ${predecessorIds.join(", ")} has no scheduled dates or hourly segments.`,
        })),
        ...calculatedPreview.diagnostics,
      ],
    };

    if (preview.proposals.length === 0) {
      return { preview, run: null, timezone_name: context.project_timezone };
    }
    if (!authority?.actorUserId) {
      throw new ScheduleResourceServiceError(
        "A trusted server authority is required to persist a leveling preview.",
        "integrity",
      );
    }

    const changedPersonIds = new Set<string>();
    const changes = preview.proposals.map((proposal) => {
      const task = taskById.get(proposal.task_id)!;
      for (const assignment of assignmentsByTask.get(task.id) ?? [])
        changedPersonIds.add(assignment.person_id);
      return {
        task_id: task.id,
        expected_task_version: task.schedule_version,
        after_state: stateFromProposal(
          task,
          proposal.segments,
          context.project_timezone,
        ),
        reasons: [
          "enterprise_capacity",
          "person_work_calendar",
          "dependency_and_constraint_rules",
        ],
      };
    });
    const personRevisionVector = Object.fromEntries(
      [...changedPersonIds]
        .sort()
        .map((personId) => [personId, context.person_revisions[personId]]),
    );

    const authoritativeRpc = untypedRpc(authority.client);
    const runResult = await authoritativeRpc("create_authoritative_schedule_leveling_run", {
      p_actor_user_id: authority.actorUserId,
      p_project_id: projectId,
      p_algorithm_version: "hourly-15m-v2",
      p_source_token: context.source_token,
      p_person_revision_vector: personRevisionVector,
      p_configuration: {
        slot_minutes: 15,
        range: context.range,
        project_timezone: context.project_timezone,
        split_tasks: true,
        enterprise_capacity: true,
        dependencies_and_constraints: true,
      },
      p_diagnostics: preview.diagnostics,
      p_changes: changes,
    });
    if (runResult.error) {
      throw new ScheduleResourceServiceError(
        `Unable to create a leveling run: ${runResult.error.message}`,
        "rpc",
        runResult.error,
      );
    }
    return {
      preview,
      run: parseObjectResult<ScheduleLevelingRunResponse>(
        runResult.data,
        "Leveling run RPC",
      ),
      timezone_name: context.project_timezone,
    };
  }

  async applyLevelingRun(
    projectId: number,
    runId: string,
    reason: string | null,
  ): Promise<ScheduleLevelingEventResponse> {
    assertProjectId(projectId);
    const rpc = untypedRpc(this.client);
    const result = await rpc("apply_schedule_leveling_run", {
      p_project_id: projectId,
      p_run_id: runId,
      p_reason: reason,
    });
    if (result.error) {
      throw new ScheduleResourceServiceError(
        `Unable to apply leveling: ${result.error.message}`,
        "rpc",
        result.error,
      );
    }
    return parseObjectResult<ScheduleLevelingEventResponse>(
      result.data,
      "Leveling apply RPC",
    );
  }

  async getLevelingHistory(
    projectId: number,
    limit = 25,
  ): Promise<ScheduleLevelingHistoryItem[]> {
    assertProjectId(projectId);
    const rpc = untypedRpc(this.client);
    const result = await rpc("get_schedule_leveling_history", {
      p_project_id: projectId,
      p_limit: limit,
    });
    if (result.error) {
      throw new ScheduleResourceServiceError(
        `Unable to load leveling history: ${result.error.message}`,
        "rpc",
        result.error,
      );
    }
    return parseArrayResult<ScheduleLevelingHistoryItem>(
      result.data,
      "Leveling history RPC",
    );
  }

  async undoLevelingEvent(
    projectId: number,
    applyEventId: string,
    reason: string | null,
  ): Promise<ScheduleLevelingEventResponse> {
    assertProjectId(projectId);
    const rpc = untypedRpc(this.client);
    const result = await rpc("undo_schedule_leveling_event", {
      p_project_id: projectId,
      p_apply_event_id: applyEventId,
      p_reason: reason,
    });
    if (result.error) {
      throw new ScheduleResourceServiceError(
        `Unable to undo leveling: ${result.error.message}`,
        "rpc",
        result.error,
      );
    }
    return parseObjectResult<ScheduleLevelingEventResponse>(
      result.data,
      "Leveling undo RPC",
    );
  }

  async getCapacityProfile(
    projectId: number,
    resourceId: string,
  ): Promise<ScheduleResourceCapacityProfile> {
    assertProjectId(projectId);
    const model = await this.loadReadModel(projectId, {
      start: null,
      finish: null,
      resourceId,
      horizonDays: null,
      includeLeveling: false,
    });
    if (model.resources.length !== 1 || model.resources[0].id !== resourceId) {
      throw new ScheduleResourceServiceError(
        `Schedule read model did not return exactly resource ${resourceId} in project ${projectId}.`,
        "integrity",
      );
    }
    const profile = model.capacity_profiles.find(
      (item) => item.resource_id === resourceId,
    );
    if (!profile) {
      return {
        profile_id: null,
        project_id: projectId,
        resource_id: resourceId,
        configured: false,
        version: null,
        coverage_start_date: null,
        coverage_finish_date: null,
        weekday_overrides: [],
        exceptions: [],
      };
    }
    return profile;
  }

  async replaceCapacityProfile(
    projectId: number,
    resourceId: string,
    input: ScheduleResourceCapacityProfileInput,
  ): Promise<ScheduleResourceCapacityProfile> {
    assertProjectId(projectId);
    const rpc = untypedRpc(this.client);
    const result = await rpc("replace_schedule_resource_capacity_profile", {
      p_project_id: projectId,
      p_resource_id: resourceId,
      p_weekday_overrides: input.weekday_overrides.map(
        ({ weekday, capacity_percent }) => ({
          weekday,
          capacity_percent,
        }),
      ),
      p_exceptions: input.exceptions.map(
        ({ date, capacity_percent, reason }) => ({
          date,
          capacity_percent,
          ...(reason ? { reason } : {}),
        }),
      ),
      p_expected_version: input.expected_version,
    });
    if (result.error) {
      throw new ScheduleResourceServiceError(
        `Unable to replace resource capacity profile: ${result.error.message}`,
        "rpc",
        result.error,
      );
    }
    return parseCapacityProfile(result.data, projectId, resourceId);
  }

  async loadLevelingContext(
    projectId: number,
    horizonDays: number,
  ): Promise<ScheduleResourceLevelingInput> {
    assertProjectId(projectId);
    if (
      !Number.isSafeInteger(horizonDays) ||
      horizonDays < 1 ||
      horizonDays > 730
    ) {
      throw new ScheduleResourceServiceError(
        "Resource-leveling horizon must be a whole number from 1 through 730 calendar days.",
        "integrity",
      );
    }

    const model = await this.loadReadModel(projectId, {
      start: null,
      finish: null,
      resourceId: null,
      horizonDays,
      includeLeveling: true,
    });
    const taskIds = new Set(model.tasks.map((task) => task.id));
    const resourceIds = new Set(model.resources.map((resource) => resource.id));
    if (
      model.dependencies.some(
        (dependency) =>
          !taskIds.has(dependency.task_id) ||
          !taskIds.has(dependency.predecessor_task_id),
      )
    ) {
      throw new ScheduleResourceServiceError(
        `Schedule read-model dependencies escaped project ${projectId}.`,
        "integrity",
      );
    }
    if (
      model.assignments.some(
        (assignment) =>
          !taskIds.has(assignment.task_id) ||
          !resourceIds.has(assignment.resource_id),
      )
    ) {
      throw new ScheduleResourceServiceError(
        `Schedule read-model assignments escaped project ${projectId}.`,
        "integrity",
      );
    }

    return {
      tasks: model.tasks,
      dependencies: model.dependencies,
      resources: model.resources,
      assignments: model.assignments,
      capacity_profiles: model.capacity_profiles,
      calendar: model.calendar,
      horizon_days: horizonDays,
    };
  }

  async getTaskAssignments(
    projectId: number,
    taskId: string,
  ): Promise<ScheduleTaskAssignment[]> {
    const assignmentRows = await loadAllRows<AssignmentRow>(
      "Unable to load task schedule assignments",
      (from, to) =>
        this.client
          .from("schedule_task_assignments")
          .select("id,project_id,task_id,resource_id,allocation_percent,cost_version")
          .eq("project_id", projectId)
          .eq("task_id", taskId)
          .order("id")
          .range(from, to),
    );
    requireProjectScope(assignmentRows, projectId, "Task schedule assignments");
    if (assignmentRows.length === 0) return [];

    const resourceIds = [
      ...new Set(assignmentRows.map((assignment) => assignment.resource_id)),
    ];
    const resourceResult = await this.client
      .from("schedule_resources")
      .select("id,project_id,person_id")
      .eq("project_id", projectId)
      .eq("resource_kind", "person")
      .in("id", resourceIds)
      .order("id");
    if (resourceResult.error)
      throwDatabaseFailure(
        "Unable to load task schedule resources",
        resourceResult.error,
      );
    const resourceRows = (resourceResult.data ?? []) as ResourceRow[];
    requireProjectScope(resourceRows, projectId, "Task schedule resources");
    const resourcesById = new Map(
      resourceRows.map((resource) => [resource.id, resource]),
    );

    return assignmentRows
      .map((assignment) => {
        const resource = resourcesById.get(assignment.resource_id);
        if (!resource) {
          return null;
        }
        if (!resource.person_id) {
          throw new ScheduleResourceServiceError(
            `Person schedule resource ${resource.id} has no person identifier.`,
            "integrity",
          );
        }
        return {
          id: assignment.id,
          project_id: assignment.project_id,
          task_id: assignment.task_id,
          resource_id: assignment.resource_id,
          person_id: resource.person_id,
          allocation_percent: assignment.allocation_percent,
          cost_version: assignment.cost_version,
        };
      })
      .filter((assignment): assignment is ScheduleTaskAssignment =>
        assignment !== null,
      )
      .sort((left, right) => left.resource_id.localeCompare(right.resource_id));
  }

  async getCostModel(projectId: number): Promise<ScheduleCostModel> {
    assertProjectId(projectId);
    const [resources, assignments, capabilityResult] = await Promise.all([
      loadAllRows<ScheduleCostResourceRecord>(
        "Unable to load schedule cost resources",
        (from, to) =>
          this.client
            .from("schedule_resources")
            .select(
              "id,project_id,person_id,resource_kind,display_name,standard_rate,cost_per_use,rate_unit,cost_version",
            )
            .eq("project_id", projectId)
            .order("display_name")
            .order("id")
            .range(from, to),
      ),
      loadAllRows<ScheduleCostAssignmentRecord>(
        "Unable to load schedule cost assignments",
        (from, to) =>
          this.client
            .from("schedule_task_assignments")
            .select(
              "id,project_id,task_id,resource_id,allocation_percent,planned_units,actual_units,actual_rate,actual_cost,cost_version",
            )
            .eq("project_id", projectId)
            .order("task_id")
            .order("resource_id")
            .range(from, to),
      ),
      this.client.rpc("current_can_manage_schedule", {
        p_project_id: projectId,
      }),
    ]);
    if (capabilityResult.error) {
      throwDatabaseFailure(
        "Unable to resolve schedule cost capability",
        capabilityResult.error,
      );
    }
    requireProjectScope(resources, projectId, "Schedule cost resources");
    requireProjectScope(assignments, projectId, "Schedule cost assignments");
    const resourceIds = new Set(resources.map((resource) => resource.id));
    const orphan = assignments.find(
      (assignment) => !resourceIds.has(assignment.resource_id),
    );
    if (orphan) {
      throw new ScheduleResourceServiceError(
        `Schedule cost assignment ${orphan.id} has no project resource.`,
        "integrity",
      );
    }
    return {
      project_id: projectId,
      can_manage: capabilityResult.data === true,
      resources,
      assignments,
    };
  }

  async upsertCostResource(
    projectId: number,
    input: ScheduleCostResourceInput,
  ): Promise<ScheduleCostResourceRecord> {
    // Supabase's generated function Args currently omit SQL nullability for
    // required PostgreSQL parameters. The RPC deliberately accepts null for a
    // new resource id and optional rate facts, as enforced by its migration.
    const args = {
      p_project_id: projectId,
      p_resource_id: sqlNullableArgument(input.id ?? null),
      p_resource_kind: input.resource_kind,
      p_display_name: input.display_name,
      p_standard_rate: sqlNullableArgument(input.standard_rate),
      p_cost_per_use: sqlNullableArgument(input.cost_per_use),
      p_rate_unit: sqlNullableArgument(input.rate_unit),
      p_expected_cost_version: sqlNullableArgument(
        input.expected_cost_version ?? null,
      ),
    };
    const result = await this.client.rpc("upsert_schedule_cost_resource", args);
    if (result.error) {
      throw new ScheduleResourceServiceError(
        `Unable to save schedule cost resource: ${result.error.message}`,
        "rpc",
        result.error,
      );
    }
    return result.data as ScheduleCostResourceRecord;
  }

  async deleteCostResource(
    projectId: number,
    resourceId: string,
    expectedCostVersion: number,
  ): Promise<void> {
    const result = await this.client.rpc("delete_schedule_cost_resource", {
      p_project_id: projectId,
      p_resource_id: resourceId,
      p_expected_cost_version: expectedCostVersion,
    });
    if (result.error) {
      throw new ScheduleResourceServiceError(
        `Unable to delete schedule cost resource: ${result.error.message}`,
        "rpc",
        result.error,
      );
    }
  }

  async upsertCostAssignment(
    projectId: number,
    input: ScheduleCostAssignmentInput,
  ): Promise<ScheduleCostAssignmentRecord> {
    // These nullable cost facts are valid SQL inputs even though the generated
    // function Args mark the parameters as non-nullable.
    const args = {
      p_project_id: projectId,
      p_task_id: input.task_id,
      p_resource_id: input.resource_id,
      p_allocation_percent: input.allocation_percent,
      p_planned_units: sqlNullableArgument(input.planned_units),
      p_actual_units: sqlNullableArgument(input.actual_units),
      p_actual_rate: sqlNullableArgument(input.actual_rate),
      p_actual_cost: sqlNullableArgument(input.actual_cost),
      p_expected_cost_version: sqlNullableArgument(
        input.expected_cost_version ?? null,
      ),
    };
    const result = await this.client.rpc("upsert_schedule_cost_assignment", args);
    if (result.error) {
      throw new ScheduleResourceServiceError(
        `Unable to save schedule cost assignment: ${result.error.message}`,
        "rpc",
        result.error,
      );
    }
    return result.data as ScheduleCostAssignmentRecord;
  }

  async deleteCostAssignment(
    projectId: number,
    assignmentId: string,
    expectedCostVersion: number,
  ): Promise<void> {
    const result = await this.client.rpc("delete_schedule_cost_assignment", {
      p_project_id: projectId,
      p_assignment_id: assignmentId,
      p_expected_cost_version: expectedCostVersion,
    });
    if (result.error) {
      throw new ScheduleResourceServiceError(
        `Unable to delete schedule cost assignment: ${result.error.message}`,
        "rpc",
        result.error,
      );
    }
  }

  async replaceTaskAssignments(
    projectId: number,
    taskId: string,
    assignments: ScheduleTaskAssignmentInput[],
    expectedAssignments: ScheduleTaskAssignmentExpectation[],
  ): Promise<ScheduleTaskAssignment[]> {
    const result = await this.client.rpc("replace_schedule_task_assignments", {
      p_project_id: projectId,
      p_task_id: taskId,
      p_assignments: assignments.map(({ person_id, allocation_percent }) => ({
        person_id,
        allocation_percent,
      })),
      p_expected_assignments: expectedAssignments.map(
        ({ id, person_id, cost_version }) => ({
          id,
          person_id,
          cost_version,
        }),
      ),
    });
    if (result.error) {
      throw new ScheduleResourceServiceError(
        `Unable to replace schedule assignments: ${result.error.message}`,
        "rpc",
        result.error,
      );
    }
    return this.getTaskAssignments(projectId, taskId);
  }
}

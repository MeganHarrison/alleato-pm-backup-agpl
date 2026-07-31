import type {
  ConstraintType,
  ScheduleDependency,
  ScheduleResource,
  ScheduleResourceCapacityProfile,
  ScheduleResourceLevelingDiagnostic,
  ScheduleResourceLevelingPreviewResult,
  ScheduleResourceLevelingProposal,
  ScheduleResourceLevelingReason,
  ScheduleTask,
  ScheduleTaskAssignment,
} from "@/types/scheduling";
import { addWorkingDays, isWorkingDay, type ScheduleCalendar } from "./schedule-calendar";
import {
  addScheduleCalendarDays,
  dependencyMinimumStart,
  effectiveTaskDates,
  effectiveTaskDuration,
  parseScheduleDate,
  placementFromFinish,
  placementFromStart,
  placementWorkingDates,
  scheduleWorkingDayDelay,
  workingDateAtOrBefore,
  workingDateAtOrAfter,
  type SchedulePlacementDates,
} from "./schedule-placement-math";
import { buildScheduleResourceCapacityResolver } from "./schedule-resource-capacity";

const DEFAULT_HORIZON_DAYS = 365;
const MAX_HORIZON_DAYS = 730;
const PREVIEW_NOTICE = "Preview only. No schedule dates were changed." as const;

export interface ScheduleResourceLevelingInput {
  tasks: ScheduleTask[];
  dependencies: ScheduleDependency[];
  resources: ScheduleResource[];
  assignments: ScheduleTaskAssignment[];
  capacity_profiles: ScheduleResourceCapacityProfile[];
  calendar: ScheduleCalendar;
  horizon_days?: number;
}

interface IndexedTask {
  task: ScheduleTask;
  effective: SchedulePlacementDates;
  duration: number;
  fixed: boolean;
  hardConstrained: boolean;
}

function isFixedTask(task: ScheduleTask): boolean {
  return task.status === "in_progress"
    || task.status === "complete"
    || task.percent_complete > 0
    || Boolean(task.actual_start_date)
    || Boolean(task.actual_finish_date);
}

function isHardConstraint(constraintType: ConstraintType | null): boolean {
  return constraintType === "must_start_on" || constraintType === "must_finish_on";
}

function isValidAllocation(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 1 && value <= 100;
}

function appendDiagnostic(
  diagnostics: ScheduleResourceLevelingDiagnostic[],
  diagnostic: ScheduleResourceLevelingDiagnostic,
): void {
  diagnostics.push(diagnostic);
}

function diagnosticSort(
  left: ScheduleResourceLevelingDiagnostic,
  right: ScheduleResourceLevelingDiagnostic,
): number {
  return JSON.stringify([
    left.code,
    left.task_id,
    left.resource_id,
    left.dependency_id,
    left.assignment_id,
    left.date,
    left.fact_type,
    left.key,
    left.message,
  ]).localeCompare(JSON.stringify([
    right.code,
    right.task_id,
    right.resource_id,
    right.dependency_id,
    right.assignment_id,
    right.date,
    right.fact_type,
    right.key,
    right.message,
  ]));
}

function taskOrder(left: IndexedTask, right: IndexedTask): number {
  const leftPriority = left.fixed ? 0 : left.hardConstrained ? 1 : 2;
  const rightPriority = right.fixed ? 0 : right.hardConstrained ? 1 : 2;
  return leftPriority - rightPriority
    || left.effective.start.localeCompare(right.effective.start)
    || left.task.sort_order - right.task.sort_order
    || left.task.id.localeCompare(right.task.id);
}

function validConstraintDate(task: ScheduleTask, calendar: ScheduleCalendar): string | null {
  if (!parseScheduleDate(task.constraint_date) || !isWorkingDay(task.constraint_date!, calendar)) return null;
  return task.constraint_date!;
}

function normalizedSoftConstraintDate(
  task: ScheduleTask,
  calendar: ScheduleCalendar,
): string | null {
  if (!parseScheduleDate(task.constraint_date)) return null;
  return task.constraint_type === "finish_no_later_than"
    ? workingDateAtOrBefore(task.constraint_date!, calendar)
    : workingDateAtOrAfter(task.constraint_date!, calendar);
}

function hardConstraintPlacement(
  indexed: IndexedTask,
  calendar: ScheduleCalendar,
): SchedulePlacementDates | null {
  const date = validConstraintDate(indexed.task, calendar);
  if (!date) return null;
  return indexed.task.constraint_type === "must_finish_on"
    ? placementFromFinish(date, indexed.duration, calendar)
    : placementFromStart(date, indexed.duration, calendar);
}

function stronglyConnectedCycleTaskIds(
  taskIds: string[],
  dependencies: ScheduleDependency[],
): Set<string> {
  const taskIdSet = new Set(taskIds);
  const successors = new Map<string, string[]>();
  for (const dependency of dependencies) {
    if (!taskIdSet.has(dependency.predecessor_task_id) || !taskIdSet.has(dependency.task_id)) continue;
    successors.set(dependency.predecessor_task_id, [
      ...(successors.get(dependency.predecessor_task_id) ?? []),
      dependency.task_id,
    ]);
  }
  for (const values of successors.values()) values.sort();

  let nextIndex = 0;
  const indexes = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cycles = new Set<string>();

  function visit(taskId: string): void {
    indexes.set(taskId, nextIndex);
    lowLinks.set(taskId, nextIndex);
    nextIndex += 1;
    stack.push(taskId);
    onStack.add(taskId);

    for (const successor of successors.get(taskId) ?? []) {
      if (!indexes.has(successor)) {
        visit(successor);
        lowLinks.set(taskId, Math.min(lowLinks.get(taskId)!, lowLinks.get(successor)!));
      } else if (onStack.has(successor)) {
        lowLinks.set(taskId, Math.min(lowLinks.get(taskId)!, indexes.get(successor)!));
      }
    }

    if (lowLinks.get(taskId) !== indexes.get(taskId)) return;
    const component: string[] = [];
    let current: string | undefined;
    do {
      current = stack.pop();
      if (!current) break;
      onStack.delete(current);
      component.push(current);
    } while (current !== taskId);
    const selfCycle = component.length === 1
      && (successors.get(component[0]) ?? []).includes(component[0]);
    if (component.length > 1 || selfCycle) {
      for (const id of component) cycles.add(id);
    }
  }

  for (const taskId of [...taskIds].sort()) {
    if (!indexes.has(taskId)) visit(taskId);
  }
  return cycles;
}

function stableTopologicalOrder(
  tasksById: Map<string, IndexedTask>,
  dependencies: ScheduleDependency[],
): { ordered: string[]; remaining: string[] } {
  const indegree = new Map([...tasksById.keys()].map((taskId) => [taskId, 0]));
  const successors = new Map<string, string[]>();
  for (const dependency of dependencies) {
    if (!tasksById.has(dependency.predecessor_task_id) || !tasksById.has(dependency.task_id)) continue;
    indegree.set(dependency.task_id, (indegree.get(dependency.task_id) ?? 0) + 1);
    successors.set(dependency.predecessor_task_id, [
      ...(successors.get(dependency.predecessor_task_id) ?? []),
      dependency.task_id,
    ]);
  }
  for (const values of successors.values()) values.sort();

  const ready = [...tasksById.keys()].filter((taskId) => indegree.get(taskId) === 0);
  const ordered: string[] = [];
  while (ready.length > 0) {
    ready.sort((leftId, rightId) => taskOrder(tasksById.get(leftId)!, tasksById.get(rightId)!));
    const taskId = ready.shift()!;
    ordered.push(taskId);
    for (const successor of successors.get(taskId) ?? []) {
      const next = (indegree.get(successor) ?? 0) - 1;
      indegree.set(successor, next);
      if (next === 0) ready.push(successor);
    }
  }
  const orderedIds = new Set(ordered);
  return {
    ordered,
    remaining: [...tasksById.keys()].filter((taskId) => !orderedIds.has(taskId)).sort(),
  };
}

function proposalFor(
  indexed: IndexedTask,
  placement: SchedulePlacementDates,
  reasons: Set<ScheduleResourceLevelingReason>,
  constrainingResourceIds: Set<string>,
  calendar: ScheduleCalendar,
): ScheduleResourceLevelingProposal | null {
  if (
    indexed.fixed
    || (placement.start === indexed.effective.start && placement.finish === indexed.effective.finish)
  ) {
    return null;
  }
  const reasonOrder: ScheduleResourceLevelingReason[] = [
    "project_calendar",
    "dependency",
    "constraint",
    "resource_capacity",
  ];
  return {
    task_id: indexed.task.id,
    task_name: indexed.task.name,
    previous_start_date: indexed.effective.start,
    previous_finish_date: indexed.effective.finish,
    proposed_start_date: placement.start,
    proposed_finish_date: placement.finish,
    delay_working_days: scheduleWorkingDayDelay(indexed.effective.start, placement.start, calendar),
    reasons: reasonOrder.filter((reason) => reasons.has(reason)),
    constraining_resource_ids: [...constrainingResourceIds].sort(),
  };
}

function previewResult(
  diagnostics: ScheduleResourceLevelingDiagnostic[],
  proposals: ScheduleResourceLevelingProposal[],
  resolvedTaskCount: number,
): ScheduleResourceLevelingPreviewResult {
  diagnostics.sort(diagnosticSort);
  proposals.sort((left, right) => left.task_id.localeCompare(right.task_id));
  return {
    status: diagnostics.length === 0 ? "available" : resolvedTaskCount > 0 ? "partial" : "unavailable",
    proposals,
    diagnostics,
    notice: PREVIEW_NOTICE,
  };
}

export function previewScheduleResourceLeveling({
  tasks,
  dependencies,
  resources,
  assignments,
  capacity_profiles,
  calendar,
  horizon_days = DEFAULT_HORIZON_DAYS,
}: ScheduleResourceLevelingInput): ScheduleResourceLevelingPreviewResult {
  const diagnostics: ScheduleResourceLevelingDiagnostic[] = [];
  const proposals: ScheduleResourceLevelingProposal[] = [];
  if (!Number.isSafeInteger(horizon_days) || horizon_days < 1 || horizon_days > MAX_HORIZON_DAYS) {
    diagnostics.push({
      code: "invalid_horizon",
      message: `Leveling horizon must be a whole number from 1 through ${MAX_HORIZON_DAYS}.`,
    });
    return previewResult(diagnostics, proposals, 0);
  }

  const duplicateTaskIds = new Set<string>();
  const taskGroups = new Map<string, ScheduleTask[]>();
  for (const task of tasks) taskGroups.set(task.id, [...(taskGroups.get(task.id) ?? []), task]);
  const tasksById = new Map<string, IndexedTask>();
  const blockedTaskIds = new Set<string>();
  for (const [taskId, grouped] of [...taskGroups].sort(([left], [right]) => left.localeCompare(right))) {
    if (grouped.length > 1) {
      duplicateTaskIds.add(taskId);
      blockedTaskIds.add(taskId);
      appendDiagnostic(diagnostics, {
        code: "invalid_task_dates",
        task_id: taskId,
        message: `Task ${taskId} appears more than once in the leveling snapshot.`,
      });
      continue;
    }
    const task = grouped[0];
    const effective = effectiveTaskDates(task);
    const duration = effectiveTaskDuration(task, calendar);
    if (!effective || !duration) {
      blockedTaskIds.add(taskId);
      appendDiagnostic(diagnostics, {
        code: "invalid_task_dates",
        task_id: taskId,
        message: `Task ${task.name} is missing valid ascending effective forecast-or-planned dates.`,
      });
      continue;
    }
    tasksById.set(taskId, {
      task,
      effective,
      duration,
      fixed: isFixedTask(task),
      hardConstrained: isHardConstraint(task.constraint_type),
    });
  }

  const resourceGroups = new Map<string, ScheduleResource[]>();
  for (const resource of resources) {
    resourceGroups.set(resource.id, [...(resourceGroups.get(resource.id) ?? []), resource]);
  }
  const resourcesById = new Map<string, ScheduleResource>();
  const inactiveResourceIds = new Set<string>();
  for (const [resourceId, grouped] of [...resourceGroups].sort(([left], [right]) => left.localeCompare(right))) {
    if (grouped.length > 1) {
      appendDiagnostic(diagnostics, {
        code: "missing_resource",
        resource_id: resourceId,
        message: `Resource ${resourceId} appears more than once in the leveling snapshot.`,
      });
      continue;
    }
    const resource = grouped[0];
    resourcesById.set(resourceId, resource);
    if (!resource.eligible || resource.person_status !== "active" || resource.membership_status !== "active") {
      inactiveResourceIds.add(resourceId);
      appendDiagnostic(diagnostics, {
        code: "inactive_resource",
        resource_id: resourceId,
        message: `Resource ${resource.display_name} is inactive or ineligible for project scheduling.`,
      });
    }
  }

  const capacityResolver = buildScheduleResourceCapacityResolver({ calendar, capacity_profiles });
  for (const diagnostic of capacityResolver.diagnostics) appendDiagnostic(diagnostics, diagnostic);

  const validTaskStarts = [...tasksById.values()].map(({ effective }) => [
    effective.start,
    effective.finish,
  ]).flat();
  const coverageStart = validTaskStarts.length > 0 ? [...validTaskStarts].sort()[0] : null;
  const coverageAnchor = validTaskStarts.length > 0 ? [...validTaskStarts].sort().at(-1)! : null;
  const coverageFinish = coverageAnchor ? addScheduleCalendarDays(coverageAnchor, horizon_days) : null;
  const rangeDiagnostics = coverageStart && coverageFinish
    ? capacityResolver.rangeDiagnostics(coverageStart, coverageFinish)
    : [];
  for (const diagnostic of rangeDiagnostics) appendDiagnostic(diagnostics, diagnostic);
  const unavailableCapacityResourceIds = new Set([
    ...capacityResolver.diagnostics
      .filter((diagnostic) => diagnostic.code === "duplicate_capacity_profile" || diagnostic.fact_type === "coverage")
      .map((diagnostic) => diagnostic.resource_id),
    ...rangeDiagnostics.map((diagnostic) => diagnostic.resource_id),
  ]);

  const assignmentGroups = new Map<string, ScheduleTaskAssignment[]>();
  for (const assignment of assignments) {
    const key = `${assignment.task_id}:${assignment.resource_id}`;
    assignmentGroups.set(key, [...(assignmentGroups.get(key) ?? []), assignment]);
  }
  const assignmentsByTaskId = new Map<string, ScheduleTaskAssignment[]>();
  for (const [key, grouped] of [...assignmentGroups].sort(([left], [right]) => left.localeCompare(right))) {
    const assignment = [...grouped].sort((left, right) => left.id.localeCompare(right.id))[0];
    const taskExists = tasksById.has(assignment.task_id) || duplicateTaskIds.has(assignment.task_id);
    if (!taskExists) {
      appendDiagnostic(diagnostics, {
        code: "missing_task",
        task_id: assignment.task_id,
        assignment_id: assignment.id,
        message: `Assignment ${assignment.id} references missing task ${assignment.task_id}.`,
      });
      continue;
    }
    if (grouped.length > 1) {
      blockedTaskIds.add(assignment.task_id);
      appendDiagnostic(diagnostics, {
        code: "invalid_assignment",
        task_id: assignment.task_id,
        resource_id: assignment.resource_id,
        assignment_id: assignment.id,
        message: `Task ${assignment.task_id} has duplicate assignments for resource ${assignment.resource_id}.`,
      });
      continue;
    }
    if (!isValidAllocation(assignment.allocation_percent)) {
      blockedTaskIds.add(assignment.task_id);
      appendDiagnostic(diagnostics, {
        code: "invalid_assignment",
        task_id: assignment.task_id,
        resource_id: assignment.resource_id,
        assignment_id: assignment.id,
        message: `Assignment ${assignment.id} must allocate a whole percent from 1 through 100.`,
      });
      continue;
    }
    if (!resourcesById.has(assignment.resource_id)) {
      blockedTaskIds.add(assignment.task_id);
      appendDiagnostic(diagnostics, {
        code: "missing_resource",
        task_id: assignment.task_id,
        resource_id: assignment.resource_id,
        assignment_id: assignment.id,
        message: `Assignment ${assignment.id} references missing resource ${assignment.resource_id}.`,
      });
      continue;
    }
    if (inactiveResourceIds.has(assignment.resource_id) || unavailableCapacityResourceIds.has(assignment.resource_id)) {
      blockedTaskIds.add(assignment.task_id);
    }
    assignmentsByTaskId.set(assignment.task_id, [
      ...(assignmentsByTaskId.get(assignment.task_id) ?? []),
      assignment,
    ]);
  }
  for (const taskAssignments of assignmentsByTaskId.values()) {
    taskAssignments.sort((left, right) => left.resource_id.localeCompare(right.resource_id) || left.id.localeCompare(right.id));
  }

  const validDependencies: ScheduleDependency[] = [];
  for (const dependency of [...dependencies].sort((left, right) => left.id.localeCompare(right.id))) {
    const predecessor = tasksById.get(dependency.predecessor_task_id);
    const successor = tasksById.get(dependency.task_id);
    if (!predecessor || !successor || !Number.isSafeInteger(dependency.lag_days)) {
      if (successor) blockedTaskIds.add(successor.task.id);
      appendDiagnostic(diagnostics, {
        code: "invalid_dependency",
        task_id: dependency.task_id,
        dependency_id: dependency.id,
        message: `Dependency ${dependency.id} has a missing endpoint or invalid lag.`,
      });
      continue;
    }
    validDependencies.push(dependency);
  }
  const incomingDependencies = new Map<string, ScheduleDependency[]>();
  for (const dependency of validDependencies) {
    incomingDependencies.set(dependency.task_id, [
      ...(incomingDependencies.get(dependency.task_id) ?? []),
      dependency,
    ]);
  }
  for (const incoming of incomingDependencies.values()) incoming.sort((left, right) => left.id.localeCompare(right.id));

  const cycleTaskIds = stronglyConnectedCycleTaskIds([...tasksById.keys()], validDependencies);
  for (const taskId of [...cycleTaskIds].sort()) {
    blockedTaskIds.add(taskId);
    appendDiagnostic(diagnostics, {
      code: "circular_dependency",
      task_id: taskId,
      message: `Task ${taskId} participates in a circular dependency.`,
    });
  }
  const topological = stableTopologicalOrder(tasksById, validDependencies);
  for (const taskId of topological.remaining) {
    if (cycleTaskIds.has(taskId)) continue;
    blockedTaskIds.add(taskId);
    appendDiagnostic(diagnostics, {
      code: "unresolved_predecessor",
      task_id: taskId,
      message: `Task ${taskId} cannot be placed because a predecessor is unresolved.`,
    });
  }

  const placements = new Map<string, SchedulePlacementDates>();
  const usageByResourceDate = new Map<string, number>();

  function reservePlacement(indexed: IndexedTask, placement: SchedulePlacementDates, reportConflict: boolean): boolean {
    if (indexed.task.is_milestone) return false;
    let hasConflict = false;
    for (const assignment of assignmentsByTaskId.get(indexed.task.id) ?? []) {
      for (const date of placementWorkingDates(placement, calendar)) {
        const key = `${assignment.resource_id}:${date}`;
        const previousUsage = usageByResourceDate.get(key) ?? 0;
        const resolution = capacityResolver.resolve(assignment.resource_id, date);
        if (reportConflict && (!resolution.available || previousUsage + assignment.allocation_percent > resolution.capacity_percent)) {
          hasConflict = true;
          appendDiagnostic(diagnostics, {
            code: "fixed_capacity_conflict",
            task_id: indexed.task.id,
            resource_id: assignment.resource_id,
            resource_ids: [assignment.resource_id],
            date,
            message: `Fixed task ${indexed.task.name} exceeds resource ${assignment.resource_id} capacity on ${date}.`,
          });
        }
        usageByResourceDate.set(key, previousUsage + assignment.allocation_percent);
      }
    }
    return hasConflict;
  }

  for (const indexed of [...tasksById.values()].sort(taskOrder)) {
    if (blockedTaskIds.has(indexed.task.id) || (!indexed.fixed && !indexed.hardConstrained)) continue;
    let placement = indexed.effective;
    const reasons = new Set<ScheduleResourceLevelingReason>();
    if (indexed.hardConstrained) {
      const constrained = hardConstraintPlacement(indexed, calendar);
      if (!constrained || constrained.start < indexed.effective.start) {
        blockedTaskIds.add(indexed.task.id);
        appendDiagnostic(diagnostics, {
          code: "hard_constraint_conflict",
          task_id: indexed.task.id,
          message: `Task ${indexed.task.name} cannot satisfy its hard constraint without invalid dates or acceleration.`,
        });
        continue;
      }
      const constrainedStart = parseScheduleDate(constrained.start)!;
      const effectiveStart = parseScheduleDate(indexed.effective.start)!;
      const calendarDelay = Math.round((constrainedStart.getTime() - effectiveStart.getTime()) / 86_400_000);
      if (calendarDelay > horizon_days) {
        blockedTaskIds.add(indexed.task.id);
        appendDiagnostic(diagnostics, {
          code: "horizon_exhausted",
          task_id: indexed.task.id,
          message: `Task ${indexed.task.name} cannot reach its hard constraint inside the ${horizon_days}-calendar-day leveling horizon.`,
        });
        continue;
      }
      if (indexed.fixed && (
        constrained.start !== indexed.effective.start
        || constrained.finish !== indexed.effective.finish
      )) {
        blockedTaskIds.add(indexed.task.id);
        appendDiagnostic(diagnostics, {
          code: "hard_constraint_conflict",
          task_id: indexed.task.id,
          message: `Fixed task ${indexed.task.name} conflicts with its hard constraint.`,
        });
        continue;
      }
      placement = constrained;
      reasons.add("constraint");
    }
    placements.set(indexed.task.id, placement);
    const capacityConflict = reservePlacement(indexed, placement, true);
    if (capacityConflict && indexed.hardConstrained && !indexed.fixed) blockedTaskIds.add(indexed.task.id);
    const proposal = proposalFor(indexed, placement, reasons, new Set(), calendar);
    if (proposal) proposals.push(proposal);
  }

  for (const taskId of topological.ordered) {
    const indexed = tasksById.get(taskId)!;
    if (blockedTaskIds.has(taskId)) continue;
    const incoming = incomingDependencies.get(taskId) ?? [];
    if (indexed.fixed || indexed.hardConstrained) {
      const placement = placements.get(taskId);
      if (!placement) continue;
      for (const dependency of incoming) {
        const predecessor = placements.get(dependency.predecessor_task_id);
        const minimumStart = predecessor
          ? dependencyMinimumStart(dependency, predecessor, indexed.duration, calendar)
          : null;
        if (!minimumStart) {
          blockedTaskIds.add(taskId);
          appendDiagnostic(diagnostics, {
            code: "unresolved_predecessor",
            task_id: taskId,
            dependency_id: dependency.id,
            message: `Fixed task ${indexed.task.name} has an unresolved predecessor.`,
          });
        } else if (placement.start < minimumStart) {
          blockedTaskIds.add(taskId);
          appendDiagnostic(diagnostics, {
            code: "fixed_dependency_conflict",
            task_id: taskId,
            dependency_id: dependency.id,
            message: `Fixed task ${indexed.task.name} violates dependency ${dependency.id}.`,
          });
        }
      }
      if (indexed.fixed && indexed.task.constraint_type === "start_no_earlier_than") {
        const constraintDate = normalizedSoftConstraintDate(indexed.task, calendar);
        if (!constraintDate || placement.start < constraintDate) {
          blockedTaskIds.add(taskId);
          appendDiagnostic(diagnostics, {
            code: "constraint_conflict",
            task_id: taskId,
            message: `Fixed task ${indexed.task.name} violates its start-no-earlier-than constraint.`,
          });
        }
      } else if (indexed.fixed && indexed.task.constraint_type === "finish_no_later_than") {
        const constraintDate = normalizedSoftConstraintDate(indexed.task, calendar);
        if (!constraintDate || placement.finish > constraintDate) {
          blockedTaskIds.add(taskId);
          appendDiagnostic(diagnostics, {
            code: "constraint_conflict",
            task_id: taskId,
            message: `Fixed task ${indexed.task.name} violates its finish-no-later-than constraint.`,
          });
        }
      }
      continue;
    }

    const baselineStart = workingDateAtOrAfter(indexed.effective.start, calendar)!;
    let earliestStart = baselineStart;
    const reasons = new Set<ScheduleResourceLevelingReason>();
    if (baselineStart !== indexed.effective.start) reasons.add("project_calendar");
    let unresolvedPredecessor = false;
    for (const dependency of incoming) {
      const predecessor = placements.get(dependency.predecessor_task_id);
      const minimumStart = predecessor
        ? dependencyMinimumStart(dependency, predecessor, indexed.duration, calendar)
        : null;
      if (!minimumStart) {
        unresolvedPredecessor = true;
        appendDiagnostic(diagnostics, {
          code: "unresolved_predecessor",
          task_id: taskId,
          dependency_id: dependency.id,
          message: `Task ${indexed.task.name} has an unresolved predecessor for dependency ${dependency.id}.`,
        });
        continue;
      }
      if (minimumStart > earliestStart) {
        earliestStart = minimumStart;
        reasons.add("dependency");
      }
    }
    if (unresolvedPredecessor) {
      blockedTaskIds.add(taskId);
      continue;
    }

    let finishNoLaterThan: string | null = null;
    if (indexed.task.constraint_type === "start_no_earlier_than") {
      const constraintStart = normalizedSoftConstraintDate(indexed.task, calendar);
      if (!constraintStart) {
        blockedTaskIds.add(taskId);
        appendDiagnostic(diagnostics, {
          code: "constraint_conflict",
          task_id: taskId,
          message: `Task ${indexed.task.name} has an invalid start-no-earlier-than constraint.`,
        });
        continue;
      }
      if (constraintStart > earliestStart) {
        earliestStart = constraintStart;
        reasons.add("constraint");
      }
    } else if (indexed.task.constraint_type === "finish_no_later_than") {
      finishNoLaterThan = normalizedSoftConstraintDate(indexed.task, calendar);
      if (!finishNoLaterThan) {
        blockedTaskIds.add(taskId);
        appendDiagnostic(diagnostics, {
          code: "constraint_conflict",
          task_id: taskId,
          message: `Task ${indexed.task.name} has an invalid finish-no-later-than constraint.`,
        });
        continue;
      }
    }

    const constrainingResourceIds = new Set<string>();
    let placed: SchedulePlacementDates | null = null;
    let constraintStoppedSearch = false;
    for (let offset = 0; offset <= horizon_days; offset += 1) {
      const candidateStart = addWorkingDays(earliestStart, offset, calendar);
      const candidateDate = parseScheduleDate(candidateStart)!;
      const baselineDate = parseScheduleDate(baselineStart)!;
      if ((candidateDate.getTime() - baselineDate.getTime()) / 86_400_000 > horizon_days) break;
      const candidate = placementFromStart(candidateStart, indexed.duration, calendar)!;
      if (finishNoLaterThan && candidate.finish > finishNoLaterThan) {
        constraintStoppedSearch = true;
        break;
      }
      let hasCapacity = true;
      if (!indexed.task.is_milestone) {
        for (const assignment of assignmentsByTaskId.get(taskId) ?? []) {
          for (const date of placementWorkingDates(candidate, calendar)) {
            const resolution = capacityResolver.resolve(assignment.resource_id, date);
            const currentUsage = usageByResourceDate.get(`${assignment.resource_id}:${date}`) ?? 0;
            if (!resolution.available || currentUsage + assignment.allocation_percent > resolution.capacity_percent) {
              hasCapacity = false;
              constrainingResourceIds.add(assignment.resource_id);
              break;
            }
          }
        }
      }
      if (hasCapacity) {
        placed = candidate;
        break;
      }
    }

    if (!placed) {
      blockedTaskIds.add(taskId);
      const resourceIds = [...constrainingResourceIds].sort();
      appendDiagnostic(diagnostics, constraintStoppedSearch
        ? {
            code: "constraint_conflict",
            task_id: taskId,
            resource_ids: resourceIds,
            message: `Task ${indexed.task.name} has no capacity-feasible placement before its finish-no-later-than constraint.`,
          }
        : {
            code: "horizon_exhausted",
            task_id: taskId,
            resource_ids: resourceIds,
            message: `Task ${indexed.task.name} has no feasible slot within the ${horizon_days}-calendar-day leveling horizon.`,
          });
      continue;
    }

    if (constrainingResourceIds.size > 0) reasons.add("resource_capacity");
    placements.set(taskId, placed);
    reservePlacement(indexed, placed, false);
    const proposal = proposalFor(indexed, placed, reasons, constrainingResourceIds, calendar);
    if (proposal) proposals.push(proposal);
  }

  const resolvedTaskCount = [...placements.keys()].filter((taskId) => !blockedTaskIds.has(taskId)).length;
  return previewResult(
    diagnostics,
    proposals.filter((proposal) => !blockedTaskIds.has(proposal.task_id)),
    resolvedTaskCount,
  );
}

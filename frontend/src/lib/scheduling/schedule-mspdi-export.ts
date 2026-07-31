import type {
  ConstraintType,
  DependencyType,
  ScheduleDependency,
  ScheduleTask,
} from "@/types/scheduling";

const MSPDI_NAMESPACE = "http://schemas.microsoft.com/project";
const MINUTES_PER_WORKING_DAY = 8 * 60;
const TENTHS_PER_MINUTE = 10;
const STANDARD_CALENDAR_WARNING =
  "Alleato project and resource calendars are not embedded; Project will use the exported standard Monday-Friday, 8-hour calendar and may recalculate dates differently.";
const XML_1_0_TEXT =
  /^[\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]*$/u;

const DEPENDENCY_TYPE: Record<DependencyType, number> = {
  finish_to_finish: 0,
  finish_to_start: 1,
  start_to_finish: 2,
  start_to_start: 3,
};

const CONSTRAINT_TYPE: Record<Exclude<ConstraintType, "none">, number> = {
  must_start_on: 2,
  must_finish_on: 3,
  start_no_earlier_than: 4,
  finish_no_later_than: 7,
};

export interface ScheduleMspdiExportOptions {
  projectId: string;
  projectName?: string;
  tasks: ScheduleTask[];
  generatedAt?: Date;
}

export interface ScheduleMspdiExportResult {
  xml: string;
  warnings: string[];
}

interface IndexedTask {
  task: ScheduleTask;
  uid: number;
  outlineLevel: number;
  outlineNumber: string;
  hasChildren: boolean;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function assertXmlText(value: string, label: string): void {
  if (!XML_1_0_TEXT.test(value)) {
    throw new Error(`${label} contains a character that XML 1.0 does not allow.`);
  }
}

function element(name: string, value: string | number | boolean): string {
  const text = typeof value === "boolean" ? (value ? "1" : "0") : String(value);
  assertXmlText(text, `XML element ${name}`);
  return `<${name}>${escapeXml(text)}</${name}>`;
}

function assertMaxLength(value: string, maxLength: number, label: string): void {
  if (value.length > maxLength) {
    throw new Error(`${label} exceeds the Microsoft Project limit of ${maxLength} characters.`);
  }
}

function normalizeDate(value: string | null | undefined, label: string): string | null {
  if (!value) return null;
  const date = value.slice(0, 10);
  const parsed = new Date(`${date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || Number.isNaN(parsed.getTime())
    || parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new Error(`${label} is not a valid ISO date: ${value}`);
  }
  return date;
}

function projectDateTime(date: string, finish = false): string {
  return `${date}T${finish ? "17:00:00" : "08:00:00"}`;
}

function isoDurationFromMinutes(minutes: number, label: string): string {
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
  const roundedMinutes = Math.round(minutes);
  const hours = Math.floor(roundedMinutes / 60);
  return `PT${hours}H${roundedMinutes % 60}M0S`;
}

function taskDuration(task: ScheduleTask, warnings: string[]): string | null {
  if (!task.is_milestone && task.duration_days === null) {
    warnings.push(
      `Task "${task.name}" has no duration; Project will infer it from the exported dates.`,
    );
    return null;
  }
  const days = task.is_milestone ? 0 : task.duration_days;
  if (days === null || days === undefined) {
    warnings.push(
      `Task "${task.name}" has no duration; Project will infer it from the exported dates.`,
    );
    return null;
  }
  return isoDurationFromMinutes(days * MINUTES_PER_WORKING_DAY, `Duration for ${task.name}`);
}

function taskWork(task: ScheduleTask): string | null {
  if (task.work_minutes === null || task.work_minutes === undefined) return null;
  return isoDurationFromMinutes(task.work_minutes, `Work for ${task.name}`);
}

function taskRemainingDuration(task: ScheduleTask): string | null {
  if (
    task.remaining_duration_days === null
    || task.remaining_duration_days === undefined
  ) {
    return null;
  }
  return isoDurationFromMinutes(
    task.remaining_duration_days * MINUTES_PER_WORKING_DAY,
    `Remaining duration for ${task.name}`,
  );
}

function percentComplete(task: ScheduleTask): number {
  if (
    !Number.isFinite(task.percent_complete)
    || task.percent_complete < 0
    || task.percent_complete > 100
  ) {
    throw new Error(`Percent complete for ${task.name} must be between 0 and 100.`);
  }
  return Math.round(task.percent_complete);
}

function priority(task: ScheduleTask): number {
  if (Number.isFinite(task.leveling_priority)) {
    return Math.max(0, Math.min(1000, Math.round(task.leveling_priority ?? 500)));
  }
  const mapped: Record<string, number> = {
    lowest: 100,
    low: 300,
    normal: 500,
    medium: 500,
    high: 700,
    highest: 900,
    urgent: 900,
    critical: 900,
  };
  return mapped[task.priority?.toLowerCase() ?? ""] ?? 500;
}

function compareTasks(a: ScheduleTask, b: ScheduleTask): number {
  return (
    a.sort_order - b.sort_order
    || compareText(a.name, b.name)
    || compareText(a.id, b.id)
  );
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function indexHierarchy(tasks: ScheduleTask[], warnings: string[]): IndexedTask[] {
  const taskById = new Map<string, ScheduleTask>();
  for (const task of tasks) {
    if (taskById.has(task.id)) {
      throw new Error(`Cannot export duplicate schedule task id: ${task.id}`);
    }
    taskById.set(task.id, task);
  }

  const children = new Map<string | null, ScheduleTask[]>();
  for (const task of tasks) {
    let parentId = task.parent_task_id;
    if (parentId && !taskById.has(parentId)) {
      warnings.push(
        `Task "${task.name}" references missing parent ${parentId}; exported at the root level.`,
      );
      parentId = null;
    }
    const siblings = children.get(parentId) ?? [];
    siblings.push(task);
    children.set(parentId, siblings);
  }
  for (const siblings of children.values()) siblings.sort(compareTasks);

  const indexed: IndexedTask[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (task: ScheduleTask, level: number, outlineNumber: string): void => {
    if (visiting.has(task.id)) {
      throw new Error(`Cannot export cyclic task hierarchy involving ${task.id}.`);
    }
    if (visited.has(task.id)) return;
    visiting.add(task.id);
    const taskChildren = children.get(task.id) ?? [];
    indexed.push({
      task,
      uid: indexed.length + 1,
      outlineLevel: level,
      outlineNumber,
      hasChildren: taskChildren.length > 0,
    });
    taskChildren.forEach((child, index) => {
      visit(child, level + 1, `${outlineNumber}.${index + 1}`);
    });
    visiting.delete(task.id);
    visited.add(task.id);
  };

  (children.get(null) ?? []).forEach((task, index) => visit(task, 1, String(index + 1)));

  // A parent cycle has no root, so make sure every input task was traversed.
  for (const task of [...tasks].sort(compareTasks)) {
    if (!visited.has(task.id)) visit(task, 1, String(indexed.length + 1));
  }
  return indexed;
}

function predecessorLink(
  dependency: ScheduleDependency,
  task: ScheduleTask,
  uidByTaskId: Map<string, number>,
  warnings: string[],
): string | null {
  if (dependency.task_id !== task.id) {
    warnings.push(
      `Dependency ${dependency.id} does not belong to task "${task.name}" and was omitted.`,
    );
    return null;
  }
  const predecessorUid = uidByTaskId.get(dependency.predecessor_task_id);
  if (!predecessorUid) {
    warnings.push(
      `Dependency ${dependency.id} on task "${task.name}" references missing predecessor ${dependency.predecessor_task_id} and was omitted.`,
    );
    return null;
  }
  if (!Number.isFinite(dependency.lag_days)) {
    throw new Error(`Dependency ${dependency.id} has an invalid lag.`);
  }
  const dependencyType = DEPENDENCY_TYPE[dependency.dependency_type];
  if (dependencyType === undefined) {
    throw new Error(`Dependency ${dependency.id} has an unsupported type.`);
  }
  const lag = Math.round(
    dependency.lag_days * MINUTES_PER_WORKING_DAY * TENTHS_PER_MINUTE,
  );
  if (!Number.isSafeInteger(lag)) {
    throw new Error(`Dependency ${dependency.id} lag exceeds the supported range.`);
  }
  return [
    "<PredecessorLink>",
    element("PredecessorUID", predecessorUid),
    element("Type", dependencyType),
    element("CrossProject", false),
    element("LinkLag", lag),
    element("LagFormat", 7),
    "</PredecessorLink>",
  ].join("");
}

function taskXml(
  indexed: IndexedTask,
  uidByTaskId: Map<string, number>,
  warnings: string[],
): string {
  const { task } = indexed;
  assertMaxLength(task.name, 512, `Task name for ${task.id}`);
  assertMaxLength(
    indexed.outlineNumber,
    512,
    `Outline number for ${task.name}`,
  );
  assertXmlText(task.name, `Task name for ${task.id}`);
  if (task.wbs_code) assertXmlText(task.wbs_code, `WBS code for ${task.name}`);
  const start = normalizeDate(task.start_date, `Start date for ${task.name}`);
  const finish = normalizeDate(task.finish_date, `Finish date for ${task.name}`);
  const actualStart = normalizeDate(
    task.actual_start_date,
    `Actual start date for ${task.name}`,
  );
  const actualFinish = normalizeDate(
    task.actual_finish_date,
    `Actual finish date for ${task.name}`,
  );
  const deadline = normalizeDate(
    task.deadline?.deadline_date,
    `Deadline for ${task.name}`,
  );
  const work = taskWork(task);
  const remainingDuration = taskRemainingDuration(task);
  const parts = [
    "<Task>",
    element("UID", indexed.uid),
    element("ID", indexed.uid),
    element("Name", task.name),
    element("WBS", task.wbs_code || indexed.outlineNumber),
    element("OutlineNumber", indexed.outlineNumber),
    element("OutlineLevel", indexed.outlineLevel),
    element("Priority", priority(task)),
  ];
  if (start) parts.push(element("Start", projectDateTime(start)));
  if (finish) parts.push(element("Finish", projectDateTime(finish, true)));
  const duration = taskDuration(task, warnings);
  if (duration) {
    parts.push(
      element("Duration", duration),
      element("DurationFormat", 7),
    );
  }
  if (work) parts.push(element("Work", work));
  parts.push(
    element("Milestone", task.is_milestone),
    element("Summary", indexed.hasChildren),
    element("PercentComplete", percentComplete(task)),
  );
  if (actualStart) parts.push(element("ActualStart", projectDateTime(actualStart)));
  if (actualFinish) parts.push(element("ActualFinish", projectDateTime(actualFinish, true)));
  if (remainingDuration) {
    parts.push(element("RemainingDuration", remainingDuration));
  }

  const constraintType = task.constraint_type;
  if (constraintType && constraintType !== "none") {
    const constraintDate = normalizeDate(
      task.constraint_date,
      `Constraint date for ${task.name}`,
    );
    if (constraintDate) {
      parts.push(
        element("ConstraintType", CONSTRAINT_TYPE[constraintType]),
        element(
          "ConstraintDate",
          projectDateTime(constraintDate, constraintType.includes("finish")),
        ),
      );
    } else {
      warnings.push(
        `Task "${task.name}" has ${constraintType} without a constraint date; the constraint was omitted.`,
      );
    }
  } else {
    parts.push(element("ConstraintType", 0));
  }
  if (deadline) parts.push(element("Deadline", projectDateTime(deadline, true)));

  if (task.schedule_mode === "manual") {
    warnings.push(
      `Task "${task.name}" is manually scheduled; Project 2007 XML preserves its dates but not Alleato schedule mode.`,
    );
  }
  if (task.segments?.length) {
    warnings.push(
      `Task "${task.name}" has ${task.segments.length} leveling segment(s); the XML exports its task dates, not split history.`,
    );
  }

  const links = [...(task.dependencies ?? [])]
    .sort((a, b) => compareText(a.id, b.id))
    .map((dependency) => predecessorLink(dependency, task, uidByTaskId, warnings))
    .filter((link): link is string => link !== null);
  parts.push(...links, "</Task>");
  return parts.join("");
}

export function exportScheduleToMspdiXml(
  options: ScheduleMspdiExportOptions,
): ScheduleMspdiExportResult {
  if (options.tasks.length === 0) {
    throw new Error("Cannot export a Microsoft Project schedule without tasks.");
  }
  const warnings: string[] = [STANDARD_CALENDAR_WARNING];
  const indexedTasks = indexHierarchy(options.tasks, warnings);
  const uidByTaskId = new Map(indexedTasks.map(({ task, uid }) => [task.id, uid]));
  const generatedAt = options.generatedAt ?? new Date();
  if (Number.isNaN(generatedAt.getTime())) {
    throw new Error("Export generation time is invalid.");
  }
  const starts = indexedTasks
    .map(({ task }) => normalizeDate(task.start_date, `Start date for ${task.name}`))
    .filter((date): date is string => date !== null)
    .sort();
  const projectStart = starts[0] ?? generatedAt.toISOString().slice(0, 10);
  const projectName = options.projectName?.trim() || `Alleato schedule ${options.projectId}`;
  assertMaxLength(projectName, 255, "Project name");
  assertXmlText(projectName, "Project name");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<Project xmlns="${MSPDI_NAMESPACE}">`,
    element("SaveVersion", 12),
    element("Name", projectName),
    element("Title", projectName),
    element("CreationDate", generatedAt.toISOString().replace(/\.\d{3}Z$/, "")),
    element("LastSaved", generatedAt.toISOString().replace(/\.\d{3}Z$/, "")),
    element("ScheduleFromStart", true),
    element("StartDate", projectDateTime(projectStart)),
    element("CurrencyCode", "USD"),
    element("MinutesPerDay", MINUTES_PER_WORKING_DAY),
    element("MinutesPerWeek", MINUTES_PER_WORKING_DAY * 5),
    element("DaysPerMonth", 20),
    element("DurationFormat", 7),
    "<Tasks>",
    ...indexedTasks.map((task) => taskXml(task, uidByTaskId, warnings)),
    "</Tasks>",
    "</Project>",
  ].join("");

  return { xml, warnings };
}

import Papa from "papaparse";
import {
  differenceInCalendarDays,
  endOfDay,
  isAfter,
  isBefore,
  isValid,
  parse,
  startOfDay,
} from "date-fns";
import type {
  ManpowerAssignmentStatus,
  ManpowerParseWarning,
  ManpowerProjectStage,
} from "./types";

export interface ParsedManpowerAssignment {
  projectCode: string | null;
  projectName: string;
  role: string;
  assigneeName: string | null;
  status: ManpowerAssignmentStatus;
  startDate: string | null;
  finishDate: string | null;
  startLabel: string | null;
  finishLabel: string | null;
  durationDays: number | null;
  durationLabel: string | null;
  predecessors: string | null;
  notes: string | null;
  taskMode: string | null;
  sortOrder: number;
}

export interface ParsedManpowerProject {
  projectCode: string | null;
  projectName: string;
  stage: ManpowerProjectStage;
  startDate: string | null;
  finishDate: string | null;
  startLabel: string | null;
  finishLabel: string | null;
  durationDays: number | null;
  durationLabel: string | null;
  notes: string | null;
  taskMode: string | null;
  sortOrder: number;
  assignments: ParsedManpowerAssignment[];
}

export interface ParsedManpowerDataset {
  sourceLabel: string;
  importedAt: string;
  warnings: ManpowerParseWarning[];
  projects: ParsedManpowerProject[];
  assignments: ParsedManpowerAssignment[];
}

type RawManpowerRow = {
  Text2?: string;
  "Task Mode"?: string;
  "Task Name"?: string;
  Duration?: string;
  Start?: string;
  Finish?: string;
  Predecessors?: string;
  "Resource Names"?: string;
  Notes?: string;
};

const REQUIRED_HEADERS = ["Task Name", "Resource Names", "Start", "Finish"] as const;

const ROLE_ALIASES: Record<string, string> = {
  "assistant super.": "Assistant Super",
  "assistant super": "Assistant Super",
  "assistant project manager": "Assistant Project Manager",
  "field engineer": "Field Engineer",
  "intern": "Intern",
  "project manager": "Project Manager",
  "senior pm": "Senior PM",
  "superintendent": "Superintendent",
};

export function normalizeComparable(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeWhitespace(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeRole(value: string): string {
  const cleaned = normalizeWhitespace(value).replace(/\.$/, "");
  const alias = ROLE_ALIASES[cleaned.toLowerCase()];
  return alias ?? cleaned;
}

function looksLikeRole(value: string): boolean {
  const normalized = normalizeComparable(value);
  return Boolean(
    ROLE_ALIASES[normalized] ||
      normalized.includes("project manager") ||
      normalized.includes("super") ||
      normalized.includes("field engineer") ||
      normalized.includes("intern") ||
      normalized.includes("senior pm"),
  );
}

function parseDateLabel(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = [
    parse(trimmed, "EEE M/d/yy", new Date()),
    parse(trimmed, "M/d/yy", new Date()),
  ].find((candidate) => isValid(candidate));

  if (!parsed) return null;

  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsed.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDurationDays(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/(-?\d+(?:\.\d+)?)\s*day/i);
  return match ? Number(match[1]) : null;
}

export function deriveAssignmentStatus(assigneeName: string | null): ManpowerAssignmentStatus {
  if (!assigneeName) return "open";
  const normalized = normalizeComparable(assigneeName);
  if (!normalized || normalized === "new hire") return "open";
  if (normalized === "tbd") return "tbd";
  return "filled";
}

function buildProjectStage(
  startDate: string | null,
  finishDate: string | null,
  now: Date,
): ManpowerProjectStage {
  if (!startDate && !finishDate) return "undated";

  const start = startDate ? startOfDay(new Date(startDate)) : null;
  const finish = finishDate ? endOfDay(new Date(finishDate)) : null;

  if (finish && isBefore(finish, now)) return "completed";
  if (start && isAfter(start, now)) return "upcoming";
  return "active";
}

export function parseManpowerCsv(
  csvText: string,
  options?: { sourceLabel?: string; importedAt?: string },
): ParsedManpowerDataset {
  const parsed = Papa.parse<RawManpowerRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    const firstError = parsed.errors[0];
    throw new Error(
      `CSV parse failed on row ${firstError.row ?? "unknown"}: ${firstError.message}`,
    );
  }

  const headers = parsed.meta.fields ?? [];
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(
      `This manpower CSV is missing required columns: ${missingHeaders.join(", ")}.`,
    );
  }

  const warnings: ManpowerParseWarning[] = [];
  const assignments: ParsedManpowerAssignment[] = [];
  const projects: ParsedManpowerProject[] = [];
  const now = new Date();
  let currentProject: ParsedManpowerProject | null = null;

  parsed.data.forEach((row, index) => {
    const rowNumber = index + 2;
    const taskNameRaw = row["Task Name"] ?? "";
    const taskName = normalizeWhitespace(taskNameRaw);
    const assigneeName = normalizeWhitespace(row["Resource Names"]) || null;
    const projectCode = normalizeWhitespace(row.Text2) || null;
    const hasIndentedTask = /^\s+/.test(taskNameRaw);
    const startDate = parseDateLabel(row.Start);
    const finishDate = parseDateLabel(row.Finish);
    const durationDays = parseDurationDays(row.Duration);
    const durationLabel = normalizeWhitespace(row.Duration) || null;
    const notes = normalizeWhitespace(row.Notes) || null;
    const taskMode = normalizeWhitespace(row["Task Mode"]) || null;
    const predecessors = normalizeWhitespace(row.Predecessors) || null;

    const isProjectRow =
      Boolean(projectCode) ||
      (Boolean(taskName) &&
        !assigneeName &&
        !looksLikeRole(taskName) &&
        !hasIndentedTask);

    if (isProjectRow) {
      currentProject = {
        projectCode,
        projectName: taskName,
        stage: buildProjectStage(startDate, finishDate, now),
        startDate,
        finishDate,
        startLabel: normalizeWhitespace(row.Start) || null,
        finishLabel: normalizeWhitespace(row.Finish) || null,
        durationDays,
        durationLabel,
        notes,
        taskMode,
        sortOrder: projects.length,
        assignments: [],
      };
      projects.push(currentProject);
      return;
    }

    const role = normalizeRole(taskName);
    if (!role && !assigneeName) return;

    if (!currentProject) {
      warnings.push({
        rowNumber,
        message: `Ignored assignment row without a project header: ${taskName || assigneeName || "Untitled row"}.`,
      });
      return;
    }

    const assignment: ParsedManpowerAssignment = {
      projectCode: currentProject.projectCode,
      projectName: currentProject.projectName,
      role,
      assigneeName,
      status: deriveAssignmentStatus(assigneeName),
      startDate,
      finishDate,
      startLabel: normalizeWhitespace(row.Start) || null,
      finishLabel: normalizeWhitespace(row.Finish) || null,
      durationDays,
      durationLabel,
      predecessors,
      notes,
      taskMode,
      sortOrder: assignments.length,
    };

    currentProject.assignments.push(assignment);
    assignments.push(assignment);
  });

  if (projects.length === 0) {
    throw new Error("No project rows were found in this manpower CSV.");
  }

  if (assignments.length === 0) {
    throw new Error("No staffing assignments were found in this manpower CSV.");
  }

  return {
    sourceLabel: options?.sourceLabel ?? "Imported CSV",
    importedAt: options?.importedAt ?? new Date().toISOString(),
    warnings,
    projects,
    assignments,
  };
}

export function isAssignmentActive(
  assignment: Pick<ParsedManpowerAssignment, "startDate" | "finishDate">,
  now = new Date(),
): boolean {
  const current = now;
  const start = assignment.startDate ? startOfDay(new Date(assignment.startDate)) : null;
  const finish = assignment.finishDate ? endOfDay(new Date(assignment.finishDate)) : null;

  if (start && finish) {
    return !isBefore(finish, current) && !isAfter(start, current);
  }
  if (start) return !isAfter(start, current);
  if (finish) return !isBefore(finish, current);
  return false;
}

export function daysUntilAssignmentStart(
  assignment: Pick<ParsedManpowerAssignment, "startDate">,
  now = new Date(),
): number | null {
  if (!assignment.startDate) return null;
  return differenceInCalendarDays(new Date(assignment.startDate), startOfDay(now));
}

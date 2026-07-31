export type ManpowerAssignmentStatus = "filled" | "open" | "tbd";

export type ManpowerProjectStage = "active" | "upcoming" | "completed" | "undated";

export interface ManpowerPersonOption {
  id: string;
  name: string;
  jobTitle: string | null;
  businessUnit: string | null;
}

export interface ManpowerAssignment {
  id: string;
  planId: string;
  manpowerProjectId: string;
  projectId: number | null;
  projectCode: string | null;
  projectName: string;
  role: string;
  assigneeName: string | null;
  assigneePersonId: string | null;
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

export interface ManpowerProject {
  id: string;
  planId: string;
  projectId: number | null;
  code: string | null;
  name: string;
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
  assignments: ManpowerAssignment[];
}

export interface ManpowerParseWarning {
  rowNumber: number;
  message: string;
}

export interface ManpowerPlanPayload {
  id: string;
  sourceLabel: string;
  importedAt: string;
  importedByName: string | null;
  warningCount: number;
  projects: ManpowerProject[];
  assignments: ManpowerAssignment[];
}

export interface ManpowerPagePayload {
  plan: ManpowerPlanPayload | null;
  people: ManpowerPersonOption[];
}

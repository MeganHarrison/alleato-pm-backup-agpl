import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type {
  ParsedManpowerAssignment,
  ParsedManpowerDataset,
  ParsedManpowerProject,
} from "./parser";
import { deriveAssignmentStatus, normalizeComparable } from "./parser";
import type {
  ManpowerAssignment,
  ManpowerPagePayload,
  ManpowerPersonOption,
  ManpowerPlanPayload,
  ManpowerProject,
} from "./types";

type DbClient = SupabaseClient<Database>;
type PlanRow = Database["public"]["Tables"]["manpower_plans"]["Row"];
type ProjectRow = Database["public"]["Tables"]["manpower_projects"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["manpower_assignments"]["Row"];
type PeopleRow = Database["public"]["Tables"]["people"]["Row"];
type ProjectTableRow = Database["public"]["Tables"]["projects"]["Row"];

type PersonOptionRow = Pick<
  PeopleRow,
  "id" | "first_name" | "last_name" | "job_title" | "business_unit"
>;
type ImportPersonRow = Pick<
  PeopleRow,
  "id" | "first_name" | "last_name" | "company" | "status" | "person_type" | "auth_user_id"
>;
type ImportProjectRow = Pick<
  ProjectTableRow,
  "id" | "name" | "job number" | "project_number"
>;

const ALLEATO_COMPANY = "Alleato";

function buildPersonName(person: Pick<PeopleRow, "first_name" | "last_name">): string {
  return `${person.first_name ?? ""} ${person.last_name ?? ""}`.replace(/\s+/g, " ").trim();
}

function buildImportedByName(person: Pick<PeopleRow, "first_name" | "last_name"> | null): string | null {
  if (!person) return null;
  return buildPersonName(person) || null;
}

function buildPersonOption(person: PersonOptionRow): ManpowerPersonOption {
  return {
    id: person.id,
    name: buildPersonName(person),
    jobTitle: person.job_title,
    businessUnit: person.business_unit,
  };
}

function mapAssignment(
  assignment: AssignmentRow,
  project: ProjectRow,
): ManpowerAssignment {
  return {
    id: assignment.id,
    planId: assignment.plan_id,
    manpowerProjectId: assignment.manpower_project_id,
    projectId: project.project_id,
    projectCode: project.external_code,
    projectName: project.project_name,
    role: assignment.role,
    assigneeName: assignment.assignee_name,
    assigneePersonId: assignment.assignee_person_id,
    status: assignment.status as ManpowerAssignment["status"],
    startDate: assignment.start_date,
    finishDate: assignment.finish_date,
    startLabel: assignment.start_label,
    finishLabel: assignment.finish_label,
    durationDays: assignment.duration_days,
    durationLabel: assignment.duration_label,
    predecessors: assignment.predecessors,
    notes: assignment.notes,
    taskMode: assignment.task_mode,
    sortOrder: assignment.sort_order,
  };
}

function mapProject(project: ProjectRow, assignments: ManpowerAssignment[]): ManpowerProject {
  return {
    id: project.id,
    planId: project.plan_id,
    projectId: project.project_id,
    code: project.external_code,
    name: project.project_name,
    stage: project.stage as ManpowerProject["stage"],
    startDate: project.start_date,
    finishDate: project.finish_date,
    startLabel: project.start_label,
    finishLabel: project.finish_label,
    durationDays: project.duration_days,
    durationLabel: project.duration_label,
    notes: project.notes,
    taskMode: project.task_mode,
    sortOrder: project.sort_order,
    assignments,
  };
}

async function fetchAssignablePeople(supabase: DbClient): Promise<ManpowerPersonOption[]> {
  const { data, error } = await supabase
    .from("people")
    .select("id, first_name, last_name, job_title, business_unit, company, status, person_type")
    .ilike("company", `%${ALLEATO_COMPANY}%`)
    .eq("status", "active")
    .in("person_type", ["user", "employee"])
    .order("last_name")
    .order("first_name");

  if (error) throw error;
  return (data ?? []).map(buildPersonOption).filter((person) => person.name.length > 0);
}

export async function getActiveManpowerPayload(supabase: DbClient): Promise<ManpowerPagePayload> {
  const people = await fetchAssignablePeople(supabase);

  const { data: plan, error: planError } = await supabase
    .from("manpower_plans")
    .select("id, source_label, imported_at, imported_by_person_id, warning_count")
    .eq("is_active", true)
    .order("imported_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (planError) throw planError;
  if (!plan) {
    return {
      plan: null,
      people,
    };
  }

  const [projectsResult, assignmentsResult, importedByResult] = await Promise.all([
    supabase
      .from("manpower_projects")
      .select("*")
      .eq("plan_id", plan.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("manpower_assignments")
      .select("*")
      .eq("plan_id", plan.id)
      .order("sort_order", { ascending: true }),
    plan.imported_by_person_id
      ? supabase
          .from("people")
          .select("first_name, last_name")
          .eq("id", plan.imported_by_person_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (projectsResult.error) throw projectsResult.error;
  if (assignmentsResult.error) throw assignmentsResult.error;
  if (importedByResult.error) throw importedByResult.error;

  const assignmentsByProject = new Map<string, ManpowerAssignment[]>();
  const projectRows = projectsResult.data ?? [];
  const assignmentRows = assignmentsResult.data ?? [];
  const projectById = new Map(projectRows.map((project) => [project.id, project]));

  assignmentRows.forEach((assignment) => {
    const project = projectById.get(assignment.manpower_project_id);
    if (!project) return;
    const mapped = mapAssignment(assignment, project);
    const current = assignmentsByProject.get(project.id) ?? [];
    current.push(mapped);
    assignmentsByProject.set(project.id, current);
  });

  const projects = projectRows.map((project) =>
    mapProject(project, assignmentsByProject.get(project.id) ?? []),
  );

  const payload: ManpowerPlanPayload = {
    id: plan.id,
    sourceLabel: plan.source_label,
    importedAt: plan.imported_at,
    importedByName: buildImportedByName(importedByResult.data),
    warningCount: plan.warning_count,
    projects,
    assignments: projects.flatMap((project) => project.assignments),
  };

  return {
    plan: payload,
    people,
  };
}

export async function resolveImportContext(supabase: DbClient) {
  const [peopleResult, projectsResult, currentUserResult] = await Promise.all([
    supabase
      .from("people")
      .select("id, first_name, last_name, company, status, person_type, auth_user_id")
      .ilike("company", `%${ALLEATO_COMPANY}%`)
      .eq("status", "active")
      .in("person_type", ["user", "employee"]),
    supabase
      .from("projects")
      .select('id, name, "job number", project_number'),
    supabase.auth.getUser(),
  ]);

  if (peopleResult.error) throw peopleResult.error;
  if (projectsResult.error) throw projectsResult.error;
  if (currentUserResult.error) throw currentUserResult.error;

  const people = peopleResult.data ?? [];
  const projects = projectsResult.data ?? [];
  const currentUserId = currentUserResult.data.user?.id ?? null;

  const peopleByName = new Map<string, ImportPersonRow>();
  people.forEach((person) => {
    const fullName = normalizeComparable(buildPersonName(person));
    if (fullName && !peopleByName.has(fullName)) {
      peopleByName.set(fullName, person);
    }
  });

  const projectsByCode = new Map<string, ImportProjectRow>();
  const projectsByName = new Map<string, ImportProjectRow>();
  projects.forEach((project) => {
    const codes = [project["job number"], project.project_number];
    codes.forEach((code) => {
      const normalized = normalizeComparable(code);
      if (normalized && !projectsByCode.has(normalized)) {
        projectsByCode.set(normalized, project);
      }
    });
    const projectName = normalizeComparable(project.name);
    if (projectName && !projectsByName.has(projectName)) {
      projectsByName.set(projectName, project);
    }
  });

  let importedByPersonId: string | null = null;
  if (currentUserId) {
    const currentUserPerson = people.find((person) => person.auth_user_id === currentUserId);
    importedByPersonId = currentUserPerson?.id ?? null;
  }

  return {
    peopleByName,
    projectsByCode,
    projectsByName,
    importedByPersonId,
  };
}

export function matchLinkedProject(
  project: ParsedManpowerProject,
  context: Awaited<ReturnType<typeof resolveImportContext>>,
): number | null {
  const byCode = normalizeComparable(project.projectCode);
  if (byCode) {
    const matched = context.projectsByCode.get(byCode);
    if (matched) return matched.id;
  }

  const byName = normalizeComparable(project.projectName);
  return context.projectsByName.get(byName)?.id ?? null;
}

export function matchPersonId(
  assigneeName: string | null,
  context: Awaited<ReturnType<typeof resolveImportContext>>,
): string | null {
  const normalized = normalizeComparable(assigneeName);
  if (!normalized) return null;
  return context.peopleByName.get(normalized)?.id ?? null;
}

export function buildProjectInsertRows(
  planId: string,
  dataset: ParsedManpowerDataset,
  context: Awaited<ReturnType<typeof resolveImportContext>>,
): Array<Database["public"]["Tables"]["manpower_projects"]["Insert"]> {
  return dataset.projects.map((project, index) => ({
    plan_id: planId,
    project_id: matchLinkedProject(project, context),
    external_code: project.projectCode,
    project_name: project.projectName,
    stage: project.stage,
    start_date: project.startDate,
    finish_date: project.finishDate,
    start_label: project.startLabel,
    finish_label: project.finishLabel,
    duration_days: project.durationDays,
    duration_label: project.durationLabel,
    notes: project.notes,
    task_mode: project.taskMode,
    sort_order: index,
  }));
}

export function buildAssignmentInsertRows(
  planId: string,
  dataset: ParsedManpowerDataset,
  insertedProjects: ProjectRow[],
  context: Awaited<ReturnType<typeof resolveImportContext>>,
): Array<Database["public"]["Tables"]["manpower_assignments"]["Insert"]> {
  const projectIdsByKey = new Map<string, string>();
  insertedProjects.forEach((project) => {
    projectIdsByKey.set(
      `${project.external_code ?? ""}::${project.project_name}`,
      project.id,
    );
  });

  return dataset.assignments.map((assignment, index) => {
    const manpowerProjectId = projectIdsByKey.get(
      `${assignment.projectCode ?? ""}::${assignment.projectName}`,
    );

    if (!manpowerProjectId) {
      throw new Error(`Could not map imported assignment to a stored project: ${assignment.projectName} / ${assignment.role}.`);
    }

    const assigneePersonId = matchPersonId(assignment.assigneeName, context);
    return {
      plan_id: planId,
      manpower_project_id: manpowerProjectId,
      assignee_person_id: assigneePersonId,
      assignee_name: assignment.assigneeName,
      role: assignment.role,
      status: assignment.status,
      start_date: assignment.startDate,
      finish_date: assignment.finishDate,
      start_label: assignment.startLabel,
      finish_label: assignment.finishLabel,
      duration_days: assignment.durationDays,
      duration_label: assignment.durationLabel,
      predecessors: assignment.predecessors,
      notes: assignment.notes,
      task_mode: assignment.taskMode,
      sort_order: index,
    };
  });
}

export async function hydrateAssignmentUpdate(
  supabase: DbClient,
  input: {
    assigneePersonId?: string | null;
    assigneeName?: string | null;
    status?: ManpowerAssignment["status"];
    notes?: string | null;
  },
): Promise<Database["public"]["Tables"]["manpower_assignments"]["Update"]> {
  let assigneeName = input.assigneeName ?? null;
  const assigneePersonId = input.assigneePersonId ?? null;

  if (assigneePersonId) {
    const { data, error } = await supabase
      .from("people")
      .select("id, first_name, last_name")
      .eq("id", assigneePersonId)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new Error("Selected assignee was not found in the people directory.");
    }
    assigneeName = buildPersonName(data);
  }

  const status =
    input.status ??
    deriveAssignmentStatus(assigneeName);

  return {
    assignee_person_id: assigneePersonId,
    assignee_name: assigneeName,
    status,
    notes: input.notes,
  };
}

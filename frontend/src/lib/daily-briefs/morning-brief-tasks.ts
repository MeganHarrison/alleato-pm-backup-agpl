import { createServiceClient } from "@/lib/supabase/service";

// ─────────────────────────────────────────────────────────────────────────────
// Morning Brief action rail — REAL tasks from the shared `tasks` store.
//
// The right rail is NOT a cosmetic list: it is a view onto the same `tasks`
// records the Tasks page serves. This loader reads open tasks and splits them
// into the owner's list ("you") vs the team's, so resolve / edit / reassign /
// delete performed in the rail mutate the same rows everywhere.
// ─────────────────────────────────────────────────────────────────────────────

export interface RailTask {
  id: string;
  text: string;
  project: string | null;
  projectId: number | null;
  href: string;
  /** true → owner's own task (Brandon); rendered in the "Your" list. */
  you: boolean;
  owner: string;
  showOwner: boolean;
  urgent: boolean;
  dueNormal: boolean;
  dueLabel: string;
  carried: boolean;
  since: string;
  priority: string;
  assigneePersonId: string | null;
  /** Shown in the "Why?" expander. */
  reasoning: string;
  status: string;
}

export interface RailData {
  your: RailTask[];
  team: RailTask[];
  resolved: RailTask[];
  brandonPersonId: string | null;
}

type TaskRow = {
  id: string;
  title: string | null;
  description: string | null;
  status: string | null;
  due_date: string | null;
  priority: string | null;
  project_id: number | null;
  assignee_person_id: string | null;
  assignee_name: string | null;
  created_at: string | null;
  projects: { name: string | null } | null;
};

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeTaskRow(value: unknown, queryName: string): TaskRow {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Daily Brief task read returned an invalid ${queryName} row.`);
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string") {
    throw new Error(`Daily Brief task read returned a ${queryName} row without an id.`);
  }
  const projectRecord =
    typeof row.projects === "object" && row.projects !== null && !Array.isArray(row.projects)
      ? (row.projects as Record<string, unknown>)
      : null;
  return {
    id: row.id,
    title: asNullableString(row.title),
    description: asNullableString(row.description),
    status: asNullableString(row.status),
    due_date: asNullableString(row.due_date),
    priority: asNullableString(row.priority),
    project_id: typeof row.project_id === "number" ? row.project_id : null,
    assignee_person_id: asNullableString(row.assignee_person_id),
    assignee_name: asNullableString(row.assignee_name),
    created_at: asNullableString(row.created_at),
    projects: projectRecord ? { name: asNullableString(projectRecord.name) } : null,
  };
}

function normalizeTaskRows(value: unknown, queryName: string): TaskRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => normalizeTaskRow(row, queryName));
}

function shortDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Due label + urgency, relative to the brief's business date. */
function deriveDue(
  dueDate: string | null,
  businessDate: string,
): { dueLabel: string; urgent: boolean; dueNormal: boolean } {
  if (!dueDate) return { dueLabel: "", urgent: false, dueNormal: false };
  const due = new Date(`${dueDate}T00:00:00Z`).getTime();
  const today = new Date(`${businessDate}T00:00:00Z`).getTime();
  if (Number.isNaN(due) || Number.isNaN(today)) {
    return { dueLabel: `Due ${shortDate(dueDate)}`, urgent: false, dueNormal: true };
  }
  if (due < today) return { dueLabel: "Overdue", urgent: true, dueNormal: false };
  if (due === today) return { dueLabel: "Due today", urgent: true, dueNormal: false };
  return { dueLabel: `Due ${shortDate(dueDate)}`, urgent: false, dueNormal: true };
}

function isCarried(createdAt: string | null, businessDate: string): { carried: boolean; since: string } {
  if (!createdAt) return { carried: false, since: "" };
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return { carried: false, since: "" };
  const createdDay = created.toISOString().slice(0, 10);
  if (createdDay >= businessDate) return { carried: false, since: "" };
  return { carried: true, since: shortDate(createdDay) };
}

async function resolveBrandonPersonId(
  supabase: ReturnType<typeof createServiceClient>,
): Promise<string | null> {
  const { data } = await supabase
    .from("people")
    .select("id")
    .ilike("first_name", "brandon")
    .in("person_type", ["employee", "user"])
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

function mapRow(row: TaskRow, brandonPersonId: string | null, businessDate: string): RailTask {
  const you = brandonPersonId != null && row.assignee_person_id === brandonPersonId;
  const owner = you ? "Brandon" : row.assignee_name?.trim() || "Unassigned";
  const { dueLabel, urgent, dueNormal } = deriveDue(row.due_date, businessDate);
  const { carried, since } = isCarried(row.created_at, businessDate);
  return {
    id: row.id,
    text: row.title?.trim() || row.description?.trim() || "Untitled task",
    project: row.projects?.name ?? null,
    projectId: row.project_id,
    href: row.project_id ? `/${row.project_id}/tasks` : "/tasks",
    you,
    owner,
    showOwner: !you,
    urgent,
    dueNormal,
    dueLabel,
    carried,
    since,
    priority: row.priority ?? "medium",
    assigneePersonId: row.assignee_person_id,
    reasoning: row.description?.trim() || "",
    status: row.status ?? "open",
  };
}

/**
 * Load the open tasks that back the Morning Brief action rail. Prefers tasks
 * generated from the brief (`source_system = 'daily_brief'`); if none exist yet,
 * falls back to the most recent open tasks so the rail reflects live work rather
 * than sitting empty.
 */
export async function loadMorningBriefRailTasks(businessDate: string): Promise<RailData> {
  const supabase = createServiceClient();
  const brandonPersonId = await resolveBrandonPersonId(supabase);

  const columns =
    "id, title, description, status, due_date, priority, project_id, assignee_person_id, assignee_name, created_at, projects(name)";

  const { data: briefTasks } = await supabase
    .from("tasks")
    .select(columns)
    .eq("status", "open")
    .eq("source_system", "daily_brief")
    .order("created_at", { ascending: false })
    .limit(60);

  let rows = normalizeTaskRows(briefTasks, "brief-task");
  if (rows.length === 0) {
    const { data: recent } = await supabase
      .from("tasks")
      .select(columns)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(40);
    rows = normalizeTaskRows(recent, "recent-task");
  }

  const mapped = rows.map((row) => mapRow(row, brandonPersonId, businessDate));
  const { data: resolvedRows } = await supabase
    .from("tasks")
    .select(columns)
    .eq("status", "done")
    .eq("source_system", "daily_brief")
    .order("updated_at", { ascending: false })
    .limit(40);
  const resolved = normalizeTaskRows(resolvedRows, "resolved-task").map((row) =>
    mapRow(row, brandonPersonId, businessDate),
  );
  return {
    your: mapped.filter((task) => task.you),
    team: mapped.filter((task) => !task.you),
    resolved,
    brandonPersonId,
  };
}

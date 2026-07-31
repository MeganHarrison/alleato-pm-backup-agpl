import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { mapTaskRow, type JoinedTaskRow } from "@/features/tasks/task-utils";
import {
  TASK_PRIORITY_VALUES,
  TASK_STATUS_VALUES,
} from "@/features/tasks/task-values";
import { GuardrailError } from "@/lib/guardrails/errors";
import { validateResponseContract, withApiGuardrails } from "@/lib/guardrails/api";

const TaskResponseSchema = z.object({
  project_name: z.string().nullable(),
  meeting_title: z.string().nullable(),
  source_title: z.string().nullable(),
  source_type: z.string().nullable(),
  source_date: z.string().nullable(),
  source_url: z.string().nullable(),
  source_web_url: z.string().nullable(),
  fireflies_link: z.string().nullable(),
  meeting_link: z.string().nullable(),
  source_context: z.string().nullable(),
});

const TASK_COLUMNS = `
  id,
  metadata_id,
  segment_id,
  source_chunk_id,
  schedule_task_id,
  description,
  assignee_person_id,
  assignee_name,
  assignee_email,
  project_id,
  client_id,
  due_date,
  priority,
  status,
  source_system,
  created_at,
  updated_at,
  project_ids,
  file_name,
  title,
  assigned_by,
  extraction_source,
  extraction_model,
  extraction_prompt_version,
  extraction_metadata
`;

// Lean select for list queries — excludes heavy content fields to prevent statement timeouts.
// source_context is lazy-loaded per-task via GET /api/tasks/[taskId] when a task is opened.
const TASK_SELECT = `
  ${TASK_COLUMNS},
  projects (id, name),
  document_metadata:tasks_metadata_id_fkey (
    id,
    title,
    type,
    source,
    source_system,
    url,
    source_web_url,
    fireflies_link,
    meeting_link,
    project_id,
    date,
    captured_at,
    created_at
  )
`;

const TASK_SELECT_WITH_DOCUMENT_INNER = TASK_SELECT.replace(
  "document_metadata:tasks_metadata_id_fkey (",
  "document_metadata:tasks_metadata_id_fkey!inner (",
);

export const GET = withApiGuardrails("/api/tasks#GET", async ({ request }) => {
  const projectIdParam = request.nextUrl.searchParams.get("project_id");
  const projectId = projectIdParam ? Number.parseInt(projectIdParam, 10) : null;

  const rawScope = request.nextUrl.searchParams.get("scope") ?? "mine";
  const scope = rawScope === "all" || rawScope === "mine" ? rawScope : "mine";

  if (!["mine", "all"].includes(scope)) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where: "/api/tasks#GET",
      message: "Invalid task scope.",
      details: { scope },
    });
  }

  // Resolve user from JWT cookie directly — no Auth network call, no rate-limit exposure.
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "/api/tasks#GET",
      message: "Not authenticated.",
      details: { reason: "No valid session cookie" },
    });
  }

  // Use service client so profile lookup/admin checks are immune to RLS edge cases.
  const serviceClient = createServiceClient();
  const { data: profileData, error: profileError } = await serviceDb.from("user_profiles")
    .select("is_admin, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/tasks#GET",
      message: "Failed to verify task access.",
      details: { reason: profileError.message },
      cause: profileError,
    });
  }

  // Admins-only guard for "all" scope.
  if (scope === "all" && profileData?.is_admin !== true) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where: "/api/tasks#GET",
      message: "Only admins can view all tasks.",
      details: { userId: user.id, scope },
    });
  }

  const supabase = await createClient();

  // Project-scoped: use service client to bypass RLS; deduplicate across three query strategies.
  if (projectId !== null && !Number.isNaN(projectId)) {
    const [byProjectIds, byProjectId, viaDocsMeta] = await Promise.all([
      serviceDb.from("tasks")
        .select(TASK_SELECT)
        .contains("project_ids", [projectId])
        .order("created_at", { ascending: false }),
      serviceDb.from("tasks")
        .select(TASK_SELECT)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      serviceDb.from("tasks")
        .select(TASK_SELECT_WITH_DOCUMENT_INNER)
        .eq("document_metadata.project_id", projectId)
        .or("project_ids.is.null,project_ids.eq.{}")
        .order("created_at", { ascending: false }),
    ]);

    if (byProjectIds.error ?? byProjectId.error ?? viaDocsMeta.error) {
      const firstError = byProjectIds.error ?? byProjectId.error ?? viaDocsMeta.error;
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "/api/tasks#GET",
        message: `Failed to load project tasks: ${firstError?.message}`,
        details: { projectId, byProjectIdsError: byProjectIds.error?.message, byProjectIdError: byProjectId.error?.message, viaDocsMetaError: viaDocsMeta.error?.message },
      });
    }

    const seenIds = new Set<string>();
    const allRows: JoinedTaskRow[] = [];
    for (const task of [
      ...(byProjectIds.data ?? []),
      ...(byProjectId.data ?? []),
      ...(viaDocsMeta.data ?? []),
    ] as JoinedTaskRow[]) {
      if (task.id && !seenIds.has(task.id)) {
        seenIds.add(task.id);
        allRows.push(task);
      }
    }

    allRows.sort((a, b) => {
      const at = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bt - at;
    });

    // Apply scope filtering within the project: "mine" = assigned to the logged-in user.
    const currentUserEmail = user.email?.trim().toLowerCase() ?? "";
    const fullName = profileData?.full_name?.trim().toLowerCase() ?? "";
    const { data: currentPerson } = currentUserEmail
      ? await serviceDb.from("people").select("id").ilike("email", currentUserEmail).maybeSingle()
      : { data: null };

    const scopedRows = scope === "mine"
      ? allRows.filter((t) => {
          if (currentPerson?.id && t.assignee_person_id === currentPerson.id) return true;
          if (currentUserEmail && t.assignee_email?.toLowerCase() === currentUserEmail) return true;
          if (fullName && t.assignee_name?.toLowerCase() === fullName) return true;
          return false;
        })
      : allRows;

    const tasks = scopedRows.map(mapTaskRow);
    validateResponseContract(z.array(TaskResponseSchema.passthrough()), tasks, "/api/tasks#GET");
    return NextResponse.json({ data: tasks, scope, projectId });
  }

  const currentUserEmail = user.email?.trim() ?? "";
  const { data: currentPerson, error: currentPersonError } = currentUserEmail
    ? await serviceDb.from("people")
      .select("id")
      .ilike("email", currentUserEmail)
      .maybeSingle()
    : { data: null, error: null };

  if (currentPersonError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/tasks#GET",
      message: "Failed to resolve the current user's task assignee record.",
      details: { reason: currentPersonError.message },
      cause: currentPersonError,
    });
  }

  const taskClient = scope === "all" ? serviceClient : supabase;
  // Legacy tasks are document-linked (metadata_id not null). Manual tasks and
  // tasks the daily deep read creates are legitimately metadata_id-null, so
  // include them by source_system instead of filtering them out.
  let query = taskClient
    .from("tasks")
    .select(TASK_SELECT)
    .or("metadata_id.not.is.null,source_system.in.(manual,daily_deep_read)")
    .order("created_at", { ascending: false })
    .limit(1000);

  // Scope: mine → prefer durable people FK, with email/name fallback for legacy rows.
  if (scope === "mine" && currentUserEmail) {
    const fullName = profileData?.full_name?.trim();
    const filters = [`assignee_email.ilike.${currentUserEmail}`];
    if (currentPerson?.id) filters.unshift(`assignee_person_id.eq.${currentPerson.id}`);
    if (fullName) filters.push(`assignee_name.ilike.${fullName}`);
    query = query.or(filters.join(","));
  }

  const { data, error } = await query;

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/tasks#GET",
      message: `Failed to load tasks: ${error.message}`,
      details: { reason: error.message },
      cause: error,
    });
  }

  const tasks = ((data ?? []) as JoinedTaskRow[]).map(mapTaskRow);

  validateResponseContract(
    z.array(TaskResponseSchema.passthrough()),
    tasks,
    "/api/tasks#GET",
  );

  return NextResponse.json({ data: tasks, scope });
});

// ---------------------------------------------------------------------------
// POST /api/tasks — create a manual (ad-hoc) task.
//
// Every existing task is AI-extracted from a source document, so `metadata_id`
// is set and `source_system` names the extractor. A manual task has no source
// document: it inserts with `metadata_id: null` and `source_system: 'manual'`.
// The 20260709 migration drops the NOT NULL on `metadata_id` to allow this.
//
// FK contract (see FORM-FK-VALIDATION-GATE.md): the assignee picker returns a
// `people.id`, so we write `assignee_person_id` and resolve the durable
// `assignee_name` / `assignee_email` from that person row — never trust
// client-supplied name/email. `project_id` comes from the project picker
// (projects.id is INTEGER).
// ---------------------------------------------------------------------------

const CreateTaskBodySchema = z.object({
  description: z.string().trim().min(1, "A task description is required."),
  title: z.string().trim().min(1).max(200).optional(),
  project_id: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  assignee_person_id: z.union([z.string().uuid(), z.null()]).optional(),
  due_date: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()])
    .optional(),
  priority: z.union([z.enum(TASK_PRIORITY_VALUES), z.null()]).optional(),
  status: z.enum(TASK_STATUS_VALUES).optional(),
});

// The insert trigger (tasks_enforce_quality_on_insert) requires a non-empty
// title on every row. When the user leaves the title blank, derive a short
// imperative-ish heading from the description so the insert never trips the
// guardrail.
function deriveTitleFromDescription(description: string): string {
  const normalized = description.replace(/\s+/g, " ").trim();
  if (normalized.length <= 80) return normalized;
  const truncated = normalized.slice(0, 80);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${(lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated).trim()}…`;
}

async function resolveManualAssignee(personId: string | null | undefined) {
  if (!personId) {
    return {
      assignee_person_id: null as string | null,
      assignee_name: null as string | null,
      assignee_email: null as string | null,
    };
  }

  const serviceClient = createServiceClient();
  const { data: person, error } = await serviceDb.from("people")
    .select("id, first_name, last_name, email")
    .eq("id", personId)
    .in("person_type", ["employee", "user"])
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/tasks#POST",
      message: "Failed to resolve the selected assignee.",
      details: { reason: error.message, personId },
      cause: error,
    });
  }

  if (!person) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where: "/api/tasks#POST",
      message: "Selected assignee was not found in active employees.",
      status: 400,
      details: { personId },
    });
  }

  return {
    assignee_person_id: person.id,
    assignee_email: person.email ?? null,
    assignee_name:
      [person.first_name, person.last_name].filter(Boolean).join(" ").trim() ||
      person.email ||
      null,
  };
}

export const POST = withApiGuardrails("/api/tasks#POST", async ({ request }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "/api/tasks#POST",
      message: "Not authenticated.",
      details: { reason: "No valid session cookie" },
    });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = CreateTaskBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where: "/api/tasks#POST",
      message: "Invalid task payload.",
      status: 400,
      details: { issues: parsed.error.flatten() },
    });
  }

  const { description, title, project_id, assignee_person_id, due_date, priority, status } =
    parsed.data;

  const assignee = await resolveManualAssignee(assignee_person_id);

  const projectId = project_id ?? null;
  const dueDate = due_date && due_date.length > 0 ? due_date : null;

  const serviceClient = createServiceClient();
  const { data, error } = await serviceDb.from("tasks")
    .insert({
      metadata_id: null,
      source_system: "manual",
      status: status ?? "open",
      description,
      title: title?.trim() || deriveTitleFromDescription(description),
      project_id: projectId,
      project_ids: projectId === null ? [] : [projectId],
      due_date: dueDate,
      priority: priority ?? null,
      assignee_person_id: assignee.assignee_person_id,
      assignee_name: assignee.assignee_name,
      assignee_email: assignee.assignee_email,
      assigned_by: user.id,
    })
    .select()
    .single();

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/tasks#POST",
      message: `Failed to create task: ${error.message}`,
      details: { reason: error.message },
      cause: error,
    });
  }

  return NextResponse.json({ task: data }, { status: 201 });
});

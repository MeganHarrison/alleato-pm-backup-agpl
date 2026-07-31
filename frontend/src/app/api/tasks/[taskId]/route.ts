import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { apiErrorResponse } from "@/lib/api-error";
import {
  TASK_PRIORITY_VALUES,
  TASK_STATUS_VALUES,
} from "@/features/tasks/task-values";
import type { Json } from "@/types/database.types";
import { mapTaskRow, type JoinedTaskRow } from "@/features/tasks/task-utils";

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

// Full select for single-task fetches. Full RAG content is intentionally not
// selected from the app DB.
const TASK_SELECT_FULL = `
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
    created_at,
    summary,
    action_items,
    bullet_points,
    notes
  )
`;

type JsonRecord = { [key: string]: Json | undefined };

const TaskStatusSchema = z.enum(TASK_STATUS_VALUES);
const TaskPrioritySchema = z.enum(TASK_PRIORITY_VALUES);

const PatchBodySchema = z
  .object({
    title: z.union([z.string().trim().min(1), z.null()]).optional(),
    description: z.string().trim().min(1).optional(),
    status: TaskStatusSchema.optional(),
    due_date: z
      .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()])
      .optional(),
    project_id: z
      .union([z.coerce.number().int().positive(), z.null()])
      .optional(),
    category: z.union([z.string().trim().min(1), z.null()]).optional(),
    priority: z.union([TaskPrioritySchema, z.null()]).optional(),
    assignee_user_id: z.union([z.string().uuid(), z.null()]).optional(),
    assignee_person_id: z.union([z.string().uuid(), z.null()]).optional(),
  })
  .refine(
    (body) =>
      body.description !== undefined ||
      body.title !== undefined ||
      body.status !== undefined ||
      body.due_date !== undefined ||
      body.project_id !== undefined ||
      body.category !== undefined ||
      body.priority !== undefined ||
      body.assignee_user_id !== undefined ||
      body.assignee_person_id !== undefined,
    { message: "At least one task field is required." },
  );

function toJsonRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};
}

async function resolveAssignee(userId: string | null) {
  if (userId === null) {
    return {
      assignee_person_id: null,
      assignee_email: null,
      assignee_name: null,
    };
  }

  const serviceClient = createServiceClient();
  const { data: profile, error: profileError } = await serviceDb.from("user_profiles")
    .select("id, email, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where: "tasks/[taskId]#PATCH",
      message: "Selected assignee was not found.",
      details: { reason: profileError?.message, userId },
      cause: profileError ?? undefined,
    });
  }

  const { data: personByAuthId, error: authPersonError } = await serviceDb.from("people")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (authPersonError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "tasks/[taskId]#PATCH",
      message: "Failed to resolve assignee directory record.",
      details: { reason: authPersonError.message, userId },
      cause: authPersonError,
    });
  }

  const { data: personByEmail, error: emailPersonError } =
    !personByAuthId && profile.email
      ? await serviceDb.from("people")
          .select("id")
          .ilike("email", profile.email)
          .maybeSingle()
      : { data: null, error: null };

  if (emailPersonError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "tasks/[taskId]#PATCH",
      message: "Failed to resolve assignee email directory record.",
      details: { reason: emailPersonError.message, userId },
      cause: emailPersonError,
    });
  }

  return {
    assignee_person_id: personByAuthId?.id ?? personByEmail?.id ?? null,
    assignee_email: profile.email ?? null,
    assignee_name: profile.full_name ?? profile.email ?? null,
  };
}

async function resolveAssigneePerson(personId: string | null) {
  if (personId === null) {
    return {
      assignee_person_id: null,
      assignee_email: null,
      assignee_name: null,
    };
  }

  const serviceClient = createServiceClient();
  const { data: person, error: personError } = await serviceDb.from("people")
    .select("id, first_name, last_name, email")
    .eq("id", personId)
    .in("person_type", ["employee", "user"])
    .eq("status", "active")
    .maybeSingle();

  if (personError || !person) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where: "tasks/[taskId]#PATCH",
      message: "Selected assignee was not found in active employees.",
      status: 400,
      details: { reason: personError?.message, personId },
      cause: personError ?? undefined,
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

export const GET = withApiGuardrails(
  "tasks/[taskId]#GET",
  async ({ request, params }) => {
    const { taskId } = await params;
    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "tasks/[taskId]#GET",
        message: "Authentication required.",
      });
    }

    const serviceClient = createServiceClient();
    const { data: profileData, error: profileError } = await serviceDb.from("user_profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "tasks/[taskId]#GET",
        message: "Failed to verify task access.",
        details: { reason: profileError.message },
        cause: profileError,
      });
    }

    const readClient =
      profileData?.is_admin === true ? serviceClient : supabase;
    const { data, error } = await readClient
      .from("tasks")
      .select(TASK_SELECT_FULL)
      .eq("id", taskId)
      .maybeSingle();

    if (error) {
      return apiErrorResponse(error);
    }
    if (!data) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ task: mapTaskRow(data as JoinedTaskRow) });
  },
);

export const PATCH = withApiGuardrails(
  "tasks/[taskId]#PATCH",
  async ({ request, params }) => {
    const { taskId } = await params;
    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const parsed = PatchBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "tasks/[taskId]#PATCH",
        message: "Authentication required.",
      });
    }

    const updates: {
      title?: string | null;
      description?: string;
      status?: string;
      due_date?: string | null;
      project_id?: number | null;
      project_ids?: number[];
      priority?: string | null;
      assignee_person_id?: string | null;
      assignee_email?: string | null;
      assignee_name?: string | null;
      extraction_metadata?: JsonRecord;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (parsed.data.status !== undefined) {
      updates.status = parsed.data.status;
    }

    if (parsed.data.title !== undefined) {
      updates.title = parsed.data.title;
    }

    if (parsed.data.description !== undefined) {
      updates.description = parsed.data.description;
    }

    if (parsed.data.due_date !== undefined) {
      updates.due_date =
        parsed.data.due_date === "" ? null : parsed.data.due_date;
    }

    if (parsed.data.project_id !== undefined) {
      updates.project_id = parsed.data.project_id;
      updates.project_ids =
        parsed.data.project_id === null ? [] : [parsed.data.project_id];
    }

    if (parsed.data.priority !== undefined) {
      updates.priority = parsed.data.priority;
    }

    if (parsed.data.assignee_user_id !== undefined) {
      Object.assign(
        updates,
        await resolveAssignee(parsed.data.assignee_user_id),
      );
    }

    if (parsed.data.assignee_person_id !== undefined) {
      Object.assign(
        updates,
        await resolveAssigneePerson(parsed.data.assignee_person_id),
      );
    }

    if (parsed.data.category !== undefined) {
      const { data: currentTask, error: currentTaskError } = await supabase
        .from("tasks")
        .select("extraction_metadata")
        .eq("id", taskId)
        .maybeSingle();

      if (currentTaskError) {
        return apiErrorResponse(currentTaskError);
      }

      const metadata = toJsonRecord(currentTask?.extraction_metadata);
      if (parsed.data.category === null) {
        delete metadata.task_category;
      } else {
        metadata.task_category = parsed.data.category;
      }
      updates.extraction_metadata = metadata;
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", taskId)
      .select()
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ task: data });
  },
);

export const DELETE = withApiGuardrails(
  "tasks/[taskId]#DELETE",
  async ({ request, params }) => {
    const { taskId } = await params;
    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "tasks/[taskId]#DELETE",
        message: "Authentication required.",
      });
    }

    const { error } = await supabase.from("tasks").delete().eq("id", taskId);

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ success: true });
  },
);

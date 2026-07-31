import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";

const CreateDocumentTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(4000),
  assigneePersonId: z.string().uuid().nullable().optional(),
  assigneeUserId: z.string().uuid().nullable().optional(),
  projectId: z.union([z.number().int().positive(), z.null()]).optional(),
  sourceSystem: z.string().trim().min(1).max(80).optional(),
  dueDate: z.string().trim().min(1).nullable().optional(),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  status: z.enum(["open", "in_progress", "blocked"]).default("open"),
});

function normalizeTaskText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSourceSystem(value: string | null | undefined): string {
  const normalized = value?.replace(/\s+/g, "_").toLowerCase().trim();
  return normalized || "manual";
}

export const POST = withApiGuardrails<{ docId: string }>(
  "documents/[docId]/tasks#POST",
  async ({ request, params }) => {
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "documents/[docId]/tasks#POST",
        message: "Authentication required.",
      });
    }

    const { docId } = await params;
    const body = await parseJsonBody(
      request,
      CreateDocumentTaskSchema,
      "documents/[docId]/tasks#POST",
    );

    const { data: source, error: sourceError } = await supabase
      .from("document_metadata")
      .select("id, title, project_id, file_name, type, source_system")
      .eq("id", docId)
      .maybeSingle();

    if (sourceError) {
      return apiErrorResponse(sourceError);
    }

    if (!source) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "documents/[docId]/tasks#POST",
        message: "Source document not found.",
        status: 404,
      });
    }

    const normalizedTitle = normalizeTaskText(body.title);
    const normalizedDescription = normalizeTaskText(body.description);

    const { data: existingTask, error: existingTaskError } = await supabase
      .from("tasks")
      .select("id")
      .eq("metadata_id", source.id)
      .eq("title", normalizedTitle)
      .eq("description", normalizedDescription)
      .limit(1)
      .maybeSingle();

    if (existingTaskError) {
      return apiErrorResponse(existingTaskError);
    }

    if (existingTask) {
      return NextResponse.json(
        {
          success: false,
          duplicate: true,
          taskId: existingTask.id,
          error: "A matching task already exists for this conversation.",
        },
        { status: 409 },
      );
    }

    let assigneeFields: {
      assignee_person_id: string | null;
      assignee_name: string | null;
      assignee_email: string | null;
    } = {
      assignee_person_id: null,
      assignee_name: null,
      assignee_email: null,
    };

    if (body.assigneeUserId) {
            const { data: profile, error: profileError } = await serviceDb.from("user_profiles")
        .select("id, email, full_name")
        .eq("id", body.assigneeUserId)
        .maybeSingle();

      if (profileError || !profile) {
        throw new GuardrailError({
          code: "VALIDATION_ERROR",
          where: "documents/[docId]/tasks#POST",
          message: "Selected assignee was not found.",
          status: 400,
          details: { reason: profileError?.message, assigneeUserId: body.assigneeUserId },
          cause: profileError ?? undefined,
        });
      }

      const { data: personByAuthId, error: authPersonError } = await serviceDb.from("people")
        .select("id")
        .eq("auth_user_id", profile.id)
        .maybeSingle();

      if (authPersonError) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "documents/[docId]/tasks#POST",
          message: "Failed to resolve assignee directory record.",
          details: { reason: authPersonError.message, assigneeUserId: body.assigneeUserId },
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
          where: "documents/[docId]/tasks#POST",
          message: "Failed to resolve assignee email directory record.",
          details: { reason: emailPersonError.message, assigneeUserId: body.assigneeUserId },
          cause: emailPersonError,
        });
      }

      assigneeFields = {
        assignee_person_id: personByAuthId?.id ?? personByEmail?.id ?? null,
        assignee_name: profile.full_name ?? profile.email ?? null,
        assignee_email: profile.email ?? null,
      };
    } else if (body.assigneePersonId) {
            const { data: person, error: personError } = await serviceDb.from("people")
        .select("id, first_name, last_name, email")
        .eq("id", body.assigneePersonId)
        .in("person_type", ["employee", "user"])
        .eq("status", "active")
        .maybeSingle();

      if (personError) {
        return apiErrorResponse(personError);
      }

      if (!person) {
        throw new GuardrailError({
          code: "VALIDATION_ERROR",
          where: "documents/[docId]/tasks#POST",
          message: "Selected assignee was not found in active employees.",
          status: 400,
        });
      }

      assigneeFields = {
        assignee_person_id: person.id,
        assignee_name:
          [person.first_name, person.last_name].filter(Boolean).join(" ").trim() || null,
        assignee_email: person.email ?? null,
      };
    }

    const selectedProjectId =
      body.projectId === undefined ? source.project_id ?? null : body.projectId;

    if (selectedProjectId !== null) {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id")
        .eq("id", selectedProjectId)
        .maybeSingle();

      if (projectError) {
        return apiErrorResponse(projectError);
      }

      if (!project) {
        throw new GuardrailError({
          code: "VALIDATION_ERROR",
          where: "documents/[docId]/tasks#POST",
          message: "Selected project was not found.",
          status: 400,
          details: { projectId: selectedProjectId },
        });
      }
    }

    const sourceSystem = normalizeSourceSystem(
      body.sourceSystem ?? source.source_system ?? source.type,
    );

    const { data: task, error: insertError } = await supabase
      .from("tasks")
      .insert({
        metadata_id: source.id,
        title: normalizedTitle,
        description: normalizedDescription,
        due_date: body.dueDate || null,
        priority: body.priority,
        status: body.status,
        project_id: selectedProjectId,
        project_ids: selectedProjectId ? [selectedProjectId] : null,
        source_system: sourceSystem,
        assigned_by: user.id,
        extraction_source: "manual_thread_review",
        extraction_metadata: {
          created_from: "meeting_detail",
          source_type: source.type,
          source_system: sourceSystem,
        },
        file_name: source.file_name ?? source.title ?? null,
        ...assigneeFields,
      })
      .select("id")
      .single();

    if (insertError) {
      return apiErrorResponse(insertError);
    }

    return NextResponse.json({ success: true, taskId: task.id });
  },
);

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireCurrentUserExecutiveDetail } from "@/lib/executive/executive-visibility";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { logger } from "@/lib/logger";
import { serviceDb } from "@/lib/supabase/service-db";

/**
 * Creates a real task in the `tasks` table FROM a Daily Executive Brief item
 * (the "Create a new task" item action).
 *
 * The task is anchored to the brief item's source document (`metadataId` = a
 * `document_metadata` id), so it also shows on that source's task list. A source
 * anchor is required because `tasks.metadata_id` is NOT NULL — the menu only
 * offers "Create a new task" for items that carry a document source, so this
 * route can require it. (Blank, source-less tasks need a `metadata_id`-nullable
 * migration and are handled separately from the full Tasks page.)
 *
 * `source_system` is fixed to `daily_brief` (NOT one of the AI source systems),
 * so the tasks quality trigger only requires a non-empty title — no
 * extraction_prompt_version is needed for a human-authored task.
 */
const createBriefTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(4000),
  metadataId: z.string().uuid(),
  projectId: z.union([z.number().int().positive(), z.null()]).optional(),
  assigneePersonId: z.string().uuid().nullable().optional(),
  dueDate: z.string().trim().min(1).nullable().optional(),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  /** The brief item key this task was created from — for traceability only. */
  subjectId: z.string().trim().max(128).nullable().optional(),
});

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export const POST = withApiGuardrails(
  "api.executive.daily-brief.tasks.POST",
  async ({ request }) => {
    const { user } = await requireCurrentUserExecutiveDetail("api.executive.daily-brief.tasks.POST");

    const body = await parseJsonBody(
      request,
      createBriefTaskSchema,
      "api.executive.daily-brief.tasks.POST",
    );


    // Validate the source anchor exists so we never write a task pointing at a
    // non-existent document.
    const metadataId = body.metadataId;
    let anchorProjectId: number | null = null;
    {
      const { data: source, error } = await serviceDb.from("document_metadata")
        .select("id, project_id")
        .eq("id", metadataId)
        .maybeSingle();
      if (error) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "api.executive.daily-brief.tasks.POST",
          message: "Failed to validate the task source.",
          details: { reason: error.message },
          cause: error,
        });
      }
      if (!source) {
        throw new GuardrailError({
          code: "VALIDATION_ERROR",
          where: "api.executive.daily-brief.tasks.POST",
          message: "The source for this item could not be found.",
          status: 400,
        });
      }
      anchorProjectId = (source.project_id as number | null) ?? null;
    }

    // Resolve the assignee (a people row) → durable name/email + person id.
    let assignee: {
      assignee_person_id: string | null;
      assignee_name: string | null;
      assignee_email: string | null;
    } = { assignee_person_id: null, assignee_name: null, assignee_email: null };
    if (body.assigneePersonId) {
      const { data: person, error } = await serviceDb.from("people")
        .select("id, first_name, last_name, email")
        .eq("id", body.assigneePersonId)
        .maybeSingle();
      if (error) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "api.executive.daily-brief.tasks.POST",
          message: "Failed to resolve the selected assignee.",
          details: { reason: error.message },
          cause: error,
        });
      }
      if (!person) {
        throw new GuardrailError({
          code: "VALIDATION_ERROR",
          where: "api.executive.daily-brief.tasks.POST",
          message: "Selected assignee was not found.",
          status: 400,
        });
      }
      assignee = {
        assignee_person_id: person.id,
        assignee_name:
          [person.first_name, person.last_name].filter(Boolean).join(" ").trim() ||
          person.email ||
          null,
        assignee_email: person.email ?? null,
      };
    }

    const projectId =
      body.projectId === undefined ? anchorProjectId : body.projectId;
    if (projectId !== null && projectId !== undefined) {
      const { data: project, error } = await serviceDb.from("projects")
        .select("id")
        .eq("id", projectId)
        .maybeSingle();
      if (error) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "api.executive.daily-brief.tasks.POST",
          message: "Failed to validate the selected project.",
          details: { reason: error.message },
          cause: error,
        });
      }
      if (!project) {
        throw new GuardrailError({
          code: "VALIDATION_ERROR",
          where: "api.executive.daily-brief.tasks.POST",
          message: "Selected project was not found.",
          status: 400,
          details: { projectId },
        });
      }
    }

    const resolvedProjectId = projectId ?? null;
    const { data: task, error: insertError } = await serviceDb.from("tasks")
      .insert({
        metadata_id: metadataId,
        title: normalize(body.title),
        description: normalize(body.description),
        due_date: body.dueDate || null,
        priority: body.priority,
        status: "open",
        project_id: resolvedProjectId,
        project_ids: resolvedProjectId ? [resolvedProjectId] : null,
        source_system: "daily_brief",
        assigned_by: user.id,
        extraction_source: "daily_brief_manual",
        extraction_metadata: {
          created_from: "daily_brief",
          brief_subject_id: body.subjectId ?? null,
        },
        ...assignee,
      })
      .select("id")
      .single();

    if (insertError) {
      logger.error({
        msg: "[daily-brief.tasks] insert into tasks failed",
        data: insertError,
      });
      throw new GuardrailError({
        code: "DB_INSERT_FAILED",
        where: "api.executive.daily-brief.tasks.POST",
        message: "Failed to create the task.",
        status: 500,
      });
    }

    return NextResponse.json({ success: true, taskId: task.id });
  },
);

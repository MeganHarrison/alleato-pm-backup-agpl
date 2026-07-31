/**
 * =============================================================================
 * SCHEDULE TASK CRUD API ENDPOINTS
 * =============================================================================
 *
 * RESTful API endpoints for individual Schedule Task operations
 * Supports:
 * - Get single task with details
 * - Update task
 * - Delete task
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { SchedulingService } from "@/lib/services/scheduling-service";
import { ScheduleTaskUpdate } from "@/types/scheduling";
import { validateFieldScheduleUpdate } from "@/lib/scheduling/field-update-validation";
import type { Database } from "@/types/database.types";

// =============================================================================
// GET - Fetch Single Schedule Task
// =============================================================================

export const GET = withApiGuardrails<{ projectId: string; taskId: string }>(
  "projects/[projectId]/scheduling/tasks/[taskId]#GET",
  async ({ request, params }) => {
  
    const { projectId, taskId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/scheduling/tasks/[taskId]#GET", message: "Authentication required." });
    }

    const service = new SchedulingService(supabase);
    const task = await service.getTaskById(projectId, taskId);

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: task });
    },
);

// =============================================================================
// PUT - Update Schedule Task
// =============================================================================

export const PUT = withApiGuardrails<{ projectId: string; taskId: string }>(
  "projects/[projectId]/scheduling/tasks/[taskId]#PUT",
  async ({ request, params }) => {
  
    const { projectId, taskId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/scheduling/tasks/[taskId]#PUT", message: "Authentication required." });
    }

    const body = await request.json();

    // Validate name if provided
    if (body.name !== undefined && (typeof body.name !== "string" || body.name.trim() === "")) {
      return NextResponse.json(
        { error: "Task name cannot be empty" },
        { status: 400 }
      );
    }

    // Validate date constraints if both are provided
    if (body.start_date && body.finish_date) {
      const start = new Date(body.start_date);
      const finish = new Date(body.finish_date);
      if (start > finish) {
        return NextResponse.json(
          { error: "Start date cannot be after finish date" },
          { status: 400 }
        );
      }
    }

    // Validate milestone constraints
    if (body.is_milestone && body.duration_days && body.duration_days !== 0) {
      return NextResponse.json(
        { error: "Milestones must have zero duration" },
        { status: 400 }
      );
    }

    // Validate percent_complete if provided
    if (body.percent_complete !== undefined) {
      if (body.percent_complete < 0 || body.percent_complete > 100) {
        return NextResponse.json(
          { error: "Percent complete must be between 0 and 100" },
          { status: 400 }
        );
      }
    }

    // Build update data - only include provided fields
    const updateData: ScheduleTaskUpdate = {};

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.parent_task_id !== undefined) updateData.parent_task_id = body.parent_task_id;
    if (body.start_date !== undefined) updateData.start_date = body.start_date;
    if (body.finish_date !== undefined) updateData.finish_date = body.finish_date;
    if (body.duration_days !== undefined) updateData.duration_days = body.duration_days;
    if (body.percent_complete !== undefined) updateData.percent_complete = body.percent_complete;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.is_milestone !== undefined) updateData.is_milestone = body.is_milestone;
    if (body.constraint_type !== undefined) updateData.constraint_type = body.constraint_type;
    if (body.constraint_date !== undefined) updateData.constraint_date = body.constraint_date;
    if (body.wbs_code !== undefined) updateData.wbs_code = body.wbs_code;
    if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;
    if (body.assignee_person_id !== undefined) {
      if (body.assignee_person_id !== null && (typeof body.assignee_person_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.assignee_person_id))) {
        return NextResponse.json({ error: "Assignee must be a valid person ID." }, { status: 400 });
      }
      if (body.assignee_person_id) {
        const { data: membership, error: membershipError } = await supabase
          .from("project_directory_memberships")
          .select("person_id")
          .eq("project_id", Number(projectId))
          .eq("person_id", body.assignee_person_id)
          .eq("status", "active")
          .maybeSingle();
        if (membershipError) return NextResponse.json({ error: `Unable to validate assignee: ${membershipError.message}` }, { status: 400 });
        if (!membership) return NextResponse.json({ error: "Assignee must be an active member of this project." }, { status: 422 });
      }
      updateData.assignee_person_id = body.assignee_person_id;
    }

    const service = new SchedulingService(supabase);
    const task = await service.updateTask(projectId, taskId, updateData);

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: task });
    },
);

// =============================================================================
// PATCH - Single-field task updates (deadline, field crew updates)
// =============================================================================
//
// Consolidates what used to be separate deadline/route.ts and
// field-update/route.ts files into this file's existing dynamic route
// boundary — see docs/architecture (Vercel route budget) for why.

export const PATCH = withApiGuardrails<{ projectId: string; taskId: string }>(
  "projects/[projectId]/scheduling/tasks/[taskId]#PATCH",
  async ({ request, params }) => {
    const { projectId, taskId } = await params;
    const where = "projects/[projectId]/scheduling/tasks/[taskId]#PATCH";

    if (!(await getApiRouteUser())) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where, message: "Authentication required." });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw new GuardrailError({ code: "INVALID_PAYLOAD", where, message: "Provide an intent and its fields." });
    }
    const { intent } = body as { intent?: unknown };

    if (intent === "deadline") {
      const { deadline_date: deadlineDate } = body as { deadline_date?: unknown };
      const service = new SchedulingService(await createClient());
      if (!(await service.getTaskById(projectId, taskId))) {
        throw new GuardrailError({ code: "NOT_FOUND", where, message: "Task not found." });
      }
      if (deadlineDate === null || deadlineDate === undefined) {
        await service.removeDeadline(projectId, taskId);
        return NextResponse.json({ message: "Deadline removed." });
      }
      if (typeof deadlineDate !== "string" || Number.isNaN(new Date(deadlineDate).getTime())) {
        throw new GuardrailError({ code: "INVALID_PAYLOAD", where, message: "Deadline must be a valid date." });
      }
      return NextResponse.json({ data: await service.setDeadline(projectId, { task_id: taskId, deadline_date: deadlineDate }) });
    }

    if (intent === "field_update") {
      const parsed = validateFieldScheduleUpdate(body);
      if (!parsed.value) {
        throw new GuardrailError({ code: "INVALID_PAYLOAD", where, message: parsed.error });
      }
      const value = parsed.value;
      const supabase = await createClient();
      const args = {
        p_project_id: Number(projectId), p_task_id: taskId,
        p_actual_start_date: value.actual_start_date ?? null, p_actual_finish_date: value.actual_finish_date ?? null,
        p_forecast_start_date: value.forecast_start_date ?? null, p_forecast_finish_date: value.forecast_finish_date ?? null,
        p_remaining_duration_days: value.remaining_duration_days ?? null, p_delay_reason: value.delay_reason ?? null,
        p_note: value.note ?? null, p_attachment_urls: value.attachment_urls ?? [],
      } as Database["public"]["Functions"]["apply_schedule_field_update"]["Args"];
      const { data, error } = await supabase.rpc("apply_schedule_field_update", args);
      if (error) {
        throw new GuardrailError({
          code: error.code === "42501" ? "AUTH_FORBIDDEN" : "INVALID_PAYLOAD",
          where,
          message: error.message,
        });
      }
      return NextResponse.json({ data });
    }

    throw new GuardrailError({ code: "INVALID_PAYLOAD", where, message: 'intent must be "deadline" or "field_update".' });
  },
);

// =============================================================================
// DELETE - Delete Schedule Task
// =============================================================================

export const DELETE = withApiGuardrails<{ projectId: string; taskId: string }>(
  "projects/[projectId]/scheduling/tasks/[taskId]#DELETE",
  async ({ request, params }) => {
  
    const { projectId, taskId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/scheduling/tasks/[taskId]#DELETE", message: "Authentication required." });
    }

    const service = new SchedulingService(supabase);
    const deleted = await service.deleteTask(projectId, taskId);

    if (!deleted) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Task deleted successfully",
      id: taskId,
    });
    },
);

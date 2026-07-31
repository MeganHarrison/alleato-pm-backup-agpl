/**
 * =============================================================================
 * SCHEDULING TASKS API ENDPOINTS
 * =============================================================================
 *
 * RESTful API endpoints for Schedule Tasks operations
 * Supports:
 * - List tasks with filtering, pagination, sorting
 * - Create new tasks
 * - Get task hierarchy
 * - Get Gantt chart data
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions-guard";
import { createClient } from "@/lib/supabase/server";
import {
  isAuthError,
  verifyProjectAccess,
} from "@/lib/supabase/auth-guard";
import { SchedulingService } from "@/lib/services/scheduling-service";
import { ScheduleTaskListParams, ScheduleTaskCreate } from "@/types/scheduling";
import { apiErrorResponse } from "@/lib/api-error";
import { validateScheduleTaskCreateInput } from "@/lib/scheduling/task-validation";

const POSTGRES_INT4_MAX = 2_147_483_647;

function parseSchedulingProjectId(projectId: string, where: string): number {
  if (!/^[1-9]\d*$/.test(projectId)) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where,
      message: "A valid project id is required.",
    });
  }

  const numericProjectId = Number(projectId);
  if (
    !Number.isSafeInteger(numericProjectId) ||
    numericProjectId > POSTGRES_INT4_MAX
  ) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where,
      message: "A valid project id is required.",
    });
  }

  return numericProjectId;
}

// =============================================================================
// GET - Fetch Schedule Tasks
// =============================================================================

export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/scheduling/tasks#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const numericProjectId = Number(projectId);
    if (!Number.isInteger(numericProjectId) || numericProjectId <= 0) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "projects/[projectId]/scheduling/tasks#GET",
        message: "A valid project id is required.",
      });
    }

    // Schedule reads use the service client only after the canonical project
    // membership guard authorizes the cookie identity. This avoids coupling
    // production reads to PostgREST's ability to verify the browser JWT while
    // preserving the project-access boundary before any RLS-bypassing query.
    const access = await verifyProjectAccess(numericProjectId);
    if (isAuthError(access)) return access;

    const { searchParams } = new URL(request.url);
    const service = new SchedulingService(access.serviceClient);

    // Handle different view modes
    const view = searchParams.get("view");

    if (view === "hierarchy") {
      const hierarchy = await service.getTasksHierarchy(projectId);
      return NextResponse.json({ data: hierarchy });
    }

    if (view === "gantt") {
      const ganttData = await service.getGanttData(projectId);
      return NextResponse.json({ data: ganttData });
    }

    if (view === "summary") {
      const summary = await service.getSummary(projectId);
      return NextResponse.json({ data: summary });
    }

    // Parse query parameters for list view
    const listParams: ScheduleTaskListParams = {
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "50"),
      sort: (searchParams.get("sort") as ScheduleTaskListParams["sort"]) || "sort_order",
      order: (searchParams.get("order") as "asc" | "desc") || "asc",
      status: searchParams.get("status") as ScheduleTaskListParams["status"],
      is_milestone: searchParams.get("is_milestone") === "true" ? true : undefined,
      search: searchParams.get("search") || undefined,
    };

    // Handle parent_task_id (can be null for root tasks)
    const parentTaskId = searchParams.get("parent_task_id");
    if (parentTaskId === "null") {
      listParams.parent_task_id = null;
    } else if (parentTaskId) {
      listParams.parent_task_id = parentTaskId;
    }

    const result = await service.listTasks(projectId, listParams);

    // Include summary if requested
    const includeSummary = searchParams.get("include_summary") === "true";
    if (includeSummary) {
      const summary = await service.getSummary(projectId);
      return NextResponse.json({
        ...result,
        summary,
      });
    }

    return NextResponse.json(result);
    },
);

// =============================================================================
// POST - Create New Schedule Task
// =============================================================================

export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/scheduling/tasks#POST",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const numericProjectId = parseSchedulingProjectId(
      projectId,
      "projects/[projectId]/scheduling/tasks#POST",
    );
    const permission = await requirePermission(
      numericProjectId,
      "schedule",
      "write",
    );
    if (permission.denied) return permission.response;

    const body = await request.json();

    const validationErrors = validateScheduleTaskCreateInput(body);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: validationErrors[0].error,
          details: validationErrors,
        },
        { status: 400 },
      );
    }

    const taskData: ScheduleTaskCreate = {
      project_id: numericProjectId,
      name: body.name.trim(),
      parent_task_id: body.parent_task_id || null,
      start_date: body.start_date || null,
      finish_date: body.finish_date || null,
      duration_days: body.duration_days ?? null,
      percent_complete: body.percent_complete ?? 0,
      status: body.status || "not_started",
      is_milestone: body.is_milestone || false,
      constraint_type: body.constraint_type || null,
      constraint_date: body.constraint_date || null,
      wbs_code: body.wbs_code || null,
      sort_order: body.sort_order,
    };

    const supabase = await createClient();
    const service = new SchedulingService(supabase);
    const task = await service.createTask(projectId, taskData);

    return NextResponse.json(task, { status: 201 });
    },
);

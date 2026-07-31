/**
 * =============================================================================
 * SCHEDULE TASK BULK OPERATIONS API
 * =============================================================================
 *
 * API endpoints for bulk operations on Schedule Tasks
 * Supports:
 * - Bulk update (status, dates, progress, milestone conversion)
 * - Bulk delete
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { SchedulingService } from "@/lib/services/scheduling-service";
import { TaskStatus } from "@/types/scheduling";

// =============================================================================
// POST - Bulk Update Tasks
// =============================================================================

interface BulkUpdateRequest {
  task_ids: string[];
  updates: {
    status?: TaskStatus;
    shift_days?: number;
    percent_complete?: number;
    is_milestone?: boolean;
    parent_task_id?: string | null;
  };
}

export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/scheduling/tasks/bulk#POST",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/scheduling/tasks/bulk#POST", message: "Authentication required." });
    }

    const body: BulkUpdateRequest = await request.json();

    // Validate request
    if (!body.task_ids || !Array.isArray(body.task_ids) || body.task_ids.length === 0) {
      return NextResponse.json(
        { error: "task_ids must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!body.updates || Object.keys(body.updates).length === 0) {
      return NextResponse.json(
        { error: "updates must contain at least one field to update" },
        { status: 400 }
      );
    }

    // Validate individual fields
    const { status, shift_days, percent_complete, is_milestone, parent_task_id } = body.updates;

    if (status && !["not_started", "in_progress", "complete"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 }
      );
    }

    if (percent_complete !== undefined && (percent_complete < 0 || percent_complete > 100)) {
      return NextResponse.json(
        { error: "percent_complete must be between 0 and 100" },
        { status: 400 }
      );
    }

    const service = new SchedulingService(supabase);
    const results = {
      updated: 0,
      failed: 0,
      errors: [] as Array<{ taskId: string; error: string }>,
    };

    // Process each task
    for (const taskId of body.task_ids) {
      try {
        // Get current task data for date shifting
        const taskUpdates: Record<string, unknown> = {};

        if (status) {
          taskUpdates.status = status;
        }

        if (percent_complete !== undefined) {
          taskUpdates.percent_complete = percent_complete;
        }

        if (is_milestone !== undefined) {
          taskUpdates.is_milestone = is_milestone;
          // If converting to milestone, set duration to 0
          if (is_milestone) {
            taskUpdates.duration_days = 0;
          }
        }

        if (parent_task_id !== undefined) {
          taskUpdates.parent_task_id = parent_task_id;
        }

        // Handle date shifting
        if (shift_days && shift_days !== 0) {
          // Get current task to shift dates
          const currentTask = await service.getTaskById(projectId, taskId);
          if (currentTask) {
            if (currentTask.start_date) {
              const startDate = new Date(currentTask.start_date);
              startDate.setDate(startDate.getDate() + shift_days);
              taskUpdates.start_date = startDate.toISOString().split("T")[0];
            }
            if (currentTask.finish_date) {
              const finishDate = new Date(currentTask.finish_date);
              finishDate.setDate(finishDate.getDate() + shift_days);
              taskUpdates.finish_date = finishDate.toISOString().split("T")[0];
            }
          }
        }

        // Apply updates
        if (Object.keys(taskUpdates).length > 0) {
          await service.updateTask(projectId, taskId, taskUpdates);
          results.updated++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          taskId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      message: `Bulk update completed: ${results.updated} updated, ${results.failed} failed`,
      ...results,
    });
    },
);

// =============================================================================
// DELETE - Bulk Delete Tasks
// =============================================================================

export const DELETE = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/scheduling/tasks/bulk#DELETE",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/scheduling/tasks/bulk#DELETE", message: "Authentication required." });
    }

    const body = await request.json();

    // Validate request
    if (!body.task_ids || !Array.isArray(body.task_ids) || body.task_ids.length === 0) {
      return NextResponse.json(
        { error: "task_ids must be a non-empty array" },
        { status: 400 }
      );
    }

    const service = new SchedulingService(supabase);
    const results = {
      deleted: 0,
      failed: 0,
      errors: [] as Array<{ taskId: string; error: string }>,
    };

    // Delete tasks in reverse order to handle parent-child relationships
    // (children should be deleted before parents)
    // For simplicity, we attempt to delete all and track failures
    for (const taskId of body.task_ids) {
      try {
        const deleted = await service.deleteTask(projectId, taskId);
        if (deleted) {
          results.deleted++;
        } else {
          results.failed++;
          results.errors.push({
            taskId,
            error: "Task not found",
          });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          taskId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      message: `Bulk delete completed: ${results.deleted} deleted, ${results.failed} failed`,
      ...results,
    });
    },
);

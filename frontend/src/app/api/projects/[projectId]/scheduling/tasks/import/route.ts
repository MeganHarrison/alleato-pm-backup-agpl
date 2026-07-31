/**
 * =============================================================================
 * SCHEDULE TASK IMPORT API
 * =============================================================================
 *
 * A replacement import must be all-or-nothing. The graph is validated in this
 * route for a useful client error, then the database RPC repeats the critical
 * checks and performs delete + task + dependency writes in one transaction.
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  type ScheduleImportTask,
  validateScheduleImportGraph,
} from "@/lib/scheduling/schedule-import-preview";
import { validateScheduleTaskCreateInput } from "@/lib/scheduling/task-validation";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";
import { NextResponse } from "next/server";

type ImportTaskData = Partial<ScheduleImportTask> & { name?: string };

interface ImportRequest {
  tasks: ImportTaskData[];
  replaceExisting?: boolean;
}

export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/scheduling/tasks/import#POST",
  async ({ request, params }) => {
    const { projectId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/scheduling/tasks/import#POST",
        message: "Authentication required.",
      });
    }

    const body: ImportRequest = await request.json();
    if (!Array.isArray(body.tasks) || body.tasks.length === 0) {
      return NextResponse.json({ error: "tasks must be a non-empty array" }, { status: 400 });
    }

    const validationErrors: Array<{ index: number; field: string; error: string }> = [];
    body.tasks.forEach((task, index) => {
      validateScheduleTaskCreateInput(task).forEach((error) => validationErrors.push({ index, ...error }));
    });
    if (validationErrors.length > 0) {
      return NextResponse.json({ error: "Validation failed", details: validationErrors }, { status: 400 });
    }

    let importGraph;
    try {
      importGraph = validateScheduleImportGraph(body.tasks as ScheduleImportTask[]);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "The imported schedule graph is invalid." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase.rpc("replace_schedule_import_atomic", {
      p_project_id: Number(projectId),
      p_tasks: importGraph.tasks as unknown as Json,
      p_dependencies: importGraph.dependencies as unknown as Json,
      p_replace_existing: body.replaceExisting === true,
    });

    if (error) {
      return NextResponse.json(
        { error: `Schedule import was not applied: ${error.message}` },
        { status: 422 },
      );
    }

    const result = data?.[0];
    if (!result) {
      throw new Error("Schedule import transaction completed without a result.");
    }

    return NextResponse.json({
      message: `Import completed: ${result.imported} imported, 0 failed`,
      imported: result.imported,
      deletedExisting: result.deleted_existing,
      dependenciesImported: result.dependencies_imported,
      failed: 0,
      errors: [],
    });
  },
);

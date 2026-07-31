import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

type RelatedActionItemRow = {
  id: string;
  title: string | null;
  description: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  assignee_name: string | null;
  assignee_email: string | null;
  project_id: number | null;
  schedule_task_id: string;
  created_at: string;
};

export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/scheduling/related-action-items#GET",
  async ({ params }) => {
    const { projectId } = await params;
    const parsedProjectId = Number(projectId);
    if (!Number.isInteger(parsedProjectId) || parsedProjectId <= 0) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "projects/[projectId]/scheduling/related-action-items#GET",
        message: "Project ID must be a positive integer.",
        details: { projectId },
      });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/scheduling/related-action-items#GET",
        message: "Authentication required.",
      });
    }

    const { data: scheduleTasks, error: scheduleTasksError } = await supabase
      .from("schedule_tasks")
      .select("id")
      .eq("project_id", parsedProjectId);

    if (scheduleTasksError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/scheduling/related-action-items#GET",
        message: "Failed to load schedule tasks for related action items.",
        details: { reason: scheduleTasksError.message },
        cause: scheduleTasksError,
      });
    }

    const scheduleTaskIds = (scheduleTasks ?? []).map((task) => task.id).filter(Boolean);
    if (scheduleTaskIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const { data, error } = await supabase
      .from("tasks")
      .select(
        "id,title,description,status,priority,due_date,assignee_name,assignee_email,project_id,schedule_task_id,created_at",
      )
      .in("schedule_task_id", scheduleTaskIds)
      .order("created_at", { ascending: false });

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/scheduling/related-action-items#GET",
        message: "Failed to load related action items.",
        details: { reason: error.message },
        cause: error,
      });
    }

    const items = ((data ?? []) as RelatedActionItemRow[]).filter(
      (item): item is RelatedActionItemRow => Boolean(item.schedule_task_id),
    );

    return NextResponse.json({ data: items });
  },
);

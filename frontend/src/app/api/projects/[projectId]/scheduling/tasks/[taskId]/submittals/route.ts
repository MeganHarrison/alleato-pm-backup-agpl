import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { evaluateLinkedSubmittalRisk } from "@/lib/scheduling/submittal-risk";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Database } from "@/types/database.types";

const linkSchema = z.object({ submittal_id: z.string().uuid() });

export const GET = withApiGuardrails<{ projectId: string; taskId: string }>(
  "projects/[projectId]/scheduling/tasks/[taskId]/submittals#GET",
  async ({ params }) => {
    const { projectId, taskId } = await params;
    if (!await getApiRouteUser()) throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/scheduling/tasks/[taskId]/submittals#GET", message: "Authentication required." });
    const supabase = await createClient();
    const db = supabase as any;
    const { data: task, error: taskError } = await db
      .from("schedule_tasks")
      .select("id, name, start_date")
      .eq("id", taskId)
      .eq("project_id", Number(projectId))
      .single();
    if (taskError || !task) return NextResponse.json({ error: "Schedule task not found in this project." }, { status: 404 });
    const { data: links, error } = await db
      .from("schedule_task_submittal_links")
      .select("submittal_id, submittals(id, submittal_number, title, required_approval_date, status, submittal_responses(response_status))")
      .eq("task_id", taskId)
      .eq("project_id", Number(projectId));
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const linkedSubmittals = (links ?? []).map((link: any) => ({
      id: link.submittals.id,
      number: link.submittals.submittal_number,
      title: link.submittals.title,
      required_approval_date: link.submittals.required_approval_date,
      status: link.submittals.status,
      responses: (link.submittals.submittal_responses ?? []).map((response: { response_status: string }) => response.response_status),
    }));
    const { data: dependentTasks, error: dependencyError } = await db
      .from("schedule_dependencies")
      .select("schedule_tasks!inner(name, project_id)")
      .eq("predecessor_task_id", taskId)
      .eq("schedule_tasks.project_id", Number(projectId));
    if (dependencyError) return NextResponse.json({ error: dependencyError.message }, { status: 400 });
    const dependency_context = (dependentTasks ?? []).map((row: any) => row.schedule_tasks?.name).filter(Boolean);
    return NextResponse.json({ data: linkedSubmittals, risk: evaluateLinkedSubmittalRisk({ task, linkedSubmittals, dependentTaskNames: dependency_context }) });
  },
);

export const POST = withApiGuardrails<{ projectId: string; taskId: string }>(
  "projects/[projectId]/scheduling/tasks/[taskId]/submittals#POST",
  async ({ request, params }) => {
    const { projectId, taskId } = await params;
    if (!await getApiRouteUser()) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/scheduling/tasks/[taskId]/submittals#POST",
        message: "Authentication required.",
      });
    }
    const parsed = linkSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "submittal_id must be a valid identifier." }, { status: 400 });
    }
    const supabase = await createClient();
    const rpc = supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
    const { data, error } = await rpc.call(supabase, "link_schedule_task_submittal", {
      p_project_id: Number(projectId),
      p_task_id: taskId,
      p_submittal_id: parsed.data.submittal_id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : 400 });
    return NextResponse.json({ data }, { status: 201 });
  },
);

const uuid = z.string().uuid();

export const DELETE = withApiGuardrails<{ projectId: string; taskId: string }>(
  "projects/[projectId]/scheduling/tasks/[taskId]/submittals#DELETE",
  async ({ request, params }) => {
    const { projectId, taskId } = await params;
    if (!await getApiRouteUser()) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/scheduling/tasks/[taskId]/submittals#DELETE",
        message: "Authentication required.",
      });
    }
    const submittalId = request.nextUrl.searchParams.get("submittalId");
    if (!submittalId || !uuid.safeParse(submittalId).success) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/scheduling/tasks/[taskId]/submittals#DELETE",
        message: "submittalId must be a valid identifier.",
      });
    }
    const supabase = await createClient();
    const args: Database["public"]["Functions"]["unlink_schedule_task_submittal"]["Args"] = {
      p_project_id: Number(projectId),
      p_task_id: taskId,
      p_submittal_id: submittalId,
    };
    const { error } = await supabase.rpc("unlink_schedule_task_submittal", args);
    if (error) {
      throw new GuardrailError({
        code: error.code === "42501" ? "AUTH_FORBIDDEN" : "NOT_FOUND",
        where: "projects/[projectId]/scheduling/tasks/[taskId]/submittals#DELETE",
        message: error.message,
      });
    }
    return new NextResponse(null, { status: 204 });
  },
);

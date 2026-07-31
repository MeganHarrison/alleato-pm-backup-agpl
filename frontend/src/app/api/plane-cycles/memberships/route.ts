import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { apiErrorResponse } from "@/lib/api-error";
import { asPlaneCyclesDb } from "@/features/plane-cycles-domain/server-db";
import {
  resolveCycleTaskProject,
  type CycleTaskProjectAssociation,
} from "@/features/plane-cycles-domain/task-project";
import { authorizePlaneCycles } from "../access";
import {
  MembershipBodySchema,
  MembershipQuerySchema,
} from "../contracts";

function invalidMembership(where: string, details: unknown) {
  return new GuardrailError({
    code: "VALIDATION_ERROR",
    where,
    message: "Invalid cycle task membership request.",
    status: 400,
    details,
  });
}

type AuthorizedPlaneCycles = Exclude<
  Awaited<ReturnType<typeof authorizePlaneCycles>>,
  NextResponse
>;

async function findCycle(
  serviceClient: AuthorizedPlaneCycles["serviceClient"],
  projectId: number,
  cycleId: string,
) {
  return asPlaneCyclesDb(serviceClient)
    .from("project_cycles")
    .select("id")
    .eq("id", cycleId)
    .eq("project_id", projectId)
    .maybeSingle();
}

async function loadMemberships(
  serviceClient: AuthorizedPlaneCycles["serviceClient"],
  projectId: number,
  cycleId: string,
) {
  const db = asPlaneCyclesDb(serviceClient);
  const { data: rows, error } = await db
    .from("cycle_task_memberships")
    .select("*")
    .eq("project_id", projectId)
    .eq("cycle_id", cycleId)
    .order("created_at");
  if (error) return { error };

  const taskIds = (rows ?? []).map((row) => row.task_id);
  if (taskIds.length === 0) return { data: [] };

  const { data: tasks, error: taskError } = await serviceClient
    .from("tasks")
    .select(
      "id, title, description, status, priority, due_date, project_id, project_ids",
    )
    .in("id", taskIds);
  if (taskError) return { error: taskError };

  const tasksById = new Map((tasks ?? []).map((task) => [task.id, task]));
  return {
    data: (rows ?? []).map((row) => ({
      ...row,
      task: tasksById.get(row.task_id) ?? null,
    })),
  };
}

export const GET = withApiGuardrails(
  "plane-cycles/memberships#GET",
  async ({ request }) => {
    const query = MembershipQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!query.success) {
      throw invalidMembership(
        "plane-cycles/memberships#GET",
        query.error.flatten(),
      );
    }

    const authorization = await authorizePlaneCycles(
      query.data.projectId,
      "read",
    );
    if (authorization instanceof NextResponse) return authorization;

    const { data: cycle, error: cycleError } = await findCycle(
      authorization.serviceClient,
      query.data.projectId,
      query.data.cycleId,
    );
    if (cycleError) return apiErrorResponse(cycleError);
    if (!cycle) {
      return NextResponse.json({ error: "Cycle not found." }, { status: 404 });
    }

    const result = await loadMemberships(
      authorization.serviceClient,
      query.data.projectId,
      query.data.cycleId,
    );
    if (result.error) return apiErrorResponse(result.error);
    return NextResponse.json({ memberships: result.data });
  },
);

export const POST = withApiGuardrails(
  "plane-cycles/memberships#POST",
  async ({ request }) => {
    const parsed = MembershipBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      throw invalidMembership(
        "plane-cycles/memberships#POST",
        parsed.error.flatten(),
      );
    }

    const authorization = await authorizePlaneCycles(
      parsed.data.project_id,
      "write",
    );
    if (authorization instanceof NextResponse) return authorization;

    const db = asPlaneCyclesDb(authorization.serviceClient);
    const { data: cycle, error: cycleError } = await findCycle(
      authorization.serviceClient,
      parsed.data.project_id,
      parsed.data.cycle_id,
    );
    if (cycleError) return apiErrorResponse(cycleError);
    if (!cycle) {
      return NextResponse.json({ error: "Cycle not found." }, { status: 404 });
    }

    const { data: tasks, error: taskError } = await authorization.serviceClient
      .from("tasks")
      .select(
        `
          id,
          project_id,
          project_ids,
          document_metadata:tasks_metadata_id_fkey (project_id)
        `,
      )
      .in("id", parsed.data.task_ids);
    if (taskError) return apiErrorResponse(taskError);
    if ((tasks ?? []).length !== parsed.data.task_ids.length) {
      return NextResponse.json(
        { error: "One or more tasks were not found." },
        { status: 404 },
      );
    }

    for (const task of tasks ?? []) {
      const resolution = resolveCycleTaskProject(
        task as CycleTaskProjectAssociation,
      );
      if (
        resolution.status !== "resolved" ||
        resolution.projectId !== parsed.data.project_id
      ) {
        return NextResponse.json(
          {
            error:
              resolution.status === "invalid"
                ? resolution.reason
                : "Task belongs to a different project.",
          },
          { status: 409 },
        );
      }
    }

    const { error } = await db.rpc("set_cycle_task_memberships", {
      p_project_id: parsed.data.project_id,
      p_cycle_id: parsed.data.cycle_id,
      p_task_ids: parsed.data.task_ids,
      p_created_by: authorization.user.id,
    });
    if (error) return apiErrorResponse(error);

    const result = await loadMemberships(
      authorization.serviceClient,
      parsed.data.project_id,
      parsed.data.cycle_id,
    );
    if (result.error) return apiErrorResponse(result.error);
    return NextResponse.json({ memberships: result.data }, { status: 201 });
  },
);

export const DELETE = withApiGuardrails(
  "plane-cycles/memberships#DELETE",
  async ({ request }) => {
    const parsed = MembershipBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      throw invalidMembership(
        "plane-cycles/memberships#DELETE",
        parsed.error.flatten(),
      );
    }

    const authorization = await authorizePlaneCycles(
      parsed.data.project_id,
      "write",
    );
    if (authorization instanceof NextResponse) return authorization;

    const { data: cycle, error: cycleError } = await findCycle(
      authorization.serviceClient,
      parsed.data.project_id,
      parsed.data.cycle_id,
    );
    if (cycleError) return apiErrorResponse(cycleError);
    if (!cycle) {
      return NextResponse.json({ error: "Cycle not found." }, { status: 404 });
    }

    const db = asPlaneCyclesDb(authorization.serviceClient);
    const { data, error } = await db
      .from("cycle_task_memberships")
      .delete()
      .eq("project_id", parsed.data.project_id)
      .eq("cycle_id", parsed.data.cycle_id)
      .in("task_id", parsed.data.task_ids)
      .select("id");
    if (error) return apiErrorResponse(error);

    return NextResponse.json({ removed: data?.length ?? 0 });
  },
);

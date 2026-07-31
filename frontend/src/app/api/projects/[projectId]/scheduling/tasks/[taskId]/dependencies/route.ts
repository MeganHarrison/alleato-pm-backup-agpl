import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { SchedulingService } from "@/lib/services/scheduling-service";
import type { DependencyType } from "@/types/scheduling";

const dependencyTypes: DependencyType[] = ["finish_to_start", "start_to_start", "finish_to_finish", "start_to_finish"];
const leadLagError = "Lead or lag must be a whole number from -365 to 365 working days.";

function isInvalidLeadOrLag(value: unknown) {
  return !Number.isInteger(value) || Number(value) < -365 || Number(value) > 365;
}

function validationErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to save this dependency.";
  if (message.includes("conflicts with") && message.includes("constraint")) {
    throw new GuardrailError({
      code: "PRECONDITION_FAILED",
      where: "projects/[projectId]/scheduling/tasks/[taskId]/dependencies",
      message,
      status: 409,
      cause: error,
    });
  }
  if (
    message.includes("belong to this project") ||
    message.includes("cannot depend on itself") ||
    message.includes("circular dependency") ||
    message.includes("Dependency not found for this schedule task")
  ) {
    return NextResponse.json({ error: message }, { status: message.includes("not found") ? 404 : 400 });
  }
  throw error;
}

async function createMutationService(actorUserId: string) {
  return new SchedulingService(await createClient(), {
    actorUserId,
    mutationClient: createServiceClient(),
  });
}

export const POST = withApiGuardrails<{ projectId: string; taskId: string }>(
  "projects/[projectId]/scheduling/tasks/[taskId]/dependencies#POST",
  async ({ request, params }) => {
    const { projectId, taskId } = await params;
    const user = await getApiRouteUser();
    if (!user) throw new GuardrailError({ code: "AUTH_EXPIRED", where: "schedule dependency create", message: "Authentication required." });
    const body = await request.json();
    if (typeof body.predecessor_task_id !== "string" || !body.predecessor_task_id) {
      return NextResponse.json({ error: "Select a predecessor task before saving this dependency." }, { status: 400 });
    }
    if (body.predecessor_task_id === taskId) {
      return NextResponse.json({ error: "A task cannot depend on itself. Select another predecessor." }, { status: 400 });
    }
    if (body.dependency_type && !dependencyTypes.includes(body.dependency_type)) {
      return NextResponse.json({ error: "Dependency type must be Finish-to-Start, Start-to-Start, Finish-to-Finish, or Start-to-Finish." }, { status: 400 });
    }
    if (body.lag_days !== undefined && isInvalidLeadOrLag(body.lag_days)) {
      throw new GuardrailError({
        code: "VALIDATION",
        where: "projects/[projectId]/scheduling/tasks/[taskId]/dependencies#POST",
        message: leadLagError,
      });
    }
    const service = await createMutationService(user.id);
    try {
      const dependency = await service.createDependency(projectId, {
        task_id: taskId,
        predecessor_task_id: body.predecessor_task_id,
        dependency_type: body.dependency_type,
        lag_days: body.lag_days,
      });
      return NextResponse.json({ data: dependency }, { status: 201 });
    } catch (error) {
      return validationErrorResponse(error);
    }
  },
);

export const DELETE = withApiGuardrails<{ projectId: string; taskId: string }>(
  "projects/[projectId]/scheduling/tasks/[taskId]/dependencies#DELETE",
  async ({ request, params }) => {
    const { projectId, taskId } = await params;
    const user = await getApiRouteUser();
    if (!user) throw new GuardrailError({ code: "AUTH_EXPIRED", where: "schedule dependency delete", message: "Authentication required." });
    const dependencyId = new URL(request.url).searchParams.get("dependencyId");
    if (!dependencyId) return NextResponse.json({ error: "A dependency ID is required." }, { status: 400 });
    const service = await createMutationService(user.id);
    const dependency = (await service.getDependencies(projectId)).find((item) => item.id === dependencyId && item.task_id === taskId);
    if (!dependency) return NextResponse.json({ error: "Dependency not found for this schedule task." }, { status: 404 });
    await service.deleteDependency(projectId, taskId, dependencyId);
    return NextResponse.json({ message: "Dependency removed." });
  },
);

export const PATCH = withApiGuardrails<{ projectId: string; taskId: string }>(
  "projects/[projectId]/scheduling/tasks/[taskId]/dependencies#PATCH",
  async ({ request, params }) => {
    const { projectId, taskId } = await params;
    const user = await getApiRouteUser();
    if (!user) throw new GuardrailError({ code: "AUTH_EXPIRED", where: "schedule dependency update", message: "Authentication required." });
    const dependencyId = new URL(request.url).searchParams.get("dependencyId");
    if (!dependencyId) return NextResponse.json({ error: "A dependency ID is required." }, { status: 400 });
    const body = await request.json();
    if (body.predecessor_task_id === undefined && body.dependency_type === undefined && body.lag_days === undefined) {
      return NextResponse.json({ error: "Provide a predecessor, relationship type, or lag days to update this dependency." }, { status: 400 });
    }
    if (body.predecessor_task_id !== undefined && (typeof body.predecessor_task_id !== "string" || !body.predecessor_task_id)) {
      return NextResponse.json({ error: "Select a predecessor task before saving this dependency." }, { status: 400 });
    }
    if (body.predecessor_task_id === taskId) {
      return NextResponse.json({ error: "A task cannot depend on itself. Select another predecessor." }, { status: 400 });
    }
    if (body.dependency_type !== undefined && !dependencyTypes.includes(body.dependency_type)) {
      return NextResponse.json({ error: "Dependency type must be Finish-to-Start, Start-to-Start, Finish-to-Finish, or Start-to-Finish." }, { status: 400 });
    }
    if (body.lag_days !== undefined && isInvalidLeadOrLag(body.lag_days)) {
      throw new GuardrailError({
        code: "VALIDATION",
        where: "projects/[projectId]/scheduling/tasks/[taskId]/dependencies#PATCH",
        message: leadLagError,
      });
    }
    const service = await createMutationService(user.id);
    try {
      const dependency = await service.updateDependency(projectId, taskId, dependencyId, body);
      return NextResponse.json({ data: dependency });
    } catch (error) {
      return validationErrorResponse(error);
    }
  },
);

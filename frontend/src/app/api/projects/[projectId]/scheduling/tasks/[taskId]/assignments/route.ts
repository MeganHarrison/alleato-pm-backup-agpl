import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  ScheduleResourceService,
  ScheduleResourceServiceError,
} from "@/lib/services/schedule-resource-service";
import {
  throwScheduleDatabaseError,
  throwScheduleRequestError,
  throwScheduleRpcError,
} from "@/lib/scheduling/schedule-route-errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const routeParamsSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  taskId: z.string().uuid(),
});
const assignmentSchema = z.object({
  person_id: z.string().uuid(),
  allocation_percent: z.number().int().min(1).max(100),
}).strict();
const replaceSchema = z.object({
  assignments: z.array(assignmentSchema).max(100),
}).strict().superRefine((value, context) => {
  const seen = new Set<string>();
  value.assignments.forEach((assignment, index) => {
    if (seen.has(assignment.person_id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A person can be assigned to a task only once.",
        path: ["assignments", index, "person_id"],
      });
    }
    seen.add(assignment.person_id);
  });
});

const GET_WHERE = "projects/[projectId]/scheduling/tasks/[taskId]/assignments#GET";
const PUT_WHERE = "projects/[projectId]/scheduling/tasks/[taskId]/assignments#PUT";

function rethrowServiceError(where: string, error: ScheduleResourceServiceError): never {
  if (error.operation === "rpc" && error.databaseError) throwScheduleRpcError(where, error.databaseError);
  if (error.databaseError) throwScheduleDatabaseError(where, error.databaseError);
  throwScheduleRequestError(where, error.message, { code: "PRECONDITION_FAILED", status: 409, cause: error });
}

export const GET = withApiGuardrails<{ projectId: string; taskId: string }>(
  GET_WHERE,
  async ({ params }) => {
    if (!await getApiRouteUser()) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: GET_WHERE, message: "Authentication required." });
    }
    const parsedParams = routeParamsSchema.safeParse(await params);
    if (!parsedParams.success) {
      throwScheduleRequestError(GET_WHERE, "Select a valid project task before loading resource assignments.");
    }
    try {
      const service = new ScheduleResourceService(await createClient());
      const data = await service.getTaskAssignments(parsedParams.data.projectId, parsedParams.data.taskId);
      return NextResponse.json({ data });
    } catch (error) {
      if (error instanceof ScheduleResourceServiceError) rethrowServiceError(GET_WHERE, error);
      throw error;
    }
  },
);

export const PUT = withApiGuardrails<{ projectId: string; taskId: string }>(
  PUT_WHERE,
  async ({ request, params }) => {
    if (!await getApiRouteUser()) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: PUT_WHERE, message: "Authentication required." });
    }
    const parsedParams = routeParamsSchema.safeParse(await params);
    if (!parsedParams.success) {
      throwScheduleRequestError(PUT_WHERE, "Select a valid project task before changing resource assignments.");
    }
    const parsedBody = replaceSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
      const duplicateIssue = parsedBody.error.issues.find((issue) => issue.message.includes("only once"));
      throwScheduleRequestError(
        PUT_WHERE,
        duplicateIssue?.message ?? "Provide at most 100 unique people with whole-number allocations from 1 through 100 percent.",
      );
    }

    try {
      const service = new ScheduleResourceService(await createClient());
      const data = await service.replaceTaskAssignments(
        parsedParams.data.projectId,
        parsedParams.data.taskId,
        parsedBody.data.assignments,
      );
      return NextResponse.json({ data });
    } catch (error) {
      if (error instanceof ScheduleResourceServiceError) rethrowServiceError(PUT_WHERE, error);
      throw error;
    }
  },
);

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
  expected_assignments: z.array(z.object({
    id: z.string().uuid(),
    person_id: z.string().uuid(),
    cost_version: z.number().int().positive(),
  }).strict()).max(100),
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
const nullableNonnegativeNumber = z.number().finite().nonnegative().nullable();
const costAssignmentSchema = z.object({
  resource_id: z.string().uuid(),
  allocation_percent: z.number().int().min(1).max(100),
  planned_units: nullableNonnegativeNumber,
  actual_units: nullableNonnegativeNumber,
  actual_rate: nullableNonnegativeNumber,
  actual_cost: nullableNonnegativeNumber,
  expected_cost_version: z.number().int().positive().nullable().optional(),
}).strict();
const deleteCostAssignmentSchema = z.object({
  assignment_id: z.string().uuid(),
  expected_cost_version: z.number().int().positive(),
}).strict();

const GET_WHERE = "projects/[projectId]/scheduling/tasks/[taskId]/assignments#GET";
const PUT_WHERE = "projects/[projectId]/scheduling/tasks/[taskId]/assignments#PUT";
const POST_WHERE = "projects/[projectId]/scheduling/tasks/[taskId]/assignments#POST";
const DELETE_WHERE = "projects/[projectId]/scheduling/tasks/[taskId]/assignments#DELETE";

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
        parsedBody.data.expected_assignments,
      );
      return NextResponse.json({ data });
    } catch (error) {
      if (error instanceof ScheduleResourceServiceError) rethrowServiceError(PUT_WHERE, error);
      throw error;
    }
  },
);

export const POST = withApiGuardrails<{ projectId: string; taskId: string }>(
  POST_WHERE,
  async ({ request, params }) => {
    if (!await getApiRouteUser()) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: POST_WHERE, message: "Authentication required." });
    }
    const parsedParams = routeParamsSchema.safeParse(await params);
    if (!parsedParams.success) {
      throwScheduleRequestError(POST_WHERE, "Select a valid project task before changing cost assignments.");
    }
    const parsedBody = costAssignmentSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsedBody.success) {
      throwScheduleRequestError(
        POST_WHERE,
        "Provide a resource, allocation, and nonnegative explicit cost facts.",
      );
    }
    try {
      const service = new ScheduleResourceService(await createClient());
      const data = await service.upsertCostAssignment(
        parsedParams.data.projectId,
        {
          task_id: parsedParams.data.taskId,
          ...parsedBody.data,
        },
      );
      return NextResponse.json({ data }, {
        status: parsedBody.data.expected_cost_version ? 200 : 201,
      });
    } catch (error) {
      if (error instanceof ScheduleResourceServiceError) rethrowServiceError(POST_WHERE, error);
      throw error;
    }
  },
);

export const DELETE = withApiGuardrails<{ projectId: string; taskId: string }>(
  DELETE_WHERE,
  async ({ request, params }) => {
    if (!await getApiRouteUser()) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: DELETE_WHERE, message: "Authentication required." });
    }
    const parsedParams = routeParamsSchema.safeParse(await params);
    if (!parsedParams.success) {
      throwScheduleRequestError(DELETE_WHERE, "Select a valid project task before deleting a cost assignment.");
    }
    const parsedBody = deleteCostAssignmentSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsedBody.success) {
      throwScheduleRequestError(
        DELETE_WHERE,
        "Choose a current cost assignment before deleting it.",
      );
    }
    try {
      const service = new ScheduleResourceService(await createClient());
      await service.deleteCostAssignment(
        parsedParams.data.projectId,
        parsedBody.data.assignment_id,
        parsedBody.data.expected_cost_version,
      );
      return NextResponse.json({ deleted: true });
    } catch (error) {
      if (error instanceof ScheduleResourceServiceError) rethrowServiceError(DELETE_WHERE, error);
      throw error;
    }
  },
);

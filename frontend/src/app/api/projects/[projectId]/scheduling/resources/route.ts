import { NextResponse } from "next/server";
import { z } from "zod";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  ScheduleResourceService,
  ScheduleResourceServiceError,
} from "@/lib/services/schedule-resource-service";
import { previewScheduleResourceLeveling } from "@/lib/scheduling/schedule-resource-leveling-preview";
import {
  throwScheduleDatabaseError,
  throwScheduleRequestError,
  throwScheduleRpcError,
} from "@/lib/scheduling/schedule-route-errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const projectIdSchema = z.coerce.number().int().positive();
const resourceIdSchema = z.string().uuid();
const dateSchema = z.string().date();
const DAY_MS = 86_400_000;
const ROUTE_WHERE = "projects/[projectId]/scheduling/resources";

const weekdayOverrideSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  capacity_percent: z.number().int().min(0).max(100),
}).strict();
const exceptionSchema = z.object({
  date: z.string().date(),
  capacity_percent: z.number().int().min(0).max(100),
  reason: z.string().trim().min(1).max(240).nullable().optional(),
}).strict();
const replaceSchema = z.object({
  expected_version: z.number().int().positive().nullable(),
  weekday_overrides: z.array(weekdayOverrideSchema).max(7),
  exceptions: z.array(exceptionSchema).max(1_000),
}).strict().superRefine((value, context) => {
  const weekdays = new Set<number>();
  value.weekday_overrides.forEach((override, index) => {
    if (weekdays.has(override.weekday)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each weekday can have only one project-capacity override.",
        path: ["weekday_overrides", index, "weekday"],
      });
    }
    weekdays.add(override.weekday);
  });
  const dates = new Set<string>();
  value.exceptions.forEach((exception, index) => {
    if (dates.has(exception.date)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each date can have only one project-capacity exception.",
        path: ["exceptions", index, "date"],
      });
    }
    dates.add(exception.date);
  });
});
const levelingRequestSchema = z.object({
  horizon_days: z.number().int().min(1).max(730).default(365),
}).strict();

function requireAuthenticatedProject(projectId: string, where: string): Promise<number> {
  return getApiRouteUser().then((user) => {
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where, message: "Authentication required." });
    }
    const parsedProjectId = projectIdSchema.safeParse(projectId);
    if (!parsedProjectId.success) {
      throwScheduleRequestError(where, "Select a valid project before loading schedule resources.");
    }
    return parsedProjectId.data;
  });
}

function rethrowServiceError(where: string, error: ScheduleResourceServiceError): never {
  if (error.operation === "rpc" && error.databaseError) throwScheduleRpcError(where, error.databaseError);
  if (error.databaseError) throwScheduleDatabaseError(where, error.databaseError);
  throwScheduleRequestError(where, error.message, {
    code: "PRECONDITION_FAILED",
    status: 409,
    cause: error,
  });
}

function parseDateRange(url: URL, where: string): { start: string; finish: string } {
  const parsed = z.object({ start: dateSchema, finish: dateSchema }).safeParse({
    start: url.searchParams.get("start"),
    finish: url.searchParams.get("finish"),
  });
  if (!parsed.success) {
    throwScheduleRequestError(where, "Choose valid start and finish dates before loading project capacity.");
  }
  const startTime = Date.parse(`${parsed.data.start}T00:00:00.000Z`);
  const finishTime = Date.parse(`${parsed.data.finish}T00:00:00.000Z`);
  if (finishTime < startTime) {
    throwScheduleRequestError(where, "Project-capacity finish must not be before its start.");
  }
  if ((finishTime - startTime) / DAY_MS > 91) {
    throwScheduleRequestError(where, "Project-capacity ranges are limited to 92 calendar days.");
  }
  return parsed.data;
}

export const GET = withApiGuardrails<{ projectId: string }>(
  `${ROUTE_WHERE}#GET`,
  async ({ request, params }) => {
    const url = new URL(request.url);
    const view = url.searchParams.get("view") ?? "roster";
    const where = `${ROUTE_WHERE}#GET:${view}`;
    const projectId = await requireAuthenticatedProject((await params).projectId, where);

    try {
      const service = new ScheduleResourceService(await createClient());
      if (view === "roster") {
        return NextResponse.json(await service.getProjectRoster(projectId));
      }
      if (view === "capacity") {
        const range = parseDateRange(url, where);
        return NextResponse.json(await service.getCapacityRange(projectId, range.start, range.finish));
      }
      if (view === "capacity-profile") {
        const resourceId = resourceIdSchema.safeParse(url.searchParams.get("resourceId"));
        if (!resourceId.success) {
          throwScheduleRequestError(where, "Select a valid project resource before loading its capacity profile.");
        }
        return NextResponse.json({ data: await service.getCapacityProfile(projectId, resourceId.data) });
      }
      throwScheduleRequestError(where, "Choose a supported schedule-resource view: roster, capacity, or capacity-profile.");
    } catch (error) {
      if (error instanceof ScheduleResourceServiceError) rethrowServiceError(where, error);
      throw error;
    }
  },
);

export const PUT = withApiGuardrails<{ projectId: string }>(
  `${ROUTE_WHERE}#PUT`,
  async ({ request, params }) => {
    const url = new URL(request.url);
    const where = `${ROUTE_WHERE}#PUT:capacity-profile`;
    const projectId = await requireAuthenticatedProject((await params).projectId, where);
    if (url.searchParams.get("view") !== "capacity-profile") {
      throwScheduleRequestError(where, "Choose the capacity-profile view before changing project capacity.");
    }
    const resourceId = resourceIdSchema.safeParse(url.searchParams.get("resourceId"));
    if (!resourceId.success) {
      throwScheduleRequestError(where, "Select a valid project resource before changing its capacity profile.");
    }
    const parsedBody = replaceSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
      const duplicate = parsedBody.error.issues.find((issue) => issue.message.includes("only one"));
      throwScheduleRequestError(
        where,
        duplicate?.message
          ?? "Provide up to seven unique weekday overrides and 1,000 unique dated exceptions with whole-number capacity from 0 through 100 percent.",
      );
    }

    try {
      const service = new ScheduleResourceService(await createClient());
      const data = await service.replaceCapacityProfile(projectId, resourceId.data, {
        expected_version: parsedBody.data.expected_version,
        weekday_overrides: parsedBody.data.weekday_overrides,
        exceptions: parsedBody.data.exceptions.map((exception) => ({
          ...exception,
          reason: exception.reason ?? null,
        })),
      });
      return NextResponse.json({ data });
    } catch (error) {
      if (error instanceof ScheduleResourceServiceError) rethrowServiceError(where, error);
      throw error;
    }
  },
);

export const POST = withApiGuardrails<{ projectId: string }>(
  `${ROUTE_WHERE}#POST`,
  async ({ request, params }) => {
    const url = new URL(request.url);
    const where = `${ROUTE_WHERE}#POST:leveling-preview`;
    const projectId = await requireAuthenticatedProject((await params).projectId, where);
    if (url.searchParams.get("operation") !== "leveling-preview") {
      throwScheduleRequestError(where, "Choose the leveling-preview operation before previewing resource leveling.");
    }
    const parsedBody = levelingRequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsedBody.success) {
      throwScheduleRequestError(where, "Choose a resource-leveling horizon from 1 through 730 calendar days.");
    }

    try {
      const service = new ScheduleResourceService(await createClient());
      const context = await service.loadLevelingContext(projectId, parsedBody.data.horizon_days);
      return NextResponse.json({ data: previewScheduleResourceLeveling(context) });
    } catch (error) {
      if (error instanceof ScheduleResourceServiceError) rethrowServiceError(where, error);
      throw error;
    }
  },
);

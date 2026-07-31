import { NextResponse } from "next/server";
import {
  CreatePlaneModuleSchema,
  PlaneModuleProjectIdSchema,
  UpdatePlaneModuleSchema,
} from "@/features/plane-modules-domain/plane-modules-contract";
import {
  createPlaneModule,
  getPlaneModule,
  listPlaneModules,
  PlaneModulesRepositoryError,
  updatePlaneModule,
} from "@/features/plane-modules-domain/plane-modules-repository";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  parseJsonBody,
  validateResponseContract,
  withApiGuardrails,
} from "@/lib/guardrails/api";
import { requirePermission } from "@/lib/permissions-guard";
import { isAuthError, verifyProjectAccess } from "@/lib/supabase/auth-guard";
import { z } from "zod";

const where = "/api/plane-modules";

const PlaneModuleResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.number().int().positive(),
  name: z.string(),
  description: z.string(),
  status: z.enum([
    "backlog",
    "planned",
    "in-progress",
    "paused",
    "completed",
    "cancelled",
  ]),
  leadPersonId: z.string().uuid().nullable(),
  memberPersonIds: z.array(z.string().uuid()),
  taskIds: z.array(z.string().uuid()),
  startDate: z.string().nullable(),
  targetDate: z.string().nullable(),
  sortOrder: z.number(),
  archivedAt: z.string().nullable(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

function asGuardrail(error: unknown, action: string): never {
  if (error instanceof PlaneModulesRepositoryError) {
    if (error.kind === "conflict") {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where,
        message: error.message,
        status: 409,
        details: { action, databaseCode: error.code },
      });
    }
    if (error.kind === "not_found") {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where,
        message: error.message,
        details: { action },
      });
    }
    if (error.kind === "validation") {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where,
        message: error.message,
        details: { action, databaseCode: error.code },
      });
    }
    throw new GuardrailError({
      code: "DB_ERROR",
      where,
      message: `Could not ${action}.`,
      details: { reason: error.message, databaseCode: error.code },
      cause: error,
    });
  }
  throw error;
}

async function authorizeRead(projectId: number) {
  const access = await verifyProjectAccess(projectId);
  return access;
}

async function authorizeWrite(projectId: number) {
  const permission = await requirePermission(projectId, "schedule", "write");
  if (permission.denied) return permission.response;
  return verifyProjectAccess(projectId);
}

export const GET = withApiGuardrails(where, async ({ request }) => {
  const parsedProjectId = PlaneModuleProjectIdSchema.safeParse(
    request.nextUrl.searchParams.get("projectId"),
  );
  if (!parsedProjectId.success) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where,
      message: "A valid projectId query parameter is required.",
      details: parsedProjectId.error.flatten(),
    });
  }

  const access = await authorizeRead(parsedProjectId.data);
  if (isAuthError(access)) return access;

  try {
    const modules = await listPlaneModules(parsedProjectId.data);
    validateResponseContract(
      z.array(PlaneModuleResponseSchema),
      modules,
      `${where}#GET`,
    );
    return NextResponse.json({ data: modules });
  } catch (error) {
    asGuardrail(error, "load project modules");
  }
});

export const POST = withApiGuardrails(where, async ({ request }) => {
  const input = await parseJsonBody(
    request,
    CreatePlaneModuleSchema,
    `${where}#POST`,
  );
  const access = await authorizeWrite(input.projectId);
  if (isAuthError(access)) return access;

  try {
    const createdModule = await createPlaneModule(
      input,
      access.membership.authUserId,
    );
    validateResponseContract(
      PlaneModuleResponseSchema,
      createdModule,
      `${where}#POST`,
    );
    return NextResponse.json({ data: createdModule }, { status: 201 });
  } catch (error) {
    asGuardrail(error, "create project module");
  }
});

export const PATCH = withApiGuardrails(where, async ({ request }) => {
  const input = await parseJsonBody(
    request,
    UpdatePlaneModuleSchema,
    `${where}#PATCH`,
  );
  const access = await authorizeWrite(input.projectId);
  if (isAuthError(access)) return access;

  try {
    const current = await getPlaneModule(input.projectId, input.moduleId);
    if (!current) {
      throw new PlaneModulesRepositoryError(
        "not_found",
        "The module was not found in this project.",
      );
    }
    const updatedModule = await updatePlaneModule(
      current,
      input,
      access.membership.authUserId,
    );
    validateResponseContract(
      PlaneModuleResponseSchema,
      updatedModule,
      `${where}#PATCH`,
    );
    return NextResponse.json({ data: updatedModule });
  } catch (error) {
    asGuardrail(error, "update project module");
  }
});

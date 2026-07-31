import { NextResponse } from "next/server";
import { z } from "zod";
import { ReplacePlaneModuleTasksSchema } from "@/features/plane-modules-domain/plane-modules-contract";
import {
  getPlaneModule,
  PlaneModulesRepositoryError,
  replacePlaneModuleTasks,
} from "@/features/plane-modules-domain/plane-modules-repository";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  parseJsonBody,
  validateResponseContract,
  withApiGuardrails,
} from "@/lib/guardrails/api";
import { requirePermission } from "@/lib/permissions-guard";
import { isAuthError, verifyProjectAccess } from "@/lib/supabase/auth-guard";

const where = "/api/plane-modules/tasks";

function asGuardrail(error: unknown): never {
  if (error instanceof PlaneModulesRepositoryError) {
    if (error.kind === "not_found") {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where,
        message: error.message,
      });
    }
    if (error.kind === "validation") {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where,
        message: error.message,
        details: { databaseCode: error.code },
      });
    }
    throw new GuardrailError({
      code: "DB_ERROR",
      where,
      message: "Could not replace module task membership.",
      details: { reason: error.message, databaseCode: error.code },
      cause: error,
    });
  }
  throw error;
}

export const PUT = withApiGuardrails(where, async ({ request }) => {
  const input = await parseJsonBody(
    request,
    ReplacePlaneModuleTasksSchema,
    `${where}#PUT`,
  );
  const permission = await requirePermission(
    input.projectId,
    "schedule",
    "write",
  );
  if (permission.denied) return permission.response;

  const access = await verifyProjectAccess(input.projectId);
  if (isAuthError(access)) return access;

  try {
    const projectModule = await getPlaneModule(input.projectId, input.moduleId);
    if (!projectModule) {
      throw new PlaneModulesRepositoryError(
        "not_found",
        "The module was not found in this project.",
      );
    }

    const taskIds = await replacePlaneModuleTasks({
      ...input,
      actorId: access.membership.authUserId,
    });
    validateResponseContract(
      z.array(z.string().uuid()),
      taskIds,
      `${where}#PUT`,
    );
    return NextResponse.json({ data: { taskIds } });
  } catch (error) {
    asGuardrail(error);
  }
});

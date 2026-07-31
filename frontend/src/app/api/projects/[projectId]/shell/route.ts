import { NextResponse } from "next/server";

import { validateResponseContract, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  ALL_MODULES,
  reduceGranularPermissionOverrides,
  type GranularFlag,
  type PermissionLevel,
  type PermissionModule,
  type UserPermissions,
} from "@/lib/permissions-shared";
import { verifyProjectAccess, isAuthError } from "@/lib/supabase/auth-guard";
import type { createServiceClient } from "@/lib/supabase/service";
import { getApiRouteUser } from "@/lib/supabase/server";
import { loadCurrentUserProfilePayload } from "@/lib/users/current-user-profile-server";
import { z } from "zod";

const ProjectShellSchema = z.object({
  project: z.object({
    id: z.number(),
    name: z.string(),
    number: z.string().optional(),
    status: z.string().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
  }),
  permissions: z.unknown(),
  userType: z.string().nullable(),
  profile: z.object({
    id: z.string(),
    personId: z.string().nullable(),
    fullName: z.string(),
    email: z.string(),
    avatarUrl: z.string().optional(),
    company: z.string().optional(),
    title: z.string().optional(),
    role: z.string().optional(),
    phone: z.string().optional(),
    profileCompleteness: z.number(),
    isAdmin: z.boolean(),
    isDeveloper: z.boolean(),
    onboardingCompletedAt: z.string().nullable(),
  }),
});

function buildAdminPermissions({
  authUserId,
  personId,
  projectId,
}: {
  authUserId: string;
  personId: string;
  projectId: number;
}): UserPermissions {
  return {
    userId: authUserId,
    personId,
    projectId,
    overrides: {
      directory: "admin",
      budget: "admin",
      contracts: "admin",
      commitments: "admin",
      estimates: "admin",
      documents: "admin",
      schedule: "admin",
      submittals: "admin",
      rfis: "admin",
      change_orders: "admin",
      change_events: "admin",
      emails: "admin",
      crm: "admin",
    },
    granularOverrides: {},
    isAdmin: true,
  };
}

type ServiceClient = ReturnType<typeof createServiceClient>;

type ShellPermissionTemplate = {
  id: string;
  name: string;
  rules_json: unknown;
  granular_flags: string[] | null;
};

function normalizeTemplate(rawTemplate?: ShellPermissionTemplate | null) {
  if (!rawTemplate) return undefined;

  return {
    id: rawTemplate.id,
    name: rawTemplate.name,
    rules: rawTemplate.rules_json as Record<PermissionModule, PermissionLevel[]>,
    granularFlags: (rawTemplate.granular_flags ?? []) as GranularFlag[],
  };
}

async function loadShellUserPermissions({
  serviceClient,
  authUserId,
  personId,
  projectId,
  projectTemplateId,
}: {
  serviceClient: ServiceClient;
  authUserId: string;
  personId: string;
  projectId: number;
  projectTemplateId: string | null;
}): Promise<UserPermissions> {
  const [
    projectTemplateResult,
    companyTemplateResult,
    overridesResult,
    granularOverridesResult,
  ] = await Promise.all([
    projectTemplateId
      ? serviceClient
          .from("permission_templates")
          .select("id, name, rules_json, granular_flags")
          .eq("id", projectTemplateId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    serviceClient
      .from("person_company_templates")
      .select("template:permission_templates (id, name, rules_json, granular_flags)")
      .eq("person_id", personId)
      .maybeSingle(),
    serviceClient
      .from("user_module_permissions")
      .select("module, level")
      .eq("project_id", projectId)
      .eq("person_id", personId),
    serviceClient
      .from("user_granular_permission_overrides")
      .select("project_id, flag, effect")
      .eq("person_id", personId)
      .or(`project_id.is.null,project_id.eq.${projectId}`),
  ]);

  const loadError =
    projectTemplateResult.error ??
    companyTemplateResult.error ??
    overridesResult.error ??
    granularOverridesResult.error;

  if (loadError) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "projects/[projectId]/shell#loadShellUserPermissions",
      message: `Failed to load shell permissions: ${loadError.message}`,
    });
  }

  const companyTemplateData = Array.isArray(companyTemplateResult.data?.template)
    ? companyTemplateResult.data.template[0]
    : companyTemplateResult.data?.template;
  const rawTemplate = projectTemplateResult.data ?? companyTemplateData ?? null;
  const emptyOverrides = Object.fromEntries(
    ALL_MODULES.map((module) => [module, "none" as PermissionLevel]),
  ) as Record<PermissionModule, PermissionLevel>;
  const overrides = (overridesResult.data ?? []).reduce((acc, row) => {
    if (ALL_MODULES.includes(row.module as PermissionModule)) {
      acc[row.module as PermissionModule] = row.level as PermissionLevel;
    }
    return acc;
  }, emptyOverrides);
  const granularOverrides = reduceGranularPermissionOverrides(
    granularOverridesResult.data ?? [],
  );

  return {
    userId: authUserId,
    personId,
    projectId,
    template: normalizeTemplate(rawTemplate),
    overrides,
    granularOverrides,
    isAdmin: false,
  };
}

export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/shell#GET",
  async ({ params }) => {
    const routeStartedAt = performance.now();
    const { projectId } = await params;
    const projectIdNum = Number(projectId);

    if (!Number.isInteger(projectIdNum)) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "projects/[projectId]/shell#GET",
        message: "Project id must be a whole number.",
        status: 400,
      });
    }

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/shell#GET",
        message: "Authentication required.",
        status: 401,
      });
    }

    const authStartedAt = performance.now();
    const authResult = await verifyProjectAccess(projectIdNum, user);
    if (isAuthError(authResult)) return authResult;
    const authDurationMs = Math.round(performance.now() - authStartedAt);

    const isAppAdmin = authResult.membership.membershipId.startsWith("super-admin:");
    const permissionsStartedAt = performance.now();
    const permissionsPromise = isAppAdmin
      ? Promise.resolve(
          buildAdminPermissions({
            authUserId: authResult.membership.authUserId,
            personId: authResult.membership.personId,
            projectId: projectIdNum,
          }),
        )
      : loadShellUserPermissions({
          serviceClient: authResult.serviceClient,
          authUserId: authResult.membership.authUserId,
          personId: authResult.membership.personId,
          projectId: projectIdNum,
          projectTemplateId: authResult.membership.permissionTemplateId,
        });

    const [{ data: projectRow, error: projectError }, permissions, profile] =
      await Promise.all([
        authResult.serviceClient
          .from("projects")
          .select('id, name, project_number, phase, "start date", "est completion"')
          .eq("id", projectIdNum)
          .single(),
        permissionsPromise,
        loadCurrentUserProfilePayload({
          serviceClient: authResult.serviceClient,
          user,
          personId: authResult.membership.personId,
          profileData: authResult.userProfile,
          where: "projects/[projectId]/shell#GET",
        }),
      ]);
    const permissionsAndPayloadDurationMs = Math.round(
      performance.now() - permissionsStartedAt,
    );

    if (projectError || !projectRow) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "projects/[projectId]/shell#GET",
        message: projectError?.message || "Project not found.",
        status: 404,
      });
    }

    const projectRecord = projectRow as Record<string, unknown>;
    const project = {
      id: Number(projectRecord.id),
      name: String(projectRecord.name ?? `Project ${projectIdNum}`),
      number:
        typeof projectRecord.project_number === "string"
          ? projectRecord.project_number
          : undefined,
      status:
        typeof projectRecord.phase === "string"
          ? projectRecord.phase
          : undefined,
      start_date:
        typeof projectRecord["start date"] === "string"
          ? projectRecord["start date"]
          : undefined,
      end_date:
        typeof projectRecord["est completion"] === "string"
          ? projectRecord["est completion"]
          : undefined,
    };

    if (!permissions) {
      throw new GuardrailError({
        code: "AUTH_FORBIDDEN",
        where: "projects/[projectId]/shell#GET",
        message: "No permissions found for this project.",
        status: 403,
      });
    }

    const payload = validateResponseContract(
      ProjectShellSchema,
      {
        project,
        permissions,
        userType: authResult.membership.userType,
        profile,
      },
      "projects/[projectId]/shell#GET",
    );

    const response = NextResponse.json(payload);
    const durationMs = Math.round(performance.now() - routeStartedAt);
    response.headers.set(
      "Server-Timing",
      [
        `project_access;dur=${authDurationMs}`,
        `shell_payload;dur=${permissionsAndPayloadDurationMs}`,
        `total;dur=${durationMs}`,
      ].join(", "),
    );

    if (durationMs > 1_000) {
      console.warn("Slow project shell response", {
        projectId: projectIdNum,
        durationMs,
        projectAccessMs: authDurationMs,
        shellPayloadMs: permissionsAndPayloadDurationMs,
      });
    }

    return response;
  },
);

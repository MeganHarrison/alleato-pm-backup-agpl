import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import type { RecruitingDatabase } from "@/lib/recruiting/db-types";
import {
  productionRecruitingRoleSchema,
  type ProductionRecruitingRole,
  type RecruitingViewer,
} from "@/lib/recruiting/production-contracts";

export type RecruitingAccessLevel = "read" | "write" | "admin";
export type RecruitingSessionClient = SupabaseClient<RecruitingDatabase>;

function isRecruitingSessionClient(
  value: unknown,
): value is RecruitingSessionClient {
  if (typeof value !== "object" || value === null) return false;
  return (
    "from" in value &&
    typeof value.from === "function" &&
    "rpc" in value &&
    typeof value.rpc === "function"
  );
}

function roleAllows(
  role: ProductionRecruitingRole,
  required: RecruitingAccessLevel,
): boolean {
  if (role === "recruiting_admin") return true;
  if (required === "admin") return false;
  if (required === "write") return role === "recruiter";
  return true;
}

export async function requireRecruitingAccess(
  required: RecruitingAccessLevel,
): Promise<{
  db: RecruitingSessionClient;
  viewer: RecruitingViewer;
  userEmail: string;
}> {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "recruiting/access",
      message: "Sign in to use Applicant Tracker.",
      status: 401,
      severity: "medium",
    });
  }

  const db = await createClient();
  if (!isRecruitingSessionClient(db)) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "recruiting/access",
      message: "Applicant Tracker could not initialize its data connection.",
    });
  }
  const [personResult, roleResult] = await Promise.all([
    db.rpc("current_recruiting_person_id"),
    db.rpc("current_recruiting_role"),
  ]);
  const accessError = personResult.error ?? roleResult.error;
  if (accessError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "recruiting/access",
      message:
        "Applicant Tracker permissions could not be verified. Confirm the recruiting migrations are applied, then reload.",
      details: { reason: accessError.message },
      cause: accessError,
    });
  }
  if (!personResult.data) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where: "recruiting/access",
      message:
        "Your Alleato account is not linked to an active company person record.",
      status: 403,
      severity: "medium",
    });
  }
  const parsedRole = productionRecruitingRoleSchema.safeParse(roleResult.data);
  if (!parsedRole.success) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where: "recruiting/access",
      message:
        "Applicant Tracker access has not been assigned to your account. Ask a recruiting administrator to assign a role.",
      status: 403,
      severity: "medium",
    });
  }
  const role = parsedRole.data;
  if (!roleAllows(role, required)) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where: "recruiting/access",
      message: `Applicant Tracker ${required} access is required.`,
      status: 403,
      severity: "medium",
    });
  }

  const canWrite = roleAllows(role, "write");
  const canAdmin = roleAllows(role, "admin");
  return {
    db,
    userEmail: user.email ?? "",
    viewer: {
      userId: user.id,
      personId: personResult.data,
      role,
      canRead: true,
      canWrite,
      canAdmin,
    },
  };
}

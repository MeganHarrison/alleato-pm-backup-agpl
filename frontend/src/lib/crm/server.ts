import "server-only";

import { GuardrailError } from "@/lib/guardrails/errors";
import { resolvePersonId } from "@/lib/auth/identity";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

export type CrmAccessLevel = "read" | "write" | "admin";

export async function requireCrmAccess(level: CrmAccessLevel) {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "crm/access",
      message: "Sign in to use CRM.",
      status: 401,
      severity: "medium",
    });
  }

  const sessionClient = await createClient();
  const { data: allowed, error: permissionError } = await sessionClient.rpc(
    "current_has_company_module_permission",
    { p_module: "crm", p_required_level: level },
  );
  if (permissionError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "crm/access",
      message: "CRM permission could not be verified.",
      details: { reason: permissionError.message },
      cause: permissionError,
    });
  }
  if (!allowed) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where: "crm/access",
      message: `CRM ${level} access is required.`,
      status: 403,
      severity: "medium",
    });
  }
  const serviceClient = createServiceClient();
  const personId = await resolvePersonId(user, serviceClient);
  if (!personId) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "crm/access",
      message: "Your CRM directory identity could not be resolved.",
    });
  }

  const [profileResult, templateResult] = await Promise.all([
    serviceClient
      .from("user_profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle(),
    serviceClient
      .from("person_company_templates")
      .select("template:permission_templates(rules_json)")
      .eq("person_id", personId)
      .maybeSingle(),
  ]);
  const identityError = profileResult.error ?? templateResult.error;
  if (identityError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "crm/access",
      message: "CRM administrator status could not be verified.",
      details: { reason: identityError.message },
      cause: identityError,
    });
  }
  const rawTemplate = Array.isArray(templateResult.data?.template)
    ? templateResult.data.template[0]
    : templateResult.data?.template;
  const crmRules = (
    rawTemplate?.rules_json as { crm?: unknown } | null | undefined
  )?.crm;
  const hasCrmAdmin =
    Array.isArray(crmRules) && crmRules.includes("admin");

  return {
    user,
    personId,
    isAdmin: profileResult.data?.is_admin === true || hasCrmAdmin,
    db: serviceClient,
  };
}

export function assertCrmOwnerOrAdmin(input: {
  ownerPersonId: string;
  personId: string;
  isAdmin: boolean;
  action: string;
}) {
  if (input.isAdmin || input.ownerPersonId === input.personId) return;
  throw new GuardrailError({
    code: "FORBIDDEN",
    where: input.action,
    message:
      "Only the record owner or a CRM administrator can make this change.",
    status: 403,
    severity: "medium",
  });
}

export async function requireActiveInternalOwner(
  personId: string,
  where: string,
) {
  const db = createServiceClient();
  const { data, error } = await db
    .from("people")
    .select("id, auth_user_id, status")
    .eq("id", personId)
    .maybeSingle();
  if (error || !data || !data.auth_user_id || data.status !== "active") {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where,
      message: "CRM owner must be an active internal user.",
      status: 400,
      details: { personId, reason: error?.message },
      cause: error ?? undefined,
    });
  }
}

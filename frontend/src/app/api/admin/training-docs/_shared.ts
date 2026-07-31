import { requireAdminDashboardApiAccess } from "@/lib/auth/admin-dashboard";
import { createServiceClient } from "@/lib/supabase/service";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";

export async function requireTrainingDocsAdmin(where: string) {
  await requireAdminDashboardApiAccess(where);

  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Sign in before managing training docs.",
      status: 401,
    });
  }

  const service = createServiceClient();
  return { userId: user.id, service };
}

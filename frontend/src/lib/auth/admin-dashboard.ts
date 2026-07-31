import "server-only";

import { redirect } from "next/navigation";

import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import {
  ADMIN_DASHBOARD_ALLOWED_EMAILS,
  isAdminDashboardEmailAllowed,
  normalizeAdminDashboardEmail,
} from "@/lib/auth/admin-dashboard-allowlist";

export async function requireAdminDashboardAccess(): Promise<void> {
  const user = await getApiRouteUser();
  if (!user) {
    redirect("/auth/login");
  }

  if (!isAdminDashboardEmailAllowed(user.email)) {
    redirect("/access-denied?reason=admin-dashboard-allowlist");
  }
}

export async function requireAdminDashboardApiAccess(
  where: string,
): Promise<void> {
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Sign in before accessing admin controls.",
      status: 401,
    });
  }

  if (!isAdminDashboardEmailAllowed(user.email)) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where,
      message:
        "Admin dashboard access is restricted to Megan Harrison and Brandon Clymer.",
      status: 403,
      details: {
        allowedEmails: ADMIN_DASHBOARD_ALLOWED_EMAILS,
        userEmail: normalizeAdminDashboardEmail(user.email) || null,
      },
    });
  }
}

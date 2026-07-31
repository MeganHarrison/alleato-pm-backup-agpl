import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentUser,
  getIsAdmin,
  getIsDeveloper,
  getProfileAccessClaims,
} from "@/lib/auth/current-user";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * Diagnostic endpoint to check admin status
 * GET /api/auth/admin-check
 */
export const GET = withApiGuardrails(
  "auth/admin-check#GET",
  async () => {
  
    const supabase = await createClient();

    // Use deduplicated getCurrentUser() — avoids redundant getUser() in the same request
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({
        authenticated: false,
        error: "Not logged in",
      }, { status: 401 });
    }

    const isAdmin = await getIsAdmin();
    const isDeveloper = await getIsDeveloper();
    const profileClaims = await getProfileAccessClaims();
    const jwtClaims = user.app_metadata as Record<string, unknown> | undefined;
    const adminSource =
      jwtClaims?.is_admin === true
        ? "auth_metadata"
        : profileClaims?.is_admin === true || profileClaims?.is_developer === true
          ? "user_profiles"
          : "none";
    const developerSource =
      jwtClaims?.is_developer === true
        ? "auth_metadata"
        : profileClaims?.is_developer === true
          ? "user_profiles"
          : "none";

    // Check if user has a person_id link
    const { data: authLink } = await supabase
      .from("users_auth")
      .select("person_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      authenticated: true,
      userId: user.id,
      email: user.email,
      isAdmin,
      isDeveloper,
      hasPersonLink: !!authLink?.person_id,
      personId: authLink?.person_id || null,
      adminAccess: {
        enabled: isAdmin,
        description: isAdmin
          ? "You have super admin access to all projects"
          : "You do not have admin access",
        source: adminSource,
      },
      developerAccess: {
        enabled: isDeveloper,
        description: isDeveloper
          ? "You can see developer-only surfaces under app/(developer)/"
          : "Developer-only surfaces are hidden from you",
        source: developerSource,
      },
    });
    },
);

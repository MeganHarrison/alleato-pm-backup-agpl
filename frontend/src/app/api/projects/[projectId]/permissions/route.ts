import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { verifyProjectAccess, isAuthError } from "@/lib/supabase/auth-guard";
import { loadUserPermissions } from "@/lib/permissions";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

/**
 * GET /api/projects/[projectId]/permissions
 * Get the current user's permissions for this project
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/permissions#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    // Verify project access
    const authResult = await verifyProjectAccess(projectIdNum);
    if (isAuthError(authResult)) return authResult;

    // Load user permissions
    const permissions = await loadUserPermissions(projectIdNum, authResult.membership.authUserId);

    if (!permissions) {
      return NextResponse.json(
        { error: "No permissions found for this project" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: permissions,
      userType: authResult.membership.userType,
    });
    },
);

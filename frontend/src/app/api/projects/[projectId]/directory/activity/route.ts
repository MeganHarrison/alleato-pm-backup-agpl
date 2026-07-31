import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse, type NextRequest } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { verifyProjectAccess, isAuthError } from "@/lib/supabase/auth-guard";
import { PermissionService } from "@/services/permissionService";
import { DirectoryAdminService } from "@/services/directoryAdminService";
import { apiErrorResponse } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

export const GET = withApiGuardrails(
  "projects/[projectId]/directory/activity#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    const authResult = await verifyProjectAccess(projectIdNum);
    if (isAuthError(authResult)) return authResult;
    const serviceSupabase = authResult.serviceClient;

    // Still need regular auth client for permission check
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/activity#GET", message: "Authentication required." });
    }

    const permissionService = new PermissionService(supabase);
    await permissionService.requirePermission(
      user.id,
      projectId,
      "directory",
      "read",
    );

    const searchParams = request.nextUrl.searchParams;
    const limit = Number.parseInt(searchParams.get("limit") || "50", 10);
    const personId = searchParams.get("personId") || undefined;

    const adminService = new DirectoryAdminService(serviceSupabase);
    const log = await adminService.getActivityLog(projectId, {
      limit: Number.isNaN(limit) ? 50 : limit,
      personId,
    });

    return NextResponse.json({ data: log });
    },
);

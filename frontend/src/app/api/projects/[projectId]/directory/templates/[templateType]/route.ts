import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse, type NextRequest } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { verifyProjectAccess, isAuthError } from "@/lib/supabase/auth-guard";
import { PermissionService } from "@/services/permissionService";
import { DirectoryAdminService } from "@/services/directoryAdminService";
import type { DirectoryTemplateType } from "@/services/directoryAdminService";
import { apiErrorResponse } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ projectId: string; templateType: string }>;
}

export const GET = withApiGuardrails(
  "projects/[projectId]/directory/templates/[templateType]#GET",
  async ({ request, params }) => {
  
    const { projectId, templateType } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const type = (templateType as DirectoryTemplateType) || "users";

    const authResult = await verifyProjectAccess(projectIdNum);
    if (isAuthError(authResult)) return authResult;
    const serviceSupabase = authResult.serviceClient;

    // Still need regular auth client for permission check
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/templates/[templateType]#GET", message: "Authentication required." });
    }

    const permissionService = new PermissionService(supabase);
    await permissionService.requirePermission(
      user.id,
      projectId,
      "directory",
      "read",
    );

    const adminService = new DirectoryAdminService(serviceSupabase);
    const csv = await adminService.generateTemplateCsv(type);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="directory-${type}-template.csv"`,
      },
    });
    },
);

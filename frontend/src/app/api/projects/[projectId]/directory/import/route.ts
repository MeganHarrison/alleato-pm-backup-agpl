import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse, type NextRequest } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { verifyProjectAccess, isAuthError } from "@/lib/supabase/auth-guard";
import { PermissionService } from "@/services/permissionService";
import {
  DirectoryAdminService,
  type DirectoryImportOptions,
  type DirectoryTemplateType,
} from "@/services/directoryAdminService";
import { apiErrorResponse } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

export const POST = withApiGuardrails(
  "projects/[projectId]/directory/import#POST",
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
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/import#POST", message: "Authentication required." });
    }

    const permissionService = new PermissionService(supabase);
    await permissionService.requirePermission(
      user.id,
      projectId,
      "directory",
      "write",
    );

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "CSV file is required" },
        { status: 400 },
      );
    }

    const type = (formData.get("type") as DirectoryTemplateType) || "users";
    const options: DirectoryImportOptions = {
      type,
      hasHeaders: formData.get("hasHeaders") !== "false",
      skipDuplicates: formData.get("skipDuplicates") === "true",
      updateExisting: formData.get("updateExisting") === "true",
      defaultCompanyId: (formData.get("defaultCompanyId") as string | null) || undefined,
      defaultPermissionTemplateId:
        (formData.get("defaultPermissionTemplateId") as string | null) || undefined,
    };

    const buffer = await file.arrayBuffer();
    const adminService = new DirectoryAdminService(serviceSupabase);
    const result = await adminService.importFromCsv(
      projectId,
      buffer,
      options,
      user.id,
    );

    return NextResponse.json({ success: true, data: result });
    },
);

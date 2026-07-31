import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { DirectoryService } from "@/services/directoryService";
import { apiErrorResponse } from "@/lib/api-error";

export const GET = withApiGuardrails<{ projectId: string; personId: string }>(
  "projects/[projectId]/directory/people/[personId]/permissions#GET",
  async ({ request, params }) => {
  
    const { projectId, personId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/people/[personId]/permissions#GET", message: "Authentication required." });
    }

    // Get user permissions
    const directoryService = new DirectoryService(supabase);
    const permissions = await directoryService.getUserPermissions(
      projectId,
      personId,
    );

    return NextResponse.json(
      {
        user_id: personId,
        permissions: permissions.override_permissions,
        template_permissions: permissions.template_permissions,
        effective_permissions: permissions.effective_permissions,
      },
      { status: 200 },
    );
    },
);

export const PATCH = withApiGuardrails<{ projectId: string; personId: string }>(
  "projects/[projectId]/directory/people/[personId]/permissions#PATCH",
  async ({ request, params }) => {
  
    const { projectId, personId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/people/[personId]/permissions#PATCH", message: "Authentication required." });
    }

    // Parse request body
    const body = await request.json();
    const { permissions } = body;

    if (!Array.isArray(permissions)) {
      return NextResponse.json(
        { error: "Permissions array is required" },
        { status: 400 },
      );
    }

    // Update user permissions
    const directoryService = new DirectoryService(supabase);
    await directoryService.updateUserPermissions(
      projectId,
      personId,
      permissions,
      user.id,
    );

    return NextResponse.json(
      {
        user_id: personId,
        permissions_updated: permissions.length,
        message: "Permissions updated successfully",
        updated_at: new Date().toISOString(),
      },
      { status: 200 },
    );
    },
);

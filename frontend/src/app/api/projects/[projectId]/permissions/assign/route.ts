import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { verifyProjectAccess, isAuthError } from "@/lib/supabase/auth-guard";
import { assignPermissionTemplate } from "@/lib/permissions";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

/**
 * POST /api/projects/[projectId]/permissions/assign
 * Assign a permission template to a user
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/permissions/assign#POST",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    // Verify project access and require admin permissions for directory
    const authResult = await verifyProjectAccess(projectIdNum);
    if (isAuthError(authResult)) return authResult;

    // Parse request body
    const body = await request.json();
    const { person_id, template_id } = body;

    if (!person_id || !template_id) {
      return NextResponse.json(
        { error: "person_id and template_id are required" },
        { status: 400 }
      );
    }

    // Assign the template
    const result = await assignPermissionTemplate(
      projectIdNum,
      person_id,
      template_id
    );

    if (!result.success) {
      const status =
        result.error === "Selected permission template no longer exists."
          ? 404
          : result.error === "Project access requires a project permission template."
            ? 400
            : 500;

      return NextResponse.json(
        { error: result.error || "Failed to assign template" },
        { status }
      );
    }

    return NextResponse.json({ success: true });
    },
);

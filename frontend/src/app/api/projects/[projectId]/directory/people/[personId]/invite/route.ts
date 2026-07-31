import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextRequest, NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { InviteService } from "@/services/inviteService";
import { PermissionService } from "@/services/permissionService";
import { apiErrorResponse } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ projectId: string; personId: string }>;
}

/**
 * Sends an invitation for a person to a project's directory after authenticating the requester and verifying write permission.
 *
 * @param request - The incoming NextRequest
 * @param params.id - The target project's ID
 * @param params.personId - The ID of the person to invite
 * @returns On success, JSON containing the invite service result. On failure, JSON with an `error` message and an appropriate HTTP status (401 for unauthorized, 403 for forbidden, 400 for bad request, 500 for server error).
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/directory/people/[personId]/invite#POST",
  async ({ request, params }) => {
  
    const { projectId, personId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/people/[personId]/invite#POST", message: "Authentication required." });
    }

    // Check permissions
    const permissionService = new PermissionService(supabase);
    const hasPermission = await permissionService.hasPermission(
      user.id,
      projectId,
      "directory",
      "write",
    );

    if (!hasPermission) {
      throw new GuardrailError({ code: "FORBIDDEN", where: "projects/[projectId]/directory/people/[personId]/invite#POST", message: "Access denied." });
    }

    // Send invite
    const inviteService = new InviteService(supabase);
    const result = await inviteService.sendInvite(projectId, personId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send invite" },
        { status: 400 },
      );
    }

    return NextResponse.json(result);
    },
);

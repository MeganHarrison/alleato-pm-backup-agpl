import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { InviteService } from "@/services/inviteService";
import { PermissionService } from "@/services/permissionService";
import { apiErrorResponse } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ projectId: string; personId: string }>;
}

/**
 * Resends an invitation for a specific person within a project after verifying the requester's identity and write permission on the project's directory.
 *
 * @param request - The incoming Next.js request object.
 * @param params.id - The ID of the project containing the person to re-invite.
 * @param params.personId - The ID of the person whose invite should be resent.
 * @returns A JSON NextResponse: on success contains the invite operation result; on failure contains an `error` message and an appropriate HTTP status (401 for unauthorized, 403 for forbidden, 400 for bad request, 500 for internal server error).
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/directory/people/[personId]/reinvite#POST",
  async ({ request, params }) => {
  
    const { projectId, personId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/people/[personId]/reinvite#POST", message: "Authentication required." });
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
      throw new GuardrailError({ code: "FORBIDDEN", where: "projects/[projectId]/directory/people/[personId]/reinvite#POST", message: "Access denied." });
    }

    // Resend invite
    const inviteService = new InviteService(supabase);
    const result = await inviteService.resendInvite(projectId, personId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to resend invite" },
        { status: 400 },
      );
    }

    return NextResponse.json(result);
    },
);

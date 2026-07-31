import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { DirectoryService } from "@/services/directoryService";
import { PermissionService } from "@/services/permissionService";
import { apiErrorResponse } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ projectId: string; personId: string }>;
}

/**
 * Handles POST requests to reactivate a person in a project's directory.
 *
 * @param request - The incoming Next.js request
 * @param params - Route parameters
 * @param params.id - ID of the project containing the person
 * @param params.personId - ID of the person to reactivate
 * @returns A JSON response: on success `{ success: true, message: 'Person reactivated successfully' }`; on authentication failure `{ error: 'Unauthorized' }` with status 401; on permission failure `{ error: 'Forbidden' }` with status 403; on unexpected errors `{ error: 'Internal server error' }` with status 500
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/directory/people/[personId]/reactivate#POST",
  async ({ request, params }) => {
  
    const { projectId, personId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/people/[personId]/reactivate#POST", message: "Authentication required." });
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
      throw new GuardrailError({ code: "FORBIDDEN", where: "projects/[projectId]/directory/people/[personId]/reactivate#POST", message: "Access denied." });
    }

    // Reactivate person
    const directoryService = new DirectoryService(supabase);
    await directoryService.reactivatePerson(projectId, personId);

    return NextResponse.json({
      success: true,
      message: "Person reactivated successfully",
    });
    },
);

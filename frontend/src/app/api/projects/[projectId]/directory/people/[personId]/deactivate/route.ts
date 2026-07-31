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
 * Handle POST requests to deactivate a person in a project's directory.
 *
 * @param request - The incoming HTTP request
 * @param params - Route parameters
 * @param params.id - The ID of the project containing the person
 * @param params.personId - The ID of the person to deactivate
 * @returns A JSON response: on success `{ success: true, message: 'Person deactivated successfully' }`; on failure an object with an `error` message describing the problem
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/directory/people/[personId]/deactivate#POST",
  async ({ request, params }) => {
  
    const { projectId, personId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/people/[personId]/deactivate#POST", message: "Authentication required." });
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
      throw new GuardrailError({ code: "FORBIDDEN", where: "projects/[projectId]/directory/people/[personId]/deactivate#POST", message: "Access denied." });
    }

    // Deactivate person
    const directoryService = new DirectoryService(supabase);
    await directoryService.deactivatePerson(projectId, personId);

    return NextResponse.json({
      success: true,
      message: "Person deactivated successfully",
    });
    },
);

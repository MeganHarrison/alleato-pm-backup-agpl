import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { DistributionGroupService } from "@/services/distributionGroupService";
import { PermissionService } from "@/services/permissionService";
import { apiErrorResponse } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ projectId: string; groupId: string }>;
}

/**
 * Handle POST requests to modify members of a distribution group within a project.
 *
 * Accepts bulk updates (`add` and/or `remove`), multiple additions (`person_ids`),
 * or a single addition (`person_id`). Requires an authenticated user with
 * `admin` permission on the project's `directory` resource.
 *
 * @param request - The incoming NextRequest for the route
 * @param params.id - The project ID from the route parameters
 * @param params.groupId - The distribution group ID from the route parameters
 * @returns An HTTP JSON NextResponse describing the result. On success the body is `{ success: true }`. On error the body is `{ error: string }` with an appropriate status code: 400 (bad request), 401 (unauthorized), 403 (forbidden), or 500 (internal server error).
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/directory/groups/[groupId]/members#POST",
  async ({ request, params }) => {
  
    const { projectId, groupId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/groups/[groupId]/members#POST", message: "Authentication required." });
    }

    // Check permissions
    const permissionService = new PermissionService(supabase);
    const hasPermission = await permissionService.hasPermission(
      user.id,
      projectId,
      "directory",
      "admin",
    );

    if (!hasPermission) {
      throw new GuardrailError({ code: "FORBIDDEN", where: "projects/[projectId]/directory/groups/[groupId]/members#POST", message: "Access denied." });
    }

    // Parse request body
    const body = await request.json();

    // Handle bulk operations
    const groupService = new DistributionGroupService(supabase);

    if (body.add || body.remove) {
      // Bulk update members
      await groupService.updateMembers(groupId, {
        add: body.add,
        remove: body.remove,
      });
    } else if (body.person_ids) {
      // Add multiple members
      await groupService.addMembers(groupId, body.person_ids);
    } else if (body.person_id) {
      // Add single member
      await groupService.addMembers(groupId, [body.person_id]);
    } else {
      return NextResponse.json(
        { error: "No members specified" },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
    },
);

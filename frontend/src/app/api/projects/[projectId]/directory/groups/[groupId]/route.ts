import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { DistributionGroupService } from "@/services/distributionGroupService";
import { PermissionService } from "@/services/permissionService";
import { apiErrorResponse } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ projectId: string; groupId: string }>;
}

/**
 * Retrieve a distribution group for a project after authenticating the requester and verifying read permission.
 *
 * Returns a JSON NextResponse containing the requested distribution group on success.
 *
 * Possible error responses:
 * - 401: when the requester is not authenticated
 * - 403: when the requester lacks read permission for the project's directory
 * - 500: on unexpected server errors
 *
 * @returns A NextResponse with the distribution group object on success, or a JSON error object with an appropriate HTTP status code on failure.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/directory/groups/[groupId]#GET",
  async ({ request, params }) => {
  
    const { projectId, groupId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/groups/[groupId]#GET", message: "Authentication required." });
    }

    // Check permissions
    const permissionService = new PermissionService(supabase);
    const hasPermission = await permissionService.hasPermission(
      user.id,
      projectId,
      "directory",
      "read",
    );

    if (!hasPermission) {
      throw new GuardrailError({ code: "FORBIDDEN", where: "projects/[projectId]/directory/groups/[groupId]#GET", message: "Access denied." });
    }

    // Get group
    const groupService = new DistributionGroupService(supabase);
    const group = await groupService.getGroup(groupId, true);

    return NextResponse.json(group);
    },
);

/**
 * Updates a distribution group within a project after verifying the caller's admin permission.
 *
 * @param request - Incoming request whose JSON body contains the update fields for the group.
 * @param params - Route parameters.
 * @param params.id - ID of the project containing the group.
 * @param params.groupId - ID of the distribution group to update.
 * @returns The updated distribution group object.
 */
export const PATCH = withApiGuardrails(
  "projects/[projectId]/directory/groups/[groupId]#PATCH",
  async ({ request, params }) => {
  
    const { projectId, groupId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/groups/[groupId]#PATCH", message: "Authentication required." });
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
      throw new GuardrailError({ code: "FORBIDDEN", where: "projects/[projectId]/directory/groups/[groupId]#PATCH", message: "Access denied." });
    }

    // Parse request body
    const body = await request.json();

    // Update group
    const groupService = new DistributionGroupService(supabase);
    const group = await groupService.updateGroup(groupId, body);

    return NextResponse.json(group);
    },
);

/**
 * Deletes a distribution group within a project's directory when the authenticated user has admin permission.
 *
 * @param request - The incoming HTTP request
 * @param params.id - The ID of the project containing the directory
 * @param params.groupId - The ID of the distribution group to delete
 * @returns A JSON HTTP response: `{ success: true }` on successful deletion, or an error object with status `401` (unauthorized), `403` (forbidden), or `500` (internal server error)
 */
export const DELETE = withApiGuardrails(
  "projects/[projectId]/directory/groups/[groupId]#DELETE",
  async ({ request, params }) => {
  
    const { projectId, groupId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/groups/[groupId]#DELETE", message: "Authentication required." });
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
      throw new GuardrailError({ code: "FORBIDDEN", where: "projects/[projectId]/directory/groups/[groupId]#DELETE", message: "Access denied." });
    }

    // Delete group
    const groupService = new DistributionGroupService(supabase);
    await groupService.deleteGroup(groupId);

    return NextResponse.json({ success: true });
    },
);

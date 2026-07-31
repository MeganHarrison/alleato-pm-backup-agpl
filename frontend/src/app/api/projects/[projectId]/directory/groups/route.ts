import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { DistributionGroupService } from "@/services/distributionGroupService";
import { PermissionService } from "@/services/permissionService";
import { apiErrorResponse } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

/**
 * Retrieve distribution groups for the specified project.
 *
 * Accepts query parameters:
 * - `include_members` (boolean): when `true`, include group members in the response.
 * - `status` (`'active' | 'inactive' | 'all'`, default `'active'`): filter groups by status.
 *
 * @param params.id - The project identifier to fetch groups for.
 * @returns A JSON response containing the retrieved distribution groups, or an error object on failure.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/directory/groups#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/groups#GET", message: "Authentication required." });
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
      throw new GuardrailError({ code: "FORBIDDEN", where: "projects/[projectId]/directory/groups#GET", message: "Access denied." });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const includeMembers = searchParams.get("include_members") === "true";
    const status =
      (searchParams.get("status") as "active" | "inactive" | "all") || "active";

    // Get groups
    const groupService = new DistributionGroupService(supabase);
    const groups = await groupService.getGroups(
      projectId,
      includeMembers,
      status,
    );

    return NextResponse.json(groups);
    },
);

/**
 * Create a new distribution group for the specified project.
 *
 * Expects a JSON request body with a required `name` field and verifies the caller has 'admin' permission on the project's directory.
 *
 * @param params - Route parameters containing `id`, the identifier of the project to scope the new group.
 * @returns A NextResponse containing the created distribution group as JSON, or a NextResponse with an error message on failure.
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/directory/groups#POST",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/groups#POST", message: "Authentication required." });
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
      throw new GuardrailError({ code: "FORBIDDEN", where: "projects/[projectId]/directory/groups#POST", message: "Access denied." });
    }

    // Parse request body
    const body = await request.json();

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { error: "Group name is required" },
        { status: 400 },
      );
    }

    // Create group
    const groupService = new DistributionGroupService(supabase);
    const group = await groupService.createGroup(projectId, body);

    return NextResponse.json(group, { status: 201 });
    },
);

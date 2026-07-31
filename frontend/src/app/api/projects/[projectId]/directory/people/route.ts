import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { type NextRequest, NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { DirectoryService } from "@/services/directoryService";
import { PermissionService } from "@/services/permissionService";
import { apiErrorResponse } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

/**
 * Lists directory people for the specified project, applying query filters and enforcing user permissions.
 *
 * @param params - Route parameters containing `id`, the project identifier used to scope the directory query.
 * @returns The directory listing serialized as JSON on success; on failure a JSON object with an `error` message and an appropriate HTTP status code.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/directory/people#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/directory/people#GET",
        message: "Authentication required.",
      });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const filters = {
      search: searchParams.get("search") || undefined,
      type: searchParams.get("type") as "user" | "contact" | "all" | undefined,
      status: searchParams.get("status") as
        | "active"
        | "inactive"
        | "all"
        | undefined,
      companyId: searchParams.get("company_id") || undefined,
      permissionTemplateId:
        searchParams.get("permission_template_id") || undefined,
      groupBy: searchParams.get("group_by") as "company" | "none" | undefined,
      sortBy: searchParams.get("sort")?.split(",") || undefined,
      page: parseInt(searchParams.get("page") || "1", 10),
      perPage: parseInt(searchParams.get("per_page") || "50", 10),
    };

    // Get people - RLS policies will enforce authorization
    const directoryService = new DirectoryService(supabase);
    const result = await directoryService.getPeople(projectId, filters);

    return NextResponse.json(result);
    },
);

/**
 * Create a new person in the specified project's directory.
 *
 * Validates that `first_name`, `last_name`, and `person_type` are present in the request body,
 * enforces project-level write permission, and returns the created person as JSON.
 *
 * @param params.id - ID of the project to which the new person will belong
 * @returns The created person object as JSON on success. On error, returns a JSON error with status `400` (missing required fields), `401` (unauthorized), `403` (forbidden), or `500` (internal server error).
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/directory/people#POST",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/people#POST", message: "Authentication required." });
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
      throw new GuardrailError({ code: "FORBIDDEN", where: "projects/[projectId]/directory/people#POST", message: "Access denied." });
    }

    // Parse request body
    const body = await request.json();
    const directoryService = new DirectoryService(supabase);

    // If person_id is provided, add an existing person to this project
    if (body.person_id) {
      const result = await directoryService.addPersonToProject(projectId, {
        person_id: body.person_id,
        permission_template_id: body.permission_template_id,
        person_type: body.person_type,
      });
      return NextResponse.json(result, { status: 201 });
    }

    // Otherwise, create a new person — validate required fields
    if (!body.first_name || !body.last_name || !body.person_type) {
      return NextResponse.json(
        { error: "Missing required fields: first_name, last_name, person_type" },
        { status: 400 },
      );
    }

    const person = await directoryService.createPerson(projectId, body);

    return NextResponse.json(person, { status: 201 });
    },
);

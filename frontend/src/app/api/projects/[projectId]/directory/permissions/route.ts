import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { verifyProjectAccess, isAuthError } from "@/lib/supabase/auth-guard";
import { apiErrorResponse } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

// GET /api/projects/[id]/directory/permissions
// Fetches all users in the project with their directory permission levels
export const GET = withApiGuardrails(
  "projects/[projectId]/directory/permissions#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    const authResult = await verifyProjectAccess(projectIdNum);
    if (isAuthError(authResult)) return authResult;
    const supabase = authResult.serviceClient;

    // Get search query if provided
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    // Fetch all people in the project with their memberships
    const query = supabase
      .from("project_directory_memberships")
      .select(
        `
        id,
        person_id,
        status,
        person:people (
          id,
          first_name,
          last_name,
          email,
          company:companies!people_company_id_fkey (
            id,
            name
          )
        ),
        permission_template:permission_templates (
          id,
          name,
          rules_json
        )
      `,
      )
      .eq("project_id", projectIdNum)
      .eq("status", "active");

    const { data: memberships, error: membershipsError } = await query;

    if (membershipsError) {
      return NextResponse.json(
        { error: membershipsError.message },
        { status: 500 },
      );
    }

    // Fetch explicit directory permissions
    const { data: directoryPerms, error: permsError } = await supabase
      .from("user_directory_permissions")
      .select("*")
      .eq("project_id", projectIdNum);

    if (permsError) {
      return NextResponse.json({ error: permsError.message }, { status: 500 });
    }

    // Create a map of person_id to permission level
    const permissionMap = new Map<string, string>();
    (directoryPerms || []).forEach((perm) => {
      permissionMap.set(perm.person_id, perm.permission_level);
    });

    // Transform the data
    const users = (memberships || [])
      .filter((m) => m.person) // Only include if person exists
      .map((membership) => {
        const person = membership.person;
        const template = membership.permission_template;

        // Get explicit permission or derive from template
        let permissionLevel = permissionMap.get(membership.person_id);

        if (!permissionLevel && template?.rules_json) {
          // Derive from template
          const rules = template.rules_json as Record<string, string[]>;
          const directoryRules = rules.directory || [];

          if (directoryRules.includes("admin")) {
            permissionLevel = "admin";
          } else if (directoryRules.includes("write")) {
            permissionLevel = "standard";
          } else if (directoryRules.includes("read")) {
            permissionLevel = "read_only";
          } else {
            permissionLevel = "none";
          }
        }

        return {
          id: membership.id,
          person_id: membership.person_id,
          first_name: person.first_name,
          last_name: person.last_name,
          full_name: `${person.last_name}, ${person.first_name}`,
          email: person.email,
          company_name: person.company?.name || null,
          permission_level: permissionLevel || "none",
          has_explicit_permission: permissionMap.has(membership.person_id),
          permission_template_id: template?.id ?? null,
          template_name: template?.name || null,
        };
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name));

    // Apply search filter if provided
    let filteredUsers = users;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredUsers = users.filter(
        (user) =>
          user.full_name.toLowerCase().includes(searchLower) ||
          user.email?.toLowerCase().includes(searchLower) ||
          user.company_name?.toLowerCase().includes(searchLower),
      );
    }

    return NextResponse.json({ data: filteredUsers });
    },
);

// PUT /api/projects/[id]/directory/permissions
// Updates a user's directory permission level
export const PUT = withApiGuardrails(
  "projects/[projectId]/directory/permissions#PUT",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    const authResult = await verifyProjectAccess(projectIdNum);
    if (isAuthError(authResult)) return authResult;
    const supabase = authResult.serviceClient;

    const body = await request.json();
    const { person_id, permission_level } = body;

    if (!person_id) {
      return NextResponse.json(
        { error: "person_id is required" },
        { status: 400 },
      );
    }

    const validLevels = ["none", "read_only", "standard", "admin"];
    if (!permission_level || !validLevels.includes(permission_level)) {
      return NextResponse.json(
        {
          error: `permission_level must be one of: ${validLevels.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Upsert the permission
    const { data, error } = await supabase
      .from("user_directory_permissions")
      .upsert(
        {
          project_id: projectIdNum,
          person_id,
          permission_level,
        },
        {
          onConflict: "project_id,person_id",
        },
      )
      .select()
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ data });
    },
);

// DELETE /api/projects/[id]/directory/permissions
// Removes explicit permission override (falls back to template)
export const DELETE = withApiGuardrails(
  "projects/[projectId]/directory/permissions#DELETE",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    const authResult = await verifyProjectAccess(projectIdNum);
    if (isAuthError(authResult)) return authResult;
    const supabase = authResult.serviceClient;

    const { searchParams } = new URL(request.url);
    const personId = searchParams.get("person_id");

    if (!personId) {
      return NextResponse.json(
        { error: "person_id query parameter is required" },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("user_directory_permissions")
      .delete()
      .eq("project_id", projectIdNum)
      .eq("person_id", personId);

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ success: true });
    },
);

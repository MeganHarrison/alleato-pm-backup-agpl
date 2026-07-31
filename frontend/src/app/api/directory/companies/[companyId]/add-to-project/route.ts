import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { PermissionService } from "@/services/permissionService";
import { apiErrorResponse } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

export const POST = withApiGuardrails(
  "directory/companies/[companyId]/add-to-project#POST",
  async ({ request, params }) => {
  
    const { companyId } = await params;
    const body = (await request.json()) as { project_id?: number | string };
    const projectId = Number.parseInt(String(body.project_id), 10);

    if (!companyId || Number.isNaN(projectId)) {
      return NextResponse.json(
        { error: "validation_error", message: "Valid project_id is required" },
        { status: 422 },
      );
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "directory/companies/[companyId]/add-to-project#POST", message: "Authentication required." });
    }

    const permissionService = new PermissionService(supabase);
    const hasPermission = await permissionService.hasPermission(
      user.id,
      projectId.toString(),
      "directory",
      "write",
    );

    if (!hasPermission) {
      return NextResponse.json(
        {
          error: "insufficient_permissions",
          message: "You do not have permission to update company access for this project.",
        },
        { status: 403 },
      );
    }

    const { data: existing } = await supabase
      .from("project_companies")
      .select("id")
      .eq("project_id", projectId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "already_exists", message: "Company is already assigned to this project." },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from("project_companies")
      .insert({
        project_id: projectId,
        company_id: companyId,
        company_type: "VENDOR",
        status: "ACTIVE",
      })
      .select("id, project_id, company_id, status, company_type")
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json(
      {
        message: "Company added to project.",
        assignment: data,
      },
      { status: 201 },
    );
    },
);


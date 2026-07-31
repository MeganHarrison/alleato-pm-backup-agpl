import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { type NextRequest, NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { CompanyService } from "@/services/companyService";
import { PermissionService } from "@/services/permissionService";

interface RouteParams {
  params: Promise<{ projectId: string; companyId: string }>;
}

/**
 * Get detailed information for a specific company.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/directory/companies/[companyId]#GET",
  async ({ request, params }) => {

    const { projectId, companyId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/companies/[companyId]#GET", message: "Authentication required." });
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
      return NextResponse.json(
        {
          error: "insufficient_permissions",
          message: "You do not have permission to view companies.",
          code: "PERMISSION_DENIED",
        },
        { status: 403 },
      );
    }

    // Get company
    const companyService = new CompanyService(supabase);

    try {
      const company = await companyService.getCompany(projectId, companyId);
      return NextResponse.json(company);
    } catch (getError) {
      if (
        getError instanceof Error &&
        (getError as NodeJS.ErrnoException).code === "RESOURCE_NOT_FOUND"
      ) {
        return NextResponse.json(
          {
            error: "not_found",
            message: `Company with ID ${companyId} not found.`,
            code: "RESOURCE_NOT_FOUND",
          },
          { status: 404 },
        );
      }
      throw getError;
    }
    },
);

/**
 * Update the project-level primary contact for a company.
 *
 * All other company fields (name, address, contact info, ERP vendor ID,
 * company type, status, logo) are managed exclusively in Acumatica (ERP) by
 * Accounting and can no longer be edited here. Only `primary_contact_id` —
 * a project-scoped assignment, not an ERP-owned field — is accepted.
 */
export const PATCH = withApiGuardrails(
  "projects/[projectId]/directory/companies/[companyId]#PATCH",
  async ({ request, params }) => {

    const { projectId, companyId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/companies/[companyId]#PATCH", message: "Authentication required." });
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
      return NextResponse.json(
        {
          error: "insufficient_permissions",
          message: "You do not have permission to update companies.",
          code: "PERMISSION_DENIED",
        },
        { status: 403 },
      );
    }

    // Parse request body
    const body = await request.json();

    // Only `primary_contact_id` is still editable at the project level.
    // Every other field is ERP-managed — reject the request instead of
    // silently ignoring the extra fields.
    const allowedKeys = new Set(["primary_contact_id"]);
    const requestedKeys = Object.keys(body ?? {});
    const disallowedKeys = requestedKeys.filter((key) => !allowedKeys.has(key));

    if (disallowedKeys.length > 0) {
      return NextResponse.json(
        {
          error: "erp_managed",
          message:
            "Companies are managed in Acumatica (ERP) by Accounting and can no longer be edited here. Ask Accounting to update the record in Acumatica — the change will sync in automatically. Only the primary contact assignment can be changed here.",
          fields: disallowedKeys,
        },
        { status: 403 },
      );
    }

    // Validate company exists
    const companyService = new CompanyService(supabase);

    try {
      await companyService.getCompany(projectId, companyId);
    } catch (getError) {
      if (
        getError instanceof Error &&
        (getError as NodeJS.ErrnoException).code === "RESOURCE_NOT_FOUND"
      ) {
        return NextResponse.json(
          {
            error: "not_found",
            message: `Company with ID ${companyId} not found.`,
            code: "RESOURCE_NOT_FOUND",
          },
          { status: 404 },
        );
      }
      throw getError;
    }

    // Update the primary contact
    const company = await companyService.updateCompany(projectId, companyId, {
      primary_contact_id: body.primary_contact_id,
    });
    return NextResponse.json(company);
    },
);

/**
 * Delete a company from the project.
 *
 * Note: Companies with assigned users cannot be deleted.
 */
export const DELETE = withApiGuardrails(
  "projects/[projectId]/directory/companies/[companyId]#DELETE",
  async ({ request, params }) => {

    const { projectId, companyId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/companies/[companyId]#DELETE", message: "Authentication required." });
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
      return NextResponse.json(
        {
          error: "insufficient_permissions",
          message: "You do not have permission to delete companies.",
          code: "PERMISSION_DENIED",
        },
        { status: 403 },
      );
    }

    const serviceSupabase = createServiceClient();
    const companyService = new CompanyService(serviceSupabase);

    // Check if company exists
    let company;
    try {
      company = await companyService.getCompany(projectId, companyId);
    } catch (getError) {
      if (
        getError instanceof Error &&
        (getError as NodeJS.ErrnoException).code === "RESOURCE_NOT_FOUND"
      ) {
        return NextResponse.json(
          {
            error: "not_found",
            message: `Company with ID ${companyId} not found.`,
            code: "RESOURCE_NOT_FOUND",
          },
          { status: 404 },
        );
      }
      throw getError;
    }

    // Check if company can be deleted
    const canDelete = await companyService.canDeleteCompany(
      projectId,
      company.company_id,
    );
    if (!canDelete.canDelete) {
      return NextResponse.json(
        {
          error: "business_rule_violation",
          message: canDelete.reason,
          code: "BUSINESS_RULE_VIOLATION",
        },
        { status: 403 },
      );
    }

    // Delete the project company association
    // Note: We don't delete the global company record, just the project association
    const projectIdNum = Number.parseInt(projectId, 10);
    const { error: deleteError } = await serviceDb.from("project_companies")
      .delete()
      .eq("project_id", projectIdNum)
      .eq("id", companyId);

    if (deleteError) throw deleteError;

    return new NextResponse(null, { status: 204 });
    },
);

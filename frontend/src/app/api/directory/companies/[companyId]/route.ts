import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { type NextRequest, NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * GET /api/directory/companies/[companyId]
 * Get a single company by ID
 */
export const GET = withApiGuardrails(
  "directory/companies/[companyId]#GET",
  async ({ request, params }) => {
  
    const { companyId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "directory/companies/[companyId]#GET", message: "Authentication required." });
    }

    // Get company
    const { data: company, error } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Company not found" },
          { status: 404 }
        );
      }
      return apiErrorResponse(error);
    }

    return NextResponse.json(company);
    },
);

/**
 * PATCH /api/directory/companies/[companyId]
 *
 * Disabled: companies are managed exclusively in Acumatica (ERP) by Accounting,
 * so insurance, EIN, and legal details stay accurate. Edits sync in
 * automatically via `backend/src/services/acumatica_sync.py`.
 */
export const PATCH = withApiGuardrails(
  "directory/companies/[companyId]#PATCH",
  async () => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "directory/companies/[companyId]#PATCH", message: "Authentication required." });
    }

    return NextResponse.json(
      {
        error: "erp_managed",
        message:
          "Companies are managed in Acumatica (ERP) by Accounting and can no longer be edited here. Ask Accounting to update the record in Acumatica — the change will sync in automatically.",
      },
      { status: 403 },
    );
  },
);

/**
 * DELETE /api/directory/companies/[companyId]
 * Delete a company
 */
export const DELETE = withApiGuardrails(
  "directory/companies/[companyId]#DELETE",
  async ({ request, params }) => {
  
    const { companyId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "directory/companies/[companyId]#DELETE", message: "Authentication required." });
    }

    // Check if company is used in any projects
    const { data: projectCompanies, error: checkError } = await supabase
      .from("project_companies")
      .select("id")
      .eq("company_id", companyId)
      .limit(1);

    if (checkError) {
      return NextResponse.json(
        { error: "Failed to check company usage", details: checkError.message },
        { status: 500 }
      );
    }

    if (projectCompanies && projectCompanies.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete company",
          message: "This company is currently assigned to one or more projects. Please remove it from all projects before deleting."
        },
        { status: 409 }
      );
    }

    // Delete company
    const { error } = await supabase
      .from("companies")
      .delete()
      .eq("id", companyId);

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Company not found" },
          { status: 404 }
        );
      }
      return apiErrorResponse(error);
    }

    return NextResponse.json(
      { message: "Company deleted successfully" },
      { status: 200 }
    );
    },
);

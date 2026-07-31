import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { type NextRequest, NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { CompanyService } from "@/services/companyService";
import { PermissionService } from "@/services/permissionService";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

/**
 * List all companies for a project with pagination and filtering.
 *
 * Query parameters:
 * - page: Page number (default: 1)
 * - per_page: Items per page (default: 25, max: 150)
 * - sort: Sort field and direction (e.g., "name" or "name:desc")
 * - status: Filter by status (ACTIVE, INACTIVE, or all)
 * - company_type: Filter by company type
 * - search: Search by company name, email, or phone
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/directory/companies#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/companies#GET", message: "Authentication required." });
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const per_page = Math.min(
      parseInt(searchParams.get("per_page") || "25", 10),
      150,
    );

    // Validate per_page
    if (per_page < 1 || per_page > 150) {
      return NextResponse.json(
        {
          error: "invalid_parameter",
          message: "Invalid per_page value. Must be between 1 and 150.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    const filters = {
      search: searchParams.get("search") || undefined,
      status:
        (searchParams.get("status") as "ACTIVE" | "INACTIVE" | "all") ||
        "ACTIVE",
      company_type: searchParams.get("company_type") || undefined,
      sort: searchParams.get("sort") || "name",
      page,
      per_page,
    };

    // Get companies
    const companyService = new CompanyService(supabase);
    const result = await companyService.getCompanies(projectId, filters);

    return NextResponse.json(result);
    },
);

/**
 * Assign an existing company to the project via `company_id`.
 *
 * Creating a brand-new company is disabled — companies are managed
 * exclusively in Acumatica (ERP) by Accounting. Any request without a
 * `company_id` matching an existing company is rejected with `erp_managed`.
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/directory/companies#POST",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/companies#POST", message: "Authentication required." });
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
          message: "You do not have permission to create companies.",
          code: "PERMISSION_DENIED",
        },
        { status: 403 },
      );
    }

    // Parse request body
    const body = await request.json();
    const projectIdNum = Number.parseInt(projectId, 10);

    // ── Assign existing company by company_id ──────────────────────
    if (body.company_id && typeof body.company_id === "string") {
      const { data: existing } = await supabase
        .from("project_companies")
        .select("id")
        .eq("project_id", projectIdNum)
        .eq("company_id", body.company_id)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: "already_assigned", message: "Company is already assigned to this project.", code: "CONFLICT" },
          { status: 409 },
        );
      }

      const { data: pc, error: pcError } = await supabase
        .from("project_companies")
        .insert({ project_id: projectIdNum, company_id: body.company_id, status: "ACTIVE", company_type: "VENDOR" })
        .select("*, company:companies(*)")
        .single();

      if (pcError) throw pcError;
      return NextResponse.json(pc, { status: 201 });
    }

    // ── New company creation is disabled ────────────────────────────
    // Companies are managed exclusively in Acumatica (ERP) by Accounting, so
    // insurance, EIN, and legal details stay accurate. Only assigning an
    // *existing* company (via company_id above) is still supported.
    return NextResponse.json(
      {
        error: "erp_managed",
        message:
          "Companies are managed in Acumatica (ERP) by Accounting and can no longer be created here. Ask Accounting to add the company in Acumatica — it will sync in automatically and can then be assigned to this project.",
      },
      { status: 403 },
    );
    },
);

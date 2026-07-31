import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { type NextRequest, NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { logger } from "@/lib/logger";

/**
 * GET /api/directory/companies
 * List all companies in the system (not project-specific)
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
  "directory/companies#GET",
  async ({ request }) => {
  
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "directory/companies#GET", message: "Authentication required." });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const per_page = Math.min(
      parseInt(searchParams.get("per_page") || "25", 10),
      150,
    );
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";
    const company_type = searchParams.get("company_type") || null;
    const sort = searchParams.get("sort") || "name";

    // Start building query
    let query = supabase
      .from("companies")
      .select("*", { count: "exact" });

    // Apply search filter
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,title.ilike.%${search}%,website.ilike.%${search}%,address.ilike.%${search}%,city.ilike.%${search}%,state.ilike.%${search}%,notes.ilike.%${search}%`
      );
    }

    // Apply status filter
    if (status !== "all") {
      query = query.eq("status", status);
    }

    // Apply company type filter
    if (company_type) {
      query = query.eq("type", company_type);
    }

    // Apply sorting
    const [sortField, sortDirection] = sort.split(":");
    query = query.order(sortField, { ascending: sortDirection !== "desc" });

    // Apply pagination
    const from = (page - 1) * per_page;
    const to = from + per_page - 1;
    query = query.range(from, to);

    // Execute query
    const { data: companies, error, count } = await query;

    if (error) {
      logger.error({ msg: "Error fetching companies:", error: error instanceof Error ? error.message : String(error) });
      return apiErrorResponse(error);
    }

    // Calculate pagination metadata
    const total = count || 0;
    const total_pages = Math.ceil(total / per_page);

    const normalizedCompanies = (companies || []).map((company) => ({
      ...company,
      company_type: company.type ?? null,
    }));

    return NextResponse.json({
      data: normalizedCompanies,
      pagination: {
        page,
        per_page,
        total,
        total_pages,
      },
    });
    },
);

/**
 * POST /api/directory/companies
 *
 * Disabled: companies are managed exclusively in Acumatica (ERP) by Accounting,
 * so insurance, EIN, and legal details stay accurate. New companies sync in
 * automatically via `backend/src/services/acumatica_sync.py`.
 */
export const POST = withApiGuardrails(
  "directory/companies#POST",
  async () => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "directory/companies#POST", message: "Authentication required." });
    }

    return NextResponse.json(
      {
        error: "erp_managed",
        message:
          "Companies are managed in Acumatica (ERP) by Accounting and can no longer be created here. Ask Accounting to add the company in Acumatica — it will sync in automatically.",
      },
      { status: 403 },
    );
  },
);

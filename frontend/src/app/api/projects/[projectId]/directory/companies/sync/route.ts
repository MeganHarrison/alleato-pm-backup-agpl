import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { PermissionService } from "@/services/permissionService";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

/**
 * POST /api/projects/[projectId]/directory/companies/sync
 *
 * Scans prime_contracts and financial_contracts for any company_id values
 * linked to this project, then upserts those companies into project_companies
 * if they are not already present.
 *
 * Returns: { added: number, total: number }
 */
export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/directory/companies/sync#POST",
  async ({ params }) => {
    const { projectId } = await params;
    const projectIdNum = Number.parseInt(projectId, 10);
    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/directory/companies/sync#POST",
        message: "Authentication required.",
      });
    }

    const permissionService = new PermissionService(supabase);
    const hasPermission = await permissionService.hasPermission(
      user.id,
      projectId,
      "directory",
      "write",
    );
    if (!hasPermission) {
      return NextResponse.json(
        { error: "insufficient_permissions", code: "PERMISSION_DENIED" },
        { status: 403 },
      );
    }

    // ── 1. Collect company IDs from contracts ─────────────────────────────────

    const companyIds = new Set<string>();

    // prime_contracts → contract_company_id
    const { data: primeContracts } = await supabase
      .from("prime_contracts")
      .select("contract_company_id")
      .eq("project_id", projectIdNum)
      .not("contract_company_id", "is", null);

    for (const row of primeContracts ?? []) {
      if (row.contract_company_id) companyIds.add(row.contract_company_id);
    }

    // financial_contracts (commitments) -> company_id
    const { data: financialContracts } = await supabase
      .from("financial_contracts")
      .select("company_id")
      .eq("project_id", projectIdNum);

    for (const row of financialContracts ?? []) {
      if (row.company_id) companyIds.add(row.company_id);
    }

    if (companyIds.size === 0) {
      return NextResponse.json({ added: 0, total: 0 });
    }

    // ── 2. Find which are already in project_companies ─────────────────────────

    const { data: existing } = await supabase
      .from("project_companies")
      .select("company_id")
      .eq("project_id", projectIdNum)
      .in("company_id", Array.from(companyIds));

    const existingIds = new Set((existing ?? []).map((r) => r.company_id).filter(Boolean));

    const toInsert = Array.from(companyIds).filter((id) => !existingIds.has(id));

    if (toInsert.length === 0) {
      return NextResponse.json({ added: 0, total: companyIds.size });
    }

    // ── 3. Verify the companies actually exist in the companies table ──────────

    const { data: validCompanies } = await supabase
      .from("companies")
      .select("id")
      .in("id", toInsert);

    const validIds = (validCompanies ?? []).map((c) => c.id);

    if (validIds.length === 0) {
      return NextResponse.json({ added: 0, total: companyIds.size });
    }

    // ── 4. Insert missing companies into project_companies ────────────────────

    const rows = validIds.map((company_id) => ({
      project_id: projectIdNum,
      company_id,
      status: "ACTIVE" as const,
      company_type: "VENDOR" as const,
    }));

    const { error: insertError } = await supabase
      .from("project_companies")
      .insert(rows);

    if (insertError) {
      // Ignore unique-constraint violations — another request may have beat us
      if (!insertError.code?.includes("23505")) {
        throw insertError;
      }
    }

    return NextResponse.json({ added: validIds.length, total: companyIds.size });
  },
);

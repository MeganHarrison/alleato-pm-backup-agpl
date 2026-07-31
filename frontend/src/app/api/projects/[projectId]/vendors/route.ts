import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";

type VendorCompany = {
  id: string;
  name: string | null;
  legal_name: string | null;
  license_number: string | null;
};

type ProjectVendorRow = {
  vendor_id: string;
  companies: VendorCompany[] | VendorCompany | null;
};

function normalizeCompany(
  company: ProjectVendorRow["companies"],
): VendorCompany | null {
  if (!company) return null;
  return Array.isArray(company) ? company[0] ?? null : company;
}

// Returns vendor companies for this project (used by form dropdowns).
// If the project has no vendors in project_vendors, returns all vendor companies globally.
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/vendors#GET",
  async ({ request, params }) => {
  const { projectId: projectIdStr } = await params;
  const projectId = parseInt(projectIdStr, 10);
  const supabase = await createClient();
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "projects/[projectId]/vendors#GET",
      message: "Authentication required.",
    });
  }

  const [projectVendorsResult, allVendorsResult] = await Promise.all([
    supabase
      .from("project_vendors")
      .select("vendor_id, companies(id, name, legal_name, license_number)")
      .eq("project_id", projectId),
    supabase
      .from("companies")
      .select("id, name, legal_name, license_number")
      .eq("is_vendor", true)
      .order("name"),
  ]);

  if (projectVendorsResult.error) {
    return apiErrorResponse(projectVendorsResult.error);
  }
  if (allVendorsResult.error) {
    return apiErrorResponse(allVendorsResult.error);
  }

  // Build a set of project-linked vendor IDs for dedup
  const projectVendorIds = new Set(
    (projectVendorsResult.data ?? []).map((row) => row.vendor_id),
  );

  // Project-linked vendors first, then all other is_vendor=true companies
  const projectVendorRows = (projectVendorsResult.data as ProjectVendorRow[] ?? []).map(
    (row) => {
      const company = normalizeCompany(row.companies);
      return {
        id: row.vendor_id,
        vendor_name: company?.name ?? "",
        company_id: row.vendor_id,
        company: company?.name ?? "",
        license_number: company?.license_number ?? null,
      };
    },
  );

  const globalVendorRows = (allVendorsResult.data as VendorCompany[] ?? [])
    .filter((c) => !projectVendorIds.has(c.id))
    .map((c) => ({
      id: c.id,
      vendor_name: c.name ?? "",
      company_id: c.id,
      company: c.name ?? "",
      license_number: c.license_number ?? null,
    }));

  return NextResponse.json([...projectVendorRows, ...globalVendorRows]);
  },
);

// ---------------------------------------------------------------------------
// POST — disabled.
//
// This used to create a company (and flip is_vendor) by name match. Companies
// are now managed exclusively in Acumatica (ERP) by Accounting, so insurance,
// EIN, and legal details stay accurate — creating or mutating a company from
// the PM app is no longer supported. Vendors already flagged `is_vendor` sync
// in automatically and are selectable directly from the GET list above.
// ---------------------------------------------------------------------------

export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/vendors#POST",
  async () => {
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/vendors#POST",
        message: "Authentication required.",
      });
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

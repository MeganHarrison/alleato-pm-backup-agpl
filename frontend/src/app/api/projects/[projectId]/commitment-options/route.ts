import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

// Returns lightweight commitment options for change-order creation pickers.
export const GET = withApiGuardrails(
  "projects/[projectId]/commitment-options#GET",
  async ({ params }) => {
    const { projectId: projectIdParam } = await params;
    const projectId = Number.parseInt(projectIdParam, 10);

    if (Number.isNaN(projectId) || projectId <= 0) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/commitment-options#GET",
        message: "Invalid project ID.",
        details: [{ path: "projectId", message: "Project ID must be a positive number." }],
      });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/commitment-options#GET",
        message: "Authentication required.",
      });
    }

    const { data: commitments, error: commitmentsError } = await supabase
      .from("commitments_unified")
      .select("id, contract_number, title, commitment_type, contract_company_id")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("contract_number", { ascending: true });

    if (commitmentsError) {
      return apiErrorResponse(commitmentsError);
    }

    const companyIds = [
      ...new Set(
        (commitments ?? [])
          .map((row) => row.contract_company_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const companyNameById = new Map<string, string>();
    if (companyIds.length > 0) {
      const { data: companies, error: companiesError } = await supabase
        .from("companies")
        .select("id, name")
        .in("id", companyIds);

      if (companiesError) {
        return apiErrorResponse(companiesError);
      }

      for (const company of companies ?? []) {
        if (company.id && company.name) {
          companyNameById.set(company.id, company.name);
        }
      }
    }

    const options = (commitments ?? []).map((row) => ({
      id: row.id,
      contract_number: row.contract_number,
      title: row.title,
      commitment_type: row.commitment_type,
      company_name: row.contract_company_id
        ? (companyNameById.get(row.contract_company_id) ?? null)
        : null,
    }));

    return NextResponse.json(options);
  },
);

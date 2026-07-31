import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions-guard";
import { exportPrimeContractsToAcumatica } from "@/lib/acumatica/export-service";
import { evaluateErpPushPreconditions } from "@/lib/acumatica/erp-push-preconditions";

const WHERE = "projects/[projectId]/erp-push#POST";

// POST → push this job (its prime contracts) to Acumatica as Project entities.
//
// This is a privileged financial write: the first push CREATES the project in
// the ERP and writes `acumatica_project_id` back. It is gated to admins /
// contract-admins (see the permission check below) and refuses to run unless
// the job actually has prime contracts with a mapped Acumatica customer, so it
// cannot create a malformed Project in the accounting system.
export const POST = withApiGuardrails<{ projectId: string }>(
  WHERE,
  async ({ params }) => {
    const projectId = parseInt(params.projectId, 10);
    if (!Number.isFinite(projectId) || projectId <= 0) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: WHERE,
        message: "Invalid project id.",
      });
    }

    // Accounting/admin-only gate. Pushing to the ERP is more privileged than any
    // in-app edit, so require ADMIN on the contracts module — app admins pass
    // automatically (isAdmin short-circuits in hasPermission).
    const guard = await requirePermission(projectId, "contracts", "admin");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    // Gather the facts the precondition check needs.
    const { data: project } = await supabase
      .from("projects")
      .select("id, acumatica_project_id")
      .eq("id", projectId)
      .single();

    const { data: primeContracts, error: contractsError } = await supabase
      .from("prime_contracts")
      .select("id, client_id, contract_company_id")
      .eq("project_id", projectId);

    if (contractsError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: WHERE,
        message: "Failed to load prime contracts.",
        details: contractsError.message,
      });
    }

    const contracts = primeContracts ?? [];
    const companyIds = Array.from(
      new Set(
        contracts
          .flatMap((c) => [c.client_id, c.contract_company_id])
          .filter(Boolean) as string[],
      ),
    );

    let companiesWithCustomer = 0;
    if (companyIds.length > 0) {
      const { data: companies } = await supabase
        .from("companies")
        .select("id, customer_id")
        .in("id", companyIds);
      companiesWithCustomer = (companies ?? []).filter((c) => !!c.customer_id).length;
    }

    const precheck = evaluateErpPushPreconditions({
      projectExists: !!project,
      primeContractCount: contracts.length,
      companiesWithCustomer,
    });

    if (!precheck.ok) {
      throw new GuardrailError({
        code: precheck.code ?? "PRECONDITION_FAILED",
        where: WHERE,
        message: precheck.message ?? "Job cannot be pushed to the ERP.",
      });
    }

    // Push. exportPrimeContractsToAcumatica is job-scoped: it upserts one
    // Acumatica Project per prime contract, writes acumatica_project_id back on
    // first push, and records an outbound audit trail.
    let result: Awaited<ReturnType<typeof exportPrimeContractsToAcumatica>>;
    try {
      result = await exportPrimeContractsToAcumatica(projectId, {
        userId: guard.userId,
      });
    } catch (error) {
      await supabase
        .from("projects")
        .update({ erp_sync_status: "failed" })
        .eq("id", projectId);
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: WHERE,
        message: "Acumatica push failed before any record was written.",
        details: error instanceof Error ? error.message : String(error),
      });
    }

    const success = result.errors.length === 0;

    await supabase
      .from("projects")
      .update({ erp_sync_status: success ? "synced" : "failed" })
      .eq("id", projectId);

    if (!success) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: WHERE,
        message: "Failed to push one or more prime contracts to Acumatica.",
        details: result.errors,
      });
    }

    return NextResponse.json({
      message: "Job pushed to Acumatica",
      status: "synced",
      result,
    });
  },
);

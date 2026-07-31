import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";

// Cost-code + description compose the natural key for an SOV line, so previously
// billed amounts from prior invoices line up even when two lines share a code.
function sovKey(costCode: string | null, description: string | null): string {
  return `${(costCode ?? "").trim()}::${(description ?? "").trim()}`;
}

/**
 * GET /api/projects/[projectId]/invoicing/owner/sov?contractId={id}
 *
 * Returns a prime contract's Schedule of Values (from contract_line_items) so
 * the New Owner Invoice form can pre-fill billable lines instead of forcing the
 * user to hand-type them — mirroring the subcontractor invoice flow. Each line
 * carries its scheduled value plus previously-billed-to-date, summed from this
 * contract's prior (non-void) owner invoices.
 */
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/invoicing/owner/sov#GET",
  async ({ request, params }) => {
    const where = "projects/[projectId]/invoicing/owner/sov#GET";
    const { projectId } = params;
    const projectIdNum = parseInt(projectId, 10);

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where, message: "Authentication required." });
    }

    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get("contractId");
    if (!contractId) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where,
        message: "A contractId query parameter is required.",
        details: [{ path: "contractId", message: "contractId is required." }],
      });
    }

    const supabase = await createClient();

    // Scope the contract to the project so one project can't read another's SOV.
    const { data: contract, error: contractError } = await supabase
      .from("prime_contracts")
      .select(
        "id, contract_number, title, original_contract_value, revised_contract_value, retention_percentage",
      )
      .eq("id", contractId)
      .eq("project_id", projectIdNum)
      .single();

    if (contractError || !contract) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: "Contract not found or does not belong to this project.",
        status: 404,
        severity: "low",
      });
    }

    const { data: lineRows, error: lineError } = await supabase
      .from("contract_line_items")
      .select("id, line_number, description, cost_code_id, total_cost")
      .eq("contract_id", contractId)
      .order("line_number", { ascending: true });

    if (lineError) {
      return apiErrorResponse(lineError);
    }

    const lineItems = lineRows ?? [];

    // Enrich cost code labels (cost_codes.id and cost_code_id are both TEXT).
    const costCodeIds = Array.from(
      new Set(
        lineItems
          .map((item) => item.cost_code_id)
          .filter((id): id is string => id != null),
      ),
    );
    const costCodeNameById = new Map<string, string>();
    if (costCodeIds.length > 0) {
      const { data: costCodes } = await supabase
        .from("cost_codes")
        .select("id, title")
        .in("id", costCodeIds);
      for (const cc of costCodes ?? []) {
        costCodeNameById.set(cc.id, cc.title ?? "");
      }
    }

    // Carry forward previously-billed per SOV line from prior owner invoices.
    // work_completed_period is the incremental billing per invoice, so summing
    // across all non-void prior invoices yields billed-to-date for the line.
    const billedByKey = new Map<string, number>();
    const { data: priorInvoices } = await supabase
      .from("owner_invoices")
      .select("status, owner_invoice_line_items(category, description, work_completed_period)")
      .eq("prime_contract_id", contractId);

    for (const invoice of priorInvoices ?? []) {
      if ((invoice.status ?? "").toLowerCase() === "void") continue;
      const priorLines = Array.isArray(invoice.owner_invoice_line_items)
        ? invoice.owner_invoice_line_items
        : [];
      for (const line of priorLines) {
        const key = sovKey(line.category ?? null, line.description ?? null);
        billedByKey.set(
          key,
          (billedByKey.get(key) ?? 0) + Number(line.work_completed_period ?? 0),
        );
      }
    }

    const contractAmount =
      contract.revised_contract_value ?? contract.original_contract_value ?? 0;

    return NextResponse.json({
      contract: {
        id: contract.id,
        contract_number: contract.contract_number,
        title: contract.title,
        contract_amount: contractAmount,
        retention_percentage: contract.retention_percentage ?? null,
      },
      line_items: lineItems.map((item) => {
        const costCode = item.cost_code_id ?? null;
        return {
          id: item.id,
          line_number: item.line_number,
          cost_code: costCode,
          cost_code_name: costCode ? costCodeNameById.get(costCode) ?? null : null,
          description: item.description ?? "",
          scheduled_value: Number(item.total_cost ?? 0),
          previously_billed:
            billedByKey.get(sovKey(costCode, item.description ?? null)) ?? 0,
        };
      }),
    });
  },
);

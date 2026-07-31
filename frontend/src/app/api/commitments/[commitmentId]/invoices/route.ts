import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

type CommitmentType = "subcontract" | "purchase_order";

interface CommitmentInvoiceLineItem {
  id: string;
  source_sov_item_id: string;
  line_number: number | null;
  budget_code: string | null;
  description: string;
  scheduled_value: number;
  gross_billed_to_date: number;
  retainage_percentage: number;
  retainage_held: number;
  net_billed_to_date: number;
  remaining_amount: number;
  percent_complete: number;
}

interface CommitmentInvoiceSummary {
  total_contract_amount: number;
  gross_billed_to_date: number;
  retainage_percentage: number;
  retainage_held: number;
  net_billed_to_date: number;
  remaining_to_invoice: number;
  net_remaining_balance: number;
  percent_invoiced: number;
}

interface CommitmentInvoiceResponse {
  summary: CommitmentInvoiceSummary;
  line_items: CommitmentInvoiceLineItem[];
  change_order_billed_to_date: Record<string, number>;
  billing_context: {
    commitment_type: CommitmentType;
    project_id: number | null;
    invoices_enabled: boolean;
    retainage_enabled: boolean;
  };
}

function roundCurrency(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

async function fetchCommitmentContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  commitmentId: string,
) {
  const { data: unifiedData, error: unifiedError } = await supabase
    .from("commitments_unified")
    .select("commitment_type")
    .eq("id", commitmentId)
    .single();

  if (unifiedError || !unifiedData) {
    return { error: "Commitment not found" as const };
  }

  const commitmentType = unifiedData.commitment_type as CommitmentType;
  const tableName =
    commitmentType === "subcontract" ? "subcontracts" : "purchase_orders";

  const { data: commitment, error: commitmentError } = await supabase
    .from(tableName)
    .select(
      "project_id, default_retainage_percent, contract_number, title, status",
    )
    .eq("id", commitmentId)
    .single();

  if (commitmentError || !commitment) {
    return { error: "Commitment not found" as const };
  }

  // Commitment tables in this schema do not currently persist advanced_settings.
  // Keep invoices/retainage enabled by default for read-only invoice summaries.
  const retainageEnabled = true;
  const invoicesEnabled = true;

  return {
    commitmentType,
    commitment: {
      projectId: Number(commitment.project_id ?? 0) || null,
      retainagePercentage: retainageEnabled
        ? Number(commitment.default_retainage_percent ?? 0)
        : 0,
      contractNumber: typeof commitment.contract_number === "string" ? commitment.contract_number : null,
      title: typeof commitment.title === "string" ? commitment.title : null,
      status: typeof commitment.status === "string" ? commitment.status : null,
      invoicesEnabled,
      retainageEnabled,
    },
  };
}

async function fetchLineItemsForCommitment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  commitmentId: string,
  commitmentType: CommitmentType,
) {
  const isSubcontract = commitmentType === "subcontract";
  const sovTableName = isSubcontract
    ? "subcontract_sov_items"
    : "purchase_order_sov_items";
  const sovFkColumn = isSubcontract ? "subcontract_id" : "purchase_order_id";

  let sovItems: Array<Record<string, unknown>> = [];

  if (isSubcontract) {
    const { data: approvedSubmission, error: submissionError } = await (supabase as any)
      .from("subcontractor_sov_submissions")
      .select("id, status")
      .eq("commitment_id", commitmentId)
      .eq("status", "approved")
      .maybeSingle();

    if (submissionError) {
      return { error: submissionError.message as string };
    }

    if (approvedSubmission?.id) {
      const { data, error } = await (supabase as any)
        .from("subcontractor_sov_items")
        .select("*")
        .eq("submission_id", approvedSubmission.id)
        .order("line_number", { ascending: true });

      if (error) {
        return { error: error.message as string };
      }

      const approvedItems = (data || []) as Array<Record<string, unknown>>;
      const { data: canonicalRows, error: canonicalError } = await supabase
        .from("subcontract_sov_items")
        .select("*")
        .eq("subcontract_id", commitmentId)
        .order("line_number", { ascending: true });

      if (canonicalError) {
        return { error: canonicalError.message };
      }

      const canonicalItems = (canonicalRows ?? []) as Array<
        Record<string, unknown>
      >;
      const reconciliationError =
        "Approved subcontractor SOV must contain every commitment SOV line exactly once. Reconcile the SOV before creating an invoice.";
      const claimedSourceIds = new Set<string>();
      sovItems = [];
      for (const approvedItem of approvedItems) {
        const explicitSourceId =
          typeof approvedItem.source_sov_item_id === "string"
            ? approvedItem.source_sov_item_id
            : null;
        const explicitSource = explicitSourceId
          ? canonicalItems.find(
              (canonicalItem) =>
                String(canonicalItem.id) === explicitSourceId,
            )
          : null;
        const metadataCandidates = explicitSourceId
          ? []
          : canonicalItems.filter(
              (canonicalItem) =>
                String(canonicalItem.budget_code ?? "")
                  .trim()
                  .toLowerCase() ===
                  String(approvedItem.budget_code ?? "")
                    .trim()
                    .toLowerCase() &&
                String(canonicalItem.description ?? "")
                  .trim()
                  .toLowerCase() ===
                  String(approvedItem.description ?? "")
                    .trim()
                    .toLowerCase(),
            );
        const source =
          explicitSource ??
          (explicitSourceId
            ? null
            : metadataCandidates.length === 1
              ? metadataCandidates[0]
              : approvedItems.length === 1 && canonicalItems.length === 1
                ? canonicalItems[0]
                : null);

        if (!source) {
          return {
            error: reconciliationError,
          };
        }

        const sourceId = String(source.id);
        if (claimedSourceIds.has(sourceId)) {
          return { error: reconciliationError };
        }
        claimedSourceIds.add(sourceId);

        sovItems.push({
          ...approvedItem,
          source_sov_item_id: sourceId,
          amount: source.amount,
          budget_code: source.budget_code,
          description: source.description,
        });
      }

      if (
        claimedSourceIds.size !== canonicalItems.length ||
        canonicalItems.some(
          (canonicalItem) =>
            !claimedSourceIds.has(String(canonicalItem.id)),
        )
      ) {
        return { error: reconciliationError };
      }
    }
  }

  if (sovItems.length === 0) {
    const { data, error } = await (supabase as any)
      .from(sovTableName)
      .select("*")
      .eq(sovFkColumn, commitmentId)
      .order("line_number", { ascending: true });

    if (error) {
      return { error: error.message as string };
    }

    sovItems = (data || []) as Array<Record<string, unknown>>;
  }

  return { data: sovItems };
}

async function fetchChangeOrderBilledToDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  commitmentId: string,
  commitmentType: CommitmentType,
) {
  const commitmentColumn =
    commitmentType === "subcontract" ? "subcontract_id" : "purchase_order_id";
  const { data: invoices, error: invoiceError } = await supabase
    .from("subcontractor_invoices")
    .select("id")
    .eq(commitmentColumn, commitmentId)
    .neq("status", "void");

  if (invoiceError) {
    return { error: invoiceError.message };
  }

  const invoiceIds = (invoices ?? []).map((invoice) => Number(invoice.id));
  if (invoiceIds.length === 0) {
    return { data: {} as Record<string, number> };
  }

  const { data: lines, error: lineError } = await supabase
    .from("subcontractor_invoice_line_items")
    .select(
      "source_change_order_id, work_completed_period, materials_stored",
    )
    .in("invoice_id", invoiceIds)
    .not("source_change_order_id", "is", null);

  if (lineError) {
    return { error: lineError.message };
  }

  const billedByChangeOrder: Record<string, number> = {};
  for (const line of lines ?? []) {
    if (!line.source_change_order_id) continue;
    billedByChangeOrder[line.source_change_order_id] =
      (billedByChangeOrder[line.source_change_order_id] ?? 0) +
      Number(line.work_completed_period ?? 0) +
      Number(line.materials_stored ?? 0);
  }
  return { data: billedByChangeOrder };
}

/**
 * GET /api/commitments/[commitmentId]/invoices
 *
 * Returns a retainage-aware billing summary for a commitment using the stored
 * SOV line-item progress. This is a view over commitment billing state, not a
 * separate owner invoice writer.
 */
export const GET = withApiGuardrails<{ commitmentId: string }>(
  "commitments/[commitmentId]/invoices#GET",
  async ({ request, params }) => {
  
    const { commitmentId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "commitments/[commitmentId]/invoices#GET",
        message: "Authentication required.",
      });
    }

    const context = await fetchCommitmentContext(supabase, commitmentId);
    if ("error" in context) {
      return NextResponse.json({ error: context.error }, { status: 404 });
    }

    const lineItemsResult = await fetchLineItemsForCommitment(
      supabase,
      commitmentId,
      context.commitmentType,
    );

    if ("error" in lineItemsResult) {
      return NextResponse.json({ error: lineItemsResult.error }, { status: 400 });
    }

    const changeOrderBillingResult = await fetchChangeOrderBilledToDate(
      supabase,
      commitmentId,
      context.commitmentType,
    );
    if ("error" in changeOrderBillingResult) {
      return NextResponse.json(
        { error: changeOrderBillingResult.error },
        { status: 400 },
      );
    }

    const retainagePercentage = context.commitment.retainagePercentage;
    const lineItems = lineItemsResult.data;

    const totalContractAmount = lineItems.reduce(
      (sum, item) => sum + Number(item.amount ?? 0),
      0,
    );
    const grossBilledToDate = lineItems.reduce(
      (sum, item) => sum + Number(item.billed_to_date ?? 0),
      0,
    );
    const retainageHeld = lineItems.reduce((sum, item) => {
      const gross = Number(item.billed_to_date ?? 0);
      return sum + roundCurrency(gross * (retainagePercentage / 100));
    }, 0);
    const netBilledToDate = roundCurrency(grossBilledToDate - retainageHeld);
    const remainingToInvoice = Math.max(totalContractAmount - grossBilledToDate, 0);
    const netRemainingBalance = Math.max(totalContractAmount - netBilledToDate, 0);

    const invoiceSummary: CommitmentInvoiceSummary = {
      total_contract_amount: roundCurrency(totalContractAmount),
      gross_billed_to_date: roundCurrency(grossBilledToDate),
      retainage_percentage: retainagePercentage,
      retainage_held: roundCurrency(retainageHeld),
      net_billed_to_date: roundCurrency(netBilledToDate),
      remaining_to_invoice: roundCurrency(remainingToInvoice),
      net_remaining_balance: roundCurrency(netRemainingBalance),
      percent_invoiced: totalContractAmount > 0
        ? Math.round((grossBilledToDate / totalContractAmount) * 100)
        : 0,
    };

    const invoiceLineItems: CommitmentInvoiceLineItem[] = lineItems.map((item) => {
      const amount = Number(item.amount ?? 0);
      const gross = Number(item.billed_to_date ?? 0);
      const itemRetainageHeld = roundCurrency(gross * (retainagePercentage / 100));
      const itemNetBilled = roundCurrency(gross - itemRetainageHeld);
      const remainingAmount = Math.max(amount - gross, 0);

      return {
        id: String(item.id),
        source_sov_item_id:
          typeof item.source_sov_item_id === "string"
            ? item.source_sov_item_id
            : String(item.id),
        line_number:
          typeof item.line_number === "number"
            ? item.line_number
            : typeof item.line_number === "string"
              ? Number(item.line_number)
              : null,
        budget_code:
          typeof item.budget_code === "string"
            ? item.budget_code
            : typeof item.cost_code === "string"
              ? item.cost_code
              : null,
        description:
          typeof item.description === "string" ? item.description : "",
        scheduled_value: roundCurrency(amount),
        gross_billed_to_date: roundCurrency(gross),
        retainage_percentage: retainagePercentage,
        retainage_held: roundCurrency(itemRetainageHeld),
        net_billed_to_date: roundCurrency(itemNetBilled),
        remaining_amount: roundCurrency(remainingAmount),
        percent_complete: amount > 0 ? Math.round((gross / amount) * 100) : 0,
      };
    });

    const responseData: CommitmentInvoiceResponse = {
      summary: invoiceSummary,
      line_items: invoiceLineItems,
      change_order_billed_to_date: changeOrderBillingResult.data,
      billing_context: {
        commitment_type: context.commitmentType,
        project_id: context.commitment.projectId,
        invoices_enabled: context.commitment.invoicesEnabled,
        retainage_enabled: context.commitment.retainageEnabled,
      },
    };

    return NextResponse.json(responseData);
    },
);

/**
 * POST /api/commitments/[commitmentId]/invoices
 *
 * Commitment invoice creation is not yet wired to a dedicated persistence model.
 * This endpoint stays disabled to avoid writing commitment invoices into the
 * wrong tables.
 */
export const POST = withApiGuardrails<{ commitmentId: string }>(
  "commitments/[commitmentId]/invoices#POST",
  async ({ request, params }) => {
  
    const { commitmentId } = await params;
    const supabase = await createClient();
    const context = await fetchCommitmentContext(supabase, commitmentId);

    if ("error" in context) {
      return NextResponse.json({ error: context.error }, { status: 404 });
    }

    return NextResponse.json(
      {
        error:
          "Commitment invoice creation is not implemented yet. The retainage billing tab is currently read-only.",
      },
      { status: 405 },
    );
    },
);

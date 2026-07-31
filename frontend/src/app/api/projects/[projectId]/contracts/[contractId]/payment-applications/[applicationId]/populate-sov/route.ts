import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions-guard";

interface RouteParams {
  params: Promise<{
    projectId: string;
    contractId: string;
    applicationId: string;
  }>;
}

/**
 * POST /api/projects/[projectId]/contracts/[contractId]/payment-applications/[applicationId]/populate-sov
 * Auto-populate line items from the contract's SOV + approved change orders.
 * Carries forward previous application amounts when applicable.
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/payment-applications/[applicationId]/populate-sov#POST",
  async ({ request, params }) => {
  
    const { projectId, contractId, applicationId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const guard = await requirePermission(projectIdNum, "contracts", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    // 1. Check if line items already exist for this application
    const { data: existingItems, error: existingError } = await supabase
      .from("payment_application_line_items")
      .select("id")
      .eq("payment_application_id", applicationId)
      .limit(1);

    if (existingError) {
      return NextResponse.json(
        { error: "Failed to check existing line items", details: existingError.message },
        { status: 400 },
      );
    }

    if (existingItems && existingItems.length > 0) {
      return NextResponse.json(
        { error: "Line items already exist for this payment application" },
        { status: 409 },
      );
    }

    // 2. Get the current application to find its application_number
    const { data: currentApp, error: currentAppError } = await supabase
      .from("prime_contract_payment_applications")
      .select("application_number")
      .eq("id", applicationId)
      .single();

    if (currentAppError || !currentApp) {
      return NextResponse.json(
        { error: "Payment application not found" },
        { status: 404 },
      );
    }

    const { data: contract, error: contractError } = await supabase
      .from("prime_contracts")
      .select("retention_percentage")
      .eq("id", contractId)
      .single();

    if (contractError || !contract) {
      return NextResponse.json(
        { error: "Prime contract not found" },
        { status: 404 },
      );
    }

    const defaultRetainagePct = Number(contract.retention_percentage ?? 0);

    // 3. Find previous payment application by comparing application_number
    // Application numbers are typically sequential strings like "1", "2", "3"
    const currentAppNum = parseInt(currentApp.application_number, 10);
    const previousLineItems: PreviousLineItemMap = {};

    if (!isNaN(currentAppNum) && currentAppNum > 1) {
      const prevAppNum = String(currentAppNum - 1);

      const { data: prevApp } = await supabase
        .from("prime_contract_payment_applications")
        .select("id")
        .eq("contract_id", contractId)
        .eq("application_number", prevAppNum)
        .single();

      if (prevApp) {
        const { data: prevItems } = await supabase
          .from("payment_application_line_items")
          .select("*")
          .eq("payment_application_id", prevApp.id);

        if (prevItems) {
          // Index previous items by sov_item_id and change_order_id for lookup
          for (const item of prevItems) {
            const key = item.sov_item_id
              ? `sov:${item.sov_item_id}`
              : item.change_order_id
                ? `co:${item.change_order_id}`
                : null;
            if (key) {
              previousLineItems[key] = {
                work_completed_previous:
                  (item.work_completed_previous ?? 0) +
                  (item.work_completed_this_period ?? 0) +
                  (item.materials_stored ?? 0),
                retainage_previous_work:
                  (item.retainage_previous_work ?? 0) +
                  (item.retainage_this_period_work ?? 0) -
                  (item.retainage_released_work ?? 0),
                retainage_previous_materials:
                  (item.retainage_previous_materials ?? 0) +
                  (item.retainage_this_period_materials ?? 0) -
                  (item.retainage_released_materials ?? 0),
              };
            }
          }
        }
      }
    }

    // 4. Fetch SOV items for the contract
    const { data: sovItems, error: sovError } = await supabase
      .from("prime_contract_sovs")
      .select("*")
      .eq("contract_id", contractId)
      .order("sort_order", { ascending: true });

    if (sovError) {
      return NextResponse.json(
        { error: "Failed to fetch SOV items", details: sovError.message },
        { status: 400 },
      );
    }

    // 5. Fetch approved prime contract change orders and their cost-code line items.
    const { data: changeOrders, error: coError } = await supabase
      .from("prime_contract_change_orders")
      .select("id, pcco_number, title, description, total_amount, prime_contract_id, contract_id")
      .eq("project_id", projectIdNum)
      .or(`prime_contract_id.eq.${contractId},contract_id.eq.${contractId}`)
      .ilike("status", "approved%");

    if (coError) {
      return NextResponse.json(
        { error: "Failed to fetch change orders", details: coError.message },
        { status: 400 },
      );
    }

    const pccoIds = (changeOrders ?? []).map((co) => co.id);
    let changeOrderLineItems: PccoLineItem[] = [];
    if (pccoIds.length > 0) {
      const { data: lineData, error: lineError } = await supabase
        .from("pcco_line_items")
        .select("id, pcco_id, description, cost_code, line_amount")
        .in("pcco_id", pccoIds)
        .order("id", { ascending: true });

      if (lineError) {
        return NextResponse.json(
          { error: "Failed to fetch prime contract change order line items", details: lineError.message },
          { status: 400 },
        );
      }

      changeOrderLineItems = lineData ?? [];
    }

    const pccoLineItemsByPccoId = new Map<number, PccoLineItem[]>();
    for (const lineItem of changeOrderLineItems) {
      const items = pccoLineItemsByPccoId.get(lineItem.pcco_id) ?? [];
      items.push(lineItem);
      pccoLineItemsByPccoId.set(lineItem.pcco_id, items);
    }

    // 6. Build line items array
    let sortOrder = 1;
    const lineItems: LineItemInsert[] = [];

    // SOV items first
    for (const sov of sovItems ?? []) {
      const prevKey = `sov:${sov.id}`;
      const prev = previousLineItems[prevKey];

      lineItems.push({
        payment_application_id: applicationId,
        item_number: String(sortOrder),
        description: sov.description ?? "",
        scheduled_value: sov.line_amount ?? 0,
        sov_item_id: sov.id,
        change_order_id: null,
        budget_code: sov.cost_code ?? null,
        sort_order: sortOrder,
        work_completed_previous: prev?.work_completed_previous ?? 0,
        work_completed_this_period: 0,
        materials_stored: 0,
        retainage_previous_work: prev?.retainage_previous_work ?? 0,
        retainage_previous_materials: prev?.retainage_previous_materials ?? 0,
        retainage_this_period_work: 0,
        retainage_this_period_work_pct: defaultRetainagePct,
        retainage_this_period_materials: 0,
        retainage_this_period_materials_pct: defaultRetainagePct,
        retainage_released_work: 0,
        retainage_released_materials: 0,
      });
      sortOrder++;
    }

    // Then prime contract change order items.
    for (const co of changeOrders ?? []) {
      const pccoLines = pccoLineItemsByPccoId.get(co.id) ?? [];
      const linesToInsert = pccoLines.length > 0
        ? pccoLines
        : [{
            id: 0,
            pcco_id: co.id,
            description: co.description ?? co.title,
            cost_code: null,
            line_amount: co.total_amount ?? 0,
          }];

      for (const pccoLine of linesToInsert) {
        // payment_application_line_items.change_order_id points to commitment COs,
        // so prime contract COs are represented as standalone PCCO rows here.
        lineItems.push({
          payment_application_id: applicationId,
          item_number: String(sortOrder),
          description: `CO #${co.pcco_number ?? co.id}: ${pccoLine.description ?? co.title}`,
          scheduled_value: pccoLine.line_amount ?? 0,
          sov_item_id: null,
          change_order_id: null,
          budget_code: pccoLine.cost_code ?? null,
          sort_order: sortOrder,
          work_completed_previous: 0,
          work_completed_this_period: 0,
          materials_stored: 0,
          retainage_previous_work: 0,
          retainage_previous_materials: 0,
          retainage_this_period_work: 0,
          retainage_this_period_work_pct: defaultRetainagePct,
          retainage_this_period_materials: 0,
          retainage_this_period_materials_pct: defaultRetainagePct,
          retainage_released_work: 0,
          retainage_released_materials: 0,
        });
        sortOrder++;
      }
    }

    if (lineItems.length === 0) {
      return NextResponse.json(
        { error: "No SOV items or approved change orders found for this contract" },
        { status: 400 },
      );
    }

    // 7. Insert all line items
    const { data: inserted, error: insertError } = await supabase
      .from("payment_application_line_items")
      .insert(lineItems)
      .select();

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to insert line items", details: insertError.message },
        { status: 400 },
      );
    }

    return NextResponse.json(inserted, { status: 201 });
    },
);

// Type helpers
interface PreviousCarryForward {
  work_completed_previous: number;
  retainage_previous_work: number;
  retainage_previous_materials: number;
}

type PreviousLineItemMap = Record<string, PreviousCarryForward>;

interface PccoLineItem {
  id: number;
  pcco_id: number;
  description: string | null;
  cost_code: string | null;
  line_amount: number | null;
}

interface LineItemInsert {
  payment_application_id: string;
  item_number: string;
  description: string;
  scheduled_value: number;
  sov_item_id: number | null;
  change_order_id: string | null;
  budget_code: string | null;
  sort_order: number;
  work_completed_previous: number;
  work_completed_this_period: number;
  materials_stored: number;
  retainage_previous_work: number;
  retainage_previous_materials: number;
  retainage_this_period_work: number;
  retainage_this_period_work_pct: number;
  retainage_this_period_materials: number;
  retainage_this_period_materials_pct: number;
  retainage_released_work: number;
  retainage_released_materials: number;
}

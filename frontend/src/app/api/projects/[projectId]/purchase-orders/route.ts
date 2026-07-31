import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { CreatePurchaseOrderSchema } from "@/lib/schemas/create-purchase-order-schema";
import { apiErrorResponse } from "@/lib/api-error";
import { normalizeCommitmentContractNumber } from "@/lib/commitments/contract-number";
import {
  fetchCommitmentSovProjectBudgetCodes,
  resolveCommitmentSovBudgetCodeFromLookup,
} from "@/lib/commitments/sov-budget-code-resolution.server";

/**
 * GET /api/projects/[id]/purchase-orders
 * Fetch all purchase orders for a project
 */
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/purchase-orders#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/purchase-orders#GET", message: "Authentication required." });
    }

    const { data, error } = await supabase
      .from("purchase_orders_with_totals")
      .select("*")
      .eq("project_id", parseInt(projectId, 10))
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch purchase orders" },
        { status: 500 },
      );
    }

    return NextResponse.json({ data });
    },
);

/**
 * POST /api/projects/[id]/purchase-orders
 * Create a new purchase order
 */
export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/purchase-orders#POST",
  async ({ request, params }) => {
  const { projectId } = await params;

  try {
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - no user session" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const validationResult = CreatePurchaseOrderSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        { status: 400 },
      );
    }

    const data = validationResult.data;

    // Map form data to database columns
    const purchaseOrderData = {
      project_id: parseInt(projectId),
      contract_number: normalizeCommitmentContractNumber(
        data.contractNumber,
        "PO-",
      ),
      contract_company_id: data.contractCompanyId || null,
      title: data.title || null,
      status: data.status || "Draft",
      executed: data.executed ?? false,
      default_retainage_percent: data.defaultRetainagePercent ?? null,
      assigned_to: data.assignedTo || null,
      bill_to: data.billTo || null,
      bill_to_company_id: data.billToCompanyId || null,
      bill_to_contact_id: data.billToContactId || null,
      bill_to_address: data.billToAddress || null,
      bill_to_address_line2: data.billToAddressLine2 || null,
      bill_to_city: data.billToCity || null,
      bill_to_state: data.billToState || null,
      bill_to_zip: data.billToZip || null,
      payment_terms: data.paymentTerms || null,
      ship_to: data.shipTo || null,
      ship_to_company_id: data.shipToCompanyId || null,
      ship_to_contact_id: data.shipToContactId || null,
      ship_to_address: data.shipToAddress || null,
      ship_to_address_line2: data.shipToAddressLine2 || null,
      ship_to_city: data.shipToCity || null,
      ship_to_state: data.shipToState || null,
      ship_to_zip: data.shipToZip || null,
      ship_via: data.shipVia || null,
      description: data.description || null,
      accounting_method: data.accountingMethod || "amount",
      contract_date: data.dates?.contractDate || null,
      delivery_date: data.dates?.deliveryDate || null,
      signed_po_received_date: data.dates?.signedPoReceivedDate || null,
      issued_on_date: data.dates?.issuedOnDate || null,
      is_private: data.privacy?.isPrivate ?? true,
      non_admin_user_ids: data.privacy?.nonAdminUserIds || [],
      allow_non_admin_view_sov_items:
        data.privacy?.allowNonAdminViewSovItems ?? false,
      invoice_contact_ids: data.invoiceContactIds || [],
      created_by: user.id,
    };

    const { data: purchaseOrder, error: poError } = await supabase
      .from("purchase_orders")
      .insert(purchaseOrderData)
      .select()
      .single();

    if (poError) {
      return NextResponse.json(
        {
          error: "Failed to create purchase order",
          details: poError,
        },
        { status: 500 },
      );
    }

    // Create SOV line items if provided
    if (data.sov && data.sov.length > 0) {
      const projectBudgetCodes = await fetchCommitmentSovProjectBudgetCodes(
        supabase,
        parseInt(projectId, 10),
        "projects/[projectId]/purchase-orders#POST",
      );
      const sovItems = await Promise.all(
        data.sov.map((item, index) => {
          const lineNumber = item.lineNumber || index + 1;
          const budgetCode = resolveCommitmentSovBudgetCodeFromLookup({
            budgetCodes: projectBudgetCodes,
            lineNumber,
            where: "projects/[projectId]/purchase-orders#POST",
            submittedBudgetCode: item.budgetCode,
            submittedProjectBudgetCodeId:
              item.projectBudgetCodeId ?? item.budgetCodeId ?? null,
          });

          return {
            purchase_order_id: purchaseOrder.id,
            line_number: lineNumber,
            change_event_line_item: item.changeEventLineItem || null,
            budget_code: budgetCode.displayBudgetCode,
            project_budget_code_id: budgetCode.projectBudgetCodeId,
            description: item.description || null,
            quantity: item.quantity ?? null,
            uom: item.uom || null,
            unit_cost: item.unitCost ?? null,
            amount: item.amount || 0,
            billed_to_date: item.billedToDate || 0,
            sort_order: index,
          };
        }),
      );

      const { error: sovError } = await supabase
        .from("purchase_order_sov_items")
        .insert(sovItems);

      if (sovError) {
        await supabase
          .from("purchase_orders")
          .delete()
          .eq("id", purchaseOrder.id);
        return NextResponse.json(
          { error: "Failed to create SOV items", details: sovError },
          { status: 500 },
        );
      }
    }

    // Fetch complete purchase order with totals
    const { data: completePO } = await supabase
      .from("purchase_orders_with_totals")
      .select("*")
      .eq("id", purchaseOrder.id)
      .single();

    return NextResponse.json({
      data: completePO || purchaseOrder,
      message: "Purchase order created successfully",
    });
  } catch (error) {
    if (error instanceof GuardrailError) {
      throw error;
    }
    return apiErrorResponse(error);
  }
  },
);

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api-error";

// Zod schema for change order update
const updateChangeOrderSchema = z.object({
  change_order_number: z
    .string()
    .trim()
    .min(1, "Change order number is required")
    .max(100)
    .optional(),
  title: z.string().trim().max(255).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  amount: z.coerce.number().optional(),
  status: z
    .enum(["draft", "pending", "approved", "out_for_signature", "executed", "void"])
    .optional(),
  requested_date: z.string().optional().nullable(),
  requested_by: z.string().uuid().optional().nullable(),
  change_reason: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  invoiced_date: z.string().optional().nullable(),
  designated_reviewer: z.string().optional().nullable(),
  schedule_impact: z.coerce.number().int().optional().nullable(),
  location: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  is_private: z.boolean().optional(),
  executed: z.boolean().optional(),
  field_change: z.boolean().optional(),
  paid_in_full: z.boolean().optional(),
});

/**
 * GET /api/commitments/[commitmentId]/change-orders/[changeOrderId]
 *
 * Retrieves a single change order by ID, verifying it belongs to the
 * specified commitment (contract_id match).
 *
 * @route GET /api/commitments/[commitmentId]/change-orders/[changeOrderId]
 * @param {string} commitmentId - Commitment UUID (contract_id)
 * @param {string} changeOrderId - Change order UUID
 *
 * @returns {object} 200 - Change order details: { data: ChangeOrderRecord }
 * @returns {object} 404 - Change order not found (PGRST116)
 * @returns {object} 400 - Database query error
 * @returns {object} 500 - Internal server error
 */
export const GET = withApiGuardrails<{ commitmentId: string; changeOrderId: string }>(
  "commitments/[commitmentId]/change-orders/[changeOrderId]#GET",
  async ({ request, params }) => {
  
    const { commitmentId, changeOrderId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "commitments/[commitmentId]/change-orders/[changeOrderId]#GET",
        message: "Authentication required.",
      });
    }

    const { data: changeOrder, error } = await supabase
      .from("contract_change_orders")
      .select("*")
      .eq("id", changeOrderId)
      .eq("contract_id", commitmentId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Change order not found" },
          { status: 404 },
        );
      }
      return apiErrorResponse(error);
    }

    return NextResponse.json({ data: changeOrder });
    },
);

/**
 * PUT /api/commitments/[commitmentId]/change-orders/[changeOrderId]
 *
 * Updates a specific change order. Validates request body against
 * updateChangeOrderSchema (Zod). If the status is changed to "approved",
 * the approved_date and approved_by fields are automatically set.
 *
 * @route PUT /api/commitments/[commitmentId]/change-orders/[changeOrderId]
 * @param {string} commitmentId - Commitment UUID (contract_id)
 * @param {string} changeOrderId - Change order UUID
 *
 * @requestBody {object} All fields optional:
 *   - change_order_number {string} - CO number (max 100 chars)
 *   - description {string} - CO description (max 2000 chars)
 *   - amount {number} - Dollar amount
 *   - status {string} - One of: draft, pending, approved, executed, void
 *   - requested_date {string|null} - ISO date string
 *   - requested_by {string|null} - UUID of requesting user
 *
 * @returns {object} 200 - Updated change order: { data: ChangeOrderRecord }
 * @returns {object} 400 - Validation error or database error
 * @returns {object} 401 - Unauthorized (no user session)
 * @returns {object} 404 - Change order not found
 * @returns {object} 500 - Internal server error
 */
export const PUT = withApiGuardrails<{ commitmentId: string; changeOrderId: string }>(
  "commitments/[commitmentId]/change-orders/[changeOrderId]#PUT",
  async ({ request, params }) => {
  
    const { commitmentId, changeOrderId } = await params;
    const supabase = await createClient();
    const body = await request.json();

    // Get the current user
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "commitments/[commitmentId]/change-orders/[changeOrderId]#PUT", message: "Authentication required." });
    }

    // Validate request body
    const validation = updateChangeOrderSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const validated = validation.data;

    // Verify the change order exists and belongs to this commitment
    const { data: existingCO, error: fetchError } = await supabase
      .from("contract_change_orders")
      .select("id, status, created_at")
      .eq("id", changeOrderId)
      .eq("contract_id", commitmentId)
      .single();

    if (fetchError || !existingCO) {
      return NextResponse.json(
        { error: "Change order not found" },
        { status: 404 },
      );
    }

    // Guardrail: the requested date can never be later than the date this
    // change order was created — a request necessarily precedes its record.
    // Compare calendar-date prefixes (not parsed Date instants) so this can't
    // false-positive across timezones at day boundaries.
    if (
      validated.requested_date &&
      existingCO.created_at &&
      validated.requested_date.slice(0, 10) > existingCO.created_at.slice(0, 10)
    ) {
      return NextResponse.json(
        {
          error: "Invalid requested date",
          message: "Requested date cannot be later than the date the change order was created.",
        },
        { status: 400 },
      );
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      ...validated,
      updated_at: new Date().toISOString(),
    };
    if ("description" in updateData) {
      updateData.description = updateData.description ?? "";
    }

    // If status is changing to approved, set approved_date and approved_by
    if (
      validated.status === "approved" &&
      existingCO.status !== "approved"
    ) {
      updateData.approved_date = new Date().toISOString().split("T")[0];
      updateData.approved_by = user.id;
    }

    // Update the change order
    const { data: updatedCO, error: updateError } = await supabase
      .from("contract_change_orders")
      .update(updateData)
      .eq("id", changeOrderId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ data: updatedCO });
    },
);

/**
 * DELETE /api/commitments/[commitmentId]/change-orders/[changeOrderId]
 *
 * Permanently deletes a change order. Only draft change orders can be deleted.
 * Change orders with any other status must first be changed to "draft" before
 * deletion is allowed.
 *
 * @route DELETE /api/commitments/[commitmentId]/change-orders/[changeOrderId]
 * @param {string} commitmentId - Commitment UUID (contract_id)
 * @param {string} changeOrderId - Change order UUID
 *
 * @returns {object} 200 - { success: true, message: "Change order deleted successfully" }
 * @returns {object} 400 - Cannot delete non-draft change order
 * @returns {object} 401 - Unauthorized (no user session)
 * @returns {object} 404 - Change order not found
 * @returns {object} 500 - Internal server error
 */
export const DELETE = withApiGuardrails<{ commitmentId: string; changeOrderId: string }>(
  "commitments/[commitmentId]/change-orders/[changeOrderId]#DELETE",
  async ({ request, params }) => {
    const where = "commitments/[commitmentId]/change-orders/[changeOrderId]#DELETE";
    const { commitmentId, changeOrderId } = await params;
    const supabase = await createClient();

    // Get the current user
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where, message: "Authentication required." });
    }

    // Verify the change order exists and belongs to this commitment
    const { data: existingCO, error: fetchError } = await supabase
      .from("contract_change_orders")
      .select("id, status, change_order_number")
      .eq("id", changeOrderId)
      .eq("contract_id", commitmentId)
      .single();

    if (fetchError || !existingCO) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where,
        message: "Change order not found.",
        status: 404,
      });
    }

    // Only allow deletion of draft change orders
    if (existingCO.status !== "draft") {
      const number = existingCO.change_order_number?.trim() || "This change order";
      throw new GuardrailError({
        code: "PRECONDITION_FAILED",
        where,
        message:
          `${number} is currently ${existingCO.status}. Only draft change orders can be deleted. ` +
          "Change the status back to draft first.",
        details: {
          code: "CHANGE_ORDER_NOT_DRAFT",
          status: existingCO.status,
          change_order_id: existingCO.id,
        },
      });
    }

    // Fail loudly when financial-history rows still reference this change
    // order. Deleting a draft shell is fine; deleting invoiced history is not.
    const { data: paymentApplicationLines, error: paymentApplicationError } =
      await supabase
        .from("payment_application_line_items")
        .select("id, payment_application_id")
        .eq("change_order_id", changeOrderId);

    if (paymentApplicationError) {
      return apiErrorResponse(paymentApplicationError);
    }

    if (paymentApplicationLines && paymentApplicationLines.length > 0) {
      throw new GuardrailError({
        code: "PRECONDITION_FAILED",
        where,
        status: 409,
        message:
          `Cannot delete this change order because ${paymentApplicationLines.length} subcontractor invoice line item${paymentApplicationLines.length === 1 ? "" : "s"} still reference${paymentApplicationLines.length === 1 ? "s" : ""} it. ` +
          "Remove the change order from those payment applications first.",
        details: {
          code: "CHANGE_ORDER_HAS_PAYMENT_APPLICATION_LINES",
          references: paymentApplicationLines.map((line) => ({
            id: line.id,
            payment_application_id: line.payment_application_id,
          })),
        },
      });
    }

    // This table currently lacks a database FK back to contract_change_orders,
    // so the delete owner must clean up scoped child rows explicitly to avoid
    // orphaned line items when a draft change order is removed.
    const { data: lineItems, error: lineItemsError } = await supabase
      .from("commitment_change_order_lines")
      .select("id")
      .eq("commitment_change_order_id", changeOrderId);

    if (lineItemsError) {
      return apiErrorResponse(lineItemsError);
    }

    if (lineItems && lineItems.length > 0) {
      const { error: deleteLineItemsError } = await supabase
        .from("commitment_change_order_lines")
        .delete()
        .eq("commitment_change_order_id", changeOrderId);

      if (deleteLineItemsError) {
        return apiErrorResponse(deleteLineItemsError);
      }
    }

    // Delete the change order
    const { error: deleteError, count } = await supabase
      .from("contract_change_orders")
      .delete({ count: "exact" })
      .eq("id", changeOrderId);

    if (!deleteError && count === 0) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where,
        message: "Change order not found.",
        status: 404,
      });
    }

    if (deleteError) {
      return apiErrorResponse(deleteError);
    }

    return NextResponse.json({
      success: true,
      message: "Change order deleted successfully",
      deleted_line_item_count: lineItems?.length ?? 0,
    });
  },
);

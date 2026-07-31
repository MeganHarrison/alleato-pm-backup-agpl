import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api-error";

// Zod schema for commitment change order creation
// OWASP: Input validation on financial mutation endpoints (A03:2021 - Injection)
const createCommitmentChangeOrderSchema = z.object({
  change_order_number: z
    .string()
    .trim()
    .min(1, "Change order number is required")
    .max(100, "Change order number must be at most 100 characters"),
  title: z.string().trim().max(255).optional().nullable(),
  description: z
    .string()
    .trim()
    .max(2000, "Description must be at most 2000 characters")
    .optional()
    .nullable(),
  amount: z.coerce.number({ message: "Amount must be a number" }),
  status: z
    .enum(["draft", "pending", "approved", "out_for_signature", "executed", "void"])
    .default("draft"),
  requested_date: z
    .string()
    .refine(
      (val) => !val || !Number.isNaN(Date.parse(val)),
      "Must be a valid date string",
    )
    .optional()
    .nullable(),
  requested_by: z.string().uuid().optional().nullable(),
  change_reason: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  invoiced_date: z.string().optional().nullable(),
  designated_reviewer: z.string().optional().nullable(),
  schedule_impact: z.coerce.number().int().optional().nullable(),
  location: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  is_private: z.boolean().optional().default(false),
  executed: z.boolean().optional().default(false),
  field_change: z.boolean().optional().default(false),
  paid_in_full: z.boolean().optional().default(false),
});

/**
 * GET /api/commitments/[commitmentId]/change-orders
 *
 * Retrieves all change orders associated with a specific commitment.
 * Queries the `contract_change_orders` table where contract_id matches.
 * Results are ordered by created_at descending (newest first).
 *
 * @route GET /api/commitments/[commitmentId]/change-orders
 * @param {string} commitmentId - Commitment UUID (used as contract_id)
 *
 * @returns {object} 200 - Change orders with aggregated totals:
 *   {
 *     data: Array<{
 *       id, number, title, status, amount, requested_date,
 *       requested_by, approved_date, approved_by, rejection_reason,
 *       created_at, updated_at
 *     }>,
 *     meta: {
 *       total_count: number,
 *       total_amount: number,
 *       approved_amount: number
 *     }
 *   }
 * @returns {object} 400 - Database query error
 * @returns {object} 500 - Internal server error
 */
export const GET = withApiGuardrails<{ commitmentId: string }>(
  "commitments/[commitmentId]/change-orders#GET",
  async ({ request, params }) => {
  
    const { commitmentId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "commitments/[commitmentId]/change-orders#GET",
        message: "Authentication required.",
      });
    }

    // Query contract_change_orders table where contract_id matches the commitment id
    const { data: changeOrders, error } = await supabase
      .from("contract_change_orders")
      .select(
        `
        id,
        change_order_number,
        title,
        description,
        status,
        amount,
        requested_date,
        requested_by,
        approved_date,
        approved_by,
        rejection_reason,
        change_reason,
        due_date,
        invoiced_date,
        designated_reviewer,
        schedule_impact,
        location,
        reference,
        is_private,
        executed,
        field_change,
        paid_in_full,
        created_at,
        updated_at
      `,
      )
      .eq("contract_id", commitmentId)
      .order("created_at", { ascending: false });

    if (error) {
      return apiErrorResponse(error);
    }

    // Return empty array if no change orders (200 status, not 404)
    if (!changeOrders || changeOrders.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Map to expected frontend format
    const formattedChangeOrders = changeOrders.map((co) => ({
      id: co.id,
      change_order_number: co.change_order_number,
      number: co.change_order_number,
      title: co.title ?? co.description ?? null,
      description: co.description ?? null,
      status: co.status?.toLowerCase() || "draft",
      amount: Number(co.amount) || 0,
      requested_date: co.requested_date,
      requested_by: co.requested_by,
      approved_date: co.approved_date,
      approved_by: co.approved_by,
      rejection_reason: co.rejection_reason,
      created_at: co.created_at,
      updated_at: co.updated_at,
    }));

    // Calculate totals
    const totalAmount = formattedChangeOrders.reduce(
      (sum, co) => sum + co.amount,
      0,
    );
    const approvedAmount = formattedChangeOrders
      .filter((co) => co.status === "approved")
      .reduce((sum, co) => sum + co.amount, 0);

    return NextResponse.json({
      data: formattedChangeOrders,
      meta: {
        total_count: formattedChangeOrders.length,
        total_amount: totalAmount,
        approved_amount: approvedAmount,
      },
    });
    },
);

/**
 * POST /api/commitments/[commitmentId]/change-orders
 *
 * Creates a new change order for a specific commitment. The request body
 * is validated against a Zod schema (createCommitmentChangeOrderSchema).
 *
 * @route POST /api/commitments/[commitmentId]/change-orders
 * @param {string} commitmentId - Commitment UUID
 *
 * @requestBody {object} Validated fields:
 *   - change_order_number {string} (required) - Unique CO number (max 100 chars)
 *   - description {string} (required) - CO description (max 2000 chars)
 *   - amount {number} (required) - Change order dollar amount
 *   - status {string} [default="draft"] - One of: draft, pending, approved, executed, void
 *   - requested_date {string} [optional] - ISO date string
 *   - requested_by {string} [optional] - UUID of requesting user
 *
 * @returns {object} 201 - Created change order with formatted fields
 * @returns {object} 400 - Validation error or duplicate CO number (23505)
 * @returns {object} 401 - Unauthorized (no user session)
 * @returns {object} 404 - Commitment not found
 * @returns {object} 500 - Internal server error
 */
export const POST = withApiGuardrails<{ commitmentId: string }>(
  "commitments/[commitmentId]/change-orders#POST",
  async ({ request, params }) => {
  
    const { commitmentId } = await params;
    const supabase = await createClient();
    const body = await request.json();

    // Get the current user
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "commitments/[commitmentId]/change-orders#POST", message: "Authentication required." });
    }

    // Verify commitment exists
    const { data: commitment, error: fetchError } = await supabase
      .from("commitments_unified")
      .select("id, project_id")
      .eq("id", commitmentId)
      .single();

    if (fetchError || !commitment) {
      return NextResponse.json(
        { error: "Commitment not found" },
        { status: 404 },
      );
    }

    // Validate request body with Zod schema
    const validation = createCommitmentChangeOrderSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const validated = validation.data;

    // Create change order
    const { data: newChangeOrder, error: createError } = await supabase
      .from("contract_change_orders")
      .insert({
        contract_id: commitmentId,
        change_order_number: validated.change_order_number,
        title: validated.title ?? null,
        description: validated.description ?? "",
        amount: validated.amount,
        status: validated.status,
        requested_date: validated.requested_date || new Date().toISOString(),
        requested_by: validated.requested_by || user.id,
        change_reason: validated.change_reason ?? null,
        due_date: validated.due_date ?? null,
        invoiced_date: validated.invoiced_date ?? null,
        designated_reviewer: validated.designated_reviewer ?? null,
        schedule_impact: validated.schedule_impact ?? null,
        location: validated.location ?? null,
        reference: validated.reference ?? null,
        is_private: validated.is_private ?? false,
        executed: validated.executed ?? false,
        field_change: validated.field_change ?? false,
        paid_in_full: validated.paid_in_full ?? false,
      })
      .select()
      .single();

    if (createError) {
      // Handle duplicate change order number
      if (createError.code === "23505") {
        return NextResponse.json(
          { error: "Change order number already exists for this commitment" },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: createError.message },
        { status: 400 },
      );
    }

    // Format response
    const formattedChangeOrder = {
      id: newChangeOrder.id,
      number: newChangeOrder.change_order_number,
      title: newChangeOrder.description,
      status: newChangeOrder.status?.toLowerCase() || "draft",
      amount: Number(newChangeOrder.amount) || 0,
      requested_date: newChangeOrder.requested_date,
      requested_by: newChangeOrder.requested_by,
      created_at: newChangeOrder.created_at,
      updated_at: newChangeOrder.updated_at,
    };

    return NextResponse.json(formattedChangeOrder, { status: 201 });
    },
);

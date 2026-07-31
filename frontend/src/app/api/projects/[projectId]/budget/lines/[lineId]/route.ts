import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { z } from "zod";
import { requirePermission } from "@/lib/permissions-guard";
import { apiErrorResponse } from "@/lib/api-error";

// Zod schema for budget line PATCH updates
// All fields optional since PATCH allows partial updates
// OWASP: Input validation to prevent injection and data integrity issues (A03:2021 - Injection)
const budgetLinePatchSchema = z
  .object({
    quantity: z
      .union([z.number(), z.string()])
      .transform((val) => (typeof val === "string" ? parseFloat(val) : val))
      .refine((val) => !Number.isNaN(val), "quantity must be a valid number")
      .optional(),
    unit_cost: z
      .union([z.number(), z.string()])
      .transform((val) => (typeof val === "string" ? parseFloat(val) : val))
      .refine((val) => !Number.isNaN(val), "unit_cost must be a valid number")
      .optional(),
    description: z
      .string()
      .trim()
      .max(1000, "Description must be at most 1000 characters")
      .optional(),
    unit_of_measure: z
      .string()
      .trim()
      .max(50, "unit_of_measure must be at most 50 characters")
      .nullable()
      .optional(),
    original_amount: z
      .union([z.number(), z.string()])
      .transform((val) => (typeof val === "string" ? parseFloat(val) : val))
      .refine(
        (val) => !Number.isNaN(val),
        "original_amount must be a valid number",
      )
      .optional(),
  })
  .refine(
    (data) =>
      data.quantity !== undefined ||
      data.unit_cost !== undefined ||
      data.unit_of_measure !== undefined ||
      data.description !== undefined ||
      data.original_amount !== undefined,
    {
      message:
        "At least one field (quantity, unit_cost, unit_of_measure, description, original_amount) must be provided",
    },
  );

// Parse the project id route param once so invalid ids fail through the shared envelope.
function parseProjectId(projectId: string, where: string): number {
  const projectIdNum = parseInt(projectId, 10);
  if (Number.isNaN(projectIdNum)) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where,
      message: "Invalid project ID.",
      details: [{ path: "projectId", message: "Project ID must be a number." }],
    });
  }
  return projectIdNum;
}

// GET /api/projects/[id]/budget/lines/[lineId] - Fetch a single budget line item
export const GET = withApiGuardrails<{ projectId: string; lineId: string }>(
  "projects/[projectId]/budget/lines/[lineId]#GET",
  async ({ request, params }) => {
    const { projectId, lineId } = await params;
    const where = "projects/[projectId]/budget/lines/[lineId]#GET";
    const projectIdNum = parseProjectId(projectId, where);

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lineId)) {
      return NextResponse.json({ error: "Invalid line ID" }, { status: 404 });
    }

    // Permission check: reading budget lines requires "read" on budget
    const guard = await requirePermission(projectIdNum, "budget", "read");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    // Get current user for authorization
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where,
        message: "Authentication required.",
      });
    }

    // TODO: Add project membership validation when project_team_members table exists
    // For now, all authenticated users can view (will be restricted by RLS on budget_lines)

    // Fetch the budget line with related data
    const { data: budgetLine, error: lineError } = await supabase
      .from("budget_lines")
      .select(
        `
        id,
        project_id,
        cost_code_id,
        cost_type_id,
        project_budget_code_id,
        description,
        quantity,
        unit_cost,
        unit_of_measure,
        original_amount,
        forecasting_enabled,
        default_ftc_method,
        sub_job_id,
        sub_job_key,
        created_at,
        created_by,
        updated_at,
        updated_by,
        cost_codes(
          id,
          title,
          division_id,
          division_title
        ),
        cost_code_types(
          id,
          description,
          category
        )
      `,
      )
      .eq("id", lineId)
      .single();

    if (lineError) {
      if (lineError.code === "PGRST116") {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where,
          message: "Budget line item not found.",
          status: 404,
          severity: "low",
        });
      }
      return apiErrorResponse(lineError);
    }

    // Verify the budget line belongs to the specified project
    if (budgetLine.project_id !== projectIdNum) {
      throw new GuardrailError({
        code: "AUTH_FORBIDDEN",
        where,
        message: "Budget line does not belong to this project.",
      });
    }

    // Return the budget line with enriched data
    return NextResponse.json({
      id: budgetLine.id,
      project_id: budgetLine.project_id,
      cost_code_id: budgetLine.cost_code_id,
      cost_type_id: budgetLine.cost_type_id,
      project_budget_code_id: budgetLine.project_budget_code_id,
      description: budgetLine.description,
      quantity: budgetLine.quantity,
      unit_cost: budgetLine.unit_cost,
      unit_of_measure: budgetLine.unit_of_measure,
      original_amount: budgetLine.original_amount,
      forecasting_enabled: budgetLine.forecasting_enabled,
      default_ftc_method: budgetLine.default_ftc_method,
      sub_job_id: budgetLine.sub_job_id,
      sub_job_key: budgetLine.sub_job_key,
      created_at: budgetLine.created_at,
      created_by: budgetLine.created_by,
      updated_at: budgetLine.updated_at,
      updated_by: budgetLine.updated_by,
      // Related data
      cost_code: budgetLine.cost_codes,
      cost_type: budgetLine.cost_code_types,
    });
    },
);

// PATCH /api/projects/[id]/budget/lines/[lineId] - Update a budget line item
export const PATCH = withApiGuardrails<{ projectId: string; lineId: string }>(
  "projects/[projectId]/budget/lines/[lineId]#PATCH",
  async ({ request, params }) => {
    const { projectId, lineId } = await params;
    const where = "projects/[projectId]/budget/lines/[lineId]#PATCH";
    const projectIdNum = parseProjectId(projectId, where);

    // Permission check: editing budget lines requires "write" on budget
    const guard = await requirePermission(projectIdNum, "budget", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where,
        message: "Authentication required.",
      });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = budgetLinePatchSchema.safeParse(body);

    if (!validation.success) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where,
        message: "Validation failed.",
        details: validation.error.flatten(),
      });
    }

    const { quantity, unit_cost, unit_of_measure, description, original_amount } =
      validation.data;

    // TODO: Add project membership validation when project_team_members table exists
    // For now, all authenticated users can edit (will be restricted by RLS on budget_lines)

    // Check if budget is locked
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("budget_locked")
      .eq("id", projectIdNum)
      .single();

    if (projectError) {
      return apiErrorResponse(projectError);
    }

    if (project.budget_locked) {
      throw new GuardrailError({
        code: "AUTH_FORBIDDEN",
        where,
        message: "Budget is locked and cannot be edited.",
      });
    }

    // Verify the budget line exists and belongs to this project
    const { data: existingLine, error: lineError } = await supabase
      .from("budget_lines")
      .select(
        "id, project_id, quantity, unit_cost, unit_of_measure, description, original_amount",
      )
      .eq("id", lineId)
      .single();

    if (lineError || !existingLine) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: "Budget line item not found.",
        status: 404,
        severity: "low",
      });
    }

    if (existingLine.project_id !== projectIdNum) {
      throw new GuardrailError({
        code: "AUTH_FORBIDDEN",
        where,
        message: "Budget line does not belong to this project.",
      });
    }

    // Build update object
    const updateData: {
      quantity?: number;
      unit_cost?: number;
      unit_of_measure?: string | null;
      description?: string;
      original_amount?: number;
      updated_by: string;
      updated_at: string;
    } = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (quantity !== undefined) {
      updateData.quantity = quantity;
    }

    if (unit_cost !== undefined) {
      updateData.unit_cost = unit_cost;
    }

    if (unit_of_measure !== undefined) {
      updateData.unit_of_measure = unit_of_measure;
    }

    if (description !== undefined) {
      updateData.description = description;
    }

    // Handle original_amount:
    // If original_amount is explicitly provided, use it directly (manual mode)
    // Otherwise, recalculate from quantity * unit_cost if either changed
    if (original_amount !== undefined) {
      updateData.original_amount = original_amount;
    } else if (quantity !== undefined || unit_cost !== undefined) {
      // Recalculate original_amount if quantity or unit_cost changed
      const newQuantity =
        quantity !== undefined ? quantity : existingLine.quantity;
      const newUnitCost =
        unit_cost !== undefined ? unit_cost : existingLine.unit_cost;

      if (newQuantity !== null && newUnitCost !== null) {
        updateData.original_amount = newQuantity * newUnitCost;
      }
    }

    // Update the budget line
    // The trigger will automatically create history entries
    const { data: updatedLine, error: updateError } = await supabase
      .from("budget_lines")
      .update(updateData)
      .eq("id", lineId)
      .select(
        `
        id,
        quantity,
        unit_cost,
        unit_of_measure,
        description,
        original_amount,
        updated_at,
        updated_by
      `,
      )
      .single();

    if (updateError) {
      return apiErrorResponse(updateError);
    }

    return NextResponse.json({
      success: true,
      lineItem: {
        id: updatedLine.id,
        quantity: updatedLine.quantity,
        unit_cost: updatedLine.unit_cost,
        unit_of_measure: updatedLine.unit_of_measure,
        description: updatedLine.description,
        amount: updatedLine.original_amount,
        updated_at: updatedLine.updated_at,
        updated_by: updatedLine.updated_by,
      },
    });
    },
);

// DELETE /api/projects/[id]/budget/lines/[lineId] - Delete a budget line item
export const DELETE = withApiGuardrails<{ projectId: string; lineId: string }>(
  "projects/[projectId]/budget/lines/[lineId]#DELETE",
  async ({ request, params }) => {
    const { projectId, lineId } = await params;
    const where = "projects/[projectId]/budget/lines/[lineId]#DELETE";
    const projectIdNum = parseProjectId(projectId, where);

    // Permission check: deleting budget lines requires "admin" on budget
    const guard = await requirePermission(projectIdNum, "budget", "admin");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    // Check if budget is locked
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("budget_locked")
      .eq("id", projectIdNum)
      .single();

    if (projectError) {
      return apiErrorResponse(projectError);
    }

    if (project.budget_locked) {
      // Procore-parity rule (test 1.3.3): delete blocked when budget is locked.
      throw new GuardrailError({
        code: "AUTH_FORBIDDEN",
        where,
        message: "Budget is locked. Unlock the budget before deleting line items.",
        details: { code: "BUDGET_LOCKED" },
      });
    }

    // Verify the budget line exists and belongs to this project
    const { data: existingLine, error: lineError } = await supabase
      .from("budget_lines")
      .select("id, project_id, original_amount, cost_code_id, cost_type_id")
      .eq("id", lineId)
      .single();

    if (lineError || !existingLine) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: "Budget line item not found.",
        status: 404,
        severity: "low",
      });
    }

    if (existingLine.project_id !== projectIdNum) {
      throw new GuardrailError({
        code: "AUTH_FORBIDDEN",
        where,
        message: "Budget line does not belong to this project.",
      });
    }

    // Procore-parity rule (test 1.3.2): delete is only allowed when the
    // original budget amount is $0. Once a line carries a budget value,
    // changes must flow through a budget modification rather than a delete.
    const originalAmount = Number(existingLine.original_amount ?? 0);
    if (originalAmount !== 0) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where,
        message:
          `Budget line cannot be deleted because its original budget is ${originalAmount.toLocaleString("en-US", { style: "currency", currency: "USD" })}. ` +
          "Only line items with an original budget of $0 may be deleted. Use a budget modification to remove or zero out funded lines.",
        details: {
          code: "LINE_HAS_BUDGET",
          originalAmount,
        },
        status: 409,
      });
    }

    // Procore-parity rule (test 1.3.4): delete blocked when an active
    // (non-void) budget modification references this line's cost code.
    const { data: blockingMods, error: modCheckError } = await supabase
      .from("budget_modifications")
      .select("id, number, status, budget_mod_lines!inner(cost_code_id, cost_type_id)")
      .eq("project_id", projectIdNum)
      .neq("status", "void")
      .eq("budget_mod_lines.cost_code_id", existingLine.cost_code_id);

    if (modCheckError) {
      return apiErrorResponse(modCheckError);
    }

    if (blockingMods && blockingMods.length > 0) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where,
        message:
          `Budget line cannot be deleted because ${blockingMods.length} active budget modification${blockingMods.length === 1 ? "" : "s"} reference${blockingMods.length === 1 ? "s" : ""} its cost code. ` +
          "Delete or void each modification first.",
        details: {
          code: "LINE_HAS_ACTIVE_MODIFICATIONS",
          modifications: blockingMods.map((m) => ({
            id: m.id,
            number: m.number,
            status: m.status,
          })),
        },
        status: 409,
      });
    }

    // Fail loudly before the delete when downstream change-event line items
    // still point at this budget line. The DB FK is ON DELETE SET NULL, but
    // the live workflow may still block on triggers/legacy alias sync, so the
    // user needs a budget-specific explanation instead of a generic FK error.
    const { data: blockingChangeEventLines, error: changeEventLineError } =
      await supabase
        .from("change_event_line_items")
        .select("id, change_event_id, budget_line_id, budget_code_id")
        .eq("budget_line_id", lineId);

    if (changeEventLineError) {
      return apiErrorResponse(changeEventLineError);
    }

    if (blockingChangeEventLines && blockingChangeEventLines.length > 0) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where,
        message:
          `Budget line cannot be deleted because ${blockingChangeEventLines.length} change event line item${blockingChangeEventLines.length === 1 ? "" : "s"} still reference${blockingChangeEventLines.length === 1 ? "s" : ""} it. ` +
          "Remove or reassign those change event line items first.",
        details: {
          code: "LINE_HAS_CHANGE_EVENT_REFERENCES",
          references: blockingChangeEventLines.map((line) => ({
            id: line.id,
            change_event_id: line.change_event_id,
          })),
        },
        status: 409,
      });
    }

    // Delete the budget line
    const { error: deleteError } = await supabase
      .from("budget_lines")
      .delete()
      .eq("id", lineId);

    if (deleteError) {
      return apiErrorResponse(deleteError);
    }

    return NextResponse.json({
      success: true,
      message: "Budget line deleted successfully",
    });
    },
);

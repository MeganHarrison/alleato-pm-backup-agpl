import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { updateLineItemSchema } from "../validation";
import { ZodError } from "zod";
import { requirePermission } from "@/lib/permissions-guard";

interface RouteParams {
  params: Promise<{ projectId: string; contractId: string; lineItemId: string }>;
}

/**
 * GET /api/projects/[id]/contracts/[contractId]/line-items/[lineItemId]
 * Returns a single line item by ID
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/line-items/[lineItemId]#GET",
  async ({ request, params }) => {
  
    const { projectId, contractId, lineItemId } = await params;
    const supabase = await createClient();

    // Verify contract exists and belongs to project
    const { data: contract } = await supabase
      .from("prime_contracts")
      .select("id")
      .eq("id", contractId)
      .eq("project_id", parseInt(projectId, 10))
      .single();

    if (!contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      );
    }

    const { data, error } = await supabase
      .from("contract_line_items")
      .select("*")
      .eq("id", lineItemId)
      .eq("contract_id", contractId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Line item not found" },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch line item", details: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json(data);
    },
);

/**
 * PUT /api/projects/[id]/contracts/[contractId]/line-items/[lineItemId]
 * Updates a line item
 */
export const PUT = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/line-items/[lineItemId]#PUT",
  async ({ request, params }) => {
  
    const { projectId, contractId, lineItemId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const guard = await requirePermission(projectIdNum, "contracts", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const body = await request.json();

    // Validate request body
    const validatedData = updateLineItemSchema.parse(body);

    // Get current user
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/contracts/[contractId]/line-items/[lineItemId]#PUT", message: "Authentication required." });
    }

    // Verify contract exists and belongs to project
    const { data: contract } = await supabase
      .from("prime_contracts")
      .select("id")
      .eq("id", contractId)
      .eq("project_id", parseInt(projectId, 10))
      .single();

    if (!contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      );
    }

    // Check if line item exists and belongs to this contract
    const { data: existingLineItem } = await supabase
      .from("contract_line_items")
      .select("id, line_number")
      .eq("id", lineItemId)
      .eq("contract_id", contractId)
      .single();

    if (!existingLineItem) {
      return NextResponse.json(
        { error: "Line item not found" },
        { status: 404 },
      );
    }

    // If updating line_number, check for uniqueness
    if (
      validatedData.line_number &&
      validatedData.line_number !== existingLineItem.line_number
    ) {
      const { data: duplicateLineItem } = await supabase
        .from("contract_line_items")
        .select("id")
        .eq("contract_id", contractId)
        .eq("line_number", validatedData.line_number)
        .neq("id", lineItemId)
        .single();

      if (duplicateLineItem) {
        return NextResponse.json(
          { error: "Line number already exists for this contract" },
          { status: 400 },
        );
      }
    }

    // Update the line item (budget_code_id is a real FK column on contract_line_items)
    const { data, error } = await supabase
      .from("contract_line_items")
      .update(validatedData)
      .eq("id", lineItemId)
      .eq("contract_id", contractId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to update line item", details: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json(data);
    },
);

/**
 * DELETE /api/projects/[id]/contracts/[contractId]/line-items/[lineItemId]
 * Deletes a line item
 */
export const DELETE = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/line-items/[lineItemId]#DELETE",
  async ({ request, params }) => {
  
    const { projectId, contractId, lineItemId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const guard = await requirePermission(projectIdNum, "contracts", "admin");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    // Get current user
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/contracts/[contractId]/line-items/[lineItemId]#DELETE", message: "Authentication required." });
    }

    // Verify contract exists and belongs to project
    const { data: contract } = await supabase
      .from("prime_contracts")
      .select("id")
      .eq("id", contractId)
      .eq("project_id", parseInt(projectId, 10))
      .single();

    if (!contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      );
    }

    // Check if line item exists before deleting
    const { data: existingLineItem } = await supabase
      .from("contract_line_items")
      .select("id")
      .eq("id", lineItemId)
      .eq("contract_id", contractId)
      .single();

    if (!existingLineItem) {
      return NextResponse.json(
        { error: "Line item not found" },
        { status: 404 },
      );
    }

    // Delete the line item
    const { error } = await supabase
      .from("contract_line_items")
      .delete()
      .eq("id", lineItemId)
      .eq("contract_id", contractId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete line item", details: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Line item deleted successfully" },
      { status: 200 },
    );
    },
);

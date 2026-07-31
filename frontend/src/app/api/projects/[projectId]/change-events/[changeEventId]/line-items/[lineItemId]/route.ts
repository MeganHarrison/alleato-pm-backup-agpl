import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateLineItemSchema } from '../../../validation';
import { ZodError } from 'zod';
import { apiErrorResponse } from "@/lib/api-error";
import { resolveChangeEventBudgetLineId } from "@/lib/change-events/budget-line-resolver";
import { requirePermission } from "@/lib/permissions-guard";
import type { Database } from "@/types/database.types";

interface RouteParams {
  params: Promise<{
    projectId: string;
    changeEventId: string;
    lineItemId: string;
  }>;
}

type ChangeEventLineItemUpdate =
  Database["public"]["Tables"]["change_event_line_items"]["Update"];

/**
 * GET /api/projects/[id]/change-events/[changeEventId]/line-items/[lineItemId]
 * Returns a single line item
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/change-events/[changeEventId]/line-items/[lineItemId]#GET",
  async ({ request, params }) => {
  
    const { projectId, changeEventId, lineItemId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/change-events/[changeEventId]/line-items/[lineItemId]#GET",
        message: "Authentication required.",
      });
    }

    // Verify change event exists
    const { data: changeEvent, error: eventError } = await supabase
      .from('change_events')
      .select('id')
      .eq('project_id', parseInt(projectId, 10))
      .eq('id', changeEventId)
      .is('deleted_at', null)
      .single();

    if (eventError || !changeEvent) {
      return NextResponse.json(
        { error: 'Change event not found' },
        { status: 404 }
      );
    }

    // Get line item
    const { data: lineItem, error } = await supabase
      .from('change_event_line_items')
      .select('*')
      .eq('change_event_id', changeEventId)
      .eq('id', lineItemId)
      .single();

    if (error || !lineItem) {
      return NextResponse.json(
        { error: 'Line item not found' },
        { status: 404 }
      );
    }

    // Format response
    const response = {
      id: lineItem.id,
      changeEventId: lineItem.change_event_id,
      description: lineItem.description,
      budgetLineId: lineItem.budget_code_id,
      budgetCodeId: lineItem.budget_code_id,
      vendorId: lineItem.vendor_id,
      contractId: lineItem.contract_id,
      commitmentId: lineItem.commitment_id,
      commitmentType: lineItem.commitment_type,
      commitmentLineItemId: lineItem.commitment_line_item_id,
      quantity: lineItem.quantity,
      unitOfMeasure: lineItem.unit_of_measure,
      unitCost: lineItem.unit_cost,
      costRom: lineItem.cost_rom,
      revenueRom: lineItem.revenue_rom,
      nonCommittedCost: lineItem.non_committed_cost,
      latestPrice: lineItem.latest_price ?? null,
      sortOrder: lineItem.sort_order || 0,
      createdAt: lineItem.created_at,
      updatedAt: lineItem.updated_at,
      _links: {
        self: `/api/projects/${projectId}/change-events/${changeEventId}/line-items/${lineItemId}`,
        changeEvent: `/api/projects/${projectId}/change-events/${changeEventId}`,
      },
    };

    return NextResponse.json(response);
    },
);

/**
 * PATCH /api/projects/[id]/change-events/[changeEventId]/line-items/[lineItemId]
 * Updates a line item
 */
export const PATCH = withApiGuardrails(
  "projects/[projectId]/change-events/[changeEventId]/line-items/[lineItemId]#PATCH",
  async ({ request, params }) => {
  
    const { projectId, changeEventId, lineItemId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const guard = await requirePermission(projectIdNum, "change_orders", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const body = await request.json();

    // Get current user
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/change-events/[changeEventId]/line-items/[lineItemId]#PATCH", message: "Authentication required." });
    }

    // Validate request body
    const validatedData = updateLineItemSchema.parse(body);

    // Verify change event exists and is not closed
    const { data: changeEvent, error: eventError } = await supabase
      .from('change_events')
      .select('id, status')
      .eq('project_id', parseInt(projectId, 10))
      .eq('id', changeEventId)
      .is('deleted_at', null)
      .single();

    if (eventError || !changeEvent) {
      return NextResponse.json(
        { error: 'Change event not found' },
        { status: 404 }
      );
    }

    if (changeEvent.status === 'closed') {
      return NextResponse.json(
        { error: 'Cannot update line items in a closed change event' },
        { status: 409 }
      );
    }

    // Get existing line item
    const { data: existingItem, error: fetchError } = await supabase
      .from('change_event_line_items')
      .select('*')
      .eq('change_event_id', changeEventId)
      .eq('id', lineItemId)
      .single();

    if (fetchError || !existingItem) {
      return NextResponse.json(
        { error: 'Line item not found' },
        { status: 404 }
      );
    }

    // Resolve BEFORE the commitment guard so we compare budget_lines.id to budget_lines.id.
    const resolvedBudgetLineId = await resolveChangeEventBudgetLineId({
      supabase,
      projectId: projectIdNum,
      inputId: validatedData.budgetCodeId,
      where: "projects/[projectId]/change-events/[changeEventId]/line-items/[lineItemId]#PATCH",
    });

    // Guard: budget code and contract cannot be changed on commitment-linked line items.
    // Placed after ID resolution so we compare budget_lines.id to budget_lines.id.
    if (existingItem.commitment_id) {
      const existingBudgetLineId = existingItem.budget_code_id;
      if (resolvedBudgetLineId !== null && resolvedBudgetLineId !== existingBudgetLineId) {
        return NextResponse.json(
          { error: 'Cannot change the budget code on a line item linked to a commitment' },
          { status: 409 }
        );
      }
      if (validatedData.contractId !== undefined && validatedData.contractId !== existingItem.commitment_id) {
        return NextResponse.json(
          { error: 'Cannot change the commitment on a line item linked to a commitment' },
          { status: 409 }
        );
      }
    }

    // vendor_id FK targets companies(id) directly — store as-is.
    const resolvedVendorId = validatedData.vendorId;

    // Build update object
    const updates: ChangeEventLineItemUpdate = {
      updated_at: new Date().toISOString(),
    };

    if (Boolean(validatedData.commitmentId) !== Boolean(validatedData.commitmentType)) {
      return NextResponse.json(
        {
          error:
            "commitmentId and commitmentType must be updated together for a change-event line item.",
        },
        { status: 400 },
      );
    }

    if (validatedData.description !== undefined) updates.description = validatedData.description;
    if (validatedData.budgetCodeId !== undefined) {
      updates.budget_code_id = resolvedBudgetLineId;
    }
    if (resolvedVendorId !== undefined && validatedData.vendorId !== undefined) updates.vendor_id = resolvedVendorId;
    if (validatedData.contractId !== undefined) updates.contract_id = validatedData.contractId;
    if (validatedData.commitmentId !== undefined) updates.commitment_id = validatedData.commitmentId;
    if (validatedData.commitmentType !== undefined) updates.commitment_type = validatedData.commitmentType;
    if (validatedData.commitmentLineItemId !== undefined) updates.commitment_line_item_id = validatedData.commitmentLineItemId;
    if (validatedData.quantity !== undefined) updates.quantity = validatedData.quantity;
    if (validatedData.unitOfMeasure !== undefined) updates.unit_of_measure = validatedData.unitOfMeasure;
    if (validatedData.unitCost !== undefined) updates.unit_cost = validatedData.unitCost;
    if (validatedData.sortOrder !== undefined) updates.sort_order = validatedData.sortOrder;
    if (validatedData.costRom !== undefined) updates.cost_rom = validatedData.costRom;
    if (validatedData.revenueRom !== undefined) updates.revenue_rom = validatedData.revenueRom;
    if (validatedData.nonCommittedCost !== undefined) updates.non_committed_cost = validatedData.nonCommittedCost;
    if (validatedData.latestPrice !== undefined) updates.latest_price = validatedData.latestPrice;

    // Update the line item
    const { data, error } = await supabase
      .from('change_event_line_items')
      .update(updates)
      .eq('id', lineItemId)
      .select()
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    // Update change event modification timestamp
    await supabase
      .from('change_events')
      .update({
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', changeEventId);

    // Create audit log entry
    await supabase
      .from('change_event_history')
      .insert({
        change_event_id: changeEventId,
        field_name: 'line_item_updated',
        old_value: existingItem.description,
        new_value: data.description,
        changed_by: user.id,
        change_type: 'UPDATE',
      });

    // Format response
    const response = {
      id: data.id,
      changeEventId: data.change_event_id,
      description: data.description,
      budgetLineId: data.budget_code_id,
      budgetCodeId: data.budget_code_id,
      vendorId: data.vendor_id,
      contractId: data.contract_id,
      commitmentId: data.commitment_id,
      commitmentType: data.commitment_type,
      commitmentLineItemId: data.commitment_line_item_id,
      quantity: data.quantity,
      unitOfMeasure: data.unit_of_measure,
      unitCost: data.unit_cost,
      costRom: data.cost_rom,
      revenueRom: data.revenue_rom,
      nonCommittedCost: data.non_committed_cost,
      sortOrder: data.sort_order,
      updatedAt: data.updated_at,
      _links: {
        self: `/api/projects/${projectId}/change-events/${changeEventId}/line-items/${lineItemId}`,
        changeEvent: `/api/projects/${projectId}/change-events/${changeEventId}`,
      },
    };

    return NextResponse.json(response);
    },
);

/**
 * DELETE /api/projects/[id]/change-events/[changeEventId]/line-items/[lineItemId]
 * Deletes a line item
 */
export const DELETE = withApiGuardrails(
  "projects/[projectId]/change-events/[changeEventId]/line-items/[lineItemId]#DELETE",
  async ({ request, params }) => {
  
    const { projectId, changeEventId, lineItemId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const guard = await requirePermission(projectIdNum, "change_orders", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    // Get current user
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/change-events/[changeEventId]/line-items/[lineItemId]#DELETE", message: "Authentication required." });
    }

    // Verify change event exists and is not closed
    const { data: changeEvent, error: eventError } = await supabase
      .from('change_events')
      .select('id, status')
      .eq('project_id', parseInt(projectId, 10))
      .eq('id', changeEventId)
      .is('deleted_at', null)
      .single();

    if (eventError || !changeEvent) {
      return NextResponse.json(
        { error: 'Change event not found' },
        { status: 404 }
      );
    }

    if (changeEvent.status === 'closed') {
      return NextResponse.json(
        { error: 'Cannot delete line items from a closed change event' },
        { status: 409 }
      );
    }

    // Get line item details before deletion
    const { data: lineItem, error: fetchError } = await supabase
      .from('change_event_line_items')
      .select('description')
      .eq('change_event_id', changeEventId)
      .eq('id', lineItemId)
      .single();

    if (fetchError || !lineItem) {
      return NextResponse.json(
        { error: 'Line item not found' },
        { status: 404 }
      );
    }

    // Delete the line item
    const { error } = await supabase
      .from('change_event_line_items')
      .delete()
      .eq('id', lineItemId);

    if (error) {
      return apiErrorResponse(error);
    }

    // Update change event modification timestamp
    await supabase
      .from('change_events')
      .update({
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', changeEventId);

    // Create audit log entry
    await supabase
      .from('change_event_history')
      .insert({
        change_event_id: changeEventId,
        field_name: 'line_item_removed',
        old_value: lineItem.description,
        changed_by: user.id,
        change_type: 'UPDATE',
      });

    return new NextResponse(null, { status: 204 });
    },
);

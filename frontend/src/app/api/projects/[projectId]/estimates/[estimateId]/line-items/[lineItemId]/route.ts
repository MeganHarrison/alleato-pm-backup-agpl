/**
 * =============================================================================
 * INDIVIDUAL ESTIMATE LINE ITEM API ENDPOINTS
 * =============================================================================
 *
 * API endpoints for individual estimate line item operations:
 * - PUT: Update a line item
 * - DELETE: Delete a line item
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from 'next/server';
import { createClient, getApiRouteUser } from '@/lib/supabase/server';
import { EstimateLineItemSchema } from '@/lib/schemas/estimates';
import { EstimateService } from '@/lib/services/estimate-service';

// =============================================================================
// PUT - Update Line Item
// =============================================================================

export const PUT = withApiGuardrails<{
      projectId: string;
      estimateId: string;
      lineItemId: string;
    }>(
  "projects/[projectId]/estimates/[estimateId]/line-items/[lineItemId]#PUT",
  async ({ request, params }) => {
  
    const { lineItemId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/estimates/[estimateId]/line-items/[lineItemId]#PUT", message: "Authentication required." });
    }

    const lineItemIdNum = parseInt(lineItemId, 10);

    if (isNaN(lineItemIdNum)) {
      return NextResponse.json(
        { error: 'Invalid line item ID' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Merge the line_item_id into the body for validation
    const dataWithId = { ...body, line_item_id: lineItemIdNum };

    const validation = EstimateLineItemSchema.safeParse(dataWithId);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid line item data', details: validation.error.format() },
        { status: 400 }
      );
    }

    const service = new EstimateService(supabase);
    const updatedLineItem = await service.updateLineItem(
      lineItemIdNum,
      validation.data
    );

    if (!updatedLineItem) {
      return NextResponse.json(
        { error: 'Line item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedLineItem);
    },
);

// =============================================================================
// DELETE - Delete Line Item
// =============================================================================

export const DELETE = withApiGuardrails<{
      projectId: string;
      estimateId: string;
      lineItemId: string;
    }>(
  "projects/[projectId]/estimates/[estimateId]/line-items/[lineItemId]#DELETE",
  async ({ request, params }) => {
  
    const { lineItemId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/estimates/[estimateId]/line-items/[lineItemId]#DELETE", message: "Authentication required." });
    }

    const lineItemIdNum = parseInt(lineItemId, 10);

    if (isNaN(lineItemIdNum)) {
      return NextResponse.json(
        { error: 'Invalid line item ID' },
        { status: 400 }
      );
    }

    const service = new EstimateService(supabase);
    const success = await service.deleteLineItem(lineItemIdNum);

    if (!success) {
      return NextResponse.json(
        { error: 'Line item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
    },
);

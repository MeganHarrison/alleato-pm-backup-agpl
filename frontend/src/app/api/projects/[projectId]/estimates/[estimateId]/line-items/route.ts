/**
 * =============================================================================
 * ESTIMATE LINE ITEMS API ENDPOINTS
 * =============================================================================
 *
 * API endpoints for estimate line item collection operations:
 * - POST: Add a single line item or bulk-add multiple line items
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from 'next/server';
import { createClient, getApiRouteUser } from '@/lib/supabase/server';
import { EstimateLineItemSchema } from '@/lib/schemas/estimates';
import { EstimateService } from '@/lib/services/estimate-service';
import { z } from 'zod';

// =============================================================================
// POST - Add Line Item(s) to Estimate
// =============================================================================

export const POST = withApiGuardrails<{ projectId: string; estimateId: string }>(
  "projects/[projectId]/estimates/[estimateId]/line-items#POST",
  async ({ request, params }) => {
  
    const { estimateId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/estimates/[estimateId]/line-items#POST", message: "Authentication required." });
    }

    const estimateIdNum = parseInt(estimateId, 10);
    if (isNaN(estimateIdNum)) {
      return NextResponse.json(
        { error: 'Invalid estimate ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const service = new EstimateService(supabase);

    // Support both single item and array (bulk add)
    if (Array.isArray(body)) {
      const validation = z.array(EstimateLineItemSchema).safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          {
            error: 'Invalid line item data',
            details: validation.error.format(),
          },
          { status: 400 }
        );
      }

      const lineItems = await service.bulkAddLineItems(
        estimateIdNum,
        validation.data
      );

      return NextResponse.json(lineItems, { status: 201 });
    }

    // Single item
    const validation = EstimateLineItemSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid line item data',
          details: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const lineItem = await service.addLineItem(
      estimateIdNum,
      validation.data
    );

    return NextResponse.json(lineItem, { status: 201 });
    },
);

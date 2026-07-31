/**
 * =============================================================================
 * INDIVIDUAL ESTIMATE API ENDPOINTS
 * =============================================================================
 *
 * API endpoints for individual estimate operations:
 * - GET: Fetch single estimate with line items, alternates, and allowances
 * - PUT: Update existing estimate
 * - DELETE: Soft delete estimate
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from 'next/server';
import { createClient, getApiRouteUser } from '@/lib/supabase/server';
import { EstimateUpdateSchema } from '@/lib/schemas/estimates';
import { EstimateService } from '@/lib/services/estimate-service';

// =============================================================================
// GET - Fetch Single Estimate
// =============================================================================

export const GET = withApiGuardrails<{ projectId: string; estimateId: string }>(
  "projects/[projectId]/estimates/[estimateId]#GET",
  async ({ request, params }) => {
  
    const { estimateId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/estimates/[estimateId]#GET", message: "Authentication required." });
    }

    const estimateIdNum = parseInt(estimateId, 10);
    if (isNaN(estimateIdNum)) {
      return NextResponse.json(
        { error: 'Invalid estimate ID' },
        { status: 400 }
      );
    }

    const service = new EstimateService(supabase);
    const estimate = await service.getById(estimateIdNum);

    if (!estimate) {
      return NextResponse.json(
        { error: 'Estimate not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(estimate);
    },
);

// =============================================================================
// PUT - Update Estimate
// =============================================================================

export const PUT = withApiGuardrails<{ projectId: string; estimateId: string }>(
  "projects/[projectId]/estimates/[estimateId]#PUT",
  async ({ request, params }) => {
  
    const { estimateId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/estimates/[estimateId]#PUT", message: "Authentication required." });
    }

    const estimateIdNum = parseInt(estimateId, 10);
    if (isNaN(estimateIdNum)) {
      return NextResponse.json(
        { error: 'Invalid estimate ID' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Merge ID into body for validation
    const dataWithId = { ...body, estimate_id: estimateIdNum };

    // Validate request data
    const validation = EstimateUpdateSchema.safeParse(dataWithId);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid update data', details: validation.error.format() },
        { status: 400 }
      );
    }

    const service = new EstimateService(supabase);
    const updatedEstimate = await service.update(estimateIdNum, validation.data);

    if (!updatedEstimate) {
      return NextResponse.json(
        { error: 'Estimate not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedEstimate);
    },
);

// =============================================================================
// DELETE - Soft Delete Estimate
// =============================================================================

export const DELETE = withApiGuardrails<{ projectId: string; estimateId: string }>(
  "projects/[projectId]/estimates/[estimateId]#DELETE",
  async ({ request, params }) => {
  
    const { estimateId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/estimates/[estimateId]#DELETE", message: "Authentication required." });
    }

    const estimateIdNum = parseInt(estimateId, 10);
    if (isNaN(estimateIdNum)) {
      return NextResponse.json(
        { error: 'Invalid estimate ID' },
        { status: 400 }
      );
    }

    const service = new EstimateService(supabase);
    const success = await service.delete(estimateIdNum);

    if (!success) {
      return NextResponse.json(
        { error: 'Estimate not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
    },
);

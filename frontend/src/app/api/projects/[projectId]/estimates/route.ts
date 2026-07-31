/**
 * =============================================================================
 * ESTIMATES API ENDPOINTS
 * =============================================================================
 *
 * RESTful API endpoints for Estimates CRUD operations
 * Follows the patterns established in the codebase and supports:
 * - Full CRUD operations
 * - Filtering, search, pagination, and sorting
 * - Type-safe request/response handling
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from 'next/server';
import { createClient, getApiRouteUser } from '@/lib/supabase/server';
import {
  EstimateCreateSchema,
  EstimateListParamsSchema,
} from '@/lib/schemas/estimates';
import { EstimateService } from '@/lib/services/estimate-service';

// =============================================================================
// GET - Fetch Estimates (with filtering, pagination, sorting)
// =============================================================================

export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/estimates#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/estimates#GET", message: "Authentication required." });
    }

    const { searchParams } = new URL(request.url);

    // Validate and parse query parameters
    const queryParams = Object.fromEntries(searchParams.entries());
    const validation = EstimateListParamsSchema.safeParse(queryParams);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const service = new EstimateService(supabase);
    const result = await service.list(parseInt(projectId, 10), validation.data);

    return NextResponse.json(result);
    },
);

// =============================================================================
// POST - Create New Estimate
// =============================================================================

export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/estimates#POST",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/estimates#POST", message: "Authentication required." });
    }

    const body = await request.json();

    // Validate request data
    const validation = EstimateCreateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid estimate data',
          details: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const service = new EstimateService(supabase);
    const estimate = await service.create(parseInt(projectId, 10), validation.data, user.id);

    return NextResponse.json(estimate, { status: 201 });
    },
);

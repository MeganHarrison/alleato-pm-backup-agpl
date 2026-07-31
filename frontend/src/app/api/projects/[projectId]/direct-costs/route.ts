/**
 * =============================================================================
 * DIRECT COSTS API ENDPOINTS
 * =============================================================================
 *
 * RESTful API endpoints for Direct Costs read operations
 * Follows the patterns established in the codebase and supports:
 * - Read-only access (writes are explicitly blocked)
 * - Advanced filtering and search
 * - Pagination and sorting
 * - Summary views and aggregations
 * - Type-safe request/response handling
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from 'next/server';
import { createClient, getApiRouteUser } from '@/lib/supabase/server';
import { DirectCostListParamsSchema } from '@/lib/schemas/direct-costs';
import { DirectCostService } from '@/lib/services/direct-cost-service';

// =============================================================================
// GET - Fetch Direct Costs (with filtering, pagination, sorting)
// =============================================================================

export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/direct-costs#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/direct-costs#GET", message: "Authentication required." });
    }

    const { searchParams } = new URL(request.url);

    // Validate and parse query parameters
    const queryParams = Object.fromEntries(searchParams.entries());
    const validation = DirectCostListParamsSchema.safeParse(queryParams);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const listParams = validation.data;
    const service = new DirectCostService(supabase);

    // Handle different view modes
    if (listParams.view === 'summary-by-cost-code') {
      const summary = await service.getSummaryByCostCode(projectId, listParams);
      return NextResponse.json(summary);
    }

    // Check if summary data is requested
    const includeSummary = searchParams.get('include_summary') === 'true';

    // Fetch main data
    const result = await service.list(projectId, listParams);

    // Optionally include summary data
    if (includeSummary) {
      const summary = await service.getSummary(projectId);
      return NextResponse.json({
        ...result,
        summary,
      });
    }

    return NextResponse.json(result);
    },
);

// =============================================================================
// POST - Create New Direct Cost
// =============================================================================

export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/direct-costs#POST",
  async ({ request, params }) => {
    void request;
    void params;

    throw new GuardrailError({
      code: "READ_ONLY_RESOURCE",
      where: "projects/[projectId]/direct-costs#POST",
      message: "Direct costs are read-only in Alleato. Sync from Acumatica to add records.",
      status: 405,
      severity: "medium",
    });
  },
);

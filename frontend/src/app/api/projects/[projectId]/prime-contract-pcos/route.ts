/**
 * ============================================================================
 * PRIME CONTRACT PCOs API ROUTE (Collection-Level)
 * ============================================================================
 *
 * RESTful API endpoints for Prime Contract Potential Change Orders
 *
 * GET  /api/projects/[projectId]/prime-contract-pcos - List PCOs with filters
 * POST /api/projects/[projectId]/prime-contract-pcos - Create new PCO
 *
 * Schema Reference: prime_contract_pcos table
 * - id: UUID (PK, auto)
 * - project_id: INTEGER (FK to projects)
 * - prime_contract_id: UUID (FK to prime_contracts)
 * - pco_number: TEXT (auto-generated via generate_pco_number RPC)
 * - title: TEXT (required)
 * - status: TEXT ('draft', 'pending', 'approved', 'void')
 * - description: TEXT
 * - total_amount: NUMERIC(14,2)
 * - schedule_impact: INTEGER (days)
 * - designated_reviewer_id: UUID
 * - due_date: TIMESTAMPTZ
 * - promoted_to_co_id: BIGINT (FK to prime_contract_change_orders)
 * - promoted_at: TIMESTAMPTZ
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { apiErrorResponse } from "@/lib/api-error";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createPcoSchema = z.object({
  prime_contract_id: z.string().uuid("prime_contract_id must be a valid UUID"),
  title: z.string().min(1, "Title is required").max(255),
  status: z.enum(["draft", "pending", "approved", "void"]).optional().default("draft"),
  description: z.string().max(5000).optional().nullable(),
  change_reason: z.string().optional().nullable(),
  revision: z.number().int().optional().nullable(),
  schedule_impact: z.number().int().optional().nullable(),
  due_date: z.string().optional().nullable(),
  designated_reviewer_id: z.string().uuid().optional().nullable(),
  is_private: z.boolean().optional().default(false),
  executed: z.boolean().optional().default(false),
  signed_co_received_date: z.string().optional().nullable(),
  request_received_from: z.string().max(255).optional().nullable(),
  location: z.string().max(255).optional().nullable(),
  field_change: z.boolean().optional().default(false),
  reference: z.string().max(255).optional().nullable(),
  paid_in_full: z.boolean().optional().default(false),
  promoted_to_co_id: z.number().int().optional().nullable(),
});

const pcoQuerySchema = z.object({
  status: z.enum(["draft", "pending", "approved", "void"]).optional(),
  search: z.string().optional(),
  prime_contract_id: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// GET /api/projects/[projectId]/prime-contract-pcos
// ---------------------------------------------------------------------------

export const GET = withApiGuardrails(
  "projects/[projectId]/prime-contract-pcos#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Auth check
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/prime-contract-pcos#GET", message: "Authentication required." });
    }

    // Parse query params
    const queryParams = pcoQuerySchema.parse(
      Object.fromEntries(searchParams.entries()),
    );

    const projectIdNum = parseInt(projectId, 10);

    // Build query with prime contract join
    let query = supabase
      .from("prime_contract_pcos")
      .select(
        `
        *,
        prime_contract:prime_contracts!prime_contract_pcos_prime_contract_id_fkey(
          id,
          contract_number,
          title
        )
      `,
      )
      .eq("project_id", projectIdNum)
      .order("created_at", { ascending: false });

    // Apply optional filters
    if (queryParams.status) {
      query = query.eq("status", queryParams.status);
    }

    if (queryParams.prime_contract_id) {
      query = query.eq("prime_contract_id", queryParams.prime_contract_id);
    }

    if (queryParams.search) {
      query = query.or(
        `pco_number.ilike.%${queryParams.search}%,title.ilike.%${queryParams.search}%,description.ilike.%${queryParams.search}%`,
      );
    }

    const { data: pcos, error } = await query;

    if (error) {
      return apiErrorResponse(error);
    }

    // Prime contract PCO IDs are UUIDs, while the live pco_line_items table
    // only references numeric potential_change_orders IDs. Use stored totals
    // until the UUID-compatible line-item table/migration is present.
    const lineItemTotals: Record<string, { count: number; amount: number }> = {};
    const pcoIds = (pcos || []).map((pco) => pco.id);
    const linkedChangeEventCounts: Record<string, number> = {};
    const firstLinkedChangeEventByPco: Record<string, { number: string | null; type: string | null }> = {};
    const promotedCoNumberMap: Record<string, string | null> = {};

    if (pcoIds.length > 0) {
      const { data: links, error: linksError } = await supabase
        .from("change_event_pco_links")
        .select(
          `
          pco_id,
          change_event:change_events!change_event_pco_links_change_event_id_fkey(
            number,
            type
          )
        `,
        )
        .in("pco_id", pcoIds)
        .eq("pco_type", "prime");

      if (linksError) {
        return apiErrorResponse(linksError);
      }

      for (const link of links || []) {
        linkedChangeEventCounts[link.pco_id] =
          (linkedChangeEventCounts[link.pco_id] || 0) + 1;
        if (!firstLinkedChangeEventByPco[link.pco_id]) {
          const changeEvent = Array.isArray(link.change_event) ? link.change_event[0] : link.change_event;
          firstLinkedChangeEventByPco[link.pco_id] = {
            number: changeEvent?.number ?? null,
            type: changeEvent?.type ?? null,
          };
        }
      }

      const promotedCoIds = (pcos || [])
        .map((pco) => pco.promoted_to_co_id)
        .filter((id): id is number => typeof id === "number");

      if (promotedCoIds.length > 0) {
        const { data: promotedCoRows, error: promotedCoError } = await supabase
          .from("prime_contract_change_orders")
          .select("id, pcco_number")
          .in("id", promotedCoIds);

        if (promotedCoError) {
          return apiErrorResponse(promotedCoError);
        }

        for (const row of promotedCoRows || []) {
          promotedCoNumberMap[String(row.id)] = row.pcco_number ?? null;
        }
      }
    }

    // Enrich PCOs with computed fields
    const enrichedPcos = (pcos || []).map((pco) => {
      const totals = lineItemTotals[pco.id] || { count: 0, amount: 0 };
      return {
        ...pco,
        line_items_count: totals.count,
        calculated_amount: pco.total_amount ?? totals.amount,
        linked_change_events_count: linkedChangeEventCounts[pco.id] || 0,
        linked_change_event_number: firstLinkedChangeEventByPco[pco.id]?.number ?? null,
        linked_change_event_type: firstLinkedChangeEventByPco[pco.id]?.type ?? null,
        promoted_co_number: pco.promoted_to_co_id
          ? (promotedCoNumberMap[String(pco.promoted_to_co_id)] ?? null)
          : null,
      };
    });

    return NextResponse.json(enrichedPcos);
    },
);

// ---------------------------------------------------------------------------
// POST /api/projects/[projectId]/prime-contract-pcos
// ---------------------------------------------------------------------------

export const POST = withApiGuardrails(
  "projects/[projectId]/prime-contract-pcos#POST",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const supabase = await createClient();

    // Auth check
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/prime-contract-pcos#POST", message: "Authentication required." });
    }

    const body = await request.json();
    const validatedData = createPcoSchema.parse(body);

    // Verify the prime contract exists and belongs to this project
    const { data: contract, error: contractError } = await supabase
      .from("prime_contracts")
      .select("id")
      .eq("id", validatedData.prime_contract_id)
      .eq("project_id", projectIdNum)
      .maybeSingle();

    if (contractError || !contract) {
      return NextResponse.json(
        { error: "Prime contract not found for this project" },
        { status: 400 },
      );
    }

    // Auto-generate PCO number
    const { data: pcoNumber, error: rpcError } = await supabase.rpc(
      "generate_pco_number",
      {
        p_project_id: projectIdNum,
        p_type: "prime",
      },
    );

    if (rpcError) {
      logger.error({ msg: "[POST /prime-contract-pcos] RPC error:", data: rpcError });
      return NextResponse.json(
        { error: "Failed to generate PCO number", details: rpcError.message },
        { status: 500 },
      );
    }

    // Create the PCO
    const { data, error } = await supabase
      .from("prime_contract_pcos")
      .insert({
        project_id: projectIdNum,
        prime_contract_id: validatedData.prime_contract_id,
        pco_number: pcoNumber,
        title: validatedData.title,
        status: validatedData.status ?? "draft",
        description: validatedData.description || null,
        change_reason: validatedData.change_reason || null,
        revision: validatedData.revision ?? null,
        schedule_impact: validatedData.schedule_impact ?? null,
        due_date: validatedData.due_date || null,
        designated_reviewer_id: validatedData.designated_reviewer_id || null,
        is_private: validatedData.is_private ?? false,
        executed: validatedData.executed ?? false,
        signed_co_received_date: validatedData.signed_co_received_date || null,
        request_received_from: validatedData.request_received_from || null,
        location: validatedData.location || null,
        field_change: validatedData.field_change ?? false,
        reference: validatedData.reference || null,
        paid_in_full: validatedData.paid_in_full ?? false,
        promoted_to_co_id: validatedData.promoted_to_co_id ?? null,
        created_by: user.id,
      })
      .select(
        `
        *,
        prime_contract:prime_contracts!prime_contract_pcos_prime_contract_id_fkey(
          id,
          contract_number,
          title
        )
      `,
      )
      .single();

    if (error) {
      logger.error({ msg: "[POST /prime-contract-pcos] DB insert error:", error: error instanceof Error ? error.message : String(error) });
      return apiErrorResponse(error);
    }

    return NextResponse.json(data, { status: 201 });
    },
);

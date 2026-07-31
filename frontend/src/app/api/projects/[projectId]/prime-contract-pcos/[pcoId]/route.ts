/**
 * ============================================================================
 * PRIME CONTRACT PCO API ROUTE (Single Resource)
 * ============================================================================
 *
 * GET    /api/projects/[projectId]/prime-contract-pcos/[pcoId] - Get PCO detail
 * PATCH  /api/projects/[projectId]/prime-contract-pcos/[pcoId] - Update PCO
 * DELETE /api/projects/[projectId]/prime-contract-pcos/[pcoId] - Delete PCO
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { apiErrorResponse } from "@/lib/api-error";
import { listLinkedPatternCDocuments } from "@/lib/documents/pattern-c-attachments";
import { requirePermission } from "@/lib/permissions-guard";
import { isAuthError, verifyProjectAccess } from "@/lib/supabase/auth-guard";
import {
  PRIME_CONTRACT_CHANGE_ORDER_STATUSES,
  type PrimeContractChangeOrderStatus,
} from "@/lib/change-orders/prime-contract-change-order-statuses";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const updatePcoSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional().nullable(),
  status: z.enum(PRIME_CONTRACT_CHANGE_ORDER_STATUSES.map((status) => status.value) as [
    PrimeContractChangeOrderStatus,
    ...PrimeContractChangeOrderStatus[],
  ]).optional(),
  change_reason: z.string().optional().nullable(),
  revision: z.number().int().optional().nullable(),
  is_private: z.boolean().optional(),
  executed: z.boolean().optional(),
  signed_co_received_date: z.string().optional().nullable(),
  request_received_from: z.string().max(255).optional().nullable(),
  location: z.string().max(255).optional().nullable(),
  field_change: z.boolean().optional(),
  reference: z.string().max(255).optional().nullable(),
  paid_in_full: z.boolean().optional(),
  schedule_impact: z.number().int().optional().nullable(),
  due_date: z.string().optional().nullable(),
  designated_reviewer_id: z.string().uuid().optional().nullable(),
  promoted_to_co_id: z.number().int().optional().nullable(),
});

// ---------------------------------------------------------------------------
// GET /api/projects/[projectId]/prime-contract-pcos/[pcoId]
// ---------------------------------------------------------------------------

export const GET = withApiGuardrails<{ projectId: string; pcoId: string }>(
  "projects/[projectId]/prime-contract-pcos/[pcoId]#GET",
  async ({ request, params }) => {
  
    const { projectId, pcoId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const authResult = await verifyProjectAccess(projectIdNum);
    if (isAuthError(authResult)) {
      return authResult;
    }
    const { serviceClient } = authResult;
    const supabase = serviceClient;

    // Get PCO with prime contract info
    const { data: pco, error } = await supabase
      .from("prime_contract_pcos")
      .select(
        `
        *,
        prime_contract:prime_contracts!prime_contract_pcos_prime_contract_id_fkey(
          id,
          contract_number,
          title,
          status,
          contract_company:companies!prime_contracts_contract_company_id_fkey(id, name),
          client:companies!prime_contracts_client_company_id_fkey(id, name),
          vendor:companies!prime_contracts_vendor_id_fkey(id, name)
        )
      `,
      )
      .eq("project_id", projectIdNum)
      .eq("id", pcoId)
      .single();

    if (error || !pco) {
      return NextResponse.json(
        { error: "Prime contract PCO not found" },
        { status: 404 },
      );
    }

    // Get line items
    const { data: lineItems } = await supabase
      .from("pco_line_items")
      .select(
        `
        *,
        change_event:change_events!pco_line_items_change_event_id_fkey(
          id,
          number,
          title
        )
      `,
      )
      .eq("pco_id", pcoId)
      .eq("pco_type", "prime")
      .order("sort_order", { ascending: true });

    // Get linked change events
    const { data: changeEventLinks } = await supabase
      .from("change_event_pco_links")
      .select(
        `
        *,
        change_event:change_events!change_event_pco_links_change_event_id_fkey(
          id,
          number,
          title,
          status,
          scope,
          type
        )
      `,
      )
      .eq("pco_id", pcoId)
      .eq("pco_type", "prime");

    const attachments = await listLinkedPatternCDocuments({
      supabase,
      serviceClient,
      entityType: "prime_contract_pco",
      entityId: pcoId,
    });

    // Resolve creator display name (best effort)
    let creatorName: string | null = null;
    if (pco.created_by) {
      const { data: creator } = await supabase
        .from("user_profiles")
        .select("full_name, email")
        .eq("id", pco.created_by)
        .maybeSingle();

      creatorName = creator?.full_name || creator?.email || null;
    }

    // Compute totals from line items
    const items = lineItems || [];
    const totalAmount = items.reduce(
      (sum, item) => sum + (item.amount || 0),
      0,
    );

    const response = {
      ...pco,
      line_items: items,
      line_items_count: items.length,
      calculated_amount: pco.total_amount ?? totalAmount,
      change_event_links: changeEventLinks || [],
      attachments: attachments.map((attachment) => ({
        id: attachment.document_metadata_id,
        file_name: attachment.file_name ?? attachment.title,
        file_path: attachment.file_path,
        file_size: attachment.source_size,
        mime_type: attachment.mime_type,
        uploaded_at: attachment.attached_at,
        download_url: attachment.download_url,
      })),
      created_by_name: creatorName,
      _links: {
        self: `/api/projects/${projectId}/prime-contract-pcos/${pcoId}`,
        promote: `/api/projects/${projectId}/prime-contract-pcos/${pcoId}/promote`,
        lineItems: `/api/projects/${projectId}/prime-contract-pcos/${pcoId}/line-items`,
      },
    };

    return NextResponse.json(response);
    },
);

// ---------------------------------------------------------------------------
// PATCH /api/projects/[projectId]/prime-contract-pcos/[pcoId]
// ---------------------------------------------------------------------------

export const PATCH = withApiGuardrails<{ projectId: string; pcoId: string }>(
  "projects/[projectId]/prime-contract-pcos/[pcoId]#PATCH",
  async ({ request, params }) => {
  
    const { projectId, pcoId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const authResult = await verifyProjectAccess(projectIdNum);
    if (isAuthError(authResult)) {
      return authResult;
    }
    const { membership, serviceClient: supabase } = authResult;

    const guard = await requirePermission(projectIdNum, "change_orders", "write");
    if (guard.denied) {
      return guard.response;
    }

    const body = await request.json();
    const validatedData = updatePcoSchema.parse(body);

    // Get existing PCO
    const { data: existingPco, error: fetchError } = await supabase
      .from("prime_contract_pcos")
      .select("*")
      .eq("project_id", projectIdNum)
      .eq("id", pcoId)
      .single();

    if (fetchError || !existingPco) {
      return NextResponse.json(
        { error: "Prime contract PCO not found" },
        { status: 404 },
      );
    }

    // Keep void PCOs immutable, but allow active records to be corrected in place
    // from the detail page like other editable project records.
    if (existingPco.status === "void") {
      return NextResponse.json(
        {
          error: "Cannot update PCO",
          details: "Void PCOs cannot be updated",
        },
        { status: 409 },
      );
    }

    // Build update payload
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: membership.authUserId,
    };

    if (validatedData.title !== undefined) updates.title = validatedData.title;
    if (validatedData.description !== undefined)
      updates.description = validatedData.description;
    if (validatedData.status !== undefined) updates.status = validatedData.status;
    if (validatedData.change_reason !== undefined)
      updates.change_reason = validatedData.change_reason;
    if (validatedData.revision !== undefined) updates.revision = validatedData.revision;
    if (validatedData.is_private !== undefined)
      updates.is_private = validatedData.is_private;
    if (validatedData.executed !== undefined) updates.executed = validatedData.executed;
    if (validatedData.signed_co_received_date !== undefined)
      updates.signed_co_received_date = validatedData.signed_co_received_date;
    if (validatedData.request_received_from !== undefined)
      updates.request_received_from = validatedData.request_received_from;
    if (validatedData.location !== undefined) updates.location = validatedData.location;
    if (validatedData.field_change !== undefined)
      updates.field_change = validatedData.field_change;
    if (validatedData.reference !== undefined)
      updates.reference = validatedData.reference;
    if (validatedData.paid_in_full !== undefined)
      updates.paid_in_full = validatedData.paid_in_full;
    if (validatedData.schedule_impact !== undefined)
      updates.schedule_impact = validatedData.schedule_impact;
    if (validatedData.due_date !== undefined)
      updates.due_date = validatedData.due_date;
    if (validatedData.designated_reviewer_id !== undefined)
      updates.designated_reviewer_id = validatedData.designated_reviewer_id;
    if (validatedData.promoted_to_co_id !== undefined)
      updates.promoted_to_co_id = validatedData.promoted_to_co_id;

    // Update
    const { data, error } = await supabase
      .from("prime_contract_pcos")
      .update(updates)
      .eq("id", pcoId)
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
      return apiErrorResponse(error);
    }

    return NextResponse.json(data);
    },
);

// ---------------------------------------------------------------------------
// DELETE /api/projects/[projectId]/prime-contract-pcos/[pcoId]
// ---------------------------------------------------------------------------

export const DELETE = withApiGuardrails<{ projectId: string; pcoId: string }>(
  "projects/[projectId]/prime-contract-pcos/[pcoId]#DELETE",
  async ({ request, params }) => {
  
    const { projectId, pcoId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const authResult = await verifyProjectAccess(projectIdNum);
    if (isAuthError(authResult)) {
      return authResult;
    }
    const { serviceClient: supabase } = authResult;

    const guard = await requirePermission(projectIdNum, "change_orders", "admin");
    if (guard.denied) {
      return guard.response;
    }

    // Get existing PCO
    const { data: existingPco, error: fetchError } = await supabase
      .from("prime_contract_pcos")
      .select("id, status")
      .eq("project_id", projectIdNum)
      .eq("id", pcoId)
      .single();

    if (fetchError || !existingPco) {
      return NextResponse.json(
        { error: "Prime contract PCO not found" },
        { status: 404 },
      );
    }

    // Only allow deletion if status is draft
    if (existingPco.status !== "draft") {
      return NextResponse.json(
        {
          error: "Cannot delete PCO",
          details: "Only PCOs with status 'draft' can be deleted",
        },
        { status: 409 },
      );
    }

    // Delete associated line items first
    await supabase
      .from("pco_line_items")
      .delete()
      .eq("pco_id", pcoId)
      .eq("pco_type", "prime");

    // Delete associated change event links
    await supabase
      .from("change_event_pco_links")
      .delete()
      .eq("pco_id", pcoId)
      .eq("pco_type", "prime");

    // Delete the PCO
    const { error } = await supabase
      .from("prime_contract_pcos")
      .delete()
      .eq("id", pcoId);

    if (error) {
      return apiErrorResponse(error);
    }

    return new NextResponse(null, { status: 204 });
    },
);

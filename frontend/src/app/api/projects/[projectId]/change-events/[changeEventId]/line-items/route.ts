import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";
import { createClient, getApiRouteUser } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createLineItemSchema, updateLineItemSchema } from '../../validation';
import { ZodError } from 'zod';
import { apiErrorResponse } from "@/lib/api-error";
import { resolveChangeEventBudgetLineId } from "@/lib/change-events/budget-line-resolver";
import { requirePermission } from "@/lib/permissions-guard";

interface RouteParams {
  params: Promise<{
    projectId: string;
    changeEventId: string;
  }>;
}

/**
 * GET /api/projects/[id]/change-events/[changeEventId]/line-items
 * Returns all line items for a change event
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/change-events/[changeEventId]/line-items#GET",
  async ({ request, params }) => {

    const { projectId, changeEventId } = await params;
    assertNonNilUuid(changeEventId, "changeEventId", "projects/[projectId]/change-events/[changeEventId]/line-items#GET");
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/change-events/[changeEventId]/line-items#GET",
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
      throw new GuardrailError({
        code: "ROUTE_BINDING_MISSING",
        where: "projects/[projectId]/change-events/[changeEventId]/line-items#GET",
        message: "Change event not found.",
        status: 404,
        severity: "low",
      });
    }

    // Get line items with budget_line details
    const { data: lineItems, error } = await supabase
      .from('change_event_line_items')
      .select(`
        *,
        budget_line:budget_lines!change_event_line_items_budget_code_id_fkey(
          id,
          description,
          cost_code:cost_codes!cost_code_id(
            id,
            title,
            division_id,
            division_title
          )
        ),
        vendor:companies!vendor_id(
          id,
          name
        )
      `)
      .eq('change_event_id', changeEventId)
      .order('sort_order', { ascending: true });

    if (error) {
      return apiErrorResponse(error);
    }

    // Batch reverse-map budget_lines.id → project_budget_codes.id
    // vendor_id directly stores companies.id — no remap needed.
    // Done as two bulk queries (not per-item) to avoid N+1.
    const budgetLineIds = [...new Set(
      (lineItems || []).map(i => i.budget_code_id).filter(Boolean)
    )] as string[];
    // budget_lines.project_budget_code_id is the project_budget_codes.id we want directly
    const budgetLineToProjectCostCode = new Map<string, string>();
    if (budgetLineIds.length > 0) {
      const { data: budgetLines } = await supabase
        .from('budget_lines')
        .select('id, project_budget_code_id')
        .in('id', budgetLineIds);

      for (const bl of budgetLines ?? []) {
        if (bl.project_budget_code_id) {
          budgetLineToProjectCostCode.set(bl.id, bl.project_budget_code_id);
        }
      }
    }

    // vendor_id stores companies.id — no remap needed.

    // Batch-fetch commitment names from purchase_orders + subcontracts.
    // commitment_id has no enforced FK so we query both tables by unique IDs.
    const commitmentIds = [...new Set(
      (lineItems || []).map(i => i.commitment_id).filter(Boolean)
    )] as string[];

    const commitmentMap = new Map<
      string,
      {
        id: string;
        contract_number: string | null;
        title: string | null;
        company_name: string | null;
        display_name?: string | null;
      }
    >();
    if (commitmentIds.length > 0) {
      const [{ data: pos }, { data: subs }] = await Promise.all([
        supabase
          .from('purchase_orders')
          .select('id, contract_number, title, contract_company_id')
          .in('id', commitmentIds),
        supabase
          .from('subcontracts')
          .select('id, contract_number, title, contract_company_id')
          .in('id', commitmentIds),
      ]);

      const companyIds = [
        ...new Set(
          [...(pos || []), ...(subs || [])]
            .map((record) => record.contract_company_id)
            .filter((value): value is string => Boolean(value)),
        ),
      ];

      const companyNameById = new Map<string, string | null>();
      if (companyIds.length > 0) {
        const { data: companies } = await supabase
          .from('companies')
          .select('id, name')
          .in('id', companyIds);

        for (const company of companies || []) {
          companyNameById.set(company.id, company.name ?? null);
        }
      }

      for (const po of pos || []) {
        commitmentMap.set(po.id, {
          id: po.id,
          contract_number: po.contract_number,
          title: po.title,
          company_name: po.contract_company_id
            ? (companyNameById.get(po.contract_company_id) ?? null)
            : null,
        });
      }

      for (const sub of subs || []) {
        commitmentMap.set(sub.id, {
          id: sub.id,
          contract_number: sub.contract_number,
          title: sub.title,
          company_name: sub.contract_company_id
            ? (companyNameById.get(sub.contract_company_id) ?? null)
            : null,
        });
      }
    }

    // Format response
    const formattedItems = (lineItems || []).map(item => {
      const quantity = item.quantity || 0;
      const unitCost = item.unit_cost || 0;
      const extendedAmount = quantity * unitCost;
      const budgetLineId = item.budget_code_id;

      return {
        id: item.id,
        changeEventId: item.change_event_id,
        budgetLineId,
        budgetCodeId: budgetLineId,
        projectBudgetCodeId: budgetLineId
          ? (budgetLineToProjectCostCode.get(budgetLineId) ?? budgetLineId)
          : undefined,
        budgetLine: item.budget_line || undefined,
        description: item.description,
        vendorId: item.vendor_id,
        formVendorId: item.vendor_id ?? undefined,
        vendor: item.vendor || undefined,
        contractId: item.contract_id,
        commitmentId: item.commitment_id,
        commitmentType: item.commitment_type,
        commitmentLineItemId: item.commitment_line_item_id,
        commitment: item.commitment_id ? (commitmentMap.get(item.commitment_id) ?? undefined) : undefined,
        quantity: item.quantity,
        unitOfMeasure: item.unit_of_measure,
        unitCost: item.unit_cost,
        extendedAmount: extendedAmount,
        costRom: item.cost_rom,
        revenueRom: item.revenue_rom,
        nonCommittedCost: item.non_committed_cost,
        latestPrice: item.latest_price ?? null,
        sortOrder: item.sort_order || 0,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        _links: {
          self: `/api/projects/${projectId}/change-events/${changeEventId}/line-items/${item.id}`,
        },
      };
    });

    return NextResponse.json({
      data: formattedItems,
      _links: {
        self: `/api/projects/${projectId}/change-events/${changeEventId}/line-items`,
        changeEvent: `/api/projects/${projectId}/change-events/${changeEventId}`,
      },
    });
    },
);

/**
 * POST /api/projects/[id]/change-events/[changeEventId]/line-items
 * Creates a new line item for a change event
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/change-events/[changeEventId]/line-items#POST",
  async ({ request, params }) => {

    const { projectId, changeEventId } = await params;
    assertNonNilUuid(changeEventId, "changeEventId", "projects/[projectId]/change-events/[changeEventId]/line-items#POST");
    const projectIdNum = parseInt(projectId, 10);
    const guard = await requirePermission(projectIdNum, "change_orders", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const body = await request.json();

    // Get current user
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/change-events/[changeEventId]/line-items#POST", message: "Authentication required." });
    }

    // Validate request body
    const validatedData = createLineItemSchema.parse(body);

    if (Boolean(validatedData.commitmentId) !== Boolean(validatedData.commitmentType)) {
      return NextResponse.json(
        {
          error:
            "commitmentId and commitmentType must be provided together for a change-event line item.",
        },
        { status: 400 },
      );
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
      throw new GuardrailError({
        code: "ROUTE_BINDING_MISSING",
        where: "projects/[projectId]/change-events/[changeEventId]/line-items#POST",
        message: "Change event not found.",
        status: 404,
        severity: "low",
      });
    }

    if (changeEvent.status === 'Closed' || changeEvent.status === 'Void') {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/change-events/[changeEventId]/line-items#POST",
        message: `Cannot add line items to a ${changeEvent.status.toLowerCase()} change event.`,
        status: 409,
        severity: "low",
      });
    }

    const resolvedBudgetLineId = await resolveChangeEventBudgetLineId({
      supabase,
      projectId: projectIdNum,
      inputId: validatedData.budgetCodeId,
      where: "projects/[projectId]/change-events/[changeEventId]/line-items#POST",
    });

    // vendor_id FK targets companies(id) directly — store as-is.
    const resolvedVendorId = validatedData.vendorId;

    // Calculate extended amount for cost_rom if not provided
    const quantity = validatedData.quantity || 0;
    const unitCost = validatedData.unitCost || 0;
    const extendedAmount = quantity * unitCost;

    // Create the line item
    const { data, error } = await supabase
      .from('change_event_line_items')
      .insert({
        change_event_id: changeEventId,
        budget_code_id: resolvedBudgetLineId || undefined,
        description: validatedData.description,
        vendor_id: resolvedVendorId || undefined,
        // SENSITIVE: this writes a contract foreign key; preserve UUID exactly.
        contract_id: validatedData.contractId || undefined,
        commitment_id: validatedData.commitmentId || undefined,
        commitment_type: validatedData.commitmentType || undefined,
        commitment_line_item_id: validatedData.commitmentLineItemId || undefined,
        quantity: validatedData.quantity || undefined,
        unit_of_measure: validatedData.unitOfMeasure || undefined,
        unit_cost: validatedData.unitCost || undefined,
        cost_rom: validatedData.costRom !== undefined ? validatedData.costRom : extendedAmount,
        revenue_rom: validatedData.revenueRom || undefined,
        non_committed_cost: validatedData.nonCommittedCost || undefined,
        latest_price: validatedData.latestPrice || undefined,
        sort_order: validatedData.sortOrder,
      })
      .select(`
        *,
        budget_line:budget_lines!change_event_line_items_budget_code_id_fkey(
          id,
          description,
          cost_code:cost_codes!cost_code_id(
            id,
            title,
            division_id,
            division_title
          )
        ),
        vendor:companies!vendor_id(
          id,
          name
        )
      `)
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    // Update change event modification timestamp
    await supabase
      .from('change_events')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', changeEventId);

    // Format response
    const response = {
      id: data.id,
      changeEventId: data.change_event_id,
      budgetLineId: data.budget_code_id,
      budgetCodeId: data.budget_code_id,
      budgetLine: data.budget_line || undefined,
      description: data.description,
      vendorId: data.vendor_id,
      vendor: data.vendor || undefined,
      contractId: data.contract_id,
      quantity: data.quantity,
      unitOfMeasure: data.unit_of_measure,
      unitCost: data.unit_cost,
      extendedAmount: extendedAmount,
      costRom: data.cost_rom,
      revenueRom: data.revenue_rom,
      nonCommittedCost: data.non_committed_cost,
      latestPrice: data.latest_price ?? null,
      sortOrder: data.sort_order,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      _links: {
        self: `/api/projects/${projectId}/change-events/${changeEventId}/line-items/${data.id}`,
        changeEvent: `/api/projects/${projectId}/change-events/${changeEventId}`,
      },
    };

    return NextResponse.json(response, { status: 201 });
    },
);

/**
 * PUT /api/projects/[id]/change-events/[changeEventId]/line-items
 * Bulk update line items (for reordering)
 */
export const PUT = withApiGuardrails(
  "projects/[projectId]/change-events/[changeEventId]/line-items#PUT",
  async ({ request, params }) => {

    const { projectId, changeEventId } = await params;
    assertNonNilUuid(changeEventId, "changeEventId", "projects/[projectId]/change-events/[changeEventId]/line-items#PUT");
    const projectIdNum = parseInt(projectId, 10);
    const guard = await requirePermission(projectIdNum, "change_orders", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const body = await request.json();

    // Get current user
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/change-events/[changeEventId]/line-items#PUT", message: "Authentication required." });
    }

    // Verify change event exists
    const { data: changeEvent, error: eventError } = await supabase
      .from('change_events')
      .select('id, status')
      .eq('project_id', parseInt(projectId, 10))
      .eq('id', changeEventId)
      .is('deleted_at', null)
      .single();

    if (eventError || !changeEvent) {
      throw new GuardrailError({
        code: "ROUTE_BINDING_MISSING",
        where: "projects/[projectId]/change-events/[changeEventId]/line-items#PUT",
        message: "Change event not found.",
        status: 404,
        severity: "low",
      });
    }

    if (changeEvent.status === 'Closed' || changeEvent.status === 'Void') {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/change-events/[changeEventId]/line-items#PUT",
        message: `Cannot update line items in a ${changeEvent.status.toLowerCase()} change event.`,
        status: 409,
        severity: "low",
      });
    }

    // Expect array of { id, sortOrder }
    if (!Array.isArray(body)) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/change-events/[changeEventId]/line-items#PUT",
        message: "Request body must be an array of line item updates.",
        status: 400,
        severity: "low",
      });
    }

    // Update sort orders
    const updates = body.map(item =>
      supabase
        .from('change_event_line_items')
        .update({ sort_order: item.sortOrder })
        .eq('id', item.id)
        .eq('change_event_id', changeEventId)
    );

    await Promise.all(updates);

    // Update change event modification timestamp
    await supabase
      .from('change_events')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', changeEventId);

    return NextResponse.json({ message: 'Line items reordered successfully' });
    },
);

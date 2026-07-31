import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ZodError } from "zod";
import { requirePermission } from "@/lib/permissions-guard";

interface RouteParams {
  params: Promise<{
    projectId: string;
    contractId: string;
    applicationId: string;
  }>;
}

const editableStatuses = new Set(["draft", "revise_and_resubmit"]);

function parseApplicationSequence(applicationNumber: string): number | null {
  const parsed = Number.parseInt(applicationNumber, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function compareApplications(
  a: { application_number: string; billing_date: string | null; created_at: string },
  b: { application_number: string; billing_date: string | null; created_at: string },
): number {
  const seqA = parseApplicationSequence(a.application_number);
  const seqB = parseApplicationSequence(b.application_number);

  if (seqA !== null && seqB !== null && seqA !== seqB) {
    return seqA - seqB;
  }

  const billingDateA = a.billing_date ? new Date(a.billing_date).getTime() : 0;
  const billingDateB = b.billing_date ? new Date(b.billing_date).getTime() : 0;
  if (billingDateA !== billingDateB) {
    return billingDateA - billingDateB;
  }

  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

const lineItemUpdateSchema = z.object({
  id: z.string().uuid(),
  work_completed_this_period: z.number().min(0).optional(),
  materials_stored: z.number().min(0).optional(),
  retainage_this_period_work: z.number().min(0).optional(),
  retainage_this_period_work_pct: z.number().min(0).max(100).optional(),
  retainage_this_period_materials: z.number().min(0).optional(),
  retainage_this_period_materials_pct: z.number().min(0).max(100).optional(),
  retainage_released_work: z.number().min(0).optional(),
  retainage_released_materials: z.number().min(0).optional(),
});

const batchUpdateSchema = z.object({
  items: z.array(lineItemUpdateSchema).optional(),
  line_items: z.array(lineItemUpdateSchema).optional(),
});

const normalizeBatchUpdateItems = (
  body: z.infer<typeof batchUpdateSchema>,
): NonNullable<z.infer<typeof batchUpdateSchema>["items"]> =>
  body.items ?? body.line_items ?? [];

/**
 * GET /api/projects/[projectId]/contracts/[contractId]/payment-applications/[applicationId]/line-items
 * Fetch all line items for a payment application, ordered by sort_order
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/payment-applications/[applicationId]/line-items#GET",
  async ({ request, params }) => {
  
    const { applicationId } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("payment_application_line_items")
      .select("*")
      .eq("payment_application_id", applicationId)
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch line items", details: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json(data ?? []);
    },
);

/**
 * PATCH /api/projects/[projectId]/contracts/[contractId]/payment-applications/[applicationId]/line-items
 * Batch update line items, then recalculate parent payment application totals
 */
export const PATCH = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/payment-applications/[applicationId]/line-items#PATCH",
  async ({ request, params }) => {
  
    const { projectId, contractId, applicationId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const guard = await requirePermission(projectIdNum, "contracts", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const body = await request.json();

    const parsedBody = batchUpdateSchema.parse(body);
    const items = normalizeBatchUpdateItems(parsedBody);

    if (items.length === 0) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: [
            {
              field: "items",
              message: "Either items or line_items must be provided",
            },
          ],
        },
        { status: 400 },
      );
    }

    const { data: application, error: applicationError } = await supabase
      .from("prime_contract_payment_applications")
      .select(
        "id, contract_id, project_id, billing_period_id, status, application_number, billing_date, created_at",
      )
      .eq("id", applicationId)
      .eq("contract_id", contractId)
      .eq("project_id", Number.parseInt(projectId, 10))
      .single();

    if (applicationError || !application) {
      return NextResponse.json(
        { error: "Payment application not found" },
        { status: 404 },
      );
    }

    const hasRetainageMutation = items.some(
      (item) =>
        item.retainage_this_period_work !== undefined ||
        item.retainage_this_period_work_pct !== undefined ||
        item.retainage_this_period_materials !== undefined ||
        item.retainage_this_period_materials_pct !== undefined ||
        item.retainage_released_work !== undefined ||
        item.retainage_released_materials !== undefined,
    );

    if (hasRetainageMutation) {
      let siblingApplicationsQuery = supabase
        .from("prime_contract_payment_applications")
        .select("id, application_number, billing_date, created_at")
        .eq("contract_id", contractId)
        .eq("project_id", Number.parseInt(projectId, 10));

      if (application.billing_period_id) {
        siblingApplicationsQuery = siblingApplicationsQuery.eq(
          "billing_period_id",
          application.billing_period_id,
        );
      }

      const { data: siblingApplications, error: siblingApplicationsError } =
        await siblingApplicationsQuery;

      if (siblingApplicationsError) {
        return NextResponse.json(
          {
            error: "Failed to validate retainage edit eligibility",
            details: siblingApplicationsError.message,
          },
          { status: 400 },
        );
      }

      const latestApplicationId = (siblingApplications ?? [])
        .sort(compareApplications)
        .at(-1)?.id;
      const canEditRetainage =
        editableStatuses.has(application.status) &&
        latestApplicationId === application.id;

      if (!canEditRetainage) {
        return NextResponse.json(
          {
            error: "Retainage edits are not allowed",
            details: editableStatuses.has(application.status)
              ? "Retainage can only be edited on the most recent invoice in this billing period."
              : "Retainage can only be edited on draft or revise-and-resubmit invoices.",
          },
          { status: 409 },
        );
      }
    }

    const itemIds = items.map((item) => item.id);
    const { data: existingItems, error: existingItemsError } = await supabase
      .from("payment_application_line_items")
      .select("*")
      .eq("payment_application_id", applicationId)
      .in("id", itemIds);

    if (existingItemsError) {
      return NextResponse.json(
        {
          error: "Failed to fetch existing line items",
          details: existingItemsError.message,
        },
        { status: 400 },
      );
    }

    const existingItemMap = new Map((existingItems ?? []).map((item) => [item.id, item]));

    // Update each line item
    for (const item of items) {
      const { id, ...fields } = item;
      const existingItem = existingItemMap.get(id);

      if (!existingItem) {
        return NextResponse.json(
          { error: `Line item ${id} not found for this payment application` },
          { status: 404 },
        );
      }

      // Build the update payload — only include provided fields
      const updateData: Record<string, number> = {};
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) {
          updateData[key] = value;
        }
      }

      const projectedWorkCompleted =
        item.work_completed_this_period ?? existingItem.work_completed_this_period ?? 0;
      const projectedMaterialsStored =
        item.materials_stored ?? existingItem.materials_stored ?? 0;

      if (
        item.retainage_this_period_work_pct !== undefined &&
        item.retainage_this_period_work === undefined
      ) {
        updateData.retainage_this_period_work = roundCurrency(
          projectedWorkCompleted * (item.retainage_this_period_work_pct / 100),
        );
      }

      if (
        item.retainage_this_period_materials_pct !== undefined &&
        item.retainage_this_period_materials === undefined
      ) {
        updateData.retainage_this_period_materials = roundCurrency(
          projectedMaterialsStored * (item.retainage_this_period_materials_pct / 100),
        );
      }

      const nextRetainedWork =
        (existingItem.retainage_previous_work ?? 0) +
        (updateData.retainage_this_period_work ??
          item.retainage_this_period_work ??
          existingItem.retainage_this_period_work ??
          0) -
        (updateData.retainage_released_work ??
          item.retainage_released_work ??
          existingItem.retainage_released_work ??
          0);
      const nextRetainedMaterials =
        (existingItem.retainage_previous_materials ?? 0) +
        (updateData.retainage_this_period_materials ??
          item.retainage_this_period_materials ??
          existingItem.retainage_this_period_materials ??
          0) -
        (updateData.retainage_released_materials ??
          item.retainage_released_materials ??
          existingItem.retainage_released_materials ??
          0);

      if (nextRetainedWork < 0 || nextRetainedMaterials < 0) {
        return NextResponse.json(
          {
            error: `Retainage release exceeds currently retained amount for line item ${id}`,
          },
          { status: 400 },
        );
      }

      if (Object.keys(updateData).length === 0) continue;

      const { error } = await supabase
        .from("payment_application_line_items")
        .update(updateData)
        .eq("id", id)
        .eq("payment_application_id", applicationId);

      if (error) {
        return NextResponse.json(
          {
            error: `Failed to update line item ${id}`,
            details: error.message,
          },
          { status: 400 },
        );
      }
    }

    // Re-fetch all line items to recalculate parent totals
    const { data: allItems, error: fetchError } = await supabase
      .from("payment_application_line_items")
      .select("*")
      .eq("payment_application_id", applicationId);

    if (fetchError || !allItems) {
      return NextResponse.json(
        {
          error: "Failed to fetch line items for recalculation",
          details: fetchError?.message,
        },
        { status: 400 },
      );
    }

    // Aggregate totals for the parent payment application
    const totalScheduledValue = allItems.reduce(
      (sum, li) => sum + (li.scheduled_value ?? 0),
      0,
    );

    const totalCompleted = allItems.reduce(
      (sum, li) =>
        sum +
        (li.work_completed_previous ?? 0) +
        (li.work_completed_this_period ?? 0) +
        (li.materials_stored ?? 0),
      0,
    );

    const totalRetention = allItems.reduce(
      (sum, li) =>
        sum +
        (li.retainage_previous_work ?? 0) +
        (li.retainage_previous_materials ?? 0) +
        (li.retainage_this_period_work ?? 0) +
        (li.retainage_this_period_materials ?? 0) -
        (li.retainage_released_work ?? 0) -
        (li.retainage_released_materials ?? 0),
      0,
    );

    const percentComplete =
      totalScheduledValue > 0 ? (totalCompleted / totalScheduledValue) * 100 : 0;

    // Update parent payment application
    // Note: net_amount is a generated column (amount - retention_amount), so we don't set it
    const { error: updateAppError } = await supabase
      .from("prime_contract_payment_applications")
      .update({
        amount: totalCompleted,
        retention_amount: totalRetention,
        percent_complete: Math.round(percentComplete * 100) / 100,
      })
      .eq("id", applicationId);

    if (updateAppError) {
      return NextResponse.json(
        {
          error: "Failed to update payment application totals",
          details: updateAppError.message,
        },
        { status: 400 },
      );
    }

    // Return updated line items
    const { data: updatedItems } = await supabase
      .from("payment_application_line_items")
      .select("*")
      .eq("payment_application_id", applicationId)
      .order("sort_order", { ascending: true });

    return NextResponse.json(updatedItems ?? []);
    },
);

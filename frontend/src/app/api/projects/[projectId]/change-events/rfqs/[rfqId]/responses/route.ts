import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

interface RouteParams {
  params: Promise<{ projectId: string; rfqId: string }>;
}

const createResponseSchema = z.object({
  lineItemId: z.string().min(1, "Line item is required"),
  unitPrice: z.number().nonnegative(),
  notes: z.string().max(1000).optional(),
});

async function ensureRfq(
  supabase: SupabaseClient,
  projectId: number,
  rfqId: string,
) {
  const { data, error } = await supabase
    .from("change_event_rfqs")
    .select("id, project_id, change_event_id, estimated_total_amount")
    .eq("project_id", projectId)
    .eq("id", rfqId)
    .single();

  if (error || !data) {
    throw new Error("RFQ not found");
  }

  return data;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = withApiGuardrails(
  "projects/[projectId]/change-events/rfqs/[rfqId]/responses#GET",
  async ({ request, params }) => {

    const { projectId, rfqId } = await params;
    const numericProjectId = parseInt(projectId, 10);
    if (!Number.isFinite(numericProjectId)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }
    if (!UUID_RE.test(rfqId)) {
      return NextResponse.json({ error: "Invalid RFQ id" }, { status: 400 });
    }

    const supabase = await createClient();
    try {
      await ensureRfq(supabase, numericProjectId, rfqId);
    } catch {
      return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
    }
    const { data, error } = await supabase
      .from("change_event_rfq_responses")
      .select("*")
      .eq("rfq_id", rfqId)
      .order("created_at", { ascending: false });

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ data: data ?? [] });
    },
);

export const POST = withApiGuardrails(
  "projects/[projectId]/change-events/rfqs/[rfqId]/responses#POST",
  async ({ request, params }) => {
  
    const { projectId, rfqId } = await params;
    const numericProjectId = parseInt(projectId, 10);
    if (!Number.isFinite(numericProjectId)) {
      return NextResponse.json(
        { error: "Invalid project id" },
        { status: 400 },
      );
    }

    const guard = await requirePermission(numericProjectId, "change_orders", "write");
    if (guard.denied) return guard.response;

    const body = await request.json();
    const parsed = createResponseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/change-events/rfqs/[rfqId]/responses#POST", message: "Authentication required." });
    }

    const rfq = await ensureRfq(supabase, numericProjectId, rfqId);

    const { data: lineItem, error: lineItemError } = await supabase
      .from("change_event_line_items")
      .select("id, change_event_id, quantity")
      .eq("id", parsed.data.lineItemId)
      .eq("change_event_id", rfq.change_event_id)
      .single();

    if (lineItemError || !lineItem) {
      return NextResponse.json(
        { error: "Line item not found for this change event" },
        { status: 404 },
      );
    }

    const quantity = Number(lineItem.quantity) || 0;
    const extendedAmount = quantity * parsed.data.unitPrice;

    const { data: response, error: responseError } = await supabase
      .from("change_event_rfq_responses")
      .insert({
        rfq_id: rfqId,
        line_item_id: lineItem.id,
        unit_price: parsed.data.unitPrice,
        extended_amount: extendedAmount,
        notes: parsed.data.notes ?? null,
        status: "Submitted",
        submitted_at: new Date().toISOString(),
        created_by: user.id,
        updated_by: user.id,
      })
      .select("*")
      .single();

    if (responseError || !response) {
      return NextResponse.json(
        { error: "Failed to create response", details: responseError?.message },
        { status: 400 },
      );
    }

    const { data: allResponses } = await supabase
      .from("change_event_rfq_responses")
      .select("extended_amount")
      .eq("rfq_id", rfqId);

    const aggregatedTotal = (allResponses ?? []).reduce(
      (sum, item) => sum + (Number(item.extended_amount) || 0),
      0,
    );

    await supabase
      .from("change_event_rfqs")
      .update({
        estimated_total_amount: aggregatedTotal,
        status: "Response Received",
        response_received_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", rfqId);

    return NextResponse.json({ data: response });
    },
);

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

interface CommitmentRfqPayload {
  id: string;
  rfq_number: string;
  title: string;
  status: string;
  due_date: string;
  sent_at: string | null;
  response_received_at: string | null;
  created_at: string;
  change_event_id: string;
  change_event_number: string | null;
  change_event_title: string | null;
  response_count: number;
}

/**
 * GET /api/commitments/[commitmentId]/rfqs
 *
 * Returns RFQs related to a commitment by traversing:
 * commitment -> change_event_line_items.commitment_id -> change_event_rfqs
 */
export const GET = withApiGuardrails<{ commitmentId: string }>(
  "commitments/[commitmentId]/rfqs#GET",
  async ({ request, params }) => {
  
    const { commitmentId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "commitments/[commitmentId]/rfqs#GET",
        message: "Authentication required.",
      });
    }

    const { data: commitment, error: commitmentError } = await supabase
      .from("commitments_unified")
      .select("id, project_id")
      .eq("id", commitmentId)
      .single();

    if (commitmentError || !commitment) {
      return NextResponse.json({ error: "Commitment not found" }, { status: 404 });
    }

    if (commitment.project_id == null) {
      return NextResponse.json(
        { error: "Commitment is missing a project_id; cannot resolve related RFQs" },
        { status: 422 },
      );
    }
    const commitmentProjectId = commitment.project_id;

    const { data: lineItems, error: lineItemsError } = await supabase
      .from("change_event_line_items")
      .select("change_event_id")
      .eq("commitment_id", commitmentId);

    if (lineItemsError) {
      return apiErrorResponse(lineItemsError);
    }

    const changeEventIds = Array.from(
      new Set(
        (lineItems ?? [])
          .map((item) => item.change_event_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    if (changeEventIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const [{ data: changeEvents, error: changeEventsError }, { data: rfqs, error: rfqsError }] =
      await Promise.all([
        supabase
          .from("change_events")
          .select("id, number, title")
          .eq("project_id", commitmentProjectId)
          .in("id", changeEventIds),
        supabase
          .from("change_event_rfqs")
          .select(
            "id, rfq_number, title, status, due_date, sent_at, response_received_at, created_at, change_event_id",
          )
          .eq("project_id", commitmentProjectId)
          .in("change_event_id", changeEventIds)
          .order("created_at", { ascending: false }),
      ]);

    if (changeEventsError) {
      return apiErrorResponse(changeEventsError);
    }
    if (rfqsError) {
      return apiErrorResponse(rfqsError);
    }

    if (!rfqs || rfqs.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const rfqIds = rfqs.map((rfq) => rfq.id);
    const { data: responses, error: responsesError } = await supabase
      .from("change_event_rfq_responses")
      .select("rfq_id")
      .in("rfq_id", rfqIds);

    if (responsesError) {
      return apiErrorResponse(responsesError);
    }

    const changeEventMap = new Map(
      (changeEvents ?? []).map((event) => [event.id, event]),
    );

    const responseCountMap = (responses ?? []).reduce<Record<string, number>>(
      (acc, response) => {
        if (!response.rfq_id) return acc;
        acc[response.rfq_id] = (acc[response.rfq_id] ?? 0) + 1;
        return acc;
      },
      {},
    );

    const payload: CommitmentRfqPayload[] = rfqs.map((rfq) => ({
      id: rfq.id,
      rfq_number: rfq.rfq_number,
      title: rfq.title,
      status: rfq.status,
      due_date: rfq.due_date,
      sent_at: rfq.sent_at,
      response_received_at: rfq.response_received_at,
      created_at: rfq.created_at,
      change_event_id: rfq.change_event_id,
      change_event_number: changeEventMap.get(rfq.change_event_id)?.number ?? null,
      change_event_title: changeEventMap.get(rfq.change_event_id)?.title ?? null,
      response_count: responseCountMap[rfq.id] ?? 0,
    }));

    return NextResponse.json({
      data: payload,
    });
    },
);

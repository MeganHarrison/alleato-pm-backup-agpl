import { NextResponse } from "next/server";
// Dispatched by the consolidated CRM catch-all route.
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { requireCrmAccess } from "@/lib/crm/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";

type Params = { dealId: string };
const BodySchema = z
  .object({
    to_stage_id: z.string().uuid(),
    row_version: z.number().int().positive(),
    reason: z.string().trim().min(1).max(1000).optional(),
  })
  .strict();

export const POST = withApiGuardrails<Params>(
  "crm/deals/[dealId]/transition#POST",
  async ({ request, params }) => {
    assertNonNilUuid(params.dealId, "dealId", "crm/deals/transition");
    const { db, personId } = await requireCrmAccess("write");
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/deals/[dealId]/transition#POST",
        message: "Invalid deal transition.",
        status: 400,
      });
    }
    const [requirementsResult, dealResult, tasksResult] = await Promise.all([
      db
        .from("crm_stage_requirements")
        .select("requirement_key, label")
        .eq("stage_id", parsed.data.to_stage_id)
        .eq("is_required", true),
      db
        .from("crm_deals")
        .select("id, company_id, lead_id, expected_close_date, bid_due_date")
        .eq("id", params.dealId)
        .maybeSingle(),
      db
        .from("tasks")
        .select("id")
        .eq("crm_deal_id", params.dealId)
        .in("status", ["open", "in_progress", "blocked"])
        .limit(1),
    ]);
    const firstReadError =
      requirementsResult.error ?? dealResult.error ?? tasksResult.error;
    if (firstReadError) return apiErrorResponse(firstReadError);
    if (!dealResult.data) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "crm/deals/[dealId]/transition#POST",
        message: "The CRM deal was not found.",
        status: 404,
      });
    }
    const requirements = requirementsResult.data ?? [];
    const intelligenceKeys = requirements
      .map((requirement) => requirement.requirement_key)
      .filter((key) => key === "stakeholder" || key === "outcome_review");
    const { data: intelligence, error: intelligenceError } =
      intelligenceKeys.length > 0
        ? await db
            .from("crm_relationship_intelligence")
            .select("intelligence_type")
            .or(
              [
                dealResult.data.company_id
                  ? `company_id.eq.${dealResult.data.company_id}`
                  : null,
                dealResult.data.lead_id
                  ? `lead_id.eq.${dealResult.data.lead_id}`
                  : null,
              ]
                .filter(Boolean)
                .join(","),
            )
            .in("status", ["active", "approved"])
        : { data: [], error: null };
    if (intelligenceError) return apiErrorResponse(intelligenceError);
    const intelligenceTypes = new Set(
      (intelligence ?? []).map((item) => item.intelligence_type),
    );
    const missing = requirements.filter((requirement) => {
      switch (requirement.requirement_key) {
        case "next_action":
          return (tasksResult.data ?? []).length === 0;
        case "expected_close_date":
          return !dealResult.data?.expected_close_date;
        case "bid_due_date":
          return !dealResult.data?.bid_due_date;
        case "stakeholder":
          return !intelligenceTypes.has("stakeholder");
        case "outcome_review":
          return !intelligenceTypes.has("pursuit_outcome");
        case "loss_reason":
          return !parsed.data.reason?.trim();
        default:
          return false;
      }
    });
    if (missing.length > 0) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/deals/[dealId]/transition#POST",
        message: `Complete the stage exit criteria first: ${missing
          .map((requirement) => requirement.label)
          .join(", ")}.`,
        status: 400,
        details: {
          missingRequirements: missing.map(
            (requirement) => requirement.requirement_key,
          ),
        },
      });
    }
    const { data, error } = await db.rpc("crm_transition_deal", {
      p_deal_id: params.dealId,
      p_to_stage_id: parsed.data.to_stage_id,
      p_expected_row_version: parsed.data.row_version,
      p_changed_by_person_id: personId,
      p_reason: parsed.data.reason,
    });
    if (error) return apiErrorResponse(error);
    return NextResponse.json({ data });
  },
);

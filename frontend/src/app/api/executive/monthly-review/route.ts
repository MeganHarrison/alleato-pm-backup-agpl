import { NextResponse } from "next/server";
import { z } from "zod";

import { requireCurrentUserExecutiveDetail } from "@/lib/executive/executive-visibility";
import { appendMonthlyReviewGovernanceEvent, loadMonthlyExecutiveReview } from "@/lib/executive/monthly-executive-review";
import { loadGovernedExecutiveArtifact } from "@/lib/executive/governed-executive-artifact";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

const actionSchema = z.object({
  reviewId: z.string().uuid(),
  action: z.enum(["finance_closed", "executive_approved"]),
  rationale: z.string().trim().max(1_000).optional(),
});

export const GET = withApiGuardrails(
  "api.executive.monthly-review.GET",
  async () => {
    await requireCurrentUserExecutiveDetail("api.executive.monthly-review.GET");
    return NextResponse.json(await loadMonthlyExecutiveReview(await loadGovernedExecutiveArtifact("monthly")));
  },
);

export const POST = withApiGuardrails(
  "api.executive.monthly-review.POST",
  async ({ request }) => {
    const { user, access } = await requireCurrentUserExecutiveDetail("api.executive.monthly-review.POST");
    if (!access.isAdmin) throw new GuardrailError({ code: "FORBIDDEN", where: "api.executive.monthly-review.POST", status: 403, message: "Only an app admin can record finance close or executive approval for a monthly review." });
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) throw new GuardrailError({ code: "INVALID_PAYLOAD", where: "api.executive.monthly-review.POST", status: 400, message: "Monthly review action requires a valid review ID and supported action.", details: parsed.error.flatten() });
    const review = await loadMonthlyExecutiveReview(await loadGovernedExecutiveArtifact("monthly"));
    if (review.id !== parsed.data.reviewId) throw new GuardrailError({ code: "PRECONDITION_FAILED", where: "api.executive.monthly-review.POST", status: 409, message: "This monthly review is no longer the current governed version. Refresh before recording approval." });
    if (parsed.data.action === "finance_closed" && review.financialReadiness.state !== "ready") {
      throw new GuardrailError({ code: "PRECONDITION_FAILED", where: "api.executive.monthly-review.POST", status: 409, message: "Finance close cannot be recorded until the monthly artifact reports ready financial source coverage.", details: { recovery: review.financialReadiness.recovery } });
    }
    if (parsed.data.action === "executive_approved" && !review.events.some((event) => event.action === "finance_closed")) {
      throw new GuardrailError({ code: "PRECONDITION_FAILED", where: "api.executive.monthly-review.POST", status: 409, message: "Executive approval cannot be recorded before finance close.", details: { recovery: "Record finance close against this exact governed review version, then retry approval." } });
    }
    if (review.events.some((event) => event.action === parsed.data.action)) {
      throw new GuardrailError({ code: "PRECONDITION_FAILED", where: "api.executive.monthly-review.POST", status: 409, message: `Monthly review ${parsed.data.action.replaceAll("_", " ")} is already recorded for this governed version.` });
    }
    await appendMonthlyReviewGovernanceEvent({ reviewId: review.id, action: parsed.data.action, actorUserId: user.id, actorLabel: user.email ?? user.id, rationale: parsed.data.rationale });
    return NextResponse.json(await loadMonthlyExecutiveReview(await loadGovernedExecutiveArtifact("monthly")), { status: 201 });
  },
);

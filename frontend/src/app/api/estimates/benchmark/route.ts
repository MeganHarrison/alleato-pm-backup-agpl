import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const WHERE = "estimates/benchmark#GET";

/**
 * GET /api/estimates/benchmark?division_code=XX
 *
 * Returns historical bid/estimate benchmarks for a CSI division.
 * Aggregates awarded sub prices from estimate_sublist_subs across all estimates.
 * Falls back to estimate_detail_items totals if no awarded bids exist.
 *
 * Response:
 *   { division_code, count, min, max, avg, median, p25, p75, source }
 */
export const GET = withApiGuardrails(WHERE, async ({ request }) => {
  const supabase = await createClient();

  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: WHERE, message: "Authentication required." });
  }

  const url = new URL(request.url);
  const divisionCode = url.searchParams.get("division_code");
  if (!divisionCode) {
    throw new GuardrailError({ code: "INVALID_PAYLOAD", where: WHERE, message: "division_code is required." });
  }

  // Try awarded bids first — most accurate signal
  const { data: awardedBids } = await supabase
    .from("estimate_sublist_subs")
    .select("price, estimate_id")
    .eq("division_code", divisionCode)
    .eq("is_awarded", true)
    .not("price", "is", null)
    .gt("price", 0);

  const bidPrices = (awardedBids ?? [])
    .map((b) => Number(b.price))
    .filter((p) => p > 0)
    .sort((a, b) => a - b);

  // Fall back to detail item totals per estimate per division
  let detailTotals: number[] = [];
  if (bidPrices.length < 3) {
    const { data: detailItems } = await supabase
      .from("estimate_detail_items")
      .select("estimate_id, estimated_amount")
      .eq("division_code", divisionCode)
      .not("estimated_amount", "is", null)
      .gt("estimated_amount", 0);

    if (detailItems && detailItems.length > 0) {
      // Sum per estimate
      const byEstimate = new Map<number, number>();
      for (const item of detailItems) {
        byEstimate.set(
          item.estimate_id,
          (byEstimate.get(item.estimate_id) ?? 0) + Number(item.estimated_amount)
        );
      }
      detailTotals = [...byEstimate.values()].filter((v) => v > 0).sort((a, b) => a - b);
    }
  }

  const values = bidPrices.length >= 3 ? bidPrices : detailTotals;
  const source = bidPrices.length >= 3 ? "awarded_bids" : detailTotals.length > 0 ? "estimate_items" : "none";

  if (values.length === 0) {
    return NextResponse.json({
      division_code: divisionCode,
      count: 0,
      min: null,
      max: null,
      avg: null,
      median: null,
      p25: null,
      p75: null,
      source: "none",
    });
  }

  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  const median = values[Math.floor(values.length / 2)]!;
  const p25 = values[Math.floor(values.length * 0.25)]!;
  const p75 = values[Math.floor(values.length * 0.75)]!;

  return NextResponse.json({
    division_code: divisionCode,
    count: values.length,
    min: values[0],
    max: values[values.length - 1],
    avg: Math.round(avg),
    median: Math.round(median),
    p25: Math.round(p25),
    p75: Math.round(p75),
    source,
  });
});

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const WHERE = "companies/[companyId]/bid-history#GET";

/**
 * GET /api/companies/[companyId]/bid-history
 *
 * Returns the bid history for a company across all estimates.
 * Used by the SubList to show a performance hover card on the company field.
 *
 * Response:
 *   {
 *     company_id, company_name,
 *     total_bids, awarded, win_rate,
 *     avg_price, divisions: [{ code, name, bids, awarded, avg_price }],
 *     recent: [{ project_name, division_code, price, is_awarded, estimate_date }]
 *   }
 */
export const GET = withApiGuardrails<{ companyId: string }>(WHERE, async ({ params }) => {
  const { companyId } = await params;
  const supabase = await createClient();

  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: WHERE, message: "Authentication required." });
  }

  if (!companyId) {
    throw new GuardrailError({ code: "INVALID_PAYLOAD", where: WHERE, message: "Company ID is required." });
  }

  // Load company
  const { data: company } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .single();

  if (!company) {
    throw new GuardrailError({ code: "NOT_FOUND", where: WHERE, message: "Company not found." });
  }

  // Load all sub entries for this company
  const { data: subs, error: subsError } = await supabase
    .from("estimate_sublist_subs")
    .select(`
      id,
      division_code,
      division_name,
      price,
      is_awarded,
      estimate_id,
      estimates!inner(estimate_id, created_at, projects!inner(name, id))
    `)
    .eq("company_id", companyId)
    .order("estimate_id", { ascending: false })
    .limit(100);

  if (subsError) {
    throw new GuardrailError({ code: "DB_ERROR", where: WHERE, message: subsError.message });
  }

  const records = subs ?? [];
  const total = records.length;
  const awarded = records.filter((s) => s.is_awarded).length;
  const withPrice = records.filter((s) => s.price && Number(s.price) > 0);
  const avgPrice = withPrice.length > 0
    ? Math.round(withPrice.reduce((sum, s) => sum + Number(s.price), 0) / withPrice.length)
    : null;

  // Per-division breakdown
  const divisionMap = new Map<string, { code: string; name: string; bids: number; awarded: number; prices: number[] }>();
  for (const sub of records) {
    const code = sub.division_code ?? "??";
    if (!divisionMap.has(code)) {
      divisionMap.set(code, { code, name: sub.division_name ?? code, bids: 0, awarded: 0, prices: [] });
    }
    const entry = divisionMap.get(code)!;
    entry.bids++;
    if (sub.is_awarded) entry.awarded++;
    if (sub.price && Number(sub.price) > 0) entry.prices.push(Number(sub.price));
  }

  const divisions = [...divisionMap.values()].map((d) => ({
    code: d.code,
    name: d.name,
    bids: d.bids,
    awarded: d.awarded,
    avg_price: d.prices.length > 0 ? Math.round(d.prices.reduce((a, b) => a + b, 0) / d.prices.length) : null,
  }));

  // Recent activity
  const recent = records.slice(0, 5).map((sub) => {
    const estimate = sub.estimates as unknown as { created_at: string; projects: { name: string | null; id: number } };
    return {
      project_name: estimate?.projects?.name ?? "Unknown project",
      project_id: estimate?.projects?.id ?? null,
      division_code: sub.division_code,
      price: sub.price ? Number(sub.price) : null,
      is_awarded: sub.is_awarded,
      estimate_date: estimate?.created_at ?? null,
    };
  });

  return NextResponse.json({
    company_id: companyId,
    company_name: company.name,
    total_bids: total,
    awarded,
    win_rate: total > 0 ? Math.round((awarded / total) * 100) : 0,
    avg_price: avgPrice,
    divisions,
    recent,
  });
});

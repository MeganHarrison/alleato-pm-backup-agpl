import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const WHERE = "estimates/suggest-subs#GET";

/** Maps CSI division codes to trade keywords for vendor_class/type matching */
const CSI_DIVISION_TRADES: Record<string, string[]> = {
  "02": ["demolition", "environmental", "existing conditions", "abatement"],
  "03": ["concrete", "structural concrete"],
  "04": ["masonry", "brick", "block"],
  "05": ["steel", "metals", "structural steel", "iron"],
  "06": ["carpentry", "wood", "millwork", "cabinetry", "framing"],
  "07": ["roofing", "waterproofing", "insulation", "caulking", "sealants"],
  "08": ["doors", "windows", "glazing", "openings", "hardware"],
  "09": ["drywall", "painting", "flooring", "tile", "finishes", "ceilings", "acoustical"],
  "10": ["specialties", "toilet", "signage", "lockers"],
  "11": ["equipment"],
  "12": ["furnishings", "furniture", "blinds"],
  "13": ["special construction"],
  "14": ["elevator", "conveying", "escalator"],
  "21": ["fire sprinkler", "fire suppression", "sprinkler"],
  "22": ["plumbing", "mechanical", "piping"],
  "23": ["hvac", "mechanical", "heating", "cooling", "ventilation", "air conditioning"],
  "25": ["automation", "controls", "building automation", "bas"],
  "26": ["electrical", "electric", "lighting", "power"],
  "27": ["data", "communications", "low voltage", "telecom", "av", "audio visual"],
  "28": ["security", "fire alarm", "access control", "cctv", "electronic safety"],
  "31": ["earthwork", "grading", "excavation", "site work"],
  "32": ["paving", "landscaping", "site improvements", "concrete flatwork", "exterior"],
  "33": ["utilities", "underground", "site utilities"],
  "50": ["design", "architect", "engineer"],
};

/**
 * GET /api/estimates/suggest-subs?division_code=XX&exclude_company_ids=uuid1,uuid2&limit=5
 *
 * Returns ranked company suggestions for a given division, based on:
 *   1. Trade keyword match in vendor_class/type
 *   2. Frequency of prior subcontract awards
 *   3. Active vendor status
 *
 * Excludes companies already in exclude_company_ids.
 */
export const GET = withApiGuardrails(WHERE, async ({ request }) => {
  const supabase = await createClient();

  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: WHERE, message: "Authentication required." });
  }

  const url = new URL(request.url);
  const divisionCode = url.searchParams.get("division_code");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "8", 10), 20);
  const excludeIds = url.searchParams.get("exclude_company_ids")?.split(",").filter(Boolean) ?? [];

  if (!divisionCode) {
    throw new GuardrailError({ code: "INVALID_PAYLOAD", where: WHERE, message: "division_code is required." });
  }

  const keywords = CSI_DIVISION_TRADES[divisionCode] ?? [];

  // Load all vendors with trade type info
  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select("id, name, contact_name, contact_email, contact_phone, vendor_class, type, is_vendor")
    .eq("is_vendor", true)
    .not("id", "in", `(${excludeIds.length > 0 ? excludeIds.join(",") : "00000000-0000-0000-0000-000000000000"})`)
    .limit(500);

  if (companiesError) {
    throw new GuardrailError({ code: "DB_ERROR", where: WHERE, message: companiesError.message });
  }

  // Get subcontract frequency per company
  const { data: contractFrequency } = await supabase
    .from("subcontracts")
    .select("contract_company_id")
    .not("contract_company_id", "is", null);

  const frequencyMap = new Map<string, number>();
  for (const row of contractFrequency ?? []) {
    if (row.contract_company_id) {
      frequencyMap.set(row.contract_company_id, (frequencyMap.get(row.contract_company_id) ?? 0) + 1);
    }
  }

  // Get bid history win rate per company
  const { data: awardedSubs } = await supabase
    .from("estimate_sublist_subs")
    .select("company_id, is_awarded")
    .not("company_id", "is", null);

  const bidMap = new Map<string, { total: number; awarded: number }>();
  for (const sub of awardedSubs ?? []) {
    if (sub.company_id) {
      const entry = bidMap.get(sub.company_id) ?? { total: 0, awarded: 0 };
      entry.total++;
      if (sub.is_awarded) entry.awarded++;
      bidMap.set(sub.company_id, entry);
    }
  }

  // Score each company
  const scored = (companies ?? []).map((company) => {
    const haystack = `${company.vendor_class ?? ""} ${company.type ?? ""}`.toLowerCase();
    const tradeScore = keywords.length > 0 && keywords.some((kw) => haystack.includes(kw)) ? 3 : 0;
    const contracts = frequencyMap.get(company.id) ?? 0;
    const contractScore = Math.min(contracts, 5); // cap at 5 points
    const bidData = bidMap.get(company.id);
    const winScore = bidData && bidData.total > 0 ? Math.round((bidData.awarded / bidData.total) * 2) : 0;
    const totalScore = tradeScore + contractScore + winScore;

    return {
      id: company.id,
      name: company.name,
      contact_name: company.contact_name,
      contact_email: company.contact_email,
      contact_phone: company.contact_phone,
      vendor_class: company.vendor_class,
      type: company.type,
      is_trade_match: tradeScore > 0,
      prior_contracts: contracts,
      bid_history: bidData ?? null,
      score: totalScore,
    };
  });

  // Sort: trade matches first, then by score descending
  scored.sort((a, b) => {
    if (a.is_trade_match !== b.is_trade_match) return a.is_trade_match ? -1 : 1;
    return b.score - a.score;
  });

  return NextResponse.json(scored.slice(0, limit));
});

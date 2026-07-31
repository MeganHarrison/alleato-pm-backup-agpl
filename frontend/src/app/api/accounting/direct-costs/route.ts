import { NextResponse } from "next/server";
import { requireCurrentUserAppCapability } from "@/lib/app-capabilities";
import { buildAcumaticaApBillHref } from "@/lib/acumatica/ap-bill-url";
import { buildFinanceSpendRollup } from "@/lib/accounting/finance-spend";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { createServiceClient } from "@/lib/supabase/service";

const WHERE = "/api/accounting/direct-costs";

export const GET = withApiGuardrails(`${WHERE}#GET`, async ({ request }) => {
  await requireCurrentUserAppCapability(
    "view_accounting",
    `${WHERE}#GET`,
    "Accounting access required.",
  );

  const monthsParam = request.nextUrl.searchParams.get("months");
  const parsedMonths = monthsParam ? Number.parseInt(monthsParam, 10) : 12;
  const months = Number.isFinite(parsedMonths)
    ? Math.min(Math.max(parsedMonths, 1), 24)
    : 12;

  const rollup = await buildFinanceSpendRollup(createServiceClient(), months, {
    includedBillLimit: 2000,
    exceptionLimit: 400,
  });

  const areaTotalsMap = new Map<
    string,
    { area: string; areaLabel: string; total: number; billCount: number; reviewCount: number }
  >();

  for (const row of rollup.includedBills) {
    const existing = areaTotalsMap.get(row.operatingArea) ?? {
      area: row.operatingArea,
      areaLabel: row.operatingAreaLabel,
      total: 0,
      billCount: 0,
      reviewCount: 0,
    };
    existing.total += row.amount;
    existing.billCount += 1;
    if (row.confidence < 0.85 || row.flags.length > 0) {
      existing.reviewCount += 1;
    }
    areaTotalsMap.set(row.operatingArea, existing);
  }

  const rows = rollup.includedBills.map((row) => ({
    ...row,
    sourceHref: row.referenceNbr
      ? buildAcumaticaApBillHref(row.documentType, row.referenceNbr)
      : null,
    needsReview: row.confidence < 0.85 || row.flags.length > 0,
  }));

  const areaTotals = [...areaTotalsMap.values()]
    .map((row) => ({
      ...row,
      total: Math.round(row.total * 100) / 100,
    }))
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({
    generatedAt: rollup.generatedAt,
    window: rollup.window,
    totals: {
      includedSpend: rollup.totals.includedSpend,
      includedBillCount: rollup.totals.includedBillCount,
      reviewCount: rows.filter((row) => row.needsReview).length,
    },
    areaTotals,
    rows,
  });
});

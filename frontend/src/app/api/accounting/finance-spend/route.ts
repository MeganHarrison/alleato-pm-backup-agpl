import { NextResponse } from "next/server";
import { requireCurrentUserAppCapability } from "@/lib/app-capabilities";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { createServiceClient } from "@/lib/supabase/service";
import { buildFinanceSpendRollup } from "@/lib/accounting/finance-spend";

const WHERE = "/api/accounting/finance-spend";

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

  const rollup = await buildFinanceSpendRollup(createServiceClient(), months);
  return NextResponse.json(rollup, {
    headers: {
      "Cache-Control": "private, max-age=60",
    },
  });
});

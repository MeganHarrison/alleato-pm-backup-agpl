import { NextResponse } from "next/server";
import { requireCurrentUserAppCapability } from "@/lib/app-capabilities";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { createServiceClient } from "@/lib/supabase/service";
import { listFinanceSpendClassificationRules } from "@/lib/accounting/finance-spend";

const WHERE = "/api/accounting/finance-spend/rules";

export const GET = withApiGuardrails(`${WHERE}#GET`, async () => {
  await requireCurrentUserAppCapability(
    "view_accounting",
    `${WHERE}#GET`,
    "Accounting access required.",
  );

  const rules = await listFinanceSpendClassificationRules(createServiceClient());
  return NextResponse.json({
    rules,
    generatedAt: new Date().toISOString(),
  });
});

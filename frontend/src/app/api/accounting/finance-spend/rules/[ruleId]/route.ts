import { NextResponse } from "next/server";
import { requireCurrentUserAppCapability } from "@/lib/app-capabilities";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { createServiceClient } from "@/lib/supabase/service";
import {
  financeSpendRuleUpdateSchema,
  updateFinanceSpendClassificationRule,
} from "@/lib/accounting/finance-spend";

const WHERE = "/api/accounting/finance-spend/rules/[ruleId]";

type Params = {
  ruleId: string;
};

export const PATCH = withApiGuardrails<Params>(
  `${WHERE}#PATCH`,
  async ({ request, params }) => {
    await requireCurrentUserAppCapability(
      "view_accounting",
      `${WHERE}#PATCH`,
      "Accounting access required.",
    );

    const input = await parseJsonBody(
      request,
      financeSpendRuleUpdateSchema,
      `${WHERE}#PATCH`,
    );
    const rule = await updateFinanceSpendClassificationRule(
      createServiceClient(),
      params.ruleId,
      input,
    );

    return NextResponse.json({ rule });
  },
);

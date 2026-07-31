import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { createCrmCommunicationCandidates } from "@/lib/crm/communication-matching";
import { reconcileCrmConversions } from "@/lib/crm/conversion-reconciliation";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { createServiceClient } from "@/lib/supabase/service";

export const POST = withApiGuardrails(
  "cron/crm-health#POST",
  async ({ request }) => {
    const configuredSecret = process.env.CRON_SECRET;
    const suppliedSecret = request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "");
    if (!configuredSecret || suppliedSecret !== configuredSecret) {
      throw new GuardrailError({
        code: "FORBIDDEN",
        where: "cron/crm-health#POST",
        message: "Scheduled CRM health authorization failed.",
        status: 403,
        severity: "high",
      });
    }
    const db = createServiceClient();
    const { data: accounts, error: accountsError } = await db
      .from("crm_account_profiles")
      .select("company_id")
      .is("archived_at", null);
    if (accountsError) return apiErrorResponse(accountsError);
    const failures: Array<{ companyId: string; reason: string }> = [];
    for (const account of accounts ?? []) {
      const { error } = await db.rpc("crm_evaluate_account", {
        p_company_id: account.company_id,
      });
      if (error)
        failures.push({ companyId: account.company_id, reason: error.message });
    }
    if (failures.length) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "cron/crm-health#POST",
        message: `CRM health catch-up failed for ${failures.length} account(s).`,
        severity: "high",
        details: { failures },
      });
    }
    const communicationCandidates = await createCrmCommunicationCandidates();
    const conversions = await reconcileCrmConversions();
    return NextResponse.json({
      data: {
        evaluated: accounts?.length ?? 0,
        communication_candidates: communicationCandidates,
        conversions,
        completed_at: new Date().toISOString(),
      },
    });
  },
);

export const GET = POST;

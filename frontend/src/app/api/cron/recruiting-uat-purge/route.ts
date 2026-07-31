import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { purgeExpiredRecruitingUatSubmissions } from "@/lib/recruiting/intake-uat-service";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export const POST = withApiGuardrails(
  "cron/recruiting-uat-purge#POST",
  async ({ request }) => {
    const configuredSecret = process.env.CRON_SECRET;
    const suppliedSecret = request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "");
    if (!configuredSecret || suppliedSecret !== configuredSecret) {
      throw new GuardrailError({
        code: "FORBIDDEN",
        where: "cron/recruiting-uat-purge#POST",
        message: "Scheduled recruiting UAT cleanup authorization failed.",
        status: 403,
        severity: "high",
      });
    }

    await purgeExpiredRecruitingUatSubmissions({
      service: createServiceClient(),
    });

    return NextResponse.json({
      success: true,
      completedAt: new Date().toISOString(),
    });
  },
);

export const GET = POST;

import { NextResponse } from "next/server";

import { drainAcceptedDailyDeepReadPromotions } from "@/lib/daily-briefs/daily-deep-read-promotion";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const WHERE = "/api/cron/daily-deep-read-promote-accepted";

function assertCronAuthorized(request: Request) {
  const cronSecret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: WHERE,
      message: "Unauthorized Daily Deep Read promotion cron invocation.",
      status: 401,
      severity: "medium",
    });
  }
}

async function handleCron(request: Request) {
  assertCronAuthorized(request);
  const result = await drainAcceptedDailyDeepReadPromotions({
    reviewedBy: "cron:daily-deep-read-promote-accepted",
  });
  return NextResponse.json(result);
}

export const GET = withApiGuardrails(`${WHERE}#GET`, async ({ request }) =>
  handleCron(request),
);

export const POST = withApiGuardrails(`${WHERE}#POST`, async ({ request }) =>
  handleCron(request),
);

export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

function parseBearerToken(header: string | null): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

export const POST = withApiGuardrails(
  "/api/cron/executive-daily-brief#POST",
  async ({ request }) => {
    const expectedSecret = process.env.CRON_SECRET;
    const token = parseBearerToken(request.headers.get("authorization"));

    if (!expectedSecret || token !== expectedSecret) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "/api/cron/executive-daily-brief#POST",
        message: "Unauthorized cron invocation.",
        status: 401,
        severity: "medium",
      });
    }

    const gatewayUrl = new URL(
      "/api/executive/daily-brief/send-teams",
      request.url,
    );
    const response = await fetch(gatewayUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${expectedSecret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const result = await response.json();

    return NextResponse.json(result, {
      status: response.status,
    });
  },
);

export const GET = POST;

import { NextResponse } from "next/server";
import { z } from "zod";

import { fetchWithPolicy } from "@/lib/guardrails/dependency";
import { GuardrailError } from "@/lib/guardrails/errors";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const ReclassifySchema = z.object({
  intakeIds: z.array(z.number().int().positive()).max(500).optional(),
  mailbox: z.string().email().optional(),
  daysBack: z.number().int().min(0).max(30).default(0),
  timeZone: z.string().min(1).default("America/New_York"),
  limit: z.number().int().min(1).max(5000).default(500),
  apply: z.boolean().default(true),
});

async function assertAdminAccess(where: string) {
  const supabase = await createClient();
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Authentication required.",
      status: 401,
    });
  }

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (error || !profile?.is_admin) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where,
      message: "Admin access required.",
      details: error?.message,
      status: 403,
    });
  }
}

function backendUrl(): string {
  const value = (
    process.env.BACKEND_URL ||
    process.env.PYTHON_BACKEND_URL ||
    (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "")
  )
    .replace(/\/+$/, "")
    .trim();

  try {
    new URL(value);
  } catch {
    throw new GuardrailError({
      code: "MISSING_ENV_VAR",
      where: "outlook-intake/reclassify#POST",
      message: "Missing or invalid backend URL. Set BACKEND_URL or PYTHON_BACKEND_URL.",
      status: 503,
    });
  }

  return value;
}

function backendAdminKey(): string {
  const apiKey = process.env.ADMIN_API_KEY?.trim();
  if (!apiKey) {
    throw new GuardrailError({
      code: "MISSING_ENV_VAR",
      where: "outlook-intake/reclassify#POST",
      message: "ADMIN_API_KEY is required to reclassify Outlook intake.",
      status: 503,
    });
  }
  return apiKey;
}

export const POST = withApiGuardrails(
  "outlook-intake/reclassify#POST",
  async ({ request, requestId }) => {
    await assertAdminAccess("outlook-intake/reclassify#POST");
    const body = await parseJsonBody(
      request,
      ReclassifySchema,
      "outlook-intake/reclassify#POST",
    );

    const headers = new Headers({
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Admin-Api-Key": backendAdminKey(),
    });

    const backendResponse = await fetchWithPolicy(
      requestId,
      "outlook-intake/reclassify#POST",
      "backend.outlook-intake.reclassify",
      `${backendUrl()}/api/graph/outlook/reclassify-intake`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          mailbox: body.mailbox,
          intake_ids: body.intakeIds,
          days_back: body.daysBack,
          time_zone: body.timeZone,
          limit: body.limit,
          apply: body.apply,
        }),
        cache: "no-store",
      },
      {
        timeoutMs: 60_000,
        maxRetries: 0,
      },
    );

    return NextResponse.json(await backendResponse.json());
  },
);

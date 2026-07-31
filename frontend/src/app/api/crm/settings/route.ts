import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { requireCrmAccess } from "@/lib/crm/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";

const PatchSchema = z.object({
  health_thresholds: z.object({
    active_days: z.number().int().min(1).max(365),
    watch_days: z.number().int().min(2).max(730),
  }).refine((value) => value.watch_days > value.active_days, {
    message: "Watch days must be greater than active days.",
  }).optional(),
  stale_deal_threshold_days: z.number().int().min(1).max(730).optional(),
  default_reporting_timezone: z.string().trim().min(1).max(100).optional(),
  auto_accept_enabled: z.boolean().optional(),
  free_email_domain_denylist: z.array(z.string().trim().toLowerCase().min(3)).max(500).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one setting is required.");

export const GET = withApiGuardrails("crm/settings#GET", async () => {
  const { db } = await requireCrmAccess("read");
  const { data, error } = await db.from("crm_settings").select("*").order("key");
  if (error) return apiErrorResponse(error);
  return NextResponse.json({ data: data ?? [] });
});

export const PATCH = withApiGuardrails("crm/settings#PATCH", async ({ request }) => {
  const { db, personId } = await requireCrmAccess("admin");
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where: "crm/settings#PATCH",
      message: "Invalid CRM settings.",
      status: 400,
      details: { issues: parsed.error.flatten() },
    });
  }
  const updates = Object.entries(parsed.data).map(([key, value]) => ({
    key,
    value,
    updated_by_person_id: personId,
  }));
  const { data, error } = await db
    .from("crm_settings")
    .upsert(updates, { onConflict: "key" })
    .select();
  if (error) return apiErrorResponse(error);
  return NextResponse.json({ data });
});

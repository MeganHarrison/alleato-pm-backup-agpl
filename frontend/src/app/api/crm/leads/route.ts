import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { requireCrmAccess } from "@/lib/crm/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || null);

const isHttpsUrl = (value: string | null | undefined) =>
  !value || (URL.canParse(value) && new URL(value).protocol === "https:");

const optionalHttpsUrl = z
  .union([z.string().trim().url().max(2048), z.literal("")])
  .optional()
  .refine(isHttpsUrl, "Use a secure https:// URL.")
  .transform((value) => value || null);

const CreateLeadSchema = z
  .object({
    full_name: z.string().trim().min(1).max(200),
    prospect_company_name: z.string().trim().min(1).max(300),
    job_title: optionalTrimmedString(200),
    email: z
      .union([z.string().trim().email().max(320), z.literal("")])
      .optional()
      .transform((value) => value || null),
    phone: z
      .union([z.string().trim().min(3).max(50), z.literal("")])
      .optional()
      .transform((value) => value || null),
    source: z.string().trim().min(1).max(200).default("manual"),
    notes: optionalTrimmedString(8000),
    website_url: optionalHttpsUrl,
    linkedin_url: optionalHttpsUrl,
    facebook_url: optionalHttpsUrl,
    x_url: optionalHttpsUrl,
  })
  .strict();

export const GET = withApiGuardrails("crm/leads#GET", async () => {
  const { db } = await requireCrmAccess("read");
  const { data, error } = await db
    .from("crm_leads")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(250);
  if (error) return apiErrorResponse(error);
  return NextResponse.json({ data: data ?? [] });
});

export const POST = withApiGuardrails("crm/leads#POST", async ({ request }) => {
  const { db, personId } = await requireCrmAccess("write");
  const parsed = CreateLeadSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where: "crm/leads#POST",
      message: "Invalid CRM lead.",
      status: 400,
      details: { issues: parsed.error.flatten() },
    });
  }

  const { data, error } = await db
    .from("crm_leads")
    .insert({
      ...parsed.data,
      owner_person_id: personId,
    })
    .select()
    .single();
  if (error) return apiErrorResponse(error);
  return NextResponse.json({ data }, { status: 201 });
});

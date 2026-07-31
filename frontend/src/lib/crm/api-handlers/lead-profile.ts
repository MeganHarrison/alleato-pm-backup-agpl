import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { assertCrmOwnerOrAdmin, requireCrmAccess } from "@/lib/crm/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

const nullableText = (max: number) =>
  z
    .union([z.string().trim().min(1).max(max), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value === undefined ? undefined : value || null));

const isHttpsUrl = (value: string | null | undefined) =>
  !value || (URL.canParse(value) && new URL(value).protocol === "https:");

const nullableHttpsUrl = z
  .union([z.string().trim().url().max(2048), z.literal(""), z.null()])
  .optional()
  .refine(isHttpsUrl, "Use a secure https:// URL.")
  .transform((value) => (value === undefined ? undefined : value || null));

const UpdateLeadSchema = z
  .object({
    row_version: z.number().int().positive(),
    full_name: z.string().trim().min(1).max(200).optional(),
    prospect_company_name: z.string().trim().min(1).max(300).optional(),
    job_title: nullableText(200),
    email: z
      .union([z.string().trim().email().max(320), z.literal(""), z.null()])
      .optional()
      .transform((value) => (value === undefined ? undefined : value || null)),
    phone: nullableText(50),
    website_url: nullableHttpsUrl,
    linkedin_url: nullableHttpsUrl,
    facebook_url: nullableHttpsUrl,
    x_url: nullableHttpsUrl,
    notes: nullableText(8000),
  })
  .strict();

export const PATCH = withApiGuardrails(
  "crm/leads/[leadId]#PATCH",
  async ({ request, params }) => {
    const { leadId } = await params;
    if (!z.string().uuid().safeParse(leadId).success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/leads/[leadId]#PATCH",
        message: "A valid CRM lead is required.",
        status: 400,
      });
    }
    const parsed = UpdateLeadSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/leads/[leadId]#PATCH",
        message: "The lead changes are invalid.",
        status: 400,
        details: { issues: parsed.error.flatten() },
      });
    }
    const { db, personId, isAdmin } = await requireCrmAccess("write");
    const { data: current, error: readError } = await db
      .from("crm_leads")
      .select("owner_person_id, row_version")
      .eq("id", leadId)
      .is("archived_at", null)
      .maybeSingle();
    if (readError) return apiErrorResponse(readError);
    if (!current)
      return NextResponse.json({ message: "Lead not found." }, { status: 404 });
    assertCrmOwnerOrAdmin({
      ownerPersonId: current.owner_person_id,
      personId,
      isAdmin,
      action: "crm/leads/[leadId]#PATCH",
    });
    if (current.row_version !== parsed.data.row_version) {
      return NextResponse.json(
        { message: "This lead changed. Refresh and try again." },
        { status: 409 },
      );
    }
    const { row_version: _rowVersion, ...patch } = parsed.data;
    const { data, error } = await db
      .from("crm_leads")
      .update(patch)
      .eq("id", leadId)
      .eq("row_version", current.row_version)
      .select()
      .maybeSingle();
    if (error) return apiErrorResponse(error);
    if (!data) {
      return NextResponse.json(
        { message: "This lead changed. Refresh and try again." },
        { status: 409 },
      );
    }
    return NextResponse.json({ data });
  },
);

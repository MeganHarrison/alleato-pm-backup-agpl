import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

type QualificationRouteParams = { companyId: string };

export const GET = withApiGuardrails<QualificationRouteParams>(
  "crm/companies/[companyId]/qualification#GET",
  async ({ params }) => {
    const { companyId } = params;
    assertNonNilUuid(companyId, "companyId", "crm/companies/[companyId]/qualification#GET");

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("company_qualification")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ data });
  },
);

const UpdateQualificationSchema = z
  .object({
    w9_received_at: z.string().date().nullable().optional(),
    insurance_certificate_received_at: z.string().date().nullable().optional(),
    insurance_expires_at: z.string().date().nullable().optional(),
    license_verified_at: z.string().date().nullable().optional(),
    notes: z.string().trim().max(4000).nullable().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "No fields to update.",
  });

export const PATCH = withApiGuardrails<QualificationRouteParams>(
  "crm/companies/[companyId]/qualification#PATCH",
  async ({ request, params }) => {
    const { companyId } = params;
    assertNonNilUuid(companyId, "companyId", "crm/companies/[companyId]/qualification#PATCH");

    const parsed = UpdateQualificationSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/companies/[companyId]/qualification#PATCH",
        message: parsed.error.issues[0]?.message ?? "Invalid qualification payload.",
        status: 400,
        severity: "low",
      });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("company_qualification")
      .upsert(
        { company_id: companyId, ...parsed.data },
        { onConflict: "company_id" },
      )
      .select("*")
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ data });
  },
);

// Converting a prospect is a status flip, never a row migration: the company
// keeps its id, history, and FKs. Requires a complete qualification record
// (W-9 + insurance + license) — the whole point of the verified boundary.
export const POST = withApiGuardrails<QualificationRouteParams>(
  "crm/companies/[companyId]/qualification#POST",
  async ({ params }) => {
    const { companyId } = params;
    assertNonNilUuid(companyId, "companyId", "crm/companies/[companyId]/qualification#POST");

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "crm/companies/[companyId]/qualification#POST",
        message: "Sign in to verify a company.",
        status: 401,
        severity: "medium",
      });
    }

    const supabase = await createClient();

    const { data: qualification, error: qualificationError } = await supabase
      .from("company_qualification")
      .select("id, w9_received_at, insurance_certificate_received_at, license_verified_at")
      .eq("company_id", companyId)
      .maybeSingle();

    if (qualificationError) {
      return apiErrorResponse(qualificationError);
    }

    const missing = [
      !qualification?.w9_received_at && "W-9",
      !qualification?.insurance_certificate_received_at && "insurance certificate",
      !qualification?.license_verified_at && "license verification",
    ].filter(Boolean);

    if (!qualification || missing.length > 0) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/companies/[companyId]/qualification#POST",
        message: `Qualification incomplete — still missing: ${missing.join(", ") || "all items"}.`,
        status: 422,
        severity: "low",
      });
    }

    const { error: companyError } = await supabase
      .from("companies")
      .update({ lifecycle_stage: "active" })
      .eq("id", companyId);

    if (companyError) {
      return apiErrorResponse(companyError);
    }

    const { error: stampError } = await supabase
      .from("company_qualification")
      .update({ qualified_at: new Date().toISOString(), qualified_by: user.id })
      .eq("id", qualification.id);

    if (stampError) {
      return apiErrorResponse(stampError);
    }

    return NextResponse.json({ success: true });
  },
);

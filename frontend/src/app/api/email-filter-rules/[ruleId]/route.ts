import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  label: z.string().trim().min(1).max(120).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  action: z.enum(["skip", "review", "allow", "not_project"]).optional(),
  senderPattern: z.string().trim().min(1).max(320).optional().nullable(),
  senderDomain: z.string().trim().min(1).max(255).optional().nullable(),
  subjectPattern: z.string().trim().min(1).max(500).optional().nullable(),
  bodyPattern: z.string().trim().min(1).max(2000).optional().nullable(),
});

async function assertAdmin(where: string) {
  const supabase = await createClient();
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Authentication required.",
    });
  }
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (profileError) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where,
      message: profileError.message,
    });
  }
  if (!profile?.is_admin) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where,
      message: "Admin access required.",
      status: 403,
    });
  }
  return supabase;
}

export const PATCH = withApiGuardrails<Promise<{ ruleId: string }>>(
  "email-filter-rules#PATCH",
  async ({ request, params }) => {
    const supabase = await assertAdmin("email-filter-rules#PATCH");
    const { ruleId } = params;

    const body = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "email-filter-rules#PATCH",
        message: parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
        status: 400,
      });
    }

    const { data: existingRule, error: existingRuleError } = await supabase
      .from("email_filter_rules")
      .select(
        "sender_pattern, sender_domain, subject_pattern, body_pattern",
      )
      .eq("id", ruleId)
      .single();

    if (existingRuleError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "email-filter-rules#PATCH",
        message: existingRuleError.message,
      });
    }

    const updateRow = {
      enabled: parsed.data.enabled,
      label: parsed.data.label,
      description: parsed.data.description,
      action: parsed.data.action,
      sender_pattern:
        parsed.data.senderPattern !== undefined
          ? parsed.data.senderPattern?.toLowerCase() ?? null
          : undefined,
      sender_domain:
        parsed.data.senderDomain !== undefined
          ? parsed.data.senderDomain?.toLowerCase() ?? null
          : undefined,
      subject_pattern:
        parsed.data.subjectPattern !== undefined
          ? parsed.data.subjectPattern ?? null
          : undefined,
      body_pattern:
        parsed.data.bodyPattern !== undefined
          ? parsed.data.bodyPattern ?? null
          : undefined,
    };

    const mergedCriteria = {
      senderPattern:
        parsed.data.senderPattern !== undefined
          ? updateRow.sender_pattern
          : existingRule.sender_pattern,
      senderDomain:
        parsed.data.senderDomain !== undefined
          ? updateRow.sender_domain
          : existingRule.sender_domain,
      subjectPattern:
        parsed.data.subjectPattern !== undefined
          ? updateRow.subject_pattern
          : existingRule.subject_pattern,
      bodyPattern:
        parsed.data.bodyPattern !== undefined
          ? updateRow.body_pattern
          : existingRule.body_pattern,
    };

    if (
      !mergedCriteria.senderPattern &&
      !mergedCriteria.senderDomain &&
      !mergedCriteria.subjectPattern &&
      !mergedCriteria.bodyPattern
    ) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "email-filter-rules#PATCH",
        message:
          "At least one of senderPattern, senderDomain, subjectPattern, or bodyPattern must be set.",
        status: 400,
      });
    }

    const { data, error } = await supabase
      .from("email_filter_rules")
      .update(updateRow)
      .eq("id", ruleId)
      .select()
      .single();

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "email-filter-rules#PATCH",
        message: error.message,
      });
    }
    return NextResponse.json(data);
  },
);

export const DELETE = withApiGuardrails<Promise<{ ruleId: string }>>(
  "email-filter-rules#DELETE",
  async ({ params }) => {
    const supabase = await assertAdmin("email-filter-rules#DELETE");
    const { ruleId } = params;

    const { error } = await supabase
      .from("email_filter_rules")
      .delete()
      .eq("id", ruleId);

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "email-filter-rules#DELETE",
        message: error.message,
      });
    }
    return NextResponse.json({ ok: true });
  },
);

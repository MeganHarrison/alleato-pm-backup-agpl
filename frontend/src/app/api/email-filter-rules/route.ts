import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

const createRuleSchema = z
  .object({
    senderPattern: z.string().trim().min(1).max(320).optional().nullable(),
    senderDomain: z.string().trim().min(1).max(255).optional().nullable(),
    subjectPattern: z.string().trim().min(1).max(500).optional().nullable(),
    bodyPattern: z.string().trim().min(1).max(2000).optional().nullable(),
    action: z.enum(["skip", "review", "allow", "not_project"]).default("skip"),
    enabled: z.boolean().optional(),
    label: z.string().trim().min(1).max(120).optional().nullable(),
    description: z.string().trim().max(2000).optional().nullable(),
    sourceMessageId: z.string().trim().max(255).optional().nullable(),
    sourceSubject: z.string().trim().max(998).optional().nullable(),
  })
  .refine(
    (v) =>
      Boolean(v.senderPattern) ||
      Boolean(v.senderDomain) ||
      Boolean(v.subjectPattern) ||
      Boolean(v.bodyPattern),
    {
      message:
        "At least one of senderPattern, senderDomain, subjectPattern, or bodyPattern must be set.",
      path: ["senderPattern"],
    },
  );

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
  return { supabase, userId: user.id };
}

function parseLimit(value: string | null): number {
  if (!value) return DEFAULT_LIMIT;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.trunc(parsed), MAX_LIMIT);
}

export const GET = withApiGuardrails(
  "email-filter-rules#GET",
  async ({ request }) => {
    const { supabase } = await assertAdmin("email-filter-rules#GET");
    const { searchParams } = new URL(request.url);
    const enabledParam = searchParams.get("enabled");
    const limit = parseLimit(searchParams.get("limit"));

    let query = supabase
      .from("email_filter_rules")
      .select(
        `id, sender_pattern, sender_domain, subject_pattern, body_pattern,
         action, label, description, enabled, match_count, last_matched_at,
         source_message_id, source_subject, created_at, updated_at`,
      )
      .order("last_matched_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (enabledParam === "true") query = query.eq("enabled", true);
    if (enabledParam === "false") query = query.eq("enabled", false);

    const { data, error } = await query;
    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "email-filter-rules#GET",
        message: error.message,
      });
    }
    return NextResponse.json(data ?? []);
  },
);

export const POST = withApiGuardrails(
  "email-filter-rules#POST",
  async ({ request }) => {
    const { supabase, userId } = await assertAdmin("email-filter-rules#POST");

    const body = await request.json().catch(() => null);
    const parsed = createRuleSchema.safeParse(body);
    if (!parsed.success) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "email-filter-rules#POST",
        message: parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
        status: 400,
      });
    }
    const p = parsed.data;

    const insertRow = {
      sender_pattern: p.senderPattern?.toLowerCase() ?? null,
      sender_domain: p.senderDomain?.toLowerCase() ?? null,
      subject_pattern: p.subjectPattern ?? null,
      body_pattern: p.bodyPattern ?? null,
      action: p.action,
      enabled: p.enabled ?? true,
      label: p.label ?? null,
      description: p.description ?? null,
      source_message_id: p.sourceMessageId ?? null,
      source_subject: p.sourceSubject ?? null,
      created_by: userId,
    };

    const { data, error } = await supabase
      .from("email_filter_rules")
      .insert(insertRow)
      .select(
        `id, sender_pattern, sender_domain, subject_pattern, body_pattern,
         action, label, description, enabled, match_count, last_matched_at,
         source_message_id, source_subject, created_at, updated_at`,
      )
      .single();

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "email-filter-rules#POST",
        message: error.message,
      });
    }
    return NextResponse.json(data, { status: 201 });
  },
);

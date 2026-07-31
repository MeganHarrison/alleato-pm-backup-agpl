import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface OutlookSkipAuditRow {
  id: string;
  graph_message_id: string;
  mailbox_user_id: string | null;
  internet_message_id: string | null;
  conversation_id: string | null;
  subject: string | null;
  body_preview: string | null;
  from_name: string | null;
  from_email: string | null;
  received_at: string | null;
  web_link: string | null;
  classification_action: string;
  classification_category: string;
  classification_confidence: number | null;
  classification_reason: string;
  classification_signals: string[] | null;
  source_metadata: Record<string, unknown> | null;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
}

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

async function assertAdminAccess(where: string) {
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

function parseLimit(value: string | null): number {
  if (!value) return DEFAULT_LIMIT;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.trunc(parsed), MAX_LIMIT);
}

export const GET = withApiGuardrails(
  "outlook-skip-audit#GET",
  async ({ request }) => {
    const supabase = await assertAdminAccess("outlook-skip-audit#GET");
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("classification_category");
    const mailbox = searchParams.get("mailbox_user_id");
    const limit = parseLimit(searchParams.get("limit"));

    let query = supabase
      .from("outlook_email_skip_audit")
      .select(
        `
        id,
        graph_message_id,
        mailbox_user_id,
        internet_message_id,
        conversation_id,
        subject,
        body_preview,
        from_name,
        from_email,
        received_at,
        web_link,
        classification_action,
        classification_category,
        classification_confidence,
        classification_reason,
        classification_signals,
        source_metadata,
        first_seen_at,
        last_seen_at,
        created_at
      `,
      )
      .order("last_seen_at", { ascending: false })
      .limit(limit);

    if (category) {
      query = query.eq("classification_category", category);
    }

    if (mailbox) {
      query = query.eq("mailbox_user_id", mailbox);
    }

    const { data, error } = await query.returns<OutlookSkipAuditRow[]>();

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "outlook-skip-audit#GET",
        message: error.message,
      });
    }

    const rows = (data ?? []).map((row) => ({
      id: row.id,
      graphMessageId: row.graph_message_id,
      mailboxUserId: row.mailbox_user_id,
      internetMessageId: row.internet_message_id,
      conversationId: row.conversation_id,
      subject: row.subject,
      bodyPreview: row.body_preview,
      fromName: row.from_name,
      fromEmail: row.from_email,
      receivedAt: row.received_at,
      webLink: row.web_link,
      classificationAction: row.classification_action,
      classificationCategory: row.classification_category,
      classificationConfidence: row.classification_confidence,
      classificationReason: row.classification_reason,
      classificationSignals: row.classification_signals ?? [],
      sourceMetadata: row.source_metadata,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
      createdAt: row.created_at,
    }));

    return NextResponse.json(rows);
  },
);

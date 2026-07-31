export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";

interface AssistantReviewRow {
  id: string;
  intake_email_id: number;
  graph_message_id: string;
  mailbox_user_id: string;
  assistant_action: string;
  assistant_priority: string;
  assistant_score: number | null;
  assistant_reason: string | null;
  assistant_owner: string | null;
  assistant_risk: string | null;
  assistant_evidence: string | null;
  review_outcome: string;
  reviewer_note: string | null;
  draft_body: string | null;
  created_at: string;
}

function parseEmailIds(searchParams: URLSearchParams): number[] {
  return Array.from(
    new Set(
      searchParams
        .getAll("emailId")
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  );
}

export const GET = withApiGuardrails(
  "email-assistant/reviews#GET",
  async ({ request }) => {
    const supabase = await createClient();
        const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "email-assistant/reviews#GET",
        message: "Authentication required.",
        status: 401,
      });
    }

    const { searchParams } = new URL(request.url);
    const emailIds = parseEmailIds(searchParams);

    if (emailIds.length === 0) {
      return NextResponse.json({});
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = profile?.is_admin === true;

    // A literal (non-templated) select string lets Supabase's generated
    // types parse the column list — a runtime-built string (e.g. via
    // Array.join) types as an unparseable GenericStringError.
    let query = serviceDb.from("outlook_email_assistant_reviews")
      .select(
        "id, intake_email_id, graph_message_id, mailbox_user_id, assistant_action, assistant_priority, assistant_score, assistant_reason, assistant_owner, assistant_risk, assistant_evidence, review_outcome, reviewer_note, draft_body, created_at",
      )
      .in("intake_email_id", emailIds)
      .order("created_at", { ascending: false });

    if (!isAdmin) {
      if (!user.email) {
        throw new GuardrailError({
          code: "FORBIDDEN",
          where: "email-assistant/reviews#GET",
          message: "Email review access requires a signed-in mailbox.",
          status: 403,
        });
      }
      query = query.eq("mailbox_user_id", user.email.toLowerCase());
    }

    const { data, error } = await query;

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "email-assistant/reviews#GET",
        message: error.message,
      });
    }

    const latestByEmailId: Record<string, unknown> = {};
    for (const row of (data ?? []) as AssistantReviewRow[]) {
      const key = String(row.intake_email_id);
      if (latestByEmailId[key]) continue;
      latestByEmailId[key] = {
        id: row.id,
        intakeEmailId: row.intake_email_id,
        graphMessageId: row.graph_message_id,
        mailboxUserId: row.mailbox_user_id,
        assistantAction: row.assistant_action,
        assistantPriority: row.assistant_priority,
        assistantScore: row.assistant_score,
        assistantReason: row.assistant_reason,
        assistantOwner: row.assistant_owner,
        assistantRisk: row.assistant_risk,
        assistantEvidence: row.assistant_evidence,
        reviewOutcome: row.review_outcome,
        reviewerNote: row.reviewer_note,
        draftBody: row.draft_body,
        createdAt: row.created_at,
      };
    }

    return NextResponse.json(latestByEmailId);
  },
);

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import {
  createOutlookIntakeServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { deriveBrandonEmailAssistantDecision } from "@/lib/email-assistant/brandon-triage";
import { dedupeOutlookIntakeByMessageId } from "@/lib/emails/dedupe-outlook-intake";
import {
  applyInboxRules,
  type InboxRule,
} from "@/lib/email-assistant/inbox-rules";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import { NextResponse } from "next/server";

/**
 * Global Emails feed.
 *
 * Reads the LIVE inbox (`outlook_email_intake`, AI Database) — current to today.
 * The old PM-APP `project_emails` projection this used to read was abandoned
 * when the Outlook sync moved to the AI DB (it silently stopped ~2026-06-16),
 * leaving the page stale. The Triage inbox already reads this same live source.
 * App-composed drafts (a handful) are not surfaced in this list; they're
 * authored from the project email composer.
 *
 * The response shape mirrors the previous project_emails contract so the Emails
 * UI is unchanged.
 */

const MAX_EMAILS = 1000;

interface IntakeRow {
  id: number;
  project_id: number | null;
  subject: string | null;
  body: string | null;
  body_html: string | null;
  body_text: string | null;
  from_name: string | null;
  from_email: string | null;
  to_list: string[] | null;
  cc_list: string[] | null;
  received_at: string | null;
  has_attachments: boolean | null;
  graph_message_id: string | null;
  internet_message_id: string | null;
  mailbox_user_id: string | null;
  conversation_id: string | null;
  project_email_id: number | null;
  created_at: string | null;
}

interface AssistantReviewRow {
  id: string;
  intake_email_id: number;
  assistant_action: "reply" | "delegate" | "watch" | "ignore" | null;
  assistant_priority: "urgent" | "high" | "normal" | "low" | null;
  assistant_score: number | null;
  assistant_reason: string | null;
  assistant_owner: string | null;
  assistant_risk: string | null;
  assistant_evidence: string | null;
  review_outcome: "draft_copied" | "draft_edited" | "skipped" | "delegated" | "watched" | "marked_no_action";
  reviewer_note: string | null;
  draft_body: string | null;
  source_metadata: unknown;
  created_at: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseProjectAssignmentFeedback(value: unknown): {
  status: "correct" | "incorrect" | "unreviewed";
  correctedProjectId: number | null;
  reasonSignals: Array<
    | "subject_line"
    | "sender"
    | "message_body"
    | "attachment"
    | "existing_project_context"
    | "other"
  >;
  reasonNote: string | null;
} {
  if (!isRecord(value)) {
    return {
      status: "unreviewed",
      correctedProjectId: null,
      reasonSignals: [],
      reasonNote: null,
    };
  }

  const status =
    value.status === "correct" || value.status === "incorrect"
      ? value.status
      : "unreviewed";
  const correctedProjectId =
    typeof value.correctedProjectId === "number" &&
    Number.isInteger(value.correctedProjectId)
      ? value.correctedProjectId
      : null;
  const reasonSignals = Array.isArray(value.reasonSignals)
    ? value.reasonSignals.filter((signal) =>
        signal === "subject_line" ||
        signal === "sender" ||
        signal === "message_body" ||
        signal === "attachment" ||
        signal === "existing_project_context" ||
        signal === "other",
      )
    : [];
  const reasonNote =
    typeof value.reasonNote === "string" && value.reasonNote.trim()
      ? value.reasonNote.trim()
      : null;

  return { status, correctedProjectId, reasonSignals, reasonNote };
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseFieldFeedback(value: unknown) {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const parseVerdict = (field: string) =>
    record[field] === "correct" || record[field] === "incorrect"
      ? record[field]
      : "unreviewed";

  return {
    action: parseVerdict("action"),
    priority: parseVerdict("priority"),
    category: parseVerdict("category"),
    draft: parseVerdict("draft"),
    project: parseVerdict("project"),
    owner: parseVerdict("owner"),
    reason: parseVerdict("reason"),
    score: parseVerdict("score"),
  };
}

function defaultAssistantCategory(action: string | null | undefined): string | null {
  switch (action) {
    case "reply":
      return "Reply Needed";
    case "delegate":
      return "To Delegate";
    case "watch":
      return "Watching";
    case "ignore":
      return "No Action";
    default:
      return null;
  }
}

export const GET = withApiGuardrails("emails#GET", async ({ request }) => {
  const supabase = await createClient();
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "emails#GET",
      message: "Authentication required.",
    });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.is_admin === true;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const mailboxUserId = searchParams.get("mailboxUserId")?.trim().toLowerCase() || null;

  const intake = createOutlookIntakeServiceClient();
  let query = intake
    .from("outlook_email_intake")
    .select(
      "id,project_id,subject,body,body_html,body_text,from_name,from_email,to_list,cc_list,received_at,has_attachments,graph_message_id,internet_message_id,mailbox_user_id,conversation_id,project_email_id,created_at",
    )
    .order("received_at", { ascending: false, nullsFirst: false })
    .limit(MAX_EMAILS);

  if (mailboxUserId) {
    if (!isAdmin && user.email?.toLowerCase() !== mailboxUserId) {
      throw new GuardrailError({
        code: "FORBIDDEN",
        where: "emails#GET",
        message: "Not authorized to read this mailbox.",
        status: 403,
      });
    }
    query = query.eq("mailbox_user_id", mailboxUserId);
  } else if (!isAdmin && user.email) {
    // Non-admins only see mail they sent or received.
    query = query.or(`from_email.eq.${user.email},to_list.cs.{${user.email}}`);
  } else if (!isAdmin) {
    return NextResponse.json([]);
  }

  const { data, error } = await query;
  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "emails#GET",
      message: error.message,
    });
  }

  const rows = (data ?? []) as unknown as IntakeRow[];
  const appService = createServiceClient();

  // Real (non-inline) attachments only. Outlook/Graph's has_attachments flag is
  // true for inline images (signature logos), which falsely shows a paperclip on
  // emails with no actual file. Drive the icon off real attachment rows instead.
  const emailIds = rows.map((r) => r.id);
  const emailsWithRealAttachments = new Set<number>();
  if (emailIds.length > 0) {
    const { data: attachmentRows } = await intake
      .from("outlook_email_intake_attachments")
      .select("intake_email_id")
      .in("intake_email_id", emailIds)
      .or("is_inline.is.null,is_inline.eq.false");
    for (const a of attachmentRows ?? []) {
      if (typeof a.intake_email_id === "number") emailsWithRealAttachments.add(a.intake_email_id);
    }
  }

  const latestReviewByEmailId = new Map<number, AssistantReviewRow>();
  if (emailIds.length > 0) {
    const { data: reviewRows, error: reviewError } = await serviceDb.from("outlook_email_assistant_reviews")
      .select(
        "id,intake_email_id,assistant_action,assistant_priority,assistant_score,assistant_reason,assistant_owner,assistant_risk,assistant_evidence,review_outcome,reviewer_note,draft_body,source_metadata,created_at",
      )
      .in("intake_email_id", emailIds)
      .order("created_at", { ascending: false });

    if (reviewError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "emails#GET",
        message: reviewError.message,
      });
    }

    for (const review of (reviewRows ?? []) as AssistantReviewRow[]) {
      if (!latestReviewByEmailId.has(review.intake_email_id)) {
        latestReviewByEmailId.set(review.intake_email_id, review);
      }
    }
  }

  // Inbox rules (Gmail/Outlook-style filters) only apply to a specific reviewed
  // mailbox — never to a user's own project-scoped mail. They deterministically
  // force priority/category, mark always-important, or drop "never-inbox" mail.
  let inboxRules: InboxRule[] = [];
  if (mailboxUserId) {
    const { data: ruleRows, error: rulesError } = await serviceDb.from("outlook_inbox_rules")
      .select("id,match_field,match_operator,match_value,action,action_value,enabled")
      .eq("mailbox_user_id", mailboxUserId)
      .eq("enabled", true);
    if (rulesError) {
      // Non-fatal: a rules-table hiccup must never blank the whole inbox.
      reportNonCriticalFailure({
        area: "emails-route",
        operation: "load-inbox-rules",
        error: rulesError,
        userVisibleFallback: "Inbox rules could not be applied to this inbox.",
        metadata: { mailboxUserId },
      });
    } else {
      inboxRules = (ruleRows ?? []).map((row) => ({
        id: row.id as string,
        field: row.match_field as InboxRule["field"],
        operator: row.match_operator as InboxRule["operator"],
        value: row.match_value as string,
        action: row.action as InboxRule["action"],
        actionValue: (row.action_value as string | null) ?? null,
        enabled: row.enabled as boolean,
      }));
    }
  }
  let rulesSkippedCount = 0;

  // Resolve project names from the PM APP in one batch.
  const projectIds = Array.from(
    new Set(rows.map((r) => r.project_id).filter((id): id is number => typeof id === "number")),
  );
  const projects = new Map<number, { id: number; name: string | null; project_number: string | null }>();
  if (projectIds.length > 0) {
    const { data: projectRows } = await serviceDb.from("projects")
      .select("id,name,project_number")
      .in("id", projectIds);
    for (const p of projectRows ?? []) {
      projects.set(p.id as number, {
        id: p.id as number,
        name: (p.name as string | null) ?? null,
        project_number: (p.project_number as string | null) ?? null,
      });
    }
  }

  // A message sent to several Alleato people is stored once per mailbox (one
  // intake row each, distinct graph_message_id). For the cross-project inbox
  // that fans out into the same email appearing 2–3×. Collapse by
  // internet_message_id — but NOT in mailbox-review mode, where each mailbox's
  // own copy is exactly what the reviewer is triaging.
  const { representatives, memberIdsByRepresentativeId } = mailboxUserId
    ? { representatives: rows, memberIdsByRepresentativeId: null }
    : dedupeOutlookIntakeByMessageId(rows);
  const hasRealAttachments = (row: IntakeRow): boolean => {
    const memberIds = memberIdsByRepresentativeId?.get(row.id) ?? [row.id];
    return memberIds.some((id) => emailsWithRealAttachments.has(id));
  };

  const emails = representatives
    .filter((r) => (status ? "Received" === status : true))
    .map((r) => {
      const latestReview = latestReviewByEmailId.get(r.id) ?? null;
      const derivedDecision = deriveBrandonEmailAssistantDecision({
        subject: r.subject,
        bodyText: r.body_text ?? r.body,
        fromEmail: r.from_email,
        fromName: r.from_name,
        toList: r.to_list,
        ccList: r.cc_list,
        mailboxUserId: r.mailbox_user_id,
        hasAttachments: hasRealAttachments(r),
        receivedAt: r.received_at,
      });
      const reviewMetadata = isRecord(latestReview?.source_metadata)
        ? latestReview.source_metadata
        : {};
      const assistantAction = latestReview?.assistant_action ?? derivedDecision.action;

      const ruleEffect = inboxRules.length
        ? applyInboxRules(
            {
              fromEmail: r.from_email,
              subject: r.subject,
              body: r.body_text ?? r.body,
            },
            inboxRules,
          )
        : null;

      // A "never inbox" rule drops the mail from the feed — but never hides one a
      // human already reviewed (that would erase their record).
      if (ruleEffect?.skipInbox && !latestReview) {
        rulesSkippedCount += 1;
        return null;
      }

      // Precedence: an explicit human review wins; otherwise an inbox rule
      // overrides the derived guess (that's the rule "training" the assistant).
      const rulePriority =
        ruleEffect?.priority ?? (ruleEffect?.important ? "urgent" : null);
      const assistantPriority =
        latestReview?.assistant_priority ?? rulePriority ?? derivedDecision.priority;
      const assistantCategory =
        nullableString(reviewMetadata.sandboxCategory) ??
        ruleEffect?.category ??
        defaultAssistantCategory(assistantAction);

      return {
        id: r.id,
        project_id: r.project_id,
        subject: r.subject || "(no subject)",
        body: r.body_text || r.body,
        body_html: r.body_html,
        from_name: r.from_name,
        from_email: r.from_email,
        to_list: r.to_list,
        cc_list: r.cc_list,
        bcc_list: null,
        status: "Received" as const,
        sent_at: null,
        received_at: r.received_at,
        is_private: null,
        is_starred: null,
        has_attachments: hasRealAttachments(r),
        related_tool: null,
        related_id: null,
        distribution_group: null,
        thread_id: r.conversation_id,
        graph_message_id: r.graph_message_id,
        mailbox_user_id: r.mailbox_user_id,
        conversation_id: r.conversation_id,
        assistant_action: assistantAction,
        assistant_priority: assistantPriority,
        assistant_category: assistantCategory,
        assistant_score: latestReview?.assistant_score ?? derivedDecision.score,
        assistant_reason: latestReview?.assistant_reason ?? derivedDecision.reason,
        assistant_owner: latestReview?.assistant_owner ?? derivedDecision.owner,
        assistant_risk: latestReview?.assistant_risk ?? derivedDecision.risk,
        assistant_evidence: latestReview?.assistant_evidence ?? derivedDecision.evidence,
        assistant_rules_applied: derivedDecision.rulesApplied,
        assistant_review: latestReview
          ? {
              reviewId: latestReview.id,
              reviewOutcome: latestReview.review_outcome,
              reviewerNote: latestReview.reviewer_note ?? null,
              draftBody: latestReview.draft_body ?? null,
              assistantCategory,
              feedbackProvidedAt:
                typeof reviewMetadata.feedbackProvidedAt === "string"
                  ? reviewMetadata.feedbackProvidedAt
                  : null,
              fieldFeedback: parseFieldFeedback(reviewMetadata.fieldFeedback),
              projectAssignmentFeedback: parseProjectAssignmentFeedback(
                reviewMetadata.projectAssignmentFeedback,
              ),
            }
          : null,
        created_by: null,
        created_at: r.created_at ?? r.received_at,
        updated_at: r.created_at ?? r.received_at,
        deleted_at: null,
        project: typeof r.project_id === "number" ? (projects.get(r.project_id) ?? null) : null,
      };
    })
    // Drop "never inbox" rule matches (returned as null above). Loud, not silent:
    // the count is logged so a misfiring rule that hides real mail is visible.
    .filter((email): email is NonNullable<typeof email> => email !== null);

  if (rulesSkippedCount > 0) {
    console.info(
      JSON.stringify({
        event: "inbox_rules_applied",
        mailboxUserId,
        skippedNeverInbox: rulesSkippedCount,
        activeRules: inboxRules.length,
      }),
    );
  }

  return NextResponse.json(emails);
});

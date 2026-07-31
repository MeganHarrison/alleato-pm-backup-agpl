import { requireAdmin } from "@/app/api/admin/_shared";
import { PageShell } from "@/components/layout";
import { serviceDb } from "@/lib/supabase/service-db";
import {
  EmailLearningClient,
  type EmailLearningFeedbackEvent,
  type EmailLearningRule,
} from "@/features/ai/email-learning/email-learning-client";

export const dynamic = "force-dynamic";

export default async function AiEmailLearningPage() {
  await requireAdmin("ai-email-learning-page");

    const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [
    rulesResult,
    recentFeedbackResult,
    positiveCountResult,
    negativeCountResult,
    ignoredCountResult,
  ] = await Promise.all([
    serviceDb.from("email_filter_rules")
      .select(
        "id, sender_pattern, sender_domain, subject_pattern, body_pattern, action, label, description, enabled, match_count, last_matched_at, source_subject, created_at, updated_at",
      )
      .order("enabled", { ascending: false })
      .order("last_matched_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false }),
    serviceDb.from("ai_feedback_events")
      .select(
        "id, signal, reason_category, free_text, created_at, after_snapshot",
      )
      .eq("event_type", "email_importance_feedback_recorded")
      .eq("surface", "outlook_emails")
      .order("created_at", { ascending: false })
      .limit(12),
    serviceDb.from("ai_feedback_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "email_importance_feedback_recorded")
      .eq("surface", "outlook_emails")
      .eq("signal", "positive")
      .gte("created_at", thirtyDaysAgo),
    serviceDb.from("ai_feedback_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "email_importance_feedback_recorded")
      .eq("surface", "outlook_emails")
      .eq("signal", "negative")
      .gte("created_at", thirtyDaysAgo),
    serviceDb.from("ai_feedback_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "email_importance_feedback_recorded")
      .eq("surface", "outlook_emails")
      .eq("signal", "ignored")
      .gte("created_at", thirtyDaysAgo),
  ]);

  if (rulesResult.error) {
    throw new Error(`email_filter_rules query failed: ${rulesResult.error.message}`);
  }
  if (recentFeedbackResult.error) {
    throw new Error(
      `ai_feedback_events query failed: ${recentFeedbackResult.error.message}`,
    );
  }
  if (positiveCountResult.error) {
    throw new Error(
      `email importance positive count failed: ${positiveCountResult.error.message}`,
    );
  }
  if (negativeCountResult.error) {
    throw new Error(
      `email importance negative count failed: ${negativeCountResult.error.message}`,
    );
  }
  if (ignoredCountResult.error) {
    throw new Error(
      `email importance ignored count failed: ${ignoredCountResult.error.message}`,
    );
  }

  return (
    <PageShell variant="content" title="Email Learning">
      <EmailLearningClient
        initialRules={(rulesResult.data ?? []) as EmailLearningRule[]}
        recentFeedback={
          (recentFeedbackResult.data ?? []) as EmailLearningFeedbackEvent[]
        }
        feedbackSummary30d={{
          positive: positiveCountResult.count ?? 0,
          negative: negativeCountResult.count ?? 0,
          ignored: ignoredCountResult.count ?? 0,
        }}
      />
    </PageShell>
  );
}

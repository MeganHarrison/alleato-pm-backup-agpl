import Link from "next/link";

import { PageShell, SectionRuleHeading } from "@/components/layout";
import { KpiRow } from "@/components/ds";
import { serviceDb } from "@/lib/supabase/service-db";
import { requireAdmin } from "@/app/api/admin/_shared";

export const dynamic = "force-dynamic";

/**
 * Learning & Feedback — admin front door for the AI learning system. Consolidates
 * what's scattered across ai/learning-promotions, feedback-inbox, and the raw
 * tables into one "what needs my attention" overview. Read-only launcher; it
 * links into the pages that own each action rather than duplicating them.
 */

/** Surfaces that SHOULD be collecting feedback — used to flag silent ones. */
const KNOWN_FEEDBACK_SURFACES: { key: string; label: string }[] = [
  { key: "ai_assistant", label: "AI chat" },
  { key: "ai_task_feedback", label: "Task generation" },
  { key: "daily_brief", label: "Executive brief" },
  { key: "progress_report", label: "Progress reports" },
  { key: "submittal_review", label: "Submittal reviews" },
  { key: "insight_card", label: "Insight / PCO cards" },
  { key: "outlook_emails", label: "Email assistant" },
];

type SurfaceStat = { positive: number; negative: number; other: number; last: string | null };

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
}

export default async function LearningFeedbackPage() {
  await requireAdmin("learning-feedback-page");

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const triageEnabled = process.env.AUTONOMOUS_TRIAGE_ENABLED === "true";
  const head = { count: "exact" as const, head: true };

  const [
    triageableRes,
    candidatesTotalRes,
    activeRes,
    archivedRes,
    recentActivationsRes,
    promotionsRes,
    feedbackItemsRes,
    changeCardsRes,
    feedbackEvents,
  ] = await Promise.all([
    serviceDb.from("agent_learnings").select("id", head).eq("status", "candidate").in("source", ["thumbs_down", "eval_failure"]),
    serviceDb.from("agent_learnings").select("id", head).eq("status", "candidate"),
    serviceDb.from("agent_learnings").select("id", head).eq("status", "active"),
    serviceDb.from("agent_learnings").select("id", head).eq("status", "archived"),
    serviceDb.from("agent_learnings").select("id", head).eq("status", "active").gte("activated_at", sevenDaysAgo),
    serviceDb.from("ai_learning_promotions").select("id", head).in("status", ["candidate", "approved"]),
    serviceDb.from("admin_feedback_items").select("id", head).in("status", ["open", "submitted"]),
    serviceDb.from("insight_cards").select("id", head).eq("card_type", "change_management").in("current_status", ["open", "blocked", "needs_review", "stale"]),
    serviceDb.from("ai_feedback_events").select("surface, signal, created_at"),
  ]);

  const triageable = triageableRes.count ?? 0;
  const candidatesTotal = candidatesTotalRes.count ?? 0;
  const activeCount = activeRes.count ?? 0;
  const archivedCount = archivedRes.count ?? 0;
  const recentActivations = recentActivationsRes.count ?? 0;
  const promotionsAwaiting = promotionsRes.count ?? 0;
  const openFeedbackItems = feedbackItemsRes.count ?? 0;
  const openChangeCards = changeCardsRes.count ?? 0;

  // Aggregate feedback events by surface (small table — safe to do in JS).
  const stats = new Map<string, SurfaceStat>();
  for (const row of feedbackEvents.data ?? []) {
    const r = row as { surface: string | null; signal: string | null; created_at: string | null };
    const key = r.surface ?? "unknown";
    const stat = stats.get(key) ?? { positive: 0, negative: 0, other: 0, last: null };
    if (r.signal === "positive") stat.positive += 1;
    else if (r.signal === "negative") stat.negative += 1;
    else stat.other += 1;
    if (r.created_at && (!stat.last || r.created_at > stat.last)) stat.last = r.created_at;
    stats.set(key, stat);
  }

  // Coverage rows: every known surface first (so silent ones are visible),
  // then any other surface that has events but isn't in the known list.
  const knownKeys = new Set(KNOWN_FEEDBACK_SURFACES.map((s) => s.key));
  const coverageRows = [
    ...KNOWN_FEEDBACK_SURFACES.map((s) => ({ label: s.label, stat: stats.get(s.key) ?? null })),
    ...[...stats.entries()]
      .filter(([key]) => !knownKeys.has(key))
      .map(([key, stat]) => ({ label: key, stat })),
  ];

  const excludedAdmin = candidatesTotal - triageable;

  const decisionMetrics = [
    { label: "Email learning control", value: "Open", href: "/ai/email-learning" },
    { label: "Triageable learning candidates", value: String(triageable) },
    { label: "Promotions awaiting review", value: String(promotionsAwaiting), href: "/ai/learning-promotions" },
    { label: "Task review queue", value: "Open", href: "/admin/task-training" },
    { label: "Open feedback-inbox items", value: String(openFeedbackItems), href: "/feedback-inbox" },
    { label: "Open change-order signals", value: String(openChangeCards), href: "/potential-change-orders" },
  ];

  const reviewLinks = [
    { href: "/ai/email-learning", label: "Email learning", hint: "Manage exclusion rules and see which email feedback actually matters" },
    { href: "/admin/task-training", label: "Task training", hint: "Review extracted Fireflies and AI-generated tasks" },
    { href: "/my-feedback", label: "My submitted feedback", hint: "Review, edit, or undo what you rated" },
    { href: "/daily-briefs", label: "Daily Briefs", hint: "Review today's brief items" },
    { href: "/potential-change-orders", label: "Potential change orders", hint: "Review & rate change-order signals" },
    { href: "/insights", label: "AI insights", hint: "All insight cards" },
    { href: "/tables-directory", label: "Data sources", hint: "Browse meetings, emails, teams, documents" },
  ];

  return (
    <PageShell
      variant="dashboard"
      title="Learning & Feedback"
      description="What the AI needs you to look at — review queue, feedback coverage, and the learning pipeline in one place."
    >
      <div className="space-y-10">
        {/* 1. Needs your decision */}
        <section className="space-y-4">
          <SectionRuleHeading label="Needs your decision" />
          <KpiRow metrics={decisionMetrics} />
        </section>

        {/* 2. Feedback coverage */}
        <section className="space-y-3">
          <SectionRuleHeading label="Feedback coverage by surface" />
          <p className="text-sm text-muted-foreground">
            Surfaces with no feedback yet are getting no learning signal — start there.
          </p>
          <div className="divide-y divide-border/40">
            {coverageRows.map(({ label, stat }) => (
              <div key={label} className="flex items-center justify-between py-2.5">
                <span className="text-sm text-foreground">{label}</span>
                {stat ? (
                  <span className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>👍 {stat.positive}</span>
                    <span>👎 {stat.negative}</span>
                    <span className="w-12 text-right text-xs">{formatDate(stat.last)}</span>
                  </span>
                ) : (
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
                    Silent
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 3. Review recent AI output */}
        <section className="space-y-3">
          <SectionRuleHeading label="Go review & rate" />
          <div className="divide-y divide-border/40">
            {reviewLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between py-2.5 text-sm transition-colors hover:text-primary"
              >
                <span className="font-medium text-foreground">{link.label}</span>
                <span className="text-xs text-muted-foreground">{link.hint}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* 4. Autonomous triage */}
        <section className="space-y-3">
          <SectionRuleHeading label="Autonomous triage" />
          <div className="divide-y divide-border/40 text-sm">
            <div className="flex items-center justify-between py-2.5">
              <span className="text-muted-foreground">Status</span>
              <span className={triageEnabled ? "font-medium text-primary" : "text-muted-foreground"}>
                {triageEnabled ? "Enabled (daily 2am)" : "Disabled"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-muted-foreground">Candidates eligible for triage</span>
              <span className="text-foreground">{triageable}</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-muted-foreground">Excluded (admin-feedback, own review flow)</span>
              <span className="text-foreground">{excludedAdmin}</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-muted-foreground">Active learnings</span>
              <span className="text-foreground">{activeCount}</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-muted-foreground">Activated in last 7 days</span>
              <span className="text-foreground">{recentActivations}</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-muted-foreground">Archived</span>
              <span className="text-foreground">{archivedCount}</span>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

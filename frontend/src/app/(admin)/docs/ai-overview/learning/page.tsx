import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PageShell } from "@/components/layout";
import { SectionNav } from "../_components/section-nav";
import { Section, SectionTitleContent } from "../_components/section-shell";

export const metadata: Metadata = {
  title: "Learning loops",
  description:
    "Five feedback loops already running in the system. Every vote, approval, and eval score feeds back into prompts, retrieval, and routing decisions.",
};

export const dynamic = "force-dynamic";

interface LearningStats {
  totalFeedback: number | null;
  positivePercent: number | null;
  pendingReview: number | null;
  diagnosticsThisWeek: number | null;
}

// Live counts will wire here once the tracking tables (ai_packet_feedback,
// ai_insights, ai_prompt_diagnostics) are added to the generated schema. Until
// then every stat surfaces as a dash so the page is honest about state.
async function loadLearningStats(): Promise<LearningStats> {
  return {
    totalFeedback: null,
    positivePercent: null,
    pendingReview: null,
    diagnosticsThisWeek: null,
  };
}

function fmt(value: number | null, suffix?: string): string {
  if (value === null) return "—";
  return suffix ? `${value}${suffix}` : String(value);
}

export default async function LearningPage() {
  const stats = await loadLearningStats();

  return (
    <PageShell
      variant="content"
      title="How the AI gets smarter"
      titleContent={<SectionTitleContent title="How the AI gets smarter" subtitle="Five feedback loops are already running in the system. Every thumbs-up, every approved insight, every eval score feeds back into prompts, retrieval, and routing decisions." />}
    >
      <SectionNav />
      <div className="space-y-14">
      {/* Section 1: Health at a glance */}
      <Section eyebrow="Health" title="Learning at a glance">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <StatBlock
            label="Total feedback"
            value={fmt(stats.totalFeedback)}
            suffix="votes recorded"
          />
          <StatBlock
            label="Positive %"
            value={stats.positivePercent !== null ? fmt(stats.positivePercent, "%") : "—"}
            suffix="thumbs-up ratio"
          />
          <StatBlock
            label="Pending review"
            value={fmt(stats.pendingReview)}
            suffix="insights queued"
          />
          <StatBlock
            label="Diagnostics this week"
            value={fmt(stats.diagnosticsThisWeek)}
            suffix="logged in last 7 days"
          />
        </div>
      </Section>

      {/* Section 2: The five loops */}
      <Section
        eyebrow="The loops"
        title="Five ways the AI improves"
        description="Each loop is operational today. They run continuously in the background: no manual trigger required."
      >
        <div className="space-y-5">
          <LoopCard
            number={1}
            title="Packet feedback (thumbs-up / thumbs-down)"
            adminHref="/admin/feedback-inbox"
            adminLabel="View feedback inbox"
            explanation="Every AI-generated card (insights, packet summaries, project briefings) has thumbs-up / thumbs-down buttons. Each click writes to `ai_packet_feedback` with the surface, the model version, and the source evidence used. Negative votes flag the source content for re-review and the prompt for diagnostics."
            metrics={[
              "Vote counts by surface",
              "Positive ratio over time",
              "Sources flagged for review",
            ]}
          />

          <LoopCard
            number={2}
            title="Insight promotions"
            adminHref="/ai/learning-promotions"
            adminLabel="View promotions queue"
            explanation="Low-confidence insights extracted from meetings and emails surface in a review queue. Admins approve or reject them. Approved patterns inform the extractor's confidence thresholds. Rejected patterns become anti-examples in the prompt."
            metrics={[
              "Promotions approved",
              "Rejection patterns",
              "Extractor confidence drift",
            ]}
          />

          <LoopCard
            number={3}
            title="Prompt diagnostics"
            adminHref="/admin/ai-prompt-diagnostics"
            adminLabel="View diagnostics"
            explanation="When a response gets a low quality score, gets explicit negative feedback, or fails an eval, the prompt, retrieval context, and response get logged for review. Engineers triage these into prompt changes or retrieval fixes."
            metrics={[
              "Diagnostics opened this week",
              "Resolution rate",
              "Top failure modes",
            ]}
          />

          <LoopCard
            number={4}
            title="Eval scores"
            adminHref="/admin/ai-system-health"
            adminLabel="View health dashboard"
            explanation="Every chat turn writes a Langfuse trace. Automated evals score groundedness (did the answer cite real sources?), helpfulness (did it answer the actual question?), and routing accuracy (did it pick the right agent?). Trends over time reveal regressions before users do."
            metrics={[
              "Groundedness score",
              "Helpfulness score",
              "Routing accuracy",
            ]}
          />

          <LoopCard
            number={5}
            title="Contextual retrieval pilot"
            adminHref="/ai-system-health"
            adminLabel="View AI system health"
            explanation="Added 2026-05-17. Before embedding, each chunk gets a one-sentence context prepended ('This is from the May 12th OAC meeting about retainage...'). This improves recall on ambiguous queries. Currently running as an A/B against the baseline. Metrics are accumulating."
            metrics={[
              "Recall@5 lift vs baseline",
              "Per-chunk embed cost delta",
              "Coverage by source type",
            ]}
          />
        </div>
      </Section>

      {/* Section 3: Roadmap */}
      <Section
        eyebrow="What's next"
        title="Loops on the roadmap"
        description="These ship after the current five have enough data to calibrate against."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <RoadmapCard
            title="User-specific tuning"
            body="As the model sees more of a user's history, it adapts tone and depth per person."
          />
          <RoadmapCard
            title="Automatic prompt evolution"
            body="Top-failing prompts get rewritten by a higher-tier model and A/B'd before promotion."
          />
          <RoadmapCard
            title="Source quality scoring"
            body="Each source (an email thread, a meeting) gets a reliability score that biases retrieval."
          />
        </div>
      </Section>
    </div>
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatBlock({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      {suffix ? (
        <p className="mt-1 text-xs text-muted-foreground">{suffix}</p>
      ) : null}
    </div>
  );
}

function LoopCard({
  number,
  title,
  adminHref,
  adminLabel,
  explanation,
  metrics,
}: {
  number: number;
  title: string;
  adminHref: string;
  adminLabel: string;
  explanation: string;
  metrics: string[];
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-6">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {number}
        </span>
        <p className="flex-1 text-lg font-semibold text-foreground">{title}</p>
        <Link
          href={adminHref}
          className="inline-flex items-center gap-1 rounded-md bg-card px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {adminLabel}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Body: explanation + metrics */}
      <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <p className="text-sm leading-relaxed text-muted-foreground">{explanation}</p>
        </div>
        <div className="rounded-md bg-card p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            What&rsquo;s measured
          </p>
          <ul className="space-y-1.5">
            {metrics.map((m) => (
              <li key={m} className="flex items-start gap-2 text-xs text-foreground">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/50" />
                {m}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function RoadmapCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-5">
      <div className="mb-2">
        <span className="rounded-md bg-card px-2 py-0.5 text-xs text-muted-foreground">
          Planned
        </span>
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

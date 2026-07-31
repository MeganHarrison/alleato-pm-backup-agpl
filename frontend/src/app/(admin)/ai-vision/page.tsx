import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  Banknote,
  Bot,
  BrainCircuit,
  Building2,
  CalendarClock,
  CheckCircle2,
  Compass,
  Eye,
  FileSearch,
  FileText,
  FlaskConical,
  Gauge,
  GitBranch,
  Inbox,
  Layers,
  LineChart,
  MessageSquare,
  Network,
  Radar,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Wrench,
} from "lucide-react";

import { PageShell } from "@/components/layout";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isOwnerEmail } from "@/lib/auth/owner";

export const metadata: Metadata = {
  title: "AI Vision & Roadmap",
  description:
    "The single command map for the Alleato AI build: the vision, the agent team, the tool roadmap in priority order, and what's already live.",
};

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Status system — four states, faithful to the planning docs.
// ─────────────────────────────────────────────────────────────────────────────

type Status = "live" | "partial" | "building" | "planned";

const STATUS_LABEL: Record<Status, string> = {
  live: "Live",
  partial: "Partial",
  building: "Building now",
  planned: "Planned",
};

const STATUS_PILL: Record<Status, string> = {
  live: "bg-status-success/12 text-status-success",
  partial: "bg-status-info/12 text-status-info",
  building: "bg-status-warning/15 text-status-warning",
  planned: "bg-muted text-muted-foreground",
};

function StatusPill({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_PILL[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

// Renders a card as a clickable link when it points at a live surface,
// otherwise a plain container. Linkable cards get a hover affordance + arrow.
function CardShell({
  href,
  className,
  children,
}: {
  href?: string;
  className: string;
  children: React.ReactNode;
}) {
  if (href) {
    return (
      <Link
        href={href}
        className={`group transition-colors hover:bg-muted/60 ${className}`}
      >
        {children}
      </Link>
    );
  }
  return <div className={className}>{children}</div>;
}

function SectionHead({
  eyebrow,
  title,
  blurb,
}: {
  eyebrow: string;
  title: string;
  blurb?: string;
}) {
  return (
    <div className="mb-6 max-w-3xl">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
        {eyebrow}
      </p>
      <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      {blurb ? (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{blurb}</p>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Content: this page IS the canonical vision statement (the old ai-plan doc
// tree was retired). The ranked build queue lives in docs/roadmap/AI-ROADMAP.md.
// ─────────────────────────────────────────────────────────────────────────────

const PILLARS: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }[] = [
  {
    icon: Target,
    title: "Specifics, never generalities",
    body: "Answers carry dollar amounts, dates, names, and document references — grounded in evidence, not vibes.",
  },
  {
    icon: Banknote,
    title: "Catch the leaks early",
    body: "Owner-approved vs. sub-committed margin mismatches and cash-flow gaps surfaced within 48 hours.",
  },
  {
    icon: Radar,
    title: "Proactive, not reactive",
    body: "The AI watches the data and reaches out. The team should never have to hunt for status.",
  },
  {
    icon: Eye,
    title: "Visible & trainable",
    body: "Memory, skills, and learning are inspectable and shaped by the field — not a black box.",
  },
  {
    icon: ShieldCheck,
    title: "Alleato stays the source of truth",
    body: "Agents emit proposals; one executor writes the rows. No agent holds a database write credential.",
  },
];

const PHASES: { name: string; goal: string; status: Status }[] = [
  { name: "Phase 1 · Data Foundation", goal: "Get ALL company data accessible to the AI — knowledge base, RAG coverage, ingestion, financial enrichment.", status: "live" },
  { name: "Phase 2 · Proactive Intelligence", goal: "AI watches the data and surfaces insights automatically — alerts, smart notifications, dashboard intelligence.", status: "building" },
  { name: "Phase 3 · Workflow Automation", goal: "AI takes action — document & meeting intelligence, report generation, smart templates.", status: "planned" },
  { name: "Phase 4 · Strategic Advisory", goal: "Full org awareness — cross-project patterns, predictive analytics, strategic recommendations.", status: "planned" },
  { name: "AI OS Layer · parallel track", goal: "Make memory, skills, and learning visible and team-owned — Memory Center, Skill Library, Teach Alleato, Work Queue.", status: "building" },
];

type Agent = { name: string; job: string; status: Status; pilot?: boolean; href?: string };

const AGENT_GROUPS: { label: string; icon: React.ComponentType<{ className?: string }>; agents: Agent[] }[] = [
  {
    label: "C-Suite (live)",
    icon: Building2,
    agents: [
      { name: "Strategist", job: "Top-level orchestrator. Routes questions to specialists, synthesizes, adds cross-functional insight.", status: "live", href: "/ai" },
      { name: "CFO", job: "Budgets, margins, commitments, cost trends, cash position.", status: "live", href: "/ai" },
      { name: "COO", job: "Operations and execution health.", status: "live", href: "/ai" },
      { name: "CRO", job: "Risk — fed by project risk analysis tools.", status: "live", href: "/ai" },
      { name: "CHRO", job: "People and resourcing.", status: "live", href: "/ai" },
      { name: "VP Business Development", job: "Pipeline and BD intelligence.", status: "live", href: "/ai" },
      { name: "CMO", job: "Marketing intelligence and content tooling.", status: "live", href: "/ai" },
      { name: "Microsoft Exec Assistant", job: "Outlook inbox triage + draft/reply workflows.", status: "live", href: "/ai" },
    ],
  },
  {
    label: "Backend Deep Agents (live)",
    icon: BrainCircuit,
    agents: [
      { name: "Project Intelligence", job: "Project-status synthesis runtime with source-coverage tools.", status: "live", href: "/ai-system-health" },
      { name: "Executive Briefing", job: "Portfolio-level executive briefing runtime.", status: "live" },
      { name: "Research Agent", job: "Web research (Tavily + fetch).", status: "live", href: "/deep-research" },
      { name: "Content Builder", job: "Marketing & content generation with image tools.", status: "live", href: "/ai" },
      { name: "Scoped analysts", job: "Financial, schedule, risk & comms analysts consumed by the Deep Agents.", status: "live", href: "/ai" },
    ],
  },
  {
    label: "Construction agents (next to build)",
    icon: Wrench,
    agents: [
      { name: "Submittal Reviewer", job: "First producer on the Action Layer. Schema 100% ready; every action is human-gated.", status: "planned", pilot: true },
      { name: "RFI Drafter", job: "Drafts RFIs from similar historical issues.", status: "planned" },
      { name: "CO Detector", job: "Detects potential change orders from RFIs + meeting notes.", status: "planned" },
      { name: "Drawing Reviewer", job: "Reviews drawings against specs and prior issues.", status: "planned" },
      { name: "Historical Issue Matcher", job: "Surfaces past projects that hit the same problem.", status: "planned" },
      { name: "Estimating Comparator", job: "Compares estimates to actuals across jobs.", status: "planned" },
      { name: "Schedule Impact Analyst", job: "Models delay cascades on the critical path.", status: "planned" },
      { name: "Pay-App Reviewer", job: "Reviews subcontractor pay applications.", status: "planned" },
      { name: "Source-Health Auditor", job: "Watches ingestion freshness and coverage.", status: "planned" },
    ],
  },
];

type Tool = { name: string; purpose: string; status: Status; href?: string };

const TOOL_TIERS: { tier: string; subtitle: string; tools: Tool[] }[] = [
  {
    tier: "Tier 1 · Do first",
    subtitle: "Highest pain, highest impact",
    tools: [
      { name: "Financial Guardian", purpose: "Continuous budget-vs-actual, owner-vs-sub margin-leak detection, cash-flow projection, CE→CO→Commitment sync.", status: "partial", href: "/ai" },
      { name: "Morning Briefing", purpose: "Daily top 3–5 cross-project priorities, per-project health, overdue items, team load.", status: "partial" },
      { name: "Conversational Financial Advisor", purpose: "Natural-language drill-down, comparisons, root-cause, what-if.", status: "live", href: "/ai" },
    ],
  },
  {
    tier: "Tier 2 · Build next",
    subtitle: "High value, foundations in place",
    tools: [
      { name: "Schedule Intelligence", purpose: "Critical-path monitoring, delay prediction, cascade analysis, 3-week look-aheads.", status: "partial", href: "/ai" },
      { name: "Meeting Intelligence", purpose: "Action-item extraction, cross-meeting tracking, recurring-issue flagging, agendas.", status: "partial", href: "/meetings" },
      { name: "Document Intelligence", purpose: "Auto-classify, metadata extraction, full-text search, auto-link.", status: "partial", href: "/files" },
    ],
  },
  {
    tier: "Tier 3 · Build later",
    subtitle: "Compounding intelligence",
    tools: [
      { name: "Vendor Scorecard", purpose: "Performance scoring on delivery, quality, price.", status: "partial", href: "/ai" },
      { name: "Report Generation", purpose: "Weekly status, monthly financial packages, client-ready summaries.", status: "partial", href: "/ai" },
      { name: "Cross-Project Learning", purpose: "Pattern recognition, “projects like this typically…”, auto-captured lessons.", status: "partial", href: "/ai" },
      { name: "Predictive Analytics", purpose: "Completion probability, overrun/delay prediction, margin forecasting.", status: "planned" },
    ],
  },
  {
    tier: "AI OS Layer · current build order",
    subtitle: "Make the AI visible and team-owned",
    tools: [
      { name: "Memory Center", purpose: "Inspect and correct what the AI remembers.", status: "building", href: "/settings/memory" },
      { name: "Learning Review Queue", purpose: "Approve, reject, and apply learning candidates.", status: "building", href: "/ai/learning-promotions" },
      { name: "Memory trace on answers", purpose: "“Memory used” disclosure + one-tap “this is wrong”.", status: "planned" },
      { name: "Teach Alleato intake", purpose: "Field workflow submission feeding the review queue.", status: "planned" },
      { name: "Skill Library", purpose: "Durable, versioned, reviewed workflows.", status: "planned" },
      { name: "AI Work Queue + Subagents", purpose: "Visible scheduled / delegated runs with status, sources, confidence.", status: "planned" },
    ],
  },
];

const TIER_TOOL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  "Financial Guardian": Banknote,
  "Morning Briefing": Sparkles,
  "Conversational Financial Advisor": LineChart,
  "Schedule Intelligence": CalendarClock,
  "Meeting Intelligence": MessageSquare,
  "Document Intelligence": FileSearch,
  "Vendor Scorecard": Gauge,
  "Report Generation": FileText,
  "Cross-Project Learning": GitBranch,
  "Predictive Analytics": LineChart,
  "Memory Center": BrainCircuit,
  "Learning Review Queue": CheckCircle2,
  "Memory trace on answers": Eye,
  "Teach Alleato intake": Inbox,
  "Skill Library": Layers,
  "AI Work Queue + Subagents": Network,
};

const ARCH_STEPS: { step: string; detail: string }[] = [
  { step: "Agent emits AgentAction", detail: "Typed proposal: evidence, confidence, rationale, before/after changes." },
  { step: "Executor validates", detail: "Evidence present? Idempotency free? Columns real? Confidence set?" },
  { step: "Policy routes it", detail: "action_policy table maps externality × reversibility to a state." },
  { step: "Auto · Confirm · Draft", detail: "Apply now (reversible) · one-tap human approval · editable draft for external/financial." },
];

const ARCH_COMPONENTS: { name: string; body: string }[] = [
  { name: "AgentAction envelope", body: "The one typed proposal every write-enabled agent emits. Evidence is mandatory." },
  { name: "Executor", body: "The single place writes happen — validate → route → apply in a transaction. No silent failures." },
  { name: "Three approval states", body: "auto (reversible, high-confidence), confirm (human one-tap), draft (external / financial)." },
  { name: "action_policy table", body: "Declarative routing. A tool graduates draft → confirm → auto by editing one row." },
  { name: "Audit ledger", body: "agent_runs + agent_actions + per-domain *_history rows, written in the same transaction." },
];

const LIVE_TODAY: string[] = [
  "RAG chat assistant with a full retrieval planner",
  "Strategist orchestrator + 7 live C-Suite specialists",
  "~195 active tools across financial, ops, schedule, RAG & ERP",
  "Document ingestion pipeline (parse → segment → embed → extract)",
  "Vector search over document_chunks (halfvec 3072)",
  "Live integrations: Acumatica ERP, Microsoft Graph, Fireflies/Teams",
  "Write tools with preview-then-confirm gates",
  "Learning substrate: memories, feedback, learning promotions",
];

const GAPS: string[] = [
  "No automated insight-generation cron yet (Phase 2)",
  "No cash-flow projection engine / daily financial scan",
  "No prioritized Morning Briefing generation or dashboard card",
  "Memory & learning exist but aren't yet visible / trustable",
  "No Skill Library, Teach Alleato intake, or AI Work Queue",
  "Agent Action Layer is specced (v0.1) but not yet built",
  "Submittal Reviewer pilot not yet wired",
];

const LIVE_SURFACES: {
  name: string;
  href: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { name: "AI assistant", href: "/ai", desc: "Ask the agents anything — this is where they run.", icon: Bot },
  { name: "How the AI works", href: "/docs/ai-overview", desc: "Guided tour of agents, tools, models & memory.", icon: Compass },
  { name: "AI system health", href: "/ai-system-health", desc: "Conversations, spend, model mix, learning loop.", icon: Gauge },
  { name: "Agent inventory", href: "/ai/admin/agents", desc: "Every agent with status & deployment.", icon: Building2 },
  { name: "Project intelligence health", href: "/ai-system-health", desc: "Source ingestion, synthesis health, and AI operations.", icon: BrainCircuit },
  { name: "Deep research archive", href: "/deep-research", desc: "Past Deep Agents research projects.", icon: FileSearch },
  { name: "Memory center", href: "/settings/memory", desc: "Inspect & correct what the AI remembers.", icon: Eye },
  { name: "Learning promotions", href: "/ai/learning-promotions", desc: "Approve candidate AI learnings.", icon: CheckCircle2 },
  { name: "Prompt diagnostics", href: "/ai-prompt-diagnostics", desc: "Inspect assembled system prompts.", icon: FileText },
  { name: "RAG eval", href: "/rag-eval", desc: "Retrieval quality & answer grounding.", icon: FlaskConical },
];

const SOURCE_DOCS: string[] = [
  "docs/roadmap/AI-ROADMAP.md",
  "docs/architecture/AI-RAG-ARCHITECTURE.md",
];

export default async function AiVisionPage() {
  const user = await getCurrentUser();
  if (!isOwnerEmail(user?.email)) {
    redirect("/");
  }

  return (
    <PageShell
      variant="dashboard"
      title="AI Vision & Roadmap"
      eyebrow="Owner only"
      description="One screen for the whole AI build — the vision, the agent team, the tools in priority order, and what's already live."
    >
      {/* Vision hero */}
      <section className="rounded-2xl bg-card p-7 sm:p-9">
        <div className="flex items-center gap-2 text-primary">
          <Compass className="h-5 w-5" />
          <span className="text-[11px] font-semibold uppercase tracking-widest">The north star</span>
        </div>
        <p className="mt-4 max-w-4xl text-2xl font-semibold leading-snug tracking-tight text-foreground sm:text-[28px]">
          Alleato AI is the business strategist that&apos;s been here since day one — it knows every
          project, dollar, person, contract, and risk, and surfaces problems before they become crises.
        </p>
        <div className="mt-6 rounded-xl bg-muted/50 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            We&apos;ll know it works when you can say
          </p>
          <p className="mt-2 text-base font-medium italic text-foreground">
            &ldquo;I know exactly where every dollar is on every project, and I found out about
            problems before they became crises.&rdquo;
          </p>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Legend
          </span>
          {(["live", "partial", "building", "planned"] as Status[]).map((s) => (
            <StatusPill key={s} status={s} />
          ))}
        </div>
      </section>

      {/* Pillars */}
      <section>
        <SectionHead
          eyebrow="Principles"
          title="Five rules the build holds to"
          blurb="Every agent and every tool is judged against these. They are the difference between a chatbot and a strategist."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="rounded-xl bg-card p-5">
                <Icon className="h-5 w-5 text-primary" />
                <p className="mt-3 text-sm font-semibold text-foreground">{p.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Phases */}
      <section>
        <SectionHead
          eyebrow="The arc"
          title="Four phases, plus a parallel OS track"
          blurb="The spine runs Data → Proactive → Automation → Advisory. The AI OS layer runs alongside it to make the system visible and team-owned."
        />
        <div className="grid gap-4 lg:grid-cols-5">
          {PHASES.map((phase, i) => (
            <div key={phase.name} className="flex flex-col rounded-xl bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-semibold tabular-nums text-muted-foreground/40">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <StatusPill status={phase.status} />
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">{phase.name}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{phase.goal}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Agent team */}
      <section>
        <SectionHead
          eyebrow="The team"
          title="The agent roster"
          blurb="A Strategist orchestrator routes to live C-Suite specialists and backend Deep Agents today. The construction agents are the next wave — Submittal Reviewer is the pilot."
        />
        <div className="space-y-6">
          {AGENT_GROUPS.map((group) => {
            const GroupIcon = group.icon;
            return (
              <div key={group.label}>
                <div className="mb-3 flex items-center gap-2">
                  <GroupIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {group.label}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.agents.map((agent) => (
                    <CardShell
                      key={agent.name}
                      href={agent.href}
                      className="flex flex-col rounded-xl bg-card p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex items-center gap-1 text-sm font-semibold text-foreground">
                          {agent.name}
                          {agent.href ? (
                            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                          ) : null}
                        </span>
                        <StatusPill status={agent.status} />
                      </div>
                      {agent.pilot ? (
                        <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          <Sparkles className="h-3 w-3" /> Pilot
                        </span>
                      ) : null}
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{agent.job}</p>
                    </CardShell>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Tool roadmap */}
      <section>
        <SectionHead
          eyebrow="The roadmap"
          title="Tools in priority order"
          blurb="Ordered the way the docs order them — by pain and impact, not by what's easiest. Status reflects what's wired today."
        />
        <div className="space-y-6">
          {TOOL_TIERS.map((tier) => (
            <div key={tier.tier} className="rounded-2xl bg-muted/40 p-5 sm:p-6">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{tier.tier}</span>
                <span className="text-xs text-muted-foreground">{tier.subtitle}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tier.tools.map((tool) => {
                  const Icon = TIER_TOOL_ICON[tool.name] ?? Wrench;
                  return (
                    <CardShell key={tool.name} href={tool.href} className="flex flex-col rounded-xl bg-card p-4">
                      <div className="flex items-start justify-between gap-2">
                        <Icon className="h-5 w-5 text-primary" />
                        <div className="flex items-center gap-1.5">
                          {tool.href ? (
                            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                          ) : null}
                          <StatusPill status={tool.status} />
                        </div>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-foreground">{tool.name}</p>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        {tool.purpose}
                      </p>
                    </CardShell>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Live surfaces */}
      <section>
        <SectionHead
          eyebrow="See it in action"
          title="Jump straight into what's live"
          blurb="Every surface below is built and working today — click through to use it or watch it run."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LIVE_SURFACES.map((surface) => {
            const Icon = surface.icon;
            return (
              <Link
                key={surface.href}
                href={surface.href}
                className="group flex items-start gap-3 rounded-xl bg-card p-4 transition-colors hover:bg-muted/60"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-sm font-semibold text-foreground">
                    {surface.name}
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{surface.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Architecture */}
      <section>
        <SectionHead
          eyebrow="The foundation"
          title="The Agent Action Layer"
          blurb="The one primitive that unblocks every write-enabled agent. Build it once and every domain agent becomes configuration on top of it."
        />
        <div className="rounded-2xl bg-card p-6">
          <div className="grid gap-3 lg:grid-cols-4">
            {ARCH_STEPS.map((s, i) => (
              <div key={s.step} className="relative rounded-xl bg-muted/50 p-4">
                <span className="text-xs font-semibold tabular-nums text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="mt-1.5 text-sm font-semibold text-foreground">{s.step}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.detail}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm font-medium text-foreground">
            The whole security model in one line:{" "}
            <span className="text-primary">agents emit proposals, the executor writes rows.</span>{" "}
            No agent holds a database write credential.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ARCH_COMPONENTS.map((c) => (
              <div key={c.name} className="rounded-xl bg-muted/40 p-4">
                <p className="text-sm font-semibold text-foreground">{c.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live vs gaps */}
      <section>
        <SectionHead
          eyebrow="Reality check"
          title="What's live today vs. the open gaps"
          blurb="So the plan is honest about where the build actually stands."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-status-success" />
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                In place today
              </span>
            </div>
            <ul className="space-y-2.5">
              {LIVE_TODAY.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-success" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-status-warning" />
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Biggest gaps still open
              </span>
            </div>
            <ul className="space-y-2.5">
              {GAPS.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-status-warning" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Source docs */}
      <section className="rounded-2xl bg-muted/40 p-6">
        <div className="mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Companion docs
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {SOURCE_DOCS.map((doc) => (
            <code
              key={doc}
              className="rounded-md bg-card px-2.5 py-1 text-xs text-muted-foreground"
            >
              {doc}
            </code>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          This page is the canonical vision statement. The ranked build queue lives in
          AI-ROADMAP.md — when the plan changes, update the roadmap and refresh this page.
        </p>
      </section>
    </PageShell>
  );
}

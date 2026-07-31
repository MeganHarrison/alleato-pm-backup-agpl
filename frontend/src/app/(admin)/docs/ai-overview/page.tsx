import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  Bot,
  Briefcase,
  DollarSign,
  GitBranch,
  Inbox,
  LineChart,
  Lightbulb,
  Network,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";

import { PageShell } from "@/components/layout";
import { SectionNav } from "./_components/section-nav";
import { Section, SectionTitleContent } from "./_components/section-shell";
import { loadAgents, loadTotalToolCount } from "./_lib/ai-stats";

export const metadata: Metadata = {
  title: "How the AI works",
  description:
    "A guided tour of the Alleato AI assistant: its agents, tools, models, memory, and feedback loops.",
};

export const dynamic = "force-dynamic";

const EXAMPLE_QUESTIONS: {
  question: string;
  routedTo: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    question: "How are we tracking on margin for the Westfield job?",
    routedTo: "CFO",
    icon: LineChart,
  },
  {
    question: "Pull every commitment over $50K with no signed contract.",
    routedTo: "Project tools",
    icon: Briefcase,
  },
  {
    question: "Draft a reply to the email from Sarah about the change order.",
    routedTo: "Microsoft EA",
    icon: Inbox,
  },
  {
    question: "Which projects are most at risk this quarter?",
    routedTo: "Strategist + CFO",
    icon: ShieldCheck,
  },
  {
    question: "What did we decide about retention in last week's meeting?",
    routedTo: "RAG / meetings",
    icon: GitBranch,
  },
  {
    question: "Summarize the project for the Monday standup.",
    routedTo: "Synthesis",
    icon: Sparkles,
  },
];

const PAGE_CARDS: {
  href: string;
  title: string;
  teaser: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    href: "/docs/ai-overview/team",
    title: "The team of agents",
    teaser:
      "Two live specialists today, with a five-agent C-suite roadmap behind them. Who owns what, which model they use.",
    icon: Bot,
  },
  {
    href: "/docs/ai-overview/tools",
    title: "Tools",
    teaser:
      "Every read, write, and search the assistant can perform, grouped by domain, with a live count from the registry.",
    icon: Wrench,
  },
  {
    href: "/docs/ai-overview/models-and-cost",
    title: "Models & cost",
    teaser:
      "Which model handles which job, why we picked it, and what each request costs.",
    icon: DollarSign,
  },
  {
    href: "/docs/ai-overview/memory",
    title: "Memory",
    teaser:
      "Three layers: conversation summaries, typed user memory, and the 109K-chunk knowledge base.",
    icon: Network,
  },
  {
    href: "/docs/ai-overview/learning",
    title: "Learning loops",
    teaser:
      "Five feedback loops already running: packet votes, promotions, prompt diagnostics, evals, contextual retrieval.",
    icon: Lightbulb,
  },
];

export default async function AiOverviewPage() {
  const [agents, totalTools] = await Promise.all([loadAgents(), loadTotalToolCount()]);
  const liveAgents = agents.filter((a) => a.status === "live").length;

  return (
    <PageShell
      variant="content"
      title="How the AI works"
      titleContent={<SectionTitleContent title="How the AI works" subtitle="A tour of the agents, tools, models, memory, and feedback loops behind the Alleato assistant. Skim the headlines here, then dive into any section." />}
    >
      <SectionNav />
      <div className="space-y-14">
      <Section
        eyebrow="At a glance"
        title="The system in three numbers"
        description="Pulled live from the codebase, not hand-edited."
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <StatBlock label="Live agents" value={liveAgents} suffix={`of ${agents.length} designed`} />
          <StatBlock label="Tools available" value={totalTools} suffix="across all domains" />
          <StatBlock label="Vector chunks indexed" value="109K+" suffix="emails, meetings, docs" />
        </div>
      </Section>

      <Section
        eyebrow="What it can do"
        title="Example questions"
        description="Each question routes to a different specialist based on its content. The assistant decides automatically."
      >
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {EXAMPLE_QUESTIONS.map((item) => (
            <li
              key={item.question}
              className="rounded-lg bg-muted/40 p-4 transition-colors hover:bg-muted/70"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-card text-primary">
                  <item.icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-foreground">
                    &ldquo;{item.question}&rdquo;
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Routed to{" "}
                    <span className="font-medium text-foreground">{item.routedTo}</span>
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        eyebrow="Architecture"
        title="How a question flows through the system"
        description="Every request walks the same path. The Strategist decides whether to answer directly or hand off to a specialist."
      >
        <FlowDiagram />
      </Section>

      <Section
        eyebrow="Keep reading"
        title="The six things to know"
        description="Each page below stands on its own. Read in any order."
      >
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PAGE_CARDS.map((card) => (
            <li key={card.href}>
              <Link
                href={card.href}
                className="group block rounded-lg bg-muted/40 p-5 transition-colors hover:bg-muted/70"
              >
                <div className="flex items-start gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <card.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                        {card.title}
                      </h3>
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {card.teaser}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </div>
    </PageShell>
  );
}

function StatBlock({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | string;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
        {value}
      </p>
      {suffix ? (
        <p className="mt-1 text-xs text-muted-foreground">{suffix}</p>
      ) : null}
    </div>
  );
}

function FlowDiagram() {
  const nodeBase =
    "rounded-lg border border-border/60 bg-card px-4 py-3 text-sm font-medium text-foreground shadow-xs";
  const labelBase =
    "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

  return (
    <div className="rounded-xl bg-muted/30 p-6 sm:p-8">
      <div className="flex flex-col items-stretch gap-4">
        {/* User */}
        <div className="flex justify-center">
          <div className={`${nodeBase} text-center`}>You ask a question</div>
        </div>
        <ArrowDown />

        {/* Chat handler */}
        <div className="flex justify-center">
          <div className={`${nodeBase} text-center`}>
            Chat API receives the message
            <p className={`${labelBase} mt-1.5 normal-case tracking-normal text-muted-foreground`}>
              Streams the response back via the Vercel AI SDK
            </p>
          </div>
        </div>
        <ArrowDown />

        {/* Strategist */}
        <div className="flex justify-center">
          <div
            className={`${nodeBase} text-center`}
            style={{ borderColor: "var(--primary)" }}
          >
            Strategist reads the question
            <p className={`${labelBase} mt-1.5 normal-case tracking-normal text-muted-foreground`}>
              Decides: answer directly, or hand off to a specialist
            </p>
          </div>
        </div>
        <ArrowDown variant="branch" />

        {/* Three branches */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <BranchBox title="CFO sub-agent" detail="Financial questions: margin, cash flow, variance" />
          <BranchBox title="Microsoft EA" detail="Outlook, Teams, calendar operator work" />
          <BranchBox title="Project tools" detail="Reads from Supabase, RAG, Acumatica" />
        </div>
        <ArrowDown />

        {/* Data layer */}
        <div className="flex justify-center">
          <div className={`${nodeBase} text-center`}>
            Data layer
            <p className={`${labelBase} mt-1.5 normal-case tracking-normal text-muted-foreground`}>
              Supabase · pgvector · Acumatica · Microsoft Graph
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArrowDown({ variant = "single" }: { variant?: "single" | "branch" }) {
  return (
    <div className="flex justify-center" aria-hidden="true">
      <svg
        width={variant === "branch" ? "240" : "12"}
        height="18"
        viewBox={variant === "branch" ? "0 0 240 18" : "0 0 12 18"}
        fill="none"
        className="text-border"
      >
        {variant === "branch" ? (
          <>
            <path d="M120 0 L120 8" stroke="currentColor" strokeWidth="1" />
            <path d="M40 8 L200 8" stroke="currentColor" strokeWidth="1" />
            <path d="M40 8 L40 16" stroke="currentColor" strokeWidth="1" />
            <path d="M120 8 L120 16" stroke="currentColor" strokeWidth="1" />
            <path d="M200 8 L200 16" stroke="currentColor" strokeWidth="1" />
          </>
        ) : (
          <path d="M6 0 L6 18" stroke="currentColor" strokeWidth="1" />
        )}
      </svg>
    </div>
  );
}

function BranchBox({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg bg-card px-4 py-3 text-center shadow-xs">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}

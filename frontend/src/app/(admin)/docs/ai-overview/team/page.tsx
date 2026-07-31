import type { Metadata } from "next";
import { Briefcase, Compass, LineChart } from "lucide-react";

import { PageShell } from "@/components/layout";
import { SectionNav } from "../_components/section-nav";
import { Section, SectionTitleContent } from "../_components/section-shell";
import { loadAgents, type AgentSummary } from "../_lib/ai-stats";

export const metadata: Metadata = {
  title: "The team of agents",
  description:
    "Every question gets routed to the specialist who owns that domain. Two agents are live today; five more are designed and waiting to be wired up.",
};

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Per-agent metadata not captured in the generic types file
// ---------------------------------------------------------------------------

const AGENT_MODEL: Record<string, string> = {
  strategist: "gpt-5.5",
  cfo: "gpt-5.4-mini",
};

const AGENT_OWNS: Record<string, string[]> = {
  strategist: [
    "Routes every request through the agent layer",
    "Synthesizes packets and cross-domain reasoning",
    "Decides whether to answer directly or delegate to a specialist",
  ],
  cfo: [
    "Margin and cash flow analysis",
    "Budget variance and financial deep-dives",
    "Acumatica ERP reads and cost projections",
  ],
};

function agentIcon(name: string): React.ComponentType<{ className?: string }> {
  if (name === "strategist") return Compass;
  if (name === "cfo") return LineChart;
  return Briefcase;
}

// ---------------------------------------------------------------------------
// Routing examples
// ---------------------------------------------------------------------------

const ROUTING_EXAMPLES: { question: string; route: string }[] = [
  { question: '"How are we tracking on margin?"', route: "consultCFO" },
  {
    question: '"Draft reply to Sarah about the change order"',
    route: "consultMicrosoftExecutiveAssistant",
  },
  {
    question: '"What did we decide last meeting?"',
    route: "searchDocuments (direct)",
  },
  {
    question: '"Project status snapshot"',
    route: "getProjectBriefingSnapshot (direct)",
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LiveAgentCard({ agent }: { agent: AgentSummary }) {
  const Icon = agentIcon(agent.name);
  const model = AGENT_MODEL[agent.name] ?? "gpt-5.4-mini";
  const owns = AGENT_OWNS[agent.name] ?? [];

  return (
    <div className="rounded-lg bg-muted/40 p-5">
      <div className="flex items-start gap-4">
        {/* Icon column */}
        <div className="flex shrink-0 flex-col items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
            Live
          </span>
        </div>

        {/* Content column */}
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-base font-semibold text-foreground">{agent.label}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
              {agent.description}
            </p>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Model
              </p>
              <p className="font-mono text-xs text-foreground">{model}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Prompt file
              </p>
              <p className="truncate font-mono text-xs text-foreground">{agent.promptFile}</p>
            </div>
          </div>

          {/* What it owns */}
          {owns.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                What it owns
              </p>
              <ul className="space-y-1">
                {owns.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span
                      className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50"
                      aria-hidden="true"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DesignedAgentCard({ agent }: { agent: AgentSummary }) {
  const Icon = agentIcon(agent.name);

  return (
    <div className="rounded-lg bg-muted/40 p-4 opacity-70">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-muted-foreground">{agent.label}</p>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Designed
            </span>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {agent.description}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function TeamPage() {
  const agents = await loadAgents();
  const liveAgents = agents.filter((a) => a.status === "live");
  const designedAgents = agents.filter((a) => a.status === "designed");

  return (
    <PageShell
      variant="content"
      title="The team of agents"
      titleContent={<SectionTitleContent title="The team of agents" subtitle="Every question gets routed to the specialist who owns that domain. Two agents are live today; five more are designed and waiting to be wired up." />}
    >
      <SectionNav />
      <div className="space-y-14">
      {/* ------------------------------------------------------------------ */}
      {/* Section 1 — Live agents                                             */}
      {/* ------------------------------------------------------------------ */}
      <Section
        eyebrow="Live agents"
        title="Currently running"
        description="These agents have system prompts deployed and are wired into the orchestrator. Every live conversation goes through at least one of them."
      >
        <ul className="flex flex-col gap-4">
          {liveAgents.map((agent) => (
            <li key={agent.name}>
              <LiveAgentCard agent={agent} />
            </li>
          ))}
        </ul>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2 — Roadmap agents                                          */}
      {/* ------------------------------------------------------------------ */}
      <Section
        eyebrow="Designed, not yet wired"
        title="Roadmap agents"
        description="These agents have system prompts written but no consult* tool wired in the orchestrator yet. They are ready to activate once the tool layer is plumbed."
      >
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {designedAgents.map((agent) => (
            <li key={agent.name}>
              <DesignedAgentCard agent={agent} />
            </li>
          ))}
        </ul>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3 — How routing works                                        */}
      {/* ------------------------------------------------------------------ */}
      <Section
        eyebrow="How routing works"
        title="From your question to the right specialist"
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Explanation */}
          <div className="space-y-3 rounded-lg bg-muted/40 p-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              The mechanism
            </p>
            <p className="text-sm leading-relaxed text-foreground">
              The Strategist receives every message first. It reads the content and decides whether
              to answer directly using the project tool layer, or to delegate to a specialist via a
              tool call.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              When financial keywords appear: &ldquo;margin&rdquo;, &ldquo;budget&rdquo;,
              &ldquo;cash flow&rdquo;: the Strategist calls{" "}
              <span className="font-mono text-xs text-foreground">consultCFO</span>. When
              Outlook, Teams, or calendar requests appear, it calls{" "}
              <span className="font-mono text-xs text-foreground">
                consultMicrosoftExecutiveAssistant
              </span>
              . Everything else is answered directly through the 28+ tools in the project layer.
            </p>
          </div>

          {/* Example routing table */}
          <div className="rounded-lg bg-muted/40 p-5">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Example routing
            </p>
            <ul className="space-y-3">
              {ROUTING_EXAMPLES.map(({ question, route }) => (
                <li key={question} className="flex flex-col gap-0.5">
                  <span className="text-sm text-foreground">{question}</span>
                  <span className="font-mono text-xs text-muted-foreground">→ {route}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>
    </div>
    </PageShell>
  );
}

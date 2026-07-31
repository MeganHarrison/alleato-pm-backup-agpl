"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  MorphingDialog,
  MorphingDialogClose,
  MorphingDialogContainer,
  MorphingDialogContent,
  MorphingDialogDescription,
  MorphingDialogTitle,
  MorphingDialogTrigger,
} from "@/components/motion/morphing-dialog";
import {
  AGENTS, CHIEF, OUTPUT_ROWS,
  STATUS_CARDS, TOOL_CATEGORIES,
  PIPELINE_LANES, type Agent, type PipelineState, type Tool,
} from "./ai-os-data";
import { IngestionChart, RagPipelineChart } from "./ai-os-charts";
import { CompanyBrain } from "./company-brain";
import { RoadmapKanban } from "./ai-os-roadmap-kanban";
import { WorkspacePageIntro, WorkspaceSectionTitle } from "../workspace-primitives";
import styles from "./ai-os.module.css";

const stateDot: Record<PipelineState, string> = {
  queue: styles.pnDotQueue, run: styles.pnDotRun, done: styles.pnDotDone, err: styles.pnDotErr,
};

function seededHeartbeat(): Array<{ h: number; cls: string }> {
  let seed = 981723;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  return Array.from({ length: 60 }).map(() => {
    const r = rnd();
    const cls = r > 0.94 ? styles.healthRed : r > 0.82 ? styles.healthYellow : styles.healthGreen;
    return { h: 40 + Math.round(rnd() * 60), cls };
  });
}

function ToolCard({ tool }: { tool: Tool }) {
  const [open, setOpen] = useState(false);
  // Rule: a badge on every item carries no signal. "Live" is the resting default —
  // only the exceptions (beta, not yet shipped) earn a label.
  const statusCls = tool.status === "beta" ? styles.statusBeta : styles.statusSoon;
  const statusLabel = tool.status === "beta" ? "Beta" : "Soon";
  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={open}
      onClick={() => setOpen((o) => !o)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } }}
      className={cn(styles.tool, "rounded-lg transition-colors")}
    >
      <div className="flex items-start gap-3 p-3.5">
        <div className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-tight tracking-tight text-foreground">{tool.name}</span>
          <span className="mt-1 block text-xs leading-snug text-muted-foreground">{tool.tagline}</span>
        </div>
        {tool.status !== "live" ? (
          <span className={cn(statusCls, "flex-none rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide")}>
            {statusLabel}
          </span>
        ) : null}
      </div>
      <div className={cn(styles.toolDetail, open && styles.toolDetailOpen)}>
        <div className={styles.toolDetailInner}>
          <div className="space-y-2 px-3.5 pb-3.5 text-xs">
            <p className="leading-relaxed text-foreground/85">{tool.purpose}</p>
            <p className="text-muted-foreground">{tool.capabilities.join(" · ")}</p>
            <p className="text-muted-foreground">{tool.integrations.join(", ")}</p>
            <p className="text-muted-foreground">{tool.usage} · {tool.updated}</p>
            {tool.status !== "soon" ? (
              <span className="inline-flex items-center gap-1.5 pt-1 text-xs font-semibold text-primary">
                Launch <ArrowUpRight className="size-3.5" />
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

const agentHealthLabel: Record<Agent["health"], string> = {
  green: "Healthy",
  yellow: "Needs attention",
  red: "Unavailable",
};

function AgentCard({ agent, lead = false }: { agent: Agent; lead?: boolean }) {
  const healthClass = agent.health === "green" ? styles.healthGreen : agent.health === "yellow" ? styles.healthYellow : styles.healthRed;

  return (
    <MorphingDialog transition={{ type: "spring", stiffness: 260, damping: 28 }}>
      <MorphingDialogTrigger
        type="button"
        aria-label={`Open ${agent.name} details`}
        className="min-h-32 w-full rounded-lg bg-card p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn("size-2 shrink-0 rounded-full", healthClass)} aria-hidden="true" />
              <span className={cn("truncate text-sm text-foreground", lead && "font-semibold")}>{agent.name}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{agentHealthLabel[agent.health]}</p>
          </div>
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{agent.lastRun}</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Tasks</p>
            <p className="mt-1 font-mono text-sm tabular-nums text-foreground">{agent.tasks}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Latency</p>
            <p className="mt-1 font-mono text-sm tabular-nums text-foreground">{agent.latency}</p>
          </div>
        </div>
      </MorphingDialogTrigger>

      <MorphingDialogContainer overlayClassName="bg-foreground/10 backdrop-blur-sm dark:bg-black/50">
        <MorphingDialogContent className="relative mx-4 w-full max-w-md rounded-xl bg-card p-6 shadow-sm">
          <MorphingDialogClose className="right-4 top-4 text-muted-foreground hover:text-foreground" />
          <div className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full", healthClass)} aria-hidden="true" />
            <span className="text-xs text-muted-foreground">{agentHealthLabel[agent.health]}</span>
          </div>
          <MorphingDialogTitle className="mt-3 pr-8 text-xl font-semibold tracking-tight text-foreground">
            {agent.name}
          </MorphingDialogTitle>
          <MorphingDialogDescription className="mt-2 text-sm text-muted-foreground">
            Last run {agent.lastRun}
          </MorphingDialogDescription>
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border/50 pt-4">
            <div>
              <p className="text-xs text-muted-foreground">Tasks</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">{agent.tasks}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Latency</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">{agent.latency}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Token volume</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">{agent.tokens}</p>
            </div>
          </div>
        </MorphingDialogContent>
      </MorphingDialogContainer>
    </MorphingDialog>
  );
}

export function AiOsDashboard() {
  const heartbeat = useMemo(seededHeartbeat, []);

  return (
    <div className={styles.root}>
      <WorkspacePageIntro eyebrow="AI Operating System" title="The company brain, at work.">
        See what is moving, what needs attention, and where the system is creating leverage.
      </WorkspacePageIntro>

      <RagPipelineChart />

      {/* The health of the system is context for the work queue, not a KPI dashboard. */}
      <section className={cn(styles.section, styles.statusSurface)}>
        <WorkspaceSectionTitle caption="99.4% uptime · last 60 cycles">System status</WorkspaceSectionTitle>
        <div className={styles.statusGrid}>
          {STATUS_CARDS.map((k) => (
            <div key={k.label} className={styles.statusMetric}>
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <div className="mt-1 font-mono text-xl font-semibold tracking-tight tabular-nums text-foreground sm:text-2xl">{k.value}</div>
              <div
                className="mt-0.5 text-xs text-muted-foreground"
                style={k.trend ? { color: "var(--aios-good)" } : undefined}
              >
                {k.sub}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.heartbeat}>
          <div className="mb-3 flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-foreground">AI heartbeat</span>
            <span className="text-xs text-muted-foreground">Last 60 cycles</span>
          </div>
          <div className={styles.hbBars}>
            {heartbeat.map((b, i) => <div key={i} className={cn(styles.hbBar, b.cls)} style={{ height: `${b.h}%` }} />)}
          </div>
        </div>
      </section>

      {/* The decision surface follows health immediately. */}
      <section className={cn(styles.section, styles.roadmapSurface)}>
        <WorkspaceSectionTitle caption="Drag to reprioritize">What needs to move next</WorkspaceSectionTitle>
        <RoadmapKanban />
      </section>

      {/* Knowledge telemetry supports planning but should not compete with it. */}
      <section className={styles.section}>
        <WorkspaceSectionTitle caption="14-day view">Knowledge in, every day</WorkspaceSectionTitle>
        <div className={styles.chartModule}>
          <div className="mb-1 text-xs text-muted-foreground">Daily ingestion · records / day · 14 days</div>
          <IngestionChart />
        </div>
      </section>

      {/* Pipeline */}
      <section className={styles.section}>
        <WorkspaceSectionTitle>Live AI pipeline</WorkspaceSectionTitle>
        <div className={styles.pipe}>
          <div className={styles.pipeTrack}>
            {PIPELINE_LANES.map((lane, li) => (
              <div key={lane.label} className="flex items-stretch">
                <div className={styles.pipeLane}>
                  <div className="mb-1 text-xs text-muted-foreground">{lane.label}</div>
                  {lane.nodes.map((nd) => (
                    <div key={nd.name} className={cn(styles.pnode, nd.state === "run" && styles.pnodeRun)}>
                      <span className={cn(styles.pnDot, stateDot[nd.state])} />
                      <span className="flex-1 text-xs text-foreground">{nd.name}</span>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">{nd.count}</span>
                    </div>
                  ))}
                </div>
                {li < PIPELINE_LANES.length - 1 ? (
                  <div className={styles.pipeArrow}>
                    <svg viewBox="0 0 26 20" width="26" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                      <path d="M2 10h20m0 0-5-5m5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><i className="size-1.5 rounded-full" style={{ background: "var(--aios-faint)" }} />Queued</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-1.5 rounded-full" style={{ background: "var(--aios-accent)" }} />Running</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-1.5 rounded-full" style={{ background: "var(--aios-good)" }} />Completed</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-1.5 rounded-full" style={{ background: "var(--aios-bad)" }} />Error</span>
          </div>
        </div>
      </section>

      {/* Knowledge graph */}
      <section className={styles.section}>
        <WorkspaceSectionTitle caption="hover a node to trace what it touches">The company brain</WorkspaceSectionTitle>
        <CompanyBrain />
      </section>

      {/* Outputs */}
      <section className={styles.section}>
        <WorkspaceSectionTitle>Recent intelligence output</WorkspaceSectionTitle>
        <div className="overflow-x-auto">
          <div style={{ minWidth: 460 }}>
            <div className="grid grid-cols-[minmax(0,1fr)_5rem_6rem_6rem] gap-2 pb-2 text-xs text-muted-foreground">
              <span>Output</span><span className="text-right">Today</span><span className="text-right">This week</span><span className="text-right">This month</span>
            </div>
            {OUTPUT_ROWS.map((o) => (
              <div key={o.name} className="grid grid-cols-[minmax(0,1fr)_5rem_6rem_6rem] items-center gap-2 border-t border-border/50 py-2.5 text-sm">
                <span className="truncate text-foreground">{o.name}</span>
                <span className="text-right font-mono font-semibold tabular-nums text-foreground">{o.today}</span>
                <span className="text-right font-mono tabular-nums text-muted-foreground">{o.week}</span>
                <span className="text-right font-mono tabular-nums text-muted-foreground">{o.month}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Agents */}
      <section className={styles.section}>
        <WorkspaceSectionTitle caption="open a card for detail">Agent team</WorkspaceSectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AgentCard lead agent={CHIEF} />
        {AGENTS.map((a) => (
          <AgentCard key={a.name} agent={a} />
        ))}
        </div>
      </section>

      {/* Tools */}
      <section className={styles.section}>
        <WorkspaceSectionTitle caption="tap a card for detail">AI tool library</WorkspaceSectionTitle>
        <div className="space-y-6">
          {TOOL_CATEGORIES.map((cat) => (
            <div key={cat.name}>
              <div className="mb-2 text-xs text-muted-foreground">{cat.name}</div>
              <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {cat.tools.map((t) => <ToolCard key={t.name} tool={t} />)}
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}

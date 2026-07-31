"use client";

import { useEffect, useRef, useState } from "react";
import {
  BrainCircuit,
  CheckCircle2,
  FileSearch,
  Layers,
  Lock,
  Search,
  Sparkles,
  Workflow,
} from "lucide-react";

import { OrbitingCircles } from "@/components/ui/orbiting-circles";

import { BuildingSection } from "./building-section";

// ─────────────────────────────────────────────────────────────────────────────
// Small primitives
// ─────────────────────────────────────────────────────────────────────────────

type Horizon = "live" | "build" | "vision";

const HORIZON_PILL: Record<Horizon, string> = {
  live: "bg-status-success/12 text-status-success",
  build: "bg-status-info/12 text-status-info",
  vision: "bg-primary/12 text-primary",
};

const HORIZON_DOT: Record<Horizon, string> = {
  live: "bg-status-success",
  build: "bg-status-info",
  vision: "bg-primary",
};

function HorizonPill({ horizon, label }: { horizon: Horizon; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${HORIZON_PILL[horizon]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${HORIZON_DOT[horizon]}`} />
      {label}
    </span>
  );
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
    <div className="mb-7 max-w-3xl">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
        {eyebrow}
      </p>
      <h3 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-[28px]">
        {title}
      </h3>
      {blurb ? (
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          {blurb}
        </p>
      ) : null}
    </div>
  );
}

// Count-up number that animates the first time it scrolls into view.
function Counter({ target, suffix }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVal(target);
      setDone(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          io.disconnect();
          const dur = 1300;
          let start: number | null = null;
          const step = (ts: number) => {
            if (start === null) start = ts;
            const p = Math.min((ts - start) / dur, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setVal(Math.floor(eased * target));
            if (p < 1) {
              requestAnimationFrame(step);
            } else {
              setVal(target);
              setDone(true);
            }
          };
          requestAnimationFrame(step);
        });
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [target]);

  return (
    <span ref={ref}>
      {val.toLocaleString("en-US")}
      {done && suffix ? suffix : ""}
    </span>
  );
}

// Circular brand-logo token used inside the orbit.
function OrbitToken({ src, label }: { src: string; label: string }) {
  return (
    <div
      title={label}
      className="flex h-full w-full items-center justify-center rounded-full bg-card p-2 shadow-sm ring-1 ring-muted-foreground/15"
    >
      <span
        role="img"
        aria-label={label}
        style={{ backgroundImage: `url(${src})` }}
        className="block h-full w-full bg-contain bg-center bg-no-repeat"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Content data
// ─────────────────────────────────────────────────────────────────────────────

type Stage = {
  n: string;
  name: string;
  verb: string;
  tag: string;
  body: string;
  icon: React.ComponentType<{ className?: string }>;
};

const STAGES: Stage[] = [
  {
    n: "01",
    name: "Capture",
    verb: "Everything the work already generates, ingested automatically.",
    tag: "Live",
    icon: Layers,
    body: "Meetings flow in through the Fireflies pipeline. Outlook email, Teams chat, SharePoint files, submittals, RFIs, contracts, change orders, and the daily log follow — syncing every 30 minutes, event-driven for conversations. Nothing has to be filed by hand: the knowledge is captured as a byproduct of doing the work.",
  },
  {
    n: "02",
    name: "Structure",
    verb: "Embedded into a vector store; decisions, risks & tasks extracted.",
    tag: "Live",
    icon: Workflow,
    body: "Raw text is embedded with text-embedding-3-large (3,072 dimensions). In the same pass the system extracts the things that matter — decisions made, risks raised, tasks assigned — and tags them to the project, so meaning is preserved, not just words. Over 152,000 chunks across 19 source types are searchable right now.",
  },
  {
    n: "03",
    name: "Recall",
    verb: "Ask in plain language. It returns the exact moment it was decided.",
    tag: "Live",
    icon: Search,
    body: "Ask in plain language: what did we decide about the Westfield submittal schedule? The answer comes back with the exact moment it was decided and a link to the source. Institutional memory becomes a query instead of a hunt — across every project at once.",
  },
  {
    n: "04",
    name: "Reason",
    verb: "Patterns across projects become risk flags and a daily brief.",
    tag: "Live",
    icon: BrainCircuit,
    body: "A frontier model rolls each project into a living state — spotting the pattern, the slipping schedule, the cost creeping out of variance. That synthesis becomes per-project intelligence and the daily executive brief, organized by what you need to do, not by which project it came from.",
  },
  {
    n: "05",
    name: "Act",
    verb: "Draft, create, reconcile — every write gated by your approval.",
    tag: "Live · gated",
    icon: CheckCircle2,
    body: "The part most teams do not have yet — and Alleato does. Agents draft RFIs and emails, create submittals and change events, review submittals against the spec, and reconcile finances. But every write requires explicit confirmation and is recorded in an audit ledger with the user, the payload, and the result. The AI proposes; a human approves; the system never forgets who did what.",
  },
];

const STATS: { value: number; suffix?: string; label: React.ReactNode }[] = [
  {
    value: 152566,
    suffix: "+",
    label: (
      <>
        <b>Embedded memories.</b> Every meeting, email, Teams thread &amp;
        document, searchable the moment it lands.
      </>
    ),
  },
  {
    value: 19,
    label: (
      <>
        <b>Live data sources</b> feeding one brain — meetings, email, Teams,
        SharePoint, submittals, RFIs &amp; more.
      </>
    ),
  },
  {
    value: 100,
    suffix: "+",
    label: (
      <>
        <b>AI tools</b> the assistant can call — 90 to read &amp; reason, 17 to
        act on your behalf.
      </>
    ),
  },
  {
    value: 160,
    label: (
      <>
        <b>Approved AI actions</b> already written to the system — every one
        confirmed by a human &amp; audited.
      </>
    ),
  },
];

const SERVICES: { src: string; label: string }[] = [
  { src: "/brand/outlook.svg", label: "Outlook email" },
  { src: "/brand/teams.svg", label: "Microsoft Teams" },
  { src: "/brand/sharepoint.svg", label: "SharePoint" },
  { src: "/brand/onedrive.svg", label: "OneDrive" },
  { src: "/brand/fireflies.svg", label: "Fireflies meetings" },
  { src: "/brand/acumatica.svg", label: "Acumatica ERP" },
];

// Split across two counter-rotating rings.
const SOURCES_OUTER = [SERVICES[0], SERVICES[4], SERVICES[5]]; // Outlook · Fireflies · Acumatica
const SOURCES_INNER = [SERVICES[1], SERVICES[2], SERVICES[3]]; // Teams · SharePoint · OneDrive

const OUTPUTS: string[] = [
  "Ask-anything recall across every project & source, with a link to the source",
  "Per-project intelligence: risks, decisions, timeline, financials, open questions",
  "The daily executive brief — organized by what to decide, not by project",
  "Submittal review against the spec set & drawings",
  "Draft emails, progress reports & meeting prep, wired to live project data",
  "Created records — RFIs, submittals, change events, tasks — on approval",
];

const GATE_FLOW = [
  "AI drafts the action",
  "You see a preview",
  "You approve",
  "Write executes",
  "Logged forever",
];

const PAYOFF = [
  {
    title: "What it removes",
    body: (
      <>
        <b>The hunt.</b> No more digging through transcripts, threads, and
        folders for what was decided. It is one question away.
      </>
    ),
  },
  {
    title: "What it protects",
    body: (
      <>
        <b>The memory.</b> Every project&apos;s history is captured and connected
        — it does not leave when a person does.
      </>
    ),
  },
  {
    title: "What it unlocks",
    body: (
      <>
        <b>The scale.</b> One approval gate means new agents ship as
        configuration — the firm grows without the headcount.
      </>
    ),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Page content
// ─────────────────────────────────────────────────────────────────────────────

export function IntelligenceVisionContent() {
  const [active, setActive] = useState(0);
  const stage = STAGES[active];

  return (
    <div className="space-y-12 sm:space-y-16">
      {/* HERO STATEMENT */}
      <section className="overflow-hidden rounded-2xl bg-card p-7 sm:p-10">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-4 w-4" />
          <span className="text-[11px] font-semibold uppercase tracking-widest">
            The company&apos;s second brain
          </span>
        </div>
        <p className="mt-5 max-w-xl text-3xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
          Every meeting, email, and decision —{" "}
          <span className="text-primary">
            turned into intelligence the business can act on.
          </span>
        </p>
        <p className="mt-6 max-w-2xl text-[15px] font-light leading-relaxed text-muted-foreground sm:text-base">
          Alleato OS is the AI-native evolution of Procore. Underneath the
          project tools runs an intelligence layer that reads everything the
          business produces,{" "}
          <span className="font-medium text-foreground">remembers all of it</span>
          , finds the patterns across every project, and surfaces the risk, the
          decision, and the dollar before they cost you. It already does this in
          production today —{" "}
          <span className="font-medium text-foreground">reading and acting</span>
          , behind a single approval gate.
        </p>
        <div className="mt-7 flex flex-wrap gap-2.5">
          <HorizonPill horizon="live" label="Live today · recall, synthesis & gated action" />
          <HorizonPill horizon="build" label="In build · deeper autonomy" />
          <HorizonPill horizon="vision" label="Vision · an agent for every workflow" />
        </div>
      </section>

      {/* THE BUILDING — the platform as a mid-rise under construction */}
      <BuildingSection />

      {/* THE FOUNDATION — interactive pipeline */}
      <section>
        <SectionHead
          eyebrow="The foundation"
          title="How raw work becomes intelligence"
          blurb="This is the engine under every floor — the loop that runs the moment work happens, with a human approving anything it acts on. Tap a stage; all five are live in production today."
        />
        <div className="overflow-hidden rounded-2xl bg-card shadow-xs">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {STAGES.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === active;
              return (
                <div
                  key={s.n}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isActive}
                  onClick={() => setActive(i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActive(i);
                    }
                  }}
                  className={`cursor-pointer border-b border-border p-5 transition-colors last:border-b-0 sm:border-r ${
                    isActive ? "bg-primary/[0.06]" : "hover:bg-muted/50"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="mt-3 font-mono text-[11px] tracking-widest text-muted-foreground/60">
                    {s.n}
                  </div>
                  <div className="mt-1 text-[15px] font-bold tracking-tight text-foreground">
                    {s.name}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {s.verb}
                  </p>
                  <span
                    className={`mt-3 inline-flex rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                      s.tag === "Live"
                        ? "bg-status-success/12 text-status-success"
                        : "bg-primary/12 text-primary"
                    }`}
                  >
                    {s.tag}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="border-t border-border bg-muted/40 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-widest text-primary">
                {stage.n} · {stage.name}
              </span>
              <span
                className={`rounded px-2 py-0.5 font-mono text-[10px] tracking-wide ${
                  stage.tag === "Live"
                    ? "bg-status-success/12 text-status-success"
                    : "bg-primary/12 text-primary"
                }`}
              >
                {stage.tag}
              </span>
            </div>
            <p className="mt-3 max-w-4xl text-[15px] leading-relaxed text-muted-foreground">
              {stage.body}
            </p>
          </div>
        </div>
      </section>

      {/* STAT BAND — dark panel with counters */}
      <section className="rounded-2xl bg-foreground p-8 text-background sm:p-10">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
          Not a slide — this is already running
        </p>
        <h3 className="mt-2 max-w-2xl text-2xl font-bold tracking-tight text-background sm:text-[28px]">
          The intelligence layer is in production today, measured in real
          numbers.
        </h3>
        <div className="mt-9 grid grid-cols-2 gap-8 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <div key={i}>
              <div className="text-3xl font-bold tracking-tight text-background sm:text-[42px]">
                <Counter target={s.value} suffix={s.suffix} />
              </div>
              <p className="mt-3 text-[13px] font-light leading-relaxed text-background/55 [&_b]:font-medium [&_b]:text-background/90">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* DATA SOURCES — orbit */}
      <section>
        <SectionHead
          eyebrow="Where the intelligence comes from"
          title="Nineteen live sources, one brain"
          blurb="Nothing has to be filed by hand. The knowledge is captured as a byproduct of doing the work — then embedded, connected, and made answerable. Same loop, every source."
        />
        <div className="grid items-center gap-8 rounded-2xl bg-card p-6 shadow-xs sm:p-8 lg:grid-cols-2">
          {/* Orbit */}
          <div className="relative mx-auto flex aspect-square w-full max-w-md items-center justify-center">
            <div className="pointer-events-none z-10 flex flex-col items-center text-center">
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-card p-5 shadow-sm ring-1 ring-muted-foreground/15">
                <span
                  role="img"
                  aria-label="Supabase"
                  style={{ backgroundImage: "url(/brand/supabase.svg)" }}
                  className="block h-full w-full bg-contain bg-center bg-no-repeat"
                />
              </span>
              <span className="mt-3 text-sm font-bold tracking-tight text-foreground">
                Supabase vector store
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                152,566 embeddings
              </span>
            </div>

            <OrbitingCircles iconSize={52} radius={152} duration={34}>
              {SOURCES_OUTER.map((s) => (
                <OrbitToken key={s.label} src={s.src} label={s.label} />
              ))}
            </OrbitingCircles>

            <OrbitingCircles
              iconSize={46}
              radius={96}
              duration={26}
              reverse
              speed={1.2}
            >
              {SOURCES_INNER.map((s) => (
                <OrbitToken key={s.label} src={s.src} label={s.label} />
              ))}
            </OrbitingCircles>
          </div>

          {/* Legend + outputs */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Captured automatically
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SERVICES.map((s) => (
                <span
                  key={s.label}
                  className="inline-flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs text-foreground ring-1 ring-border"
                >
                  <span
                    role="img"
                    aria-label={s.label}
                    style={{ backgroundImage: `url(${s.src})` }}
                    className="block h-4 w-4 bg-contain bg-center bg-no-repeat"
                  />
                  {s.label}
                </span>
              ))}
            </div>

            <p className="mt-7 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              What comes out
            </p>
            <ul className="mt-3 space-y-2.5">
              {OUTPUTS.map((o) => (
                <li key={o} className="flex items-start gap-2.5 text-[13.5px] text-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-status-success" />
                  <span className="leading-relaxed">{o}</span>
                </li>
              ))}
            </ul>

            <p className="mt-6 border-t border-border pt-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
              Sync every <span className="text-primary">30 min</span> · meetings,
              email &amp; Teams are event-driven · embedded with{" "}
              <span className="text-primary">text-embedding-3-large</span> (3,072
              dims) · every output traces back to its exact source.
            </p>
          </div>
        </div>
      </section>

      {/* THE SAFETY MODEL — dark gate panel */}
      <section>
        <SectionHead
          eyebrow="The reason you can trust it to act"
          title="The AI proposes. A human approves. The system remembers who, what & when."
          blurb="The single most important design decision in the platform — and it is already built. The AI never writes silently. Every action that changes your data passes through one boundary: a preview, your confirmation, and a permanent audit record."
        />
        <div className="rounded-2xl bg-foreground p-8 text-background sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Lock className="h-6 w-6" />
            </span>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-primary">
                The single gating primitive
              </p>
              <h4 className="mt-2 text-xl font-bold tracking-tight text-background">
                Build the fence first. Then the agents are easy.
              </h4>
              <p className="mt-3 max-w-3xl text-sm font-light leading-relaxed text-background/65">
                Every agent on the roadmap depends on one thing: a boundary where
                the AI proposes and a human approves. That boundary exists today —
                write tools refuse to run without an explicit confirmation, every
                call is logged to an audit ledger with the user, payload, and
                result, and an idempotency key makes double-writes impossible.
                Ship that gate once, and{" "}
                <span className="font-medium text-background">
                  each new agent becomes configuration, not a new engineering
                  project.
                </span>{" "}
                Trust and speed come from the same decision.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-2">
                {GATE_FLOW.map((step, i) => (
                  <span key={step} className="flex items-center gap-2">
                    <span
                      className={`rounded-lg border px-3 py-1.5 font-mono text-[11px] ${
                        step === "You approve"
                          ? "border-primary/40 bg-primary/15 text-background"
                          : "border-background/15 bg-background/[0.06] text-background/80"
                      }`}
                    >
                      {step}
                    </span>
                    {i < GATE_FLOW.length - 1 ? (
                      <span className="text-background/35">→</span>
                    ) : null}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PAYOFF */}
      <section className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-8 sm:p-10">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
          Why it matters
        </p>
        <h3 className="mt-2 max-w-xl text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-[34px]">
          Less time on the busywork.{" "}
          <span className="text-primary">More time in your zone of genius.</span>
        </h3>
        <p className="mt-4 max-w-2xl text-[15px] font-light leading-relaxed text-muted-foreground">
          The blind spots disappear. The institutional memory stops walking out
          the door. The hours spent hunting through transcripts, chasing
          submittal status, and reconciling spreadsheets get handed back — so the
          team spends them{" "}
          <span className="font-medium text-foreground">
            winning work, designing better systems, and building the
            relationships that scale the firm.
          </span>
        </p>
        <div className="mt-9 grid gap-6 sm:grid-cols-3">
          {PAYOFF.map((p) => (
            <div key={p.title}>
              <p className="font-mono text-[11px] uppercase tracking-wide text-primary">
                {p.title}
              </p>
              <p className="mt-2.5 text-sm font-light leading-relaxed text-foreground [&_b]:font-semibold">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* HONEST STATUS FOOTNOTE */}
      <section className="border-t border-border pt-6">
        <div className="flex items-start gap-2.5">
          <FileSearch className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="max-w-4xl text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">
              Where things actually stand.
            </span>{" "}
            Recall, synthesis, the daily brief, per-project intelligence,
            submittal review, and AI email/record drafting are live in production
            today — the AI reads and writes, with every action confirmed by a
            human and recorded in an audit ledger. Items under In build are
            partially shipped behind feature flags; items under The vision build
            on the same approval gate that already exists. Numbers reflect the
            live system at the time of this snapshot.
          </p>
        </div>
      </section>
    </div>
  );
}

"use client";

import { useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// The platform, drawn as a mid-rise under construction. Each floor is a stage in
// the life of a commercial construction project; how finished a floor looks is
// how much of that stage's AI we have actually built.
//   live     → clad & lit (occupied)        green
//   building → framed, wiring & piping in    blue
//   vision   → bare steel frame / blueprint  orange
// Everything rests on the foundation: the intelligence engine, already poured.
// ─────────────────────────────────────────────────────────────────────────────

type Status = "live" | "building" | "vision";

type Cap = { name: string; status: Status };

type Level = {
  key: string;
  tag: string; // L1 … RF / BASE
  stage: string;
  phase: string;
  status: Status;
  tagline: string;
  here?: boolean;
  caps: Cap[];
};

const STATUS_META: Record<Status, { label: string; pill: string; dot: string; text: string }> = {
  live: { label: "Live", pill: "bg-status-success/12 text-status-success", dot: "bg-status-success", text: "text-status-success" },
  building: { label: "In build", pill: "bg-status-info/12 text-status-info", dot: "bg-status-info", text: "text-status-info" },
  vision: { label: "Vision", pill: "bg-primary/12 text-primary", dot: "bg-primary", text: "text-primary" },
};

const SVG_FILL: Record<Status, string> = {
  live: "hsl(var(--status-success))",
  building: "hsl(var(--status-info))",
  vision: "hsl(var(--primary))",
};

// index 0 = ground floor (sits on the foundation), last = roof
const FLOORS: Level[] = [
  {
    key: "L1",
    tag: "L1",
    stage: "Pursue & Win",
    phase: "Business development",
    status: "building",
    tagline: "Find the right work and walk in already knowing the client.",
    caps: [
      { name: "Company & market research", status: "live" },
      { name: "Pursuit & competitor intelligence", status: "building" },
      { name: "AI lead generation", status: "vision" },
      { name: "Proposal-ready briefing packs", status: "vision" },
    ],
  },
  {
    key: "L2",
    tag: "L2",
    stage: "Estimate & Propose",
    phase: "Estimating",
    status: "vision",
    tagline: "Turn the last hundred estimates into the next quote in minutes.",
    caps: [
      { name: "Recall pricing from similar past jobs", status: "vision" },
      { name: "Auto-drafted quotes & proposals", status: "vision" },
      { name: "Win-rate & margin guidance", status: "vision" },
    ],
  },
  {
    key: "L3",
    tag: "L3",
    stage: "Award → Budget & Contract",
    phase: "Buyout / award",
    status: "vision",
    tagline: "Win it once, never type it twice.",
    caps: [
      { name: "Estimate → budget, automatically", status: "vision" },
      { name: "Estimate → prime contract", status: "vision" },
      { name: "Zero re-entry handoff", status: "vision" },
    ],
  },
  {
    key: "L4",
    tag: "L4",
    stage: "Plan & Buy Out",
    phase: "Preconstruction",
    status: "building",
    tagline: "Build the schedule and the crew before the first shovel.",
    caps: [
      { name: "Schedule analysis", status: "live" },
      { name: "Delay & critical-path prediction", status: "building" },
      { name: "Manpower & resource AI", status: "vision" },
      { name: "Buyout & commitments", status: "live" },
    ],
  },
  {
    key: "L5",
    tag: "L5",
    stage: "Build",
    phase: "Construction",
    status: "live",
    here: true,
    tagline: "The floor we're standing on — most of this is live in production today.",
    caps: [
      { name: "AI submittal review", status: "live" },
      { name: "AI drawing review", status: "building" },
      { name: "Create records by chat", status: "live" },
      { name: "Change-event detection", status: "live" },
      { name: "RFI auto-drafting", status: "vision" },
      { name: "Daily logs & site scribe", status: "live" },
    ],
  },
  {
    key: "L6",
    tag: "L6",
    stage: "Oversee & Communicate",
    phase: "Project management",
    status: "live",
    tagline: "Every email, meeting and risk synthesized — and acted on with approval.",
    caps: [
      { name: "Project intelligence", status: "live" },
      { name: "Email assistant & triage", status: "live" },
      { name: "Notifications & executive brief", status: "live" },
      { name: "Sub & contractor follow-up", status: "vision" },
      { name: "PM copilot", status: "vision" },
    ],
  },
  {
    key: "RF",
    tag: "RF",
    stage: "Close & Learn",
    phase: "Closeout",
    status: "building",
    tagline: "Close it out, capture the lessons, and feed the next pursuit.",
    caps: [
      { name: "Lessons learned → memory", status: "live" },
      { name: "Cross-project learning", status: "live" },
      { name: "Closeout capture", status: "building" },
      { name: "Portfolio synthesis", status: "building" },
    ],
  },
];

const FOUNDATION: Level = {
  key: "foundation",
  tag: "BASE",
  stage: "Intelligence Foundation",
  phase: "The engine underneath",
  status: "live",
  tagline: "Everything above rests on this — and it is already poured.",
  caps: [
    { name: "Capture every meeting, email & doc", status: "live" },
    { name: "Embed & recall — 152K+ memories", status: "live" },
    { name: "Reason across every project", status: "live" },
    { name: "The human-approval gate", status: "live" },
  ],
};

const ALL: Record<string, Level> = Object.fromEntries(
  [...FLOORS, FOUNDATION].map((l) => [l.key, l]),
);

// ── geometry ────────────────────────────────────────────────────────────────
const GROUND = 558;
const FH = 60;
const LX = 132;
const RX = 396;
const BW = RX - LX;
const COLS = [LX, LX + BW / 2, RX];
const TOP = GROUND - FLOORS.length * FH; // top of highest floor

function floorRange(i: number) {
  const bottom = GROUND - i * FH;
  const top = GROUND - (i + 1) * FH;
  return { top, bottom };
}

function FloorGroup({
  floor,
  index,
  selected,
  onSelect,
}: {
  floor: Level;
  index: number;
  selected: boolean;
  onSelect: (key: string) => void;
}) {
  const { top, bottom } = floorRange(index);
  const bx = LX + 6;
  const bw = BW - 12;
  const by = top + 4;
  const bh = FH - 7;
  const cy = by + bh / 2;
  const accent = SVG_FILL[floor.status];

  // texture region (right portion of the band)
  const tx0 = 250;
  const tx1 = RX - 14;

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${floor.stage} — ${STATUS_META[floor.status].label}`}
      onClick={() => onSelect(floor.key)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(floor.key);
        }
      }}
      style={{ cursor: "pointer" }}
    >
      {/* band fill — live is clad/opaque, building is muted, vision is bare frame */}
      <rect
        x={bx}
        y={by}
        width={bw}
        height={bh}
        rx={3}
        fill={floor.status === "vision" ? "hsl(var(--background))" : "hsl(var(--card))"}
        fillOpacity={floor.status === "vision" ? 0.15 : floor.status === "building" ? 0.92 : 1}
        stroke={selected ? "hsl(var(--primary))" : "hsl(var(--border))"}
        strokeWidth={selected ? 2 : 1}
        strokeDasharray={floor.status === "vision" ? "5 4" : undefined}
      />

      {/* status texture */}
      {floor.status === "live" &&
        Array.from({ length: 3 }).map((_, c) =>
          Array.from({ length: 2 }).map((_, r) => (
            <rect
              key={`w-${c}-${r}`}
              x={tx0 + c * 34}
              y={by + 8 + r * (bh / 2 - 2)}
              width={24}
              height={bh / 2 - 10}
              rx={1.5}
              fill={accent}
              fillOpacity={0.5}
            />
          )),
        )}
      {floor.status === "building" && (
        <>
          {Array.from({ length: 8 }).map((_, s) => (
            <line
              key={`stud-${s}`}
              x1={tx0 + s * ((tx1 - tx0) / 7)}
              y1={by + 5}
              x2={tx0 + s * ((tx1 - tx0) / 7)}
              y2={by + bh - 5}
              stroke="hsl(var(--muted-foreground))"
              strokeOpacity={0.35}
            />
          ))}
          <line x1={tx0} y1={cy - 6} x2={tx1} y2={cy - 6} stroke={SVG_FILL.building} strokeWidth={2} strokeOpacity={0.7} />
          <line x1={tx0} y1={cy + 6} x2={tx1} y2={cy + 6} stroke={SVG_FILL.vision} strokeWidth={2} strokeOpacity={0.6} />
        </>
      )}
      {floor.status === "vision" &&
        Array.from({ length: 4 }).map((_, s) => (
          <line
            key={`bp-${s}`}
            x1={tx0 + s * ((tx1 - tx0) / 3)}
            y1={by + 5}
            x2={tx0 + s * ((tx1 - tx0) / 3)}
            y2={by + bh - 5}
            stroke={accent}
            strokeOpacity={0.3}
            strokeDasharray="3 4"
          />
        ))}

      {/* selected accent bar */}
      {selected && <rect x={bx} y={by} width={4} height={bh} rx={2} fill="hsl(var(--primary))" />}

      {/* level tag */}
      <text x={bx + 14} y={cy} dominantBaseline="middle" fontSize={11} fontWeight={600} fill="hsl(var(--muted-foreground))">
        {floor.tag}
      </text>

      {/* stage name */}
      <text
        x={bx + 44}
        y={cy}
        dominantBaseline="middle"
        fontSize={13}
        fontWeight={selected ? 700 : 600}
        fill="hsl(var(--foreground))"
      >
        {floor.here ? "★ " : ""}
        {floor.stage}
      </text>

      {/* status dot */}
      <circle cx={RX - 8} cy={cy} r={4} fill={accent} />

      {/* "you are here" pin */}
      {floor.here && (
        <g className="animate-pulse">
          <circle cx={RX + 16} cy={cy} r={5} fill="hsl(var(--primary))" />
          <path d={`M ${RX + 11} ${cy} L ${RX + 6} ${cy} `} stroke="hsl(var(--primary))" strokeWidth={2} />
        </g>
      )}
    </g>
  );
}

function BuildingDiagram({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <svg
      viewBox="0 0 560 620"
      className="h-auto w-full"
      role="img"
      aria-label="The Alleato platform drawn as a building under construction, one floor per project stage"
    >
      {/* sky wash */}
      <rect x={0} y={0} width={560} height={620} fill="hsl(var(--muted))" fillOpacity={0.25} rx={14} />

      {/* steel frame columns (run the full height, behind the floors) */}
      {COLS.map((cx) => (
        <rect key={`col-${cx}`} x={cx - 3} y={TOP - 6} width={6} height={GROUND - TOP + 6} fill="hsl(var(--muted-foreground))" fillOpacity={0.16} />
      ))}

      {/* roof parapet */}
      <rect x={LX + 2} y={TOP - 12} width={BW - 4} height={12} rx={2} fill="hsl(var(--card))" stroke="hsl(var(--border))" />

      {/* floors */}
      {FLOORS.map((f, i) => (
        <FloorGroup key={f.key} floor={f} index={i} selected={selected === f.key} onSelect={onSelect} />
      ))}

      {/* tower crane */}
      <g fill="none" stroke="hsl(var(--muted-foreground))" strokeOpacity={0.55} strokeWidth={2}>
        {/* mast */}
        <line x1={470} y1={150} x2={470} y2={GROUND} />
        <line x1={486} y1={150} x2={486} y2={GROUND} />
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={`mr-${i}`} x1={470} y1={170 + i * 42} x2={486} y2={150 + i * 42} strokeOpacity={0.35} />
        ))}
        {/* cab */}
        <rect x={468} y={132} width={20} height={20} fill="hsl(var(--card))" />
        {/* jib reaching left over the unbuilt floors */}
        <line x1={478} y1={138} x2={250} y2={138} />
        <line x1={478} y1={150} x2={250} y2={150} />
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={`jr-${i}`} x1={258 + i * 24} y1={138} x2={246 + i * 24} y2={150} strokeOpacity={0.35} />
        ))}
        {/* counter-jib + weight */}
        <line x1={486} y1={144} x2={520} y2={144} />
        <rect x={512} y={138} width={16} height={16} fill="hsl(var(--muted-foreground))" fillOpacity={0.4} stroke="none" />
        {/* hook + load (lifting the next stage into place) */}
        <line x1={300} y1={150} x2={300} y2={196} />
        <rect x={284} y={196} width={32} height={20} rx={2} fill="hsl(var(--primary))" fillOpacity={0.14} stroke="hsl(var(--primary))" strokeOpacity={0.5} />
      </g>

      {/* ground line + hatch */}
      <line x1={40} y1={GROUND} x2={540} y2={GROUND} stroke="hsl(var(--border))" strokeWidth={1.5} />
      {Array.from({ length: 20 }).map((_, i) => (
        <line key={`g-${i}`} x1={48 + i * 26} y1={GROUND} x2={40 + i * 26} y2={GROUND + 9} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.28} />
      ))}

      {/* foundation */}
      <g
        role="button"
        tabIndex={0}
        aria-label="Intelligence Foundation — Live"
        onClick={() => onSelect("foundation")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect("foundation");
          }
        }}
        style={{ cursor: "pointer" }}
      >
        <rect
          x={LX - 16}
          y={GROUND}
          width={BW + 32}
          height={44}
          rx={3}
          fill="hsl(var(--foreground))"
          stroke={selected === "foundation" ? "hsl(var(--primary))" : "hsl(var(--border))"}
          strokeWidth={selected === "foundation" ? 2 : 1}
        />
        <text x={264} y={GROUND + 19} textAnchor="middle" fontSize={11.5} fontWeight={700} fill="hsl(var(--background))" letterSpacing="0.06em">
          INTELLIGENCE FOUNDATION
        </text>
        <text x={264} y={GROUND + 34} textAnchor="middle" fontSize={9} fill="hsl(var(--background))" fillOpacity={0.6}>
          capture · embed · recall · reason · the approval gate
        </text>
      </g>
    </svg>
  );
}

function StatusPill({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${m.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export function BuildingSection() {
  const [selected, setSelected] = useState("L5");
  const current = ALL[selected] ?? FLOORS[4];

  return (
    <section>
      <div className="mb-7 max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">The big picture</p>
        <h3 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-[28px]">
          We&apos;re building this like a building
        </h3>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Every floor is a stage in the life of a commercial construction project — from chasing
          the work to closing it out. How finished a floor looks is how much of that stage we&apos;ve
          actually built: <b className="font-medium text-foreground">lit &amp; occupied</b> is live
          today, <b className="font-medium text-foreground">framed with the wiring going in</b> is
          under construction, and <b className="font-medium text-foreground">bare steel &amp; blueprint</b>{" "}
          is designed and next. It all sits on a foundation that&apos;s already poured. Tap a floor.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        {/* the building */}
        <div className="rounded-2xl bg-card p-4 shadow-xs sm:p-6">
          <BuildingDiagram selected={selected} onSelect={setSelected} />
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-border pt-4">
            {(["live", "building", "vision"] as Status[]).map((s) => (
              <span key={s} className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <span className={`h-2.5 w-2.5 rounded-sm ${STATUS_META[s].dot}`} />
                {STATUS_META[s].label}
              </span>
            ))}
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-primary">★</span> You are here
            </span>
          </div>
        </div>

        {/* the selected floor */}
        <div className="flex flex-col rounded-2xl bg-card p-6 shadow-xs sm:p-7">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[11px] font-semibold text-muted-foreground">{current.tag}</span>
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">· {current.phase}</span>
            <span className="ml-auto">
              <StatusPill status={current.status} />
            </span>
          </div>
          <p className="mt-3 text-xl font-bold tracking-tight text-foreground">
            {current.here ? "★ " : ""}
            {current.stage}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{current.tagline}</p>

          {current.here && (
            <p className="mt-4 inline-flex w-fit items-center gap-2 rounded-lg bg-primary/[0.06] px-3 py-1.5 text-xs font-medium text-primary">
              You are here — this is where the platform already lives.
            </p>
          )}

          <div className="mt-5 space-y-2.5">
            {current.caps.map((c) => (
              <div key={c.name} className="flex items-center gap-3">
                <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_META[c.status].dot}`} />
                <span className="text-sm text-foreground">{c.name}</span>
                <span className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${STATUS_META[c.status].pill}`}>
                  {STATUS_META[c.status].label}
                </span>
              </div>
            ))}
          </div>

          {current.key === "RF" && (
            <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
              Closeout feeds the next pursuit — what we learn on this project sharpens the estimate on
              the next one. The building is a cycle, not a dead end.
            </p>
          )}
          {current.key === "foundation" && (
            <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
              This is the engine the rest of the page walks through — capture, recall, reason, and the
              approval gate that lets the AI act safely.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

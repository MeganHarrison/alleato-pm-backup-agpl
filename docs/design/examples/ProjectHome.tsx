// @ts-nocheck
import { useState } from "react";

// ============================================================================
// MOCK DATA — Realistic Westfield Collective project data
// ============================================================================

const PROJECT = {
  code: "24-115",
  name: "Westfield Collective",
  address: "1200 Westfield Ave, Tampa, FL 33602",
  type: "Restaurant / Bar — Design Build",
  phase: "Construction",
  startDate: "Oct 15, 2024",
  substantialCompletion: "Mar 28, 2025",
  daysRemaining: 26,
  percentComplete: 82,
  healthScore: 73,
  owner: "Westfield Hospitality Group",
  architect: "Studio Forma Architects",
  pm: "Brandon Collier",
};

const FINANCIALS = {
  contractValue: 9300000,
  approvedCOs: 187500,
  revisedContract: 9487500,
  committed: 7340000,
  billedToDate: 5890000,
  paidToDate: 5120000,
  retention: 294500,
  remaining: 2147500,
  projectedFinal: 9610000,
  varianceAmount: -122500,
  variancePercent: -1.3,
  pendingCOExposure: 342000,
};

const ATTENTION_ITEMS = [
  { type: "action", label: "Overdue action items", count: 4, severity: "error", href: "#" },
  { type: "co", label: "Pending change orders", count: 2, amount: "$342K", severity: "warning", href: "#" },
  { type: "rfi", label: "Open RFIs", count: 3, days: "avg 8 days", severity: "warning", href: "#" },
  { type: "submittal", label: "Submittals awaiting review", count: 5, severity: "neutral", href: "#" },
  { type: "invoice", label: "Invoices pending approval", count: 1, amount: "$284K", severity: "neutral", href: "#" },
  { type: "punch", label: "Open punch list items", count: 18, severity: "neutral", href: "#" },
];

const BUDGET_LINES = [
  { code: "03-10", desc: "Concrete & Foundations", budget: 680000, committed: 660000, spent: 645000, variance: 20000 },
  { code: "09-00", desc: "Finishes", budget: 1450000, committed: 1520000, spent: 980000, variance: -70000 },
  { code: "16-10", desc: "Electrical", budget: 780000, committed: 810000, spent: 620000, variance: -30000 },
  { code: "15-10", desc: "Mechanical / HVAC", budget: 920000, committed: 895000, spent: 710000, variance: 25000 },
  { code: "22-00", desc: "Plumbing", budget: 480000, committed: 475000, spent: 390000, variance: 5000 },
  { code: "01-10", desc: "General Conditions", budget: 650000, committed: 610000, spent: 520000, variance: 40000 },
];

const MEETINGS = [
  {
    month: "Feb", day: "24", title: "OAC — Westfield Collective",
    summary: "Construction nearing completion. Plumbing, electrical, and wood trim starting. Inspection raised concerns on door and sprinkler placements — won't block TCO. Elevator and health inspections this weekend.",
    decisions: ["Approved alternate sprinkler head placement", "TCO target confirmed for Mar 28"],
    actionItems: 3, attendees: 15, avatars: ["BC", "JD"], overflow: 12,
  },
  {
    month: "Feb", day: "17", title: "Beer Line Discussion",
    summary: "Rerouting 4.5-inch PVC beer lines under bar to prevent interference with coolers. Agreed on trenching and sleeving. Alternative 90-degree elbow approach analyzed — too deep at 4 inches.",
    decisions: ["Go with trenching approach over elbow routing"],
    actionItems: 2, attendees: 6, avatars: ["AL", "DS"], overflow: 3,
  },
  {
    month: "Feb", day: "17", title: "OAC — Westfield Collective",
    summary: "Kitchen equipment by Daniel Stewart's team. Inspections next week for TCO. Jim installing exterior signage. Mural designs awaiting pricing.",
    decisions: ["Signage vendor selected", "Mural budget capped at $12K"],
    actionItems: 4, attendees: 18, avatars: ["BC", "JD"], overflow: 15,
  },
  {
    month: "Feb", day: "11", title: "1st and 2nd Floor Bar Review",
    summary: "Draft beer tap system installation plan. Metal stud wall for taps and cabinetry. Cantilevered countertop at 42 inches with coolers integrated beneath.",
    decisions: ["Countertop height confirmed at 42\"", "Equipment delivery Tue/Wed"],
    actionItems: 2, attendees: 9, avatars: ["ME", "JD"], overflow: 6,
  },
];

const DAILY_LOG_HIGHLIGHTS = [
  { date: "Feb 24", weather: "72°F Sunny", workers: 34, note: "Plumbing rough-in 2nd floor complete. Electrical panel installed." },
  { date: "Feb 21", weather: "68°F Cloudy", workers: 28, note: "Drywall finishing main dining. HVAC duct inspection passed." },
  { date: "Feb 20", weather: "74°F Sunny", workers: 31, note: "Exterior signage mounting brackets installed. Concrete curing south patio." },
];

const NAV_SECTIONS = [
  { label: "Financial", items: [
    { name: "Budget", count: null, active: false },
    { name: "Prime Contracts", count: 1, active: false },
    { name: "Commitments", count: 12, active: false },
    { name: "Direct Costs", count: null, active: false },
    { name: "Invoices", count: 3, active: false },
    { name: "Change Orders", count: 2, active: false },
    { name: "Change Events", count: 4, active: false },
  ]},
  { label: "Project", items: [
    { name: "Schedule", count: null, active: false },
    { name: "RFIs", count: 3, active: false },
    { name: "Submittals", count: 5, active: false },
    { name: "Daily Log", count: null, active: false },
    { name: "Punch List", count: 18, active: false },
    { name: "Meetings", count: 57, active: false },
  ]},
  { label: "Files", items: [
    { name: "Drawings", count: 24, active: false },
    { name: "Documents", count: 89, active: false },
    { name: "Photos", count: 342, active: false },
    { name: "Specifications", count: 16, active: false },
  ]},
  { label: "Directory", items: [
    { name: "Users", count: null, active: false },
    { name: "Companies", count: null, active: false },
    { name: "Contacts", count: null, active: false },
  ]},
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function fmt(n) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtFull(n) {
  return `$${n.toLocaleString()}`;
}

function pct(n, total) {
  return Math.round((n / total) * 100);
}

// ============================================================================
// COMPONENT: Health Score Ring
// ============================================================================

function HealthRing({ score, size = 56 }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? "#16a34a" : score >= 50 ? "#d97706" : "#dc2626";
  const bgColor = score >= 75 ? "#dcfce7" : score >= 50 ? "#fef3c7" : "#fee2e2";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#f0f0f0" strokeWidth="4" />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-semibold" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENT: Progress Bar
// ============================================================================

function ProgressBar({ value, max, color = "#f97316", height = 6, showLabel = false }) {
  const pctVal = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height, backgroundColor: "#f0f0f3" }}>
        <div className="rounded-full transition-all duration-700" style={{ width: `${pctVal}%`, height: "100%", backgroundColor: color }} />
      </div>
      {showLabel && <span className="text-xs tabular-nums" style={{ color: "rgba(0,0,0,0.45)", minWidth: 32 }}>{pctVal}%</span>}
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function ProjectHome() {
  const [expandedBudget, setExpandedBudget] = useState(false);

  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", background: "#f5f5f7", minHeight: "100vh", color: "rgba(0,0,0,0.88)" }}>

      {/* ================================================================
          PAGE HEADER
      ================================================================ */}
      <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.08)", padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "rgba(0,0,0,0.45)", marginBottom: 4 }}>
          <span style={{ cursor: "pointer", transition: "color 0.15s" }} onMouseEnter={e => e.target.style.color = "rgba(0,0,0,0.7)"} onMouseLeave={e => e.target.style.color = "rgba(0,0,0,0.45)"}>Projects</span>
          <span style={{ opacity: 0.4 }}>›</span>
          <span style={{ color: "rgba(0,0,0,0.88)", fontWeight: 500 }}>{PROJECT.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div>
              <span style={{ fontSize: 11, color: "rgba(0,0,0,0.35)" }}>{PROJECT.code}</span>
              <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", margin: 0, lineHeight: 1.2 }}>{PROJECT.name}</h1>
            </div>
            <HealthRing score={PROJECT.healthScore} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 13, fontWeight: 500, color: "rgba(0,0,0,0.7)", background: "#fff", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 6, cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={e => e.target.style.background = "#f9f9f9"} onMouseLeave={e => e.target.style.background = "#fff"}>
              ✏️ Edit Project
            </button>
            <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", fontSize: 13, fontWeight: 500, color: "#fff", background: "#f97316", border: "none", borderRadius: 6, cursor: "pointer", transition: "all 0.15s", boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }}
              onMouseEnter={e => e.target.style.background = "#ea580c"} onMouseLeave={e => e.target.style.background = "#f97316"}>
              Setup Checklist →
            </button>
          </div>
        </div>
      </div>

      {/* ================================================================
          BODY: MAIN + SIDEBAR
      ================================================================ */}
      <div style={{ display: "flex" }}>

        {/* ============================================================
            MAIN CONTENT
        ============================================================ */}
        <div style={{ flex: 1, minWidth: 0, padding: "24px 28px", maxWidth: 960 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>

            {/* --------------------------------------------------------
                SECTION 1: PROJECT SNAPSHOT (Schedule + Phase)
            -------------------------------------------------------- */}
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ padding: "16px 20px", borderRight: "1px solid rgba(0,0,0,0.05)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(0,0,0,0.4)", marginBottom: 4 }}>Phase</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "rgba(0,0,0,0.88)" }}>{PROJECT.phase}</div>
                  <div style={{ fontSize: 11, color: "rgba(0,0,0,0.35)", marginTop: 2 }}>{PROJECT.type}</div>
                </div>
                <div style={{ padding: "16px 20px", borderRight: "1px solid rgba(0,0,0,0.05)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(0,0,0,0.4)", marginBottom: 4 }}>Completion</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{PROJECT.percentComplete}%</div>
                  <div style={{ marginTop: 6 }}>
                    <ProgressBar value={PROJECT.percentComplete} max={100} color="#f97316" height={5} />
                  </div>
                </div>
                <div style={{ padding: "16px 20px", borderRight: "1px solid rgba(0,0,0,0.05)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(0,0,0,0.4)", marginBottom: 4 }}>Substantial Completion</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{PROJECT.substantialCompletion}</div>
                  <div style={{ fontSize: 11, color: "rgba(0,0,0,0.35)", marginTop: 2 }}>{PROJECT.daysRemaining} days remaining</div>
                </div>
                <div style={{ padding: "16px 20px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(0,0,0,0.4)", marginBottom: 4 }}>Project Manager</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#fed7aa", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: "#9a3412" }}>BC</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{PROJECT.pm}</div>
                      <div style={{ fontSize: 11, color: "rgba(0,0,0,0.35)" }}>Alleato Group</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* --------------------------------------------------------
                SECTION 2: FINANCIAL KPIs
            -------------------------------------------------------- */}
            <section>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>Financials</h2>
                <span style={{ fontSize: 12, color: "rgba(0,0,0,0.4)", cursor: "pointer" }}>View Budget →</span>
              </div>
              <div style={{ background: "#fff", borderRadius: 8, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)" }}>
                  {[
                    { label: "Contract Value", value: fmt(FINANCIALS.revisedContract), context: `Original ${fmt(FINANCIALS.contractValue)}`, delta: FINANCIALS.approvedCOs > 0 ? { value: `+${fmt(FINANCIALS.approvedCOs)} COs`, positive: true } : null },
                    { label: "Committed", value: fmt(FINANCIALS.committed), context: `${pct(FINANCIALS.committed, FINANCIALS.revisedContract)}% of contract`, delta: null },
                    { label: "Billed to Date", value: fmt(FINANCIALS.billedToDate), context: `${fmt(FINANCIALS.paidToDate)} collected`, delta: null },
                    { label: "Remaining", value: fmt(FINANCIALS.remaining), context: `${pct(FINANCIALS.remaining, FINANCIALS.revisedContract)}% unallocated`, delta: null },
                    { label: "Projected Variance", value: fmt(Math.abs(FINANCIALS.varianceAmount)), context: `${FINANCIALS.variancePercent}% of contract`, delta: { value: `${FINANCIALS.variancePercent}%`, positive: FINANCIALS.varianceAmount >= 0 } },
                  ].map((kpi, i) => (
                    <div key={i} style={{ padding: "16px 20px", borderRight: i < 4 ? "1px solid rgba(0,0,0,0.05)" : "none" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(0,0,0,0.4)", marginBottom: 6 }}>{kpi.label}</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" }}>{kpi.value}</span>
                        {kpi.delta && (
                          <span style={{
                            display: "inline-flex", alignItems: "center", padding: "1px 6px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                            background: kpi.delta.positive ? "#dcfce7" : "#fee2e2",
                            color: kpi.delta.positive ? "#15803d" : "#b91c1c",
                          }}>
                            {kpi.delta.positive ? "↑" : "↓"} {kpi.delta.value}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(0,0,0,0.35)", marginTop: 2 }}>{kpi.context}</div>
                    </div>
                  ))}
                </div>

                {/* Billing Progress Bar */}
                <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(0,0,0,0.05)", background: "#fafafa" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11, color: "rgba(0,0,0,0.45)" }}>
                    <span>Billing Progress</span>
                    <span>{pct(FINANCIALS.billedToDate, FINANCIALS.revisedContract)}% billed</span>
                  </div>
                  <div style={{ height: 6, background: "#e5e5e5", borderRadius: 3, overflow: "hidden", display: "flex" }}>
                    <div style={{ width: `${pct(FINANCIALS.paidToDate, FINANCIALS.revisedContract)}%`, background: "#16a34a", transition: "width 0.7s" }} />
                    <div style={{ width: `${pct(FINANCIALS.billedToDate - FINANCIALS.paidToDate, FINANCIALS.revisedContract)}%`, background: "#f59e0b", transition: "width 0.7s" }} />
                  </div>
                  <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 10, color: "rgba(0,0,0,0.4)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: "#16a34a" }} /> Paid ({fmt(FINANCIALS.paidToDate)})
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: "#f59e0b" }} /> Billed, unpaid ({fmt(FINANCIALS.billedToDate - FINANCIALS.paidToDate)})
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: "#e5e5e5" }} /> Unbilled ({fmt(FINANCIALS.revisedContract - FINANCIALS.billedToDate)})
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* --------------------------------------------------------
                SECTION 3: NEEDS ATTENTION
            -------------------------------------------------------- */}
            <section>
              <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", margin: "0 0 12px" }}>Needs Attention</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "rgba(0,0,0,0.06)", borderRadius: 8, overflow: "hidden" }}>
                {ATTENTION_ITEMS.map((item, i) => (
                  <div key={i} style={{ background: "#fff", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#fafafa"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: item.severity === "error" ? "#dc2626" : item.severity === "warning" ? "#d97706" : "#9ca3af",
                        flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 13, color: "rgba(0,0,0,0.7)" }}>{item.label}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {item.amount && <span style={{ fontSize: 12, color: "rgba(0,0,0,0.45)" }}>{item.amount}</span>}
                      {item.days && <span style={{ fontSize: 12, color: "rgba(0,0,0,0.45)" }}>{item.days}</span>}
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        minWidth: 20, height: 20, borderRadius: 10, fontSize: 11, fontWeight: 600,
                        background: item.severity === "error" ? "#fee2e2" : item.severity === "warning" ? "#fef3c7" : "#f3f4f6",
                        color: item.severity === "error" ? "#b91c1c" : item.severity === "warning" ? "#92400e" : "#4b5563",
                        padding: "0 6px",
                      }}>
                        {item.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {FINANCIALS.pendingCOExposure > 0 && (
                <div style={{ marginTop: 8, padding: "10px 16px", borderRadius: 6, background: "#fffbeb", border: "1px solid rgba(217,119,6,0.15)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14 }}>⚠️</span>
                  <span style={{ fontSize: 12, color: "#92400e" }}>
                    <strong>{fmt(FINANCIALS.pendingCOExposure)}</strong> in pending change order exposure — {pct(FINANCIALS.pendingCOExposure, FINANCIALS.revisedContract)}% of revised contract
                  </span>
                </div>
              )}
            </section>

            {/* --------------------------------------------------------
                SECTION 4: BUDGET BREAKDOWN (expandable)
            -------------------------------------------------------- */}
            <section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>Budget by Cost Code</h2>
                <button onClick={() => setExpandedBudget(!expandedBudget)}
                  style={{ fontSize: 12, color: "rgba(0,0,0,0.45)", background: "none", border: "none", cursor: "pointer" }}>
                  {expandedBudget ? "Collapse" : "Show all"} →
                </button>
              </div>
              <div style={{ background: "#fff", borderRadius: 8, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                      {["Code", "Description", "Budget", "Committed", "Spent", "Variance", ""].map((h, i) => (
                        <th key={i} style={{
                          padding: "10px 16px", textAlign: i >= 2 ? "right" : "left",
                          fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
                          color: "rgba(0,0,0,0.38)",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(expandedBudget ? BUDGET_LINES : BUDGET_LINES.slice(0, 4)).map((line, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)", transition: "background 0.1s", cursor: "pointer" }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.015)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "10px 16px", fontFamily: "monospace", fontSize: 12, color: "rgba(0,0,0,0.5)" }}>{line.code}</td>
                        <td style={{ padding: "10px 16px", fontWeight: 500, color: "rgba(0,0,0,0.88)" }}>{line.desc}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "rgba(0,0,0,0.55)" }}>{fmtFull(line.budget)}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "rgba(0,0,0,0.55)" }}>{fmtFull(line.committed)}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "rgba(0,0,0,0.55)" }}>{fmtFull(line.spent)}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500, color: line.variance >= 0 ? "#15803d" : "#b91c1c" }}>
                          {line.variance >= 0 ? "+" : ""}{fmtFull(line.variance)}
                        </td>
                        <td style={{ padding: "10px 16px", width: 100 }}>
                          <ProgressBar value={line.spent} max={line.budget} color={line.variance >= 0 ? "#16a34a" : "#dc2626"} height={4} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* --------------------------------------------------------
                SECTION 5: RECENT MEETINGS
            -------------------------------------------------------- */}
            <section>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>Meetings</h2>
                  <span style={{ fontSize: 13, color: "rgba(0,0,0,0.3)" }}>57</span>
                </div>
                <span style={{ fontSize: 12, color: "rgba(0,0,0,0.4)", cursor: "pointer" }}>View all →</span>
              </div>
              <div>
                {MEETINGS.map((m, i) => (
                  <div key={i} style={{ display: "flex", gap: 16, padding: "16px 8px", borderBottom: i < MEETINGS.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none", cursor: "pointer", borderRadius: 8, margin: "0 -8px", transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.02)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    {/* Date */}
                    <div style={{ width: 44, flexShrink: 0, textAlign: "center", paddingTop: 2 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(0,0,0,0.38)" }}>{m.month}</div>
                      <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{m.day}</div>
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 500, margin: 0, lineHeight: 1.3 }}>{m.title}</h3>
                        <div style={{ display: "flex", flexShrink: 0 }}>
                          {m.avatars.map((a, j) => (
                            <div key={j} style={{ width: 24, height: 24, borderRadius: "50%", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.5)", marginLeft: j > 0 ? -6 : 0, border: "2px solid #fff", position: "relative", zIndex: m.avatars.length - j }}>{a}</div>
                          ))}
                          {m.overflow > 0 && (
                            <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#d1d5db", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.5)", marginLeft: -6, border: "2px solid #fff" }}>+{m.overflow}</div>
                          )}
                        </div>
                      </div>
                      <p style={{ fontSize: 13, color: "rgba(0,0,0,0.5)", lineHeight: 1.5, margin: "4px 0 0", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{m.summary}</p>
                      {/* Decisions */}
                      {m.decisions && m.decisions.length > 0 && (
                        <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {m.decisions.map((d, j) => (
                            <span key={j} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#eff6ff", color: "#1d4ed8", fontWeight: 500 }}>✓ {d}</span>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: 6, display: "flex", gap: 12, fontSize: 11, color: "rgba(0,0,0,0.35)" }}>
                        <span>👥 {m.attendees} attendees</span>
                        {m.actionItems > 0 && <span style={{ color: m.actionItems > 2 ? "#b91c1c" : "rgba(0,0,0,0.35)" }}>📋 {m.actionItems} action items</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* --------------------------------------------------------
                SECTION 6: DAILY LOG HIGHLIGHTS
            -------------------------------------------------------- */}
            <section>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>Daily Log</h2>
                <span style={{ fontSize: 12, color: "rgba(0,0,0,0.4)", cursor: "pointer" }}>View all →</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: "rgba(0,0,0,0.06)", borderRadius: 8, overflow: "hidden" }}>
                {DAILY_LOG_HIGHLIGHTS.map((log, i) => (
                  <div key={i} style={{ background: "#fff", padding: "14px 16px", cursor: "pointer", transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#fafafa"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{log.date}</span>
                      <span style={{ fontSize: 11, color: "rgba(0,0,0,0.35)" }}>{log.weather}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "rgba(0,0,0,0.55)", lineHeight: 1.5, margin: 0 }}>{log.note}</p>
                    <div style={{ marginTop: 8, fontSize: 11, color: "rgba(0,0,0,0.35)" }}>👷 {log.workers} workers on site</div>
                  </div>
                ))}
              </div>
            </section>

          </div>
        </div>

        {/* ============================================================
            RIGHT SIDEBAR
        ============================================================ */}
        <div style={{ width: 220, flexShrink: 0, borderLeft: "1px solid rgba(0,0,0,0.07)", background: "#fff", position: "sticky", top: 0, height: "100vh", overflowY: "auto", padding: "20px 16px" }}>

          {/* Project Info */}
          <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(0,0,0,0.38)", marginBottom: 8 }}>Project Info</div>
            <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)", lineHeight: 1.6 }}>
              <div>{PROJECT.address}</div>
              <div style={{ marginTop: 4 }}><span style={{ color: "rgba(0,0,0,0.35)" }}>Owner:</span> {PROJECT.owner}</div>
              <div><span style={{ color: "rgba(0,0,0,0.35)" }}>Architect:</span> {PROJECT.architect}</div>
              <div style={{ marginTop: 4 }}><span style={{ color: "rgba(0,0,0,0.35)" }}>Start:</span> {PROJECT.startDate}</div>
            </div>
          </div>

          {/* Nav Sections */}
          {NAV_SECTIONS.map((section, i) => (
            <div key={i} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(0,0,0,0.38)", marginBottom: 4 }}>{section.label}</div>
              {section.items.map((item, j) => (
                <div key={j} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "5px 8px", borderRadius: 4, fontSize: 13,
                  color: item.active ? "rgba(0,0,0,0.88)" : "rgba(0,0,0,0.55)",
                  fontWeight: item.active ? 500 : 400,
                  background: item.active ? "rgba(0,0,0,0.04)" : "transparent",
                  cursor: "pointer", transition: "all 0.1s",
                }} onMouseEnter={e => { if (!item.active) { e.currentTarget.style.background = "rgba(0,0,0,0.03)"; e.currentTarget.style.color = "rgba(0,0,0,0.8)" }}}
                   onMouseLeave={e => { if (!item.active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(0,0,0,0.55)" }}}>
                  <span>{item.name}</span>
                  {item.count != null && <span style={{ fontSize: 11, color: "rgba(0,0,0,0.3)", fontVariantNumeric: "tabular-nums" }}>{item.count}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

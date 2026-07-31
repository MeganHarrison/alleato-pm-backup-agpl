/**
 * Representative data for the AI Operating System page.
 *
 * This is the single place to swap static values for live queries. Counts,
 * agents, tools, roadmap and impact are illustrative for the executive
 * showcase; wire them to `../live-data.ts` (document_metadata / document_chunks
 * / agent telemetry) in a follow-up without touching the view layer.
 */

export type Health = "green" | "yellow" | "red";
export type ToolStatus = "live" | "beta" | "soon";
export type PipelineState = "queue" | "run" | "done" | "err";

/* ---- Section 1 — system status ---- */
export interface StatusCard {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
  trend?: boolean;
  ring?: number;
}

export const STATUS_CARDS: StatusCard[] = [
  { label: "Overall AI health", value: "98%", sub: "all agents nominal", highlight: true, ring: 98 },
  { label: "Agents running", value: "23", sub: "+2 vs last week", trend: true },
  { label: "Knowledge sources", value: "8", sub: "connectors live" },
  { label: "Documents indexed", value: "28,491", sub: "+312 today", trend: true },
  { label: "Vectors stored", value: "18.2M", sub: "embedded chunks" },
  { label: "Tasks generated today", value: "47", sub: "auto-extracted", highlight: true },
  { label: "Insights generated", value: "16", sub: "today" },
  { label: "Potential COs detected", value: "3", sub: "flagged for review", trend: true },
];

/* ---- Section 2a — daily ingestion ---- */
export interface SeriesDef {
  key: string;
  name: string;
  varName: string;
}

export const INGESTION_SERIES: SeriesDef[] = [
  { key: "s1", name: "Fireflies", varName: "--aios-s1" },
  { key: "s2", name: "Outlook", varName: "--aios-s2" },
  { key: "s3", name: "Teams", varName: "--aios-s3" },
  { key: "s4", name: "SharePoint", varName: "--aios-s4" },
  { key: "s5", name: "Documents", varName: "--aios-s5" },
  { key: "s6", name: "Drawings", varName: "--aios-s6" },
  { key: "s7", name: "Specs", varName: "--aios-s7" },
  { key: "s8", name: "Photos", varName: "--aios-s8" },
];

export interface IngestionDay {
  date: string;
  weekend: boolean;
  s1: number; s2: number; s3: number; s4: number;
  s5: number; s6: number; s7: number; s8: number;
  tasks: number;
}

const RAW_INGESTION: Array<[string, number, number, number, number, number, number, number, number, number, number]> = [
  ["Jul 5", 1, 2, 18, 12, 4, 9, 3, 2, 6, 9],
  ["Jul 6", 1, 1, 12, 8, 3, 5, 1, 1, 3, 6],
  ["Jul 7", 0, 9, 86, 64, 22, 31, 12, 9, 24, 41],
  ["Jul 8", 0, 11, 94, 71, 28, 36, 15, 11, 29, 48],
  ["Jul 9", 0, 8, 78, 59, 19, 28, 10, 8, 21, 39],
  ["Jul 10", 0, 12, 102, 77, 31, 40, 18, 13, 33, 52],
  ["Jul 11", 0, 10, 88, 68, 26, 34, 14, 11, 27, 44],
  ["Jul 12", 1, 3, 21, 14, 6, 9, 3, 2, 7, 11],
  ["Jul 13", 1, 2, 15, 9, 4, 6, 2, 1, 4, 7],
  ["Jul 14", 0, 13, 110, 82, 34, 44, 20, 15, 36, 57],
  ["Jul 15", 0, 9, 91, 70, 27, 35, 15, 11, 28, 46],
  ["Jul 16", 0, 12, 99, 74, 30, 39, 17, 12, 31, 50],
  ["Jul 17", 0, 14, 118, 88, 37, 48, 22, 16, 40, 61],
  ["Jul 18", 0, 8, 72, 55, 21, 29, 12, 9, 22, 38],
];

export const INGESTION_DATA: IngestionDay[] = RAW_INGESTION.map((r) => ({
  date: r[0], weekend: !!r[1],
  s1: r[2], s2: r[3], s3: r[4], s4: r[5], s5: r[6], s6: r[7], s7: r[8], s8: r[9],
  tasks: r[10],
}));

/* ---- Section 3 — live pipeline ---- */
export interface PipelineNode {
  name: string;
  state: PipelineState;
  count: string;
}
export interface PipelineLane {
  label: string;
  nodes: PipelineNode[];
}

export const PIPELINE_LANES: PipelineLane[] = [
  { label: "Sources", nodes: [
    { name: "Fireflies", state: "done", count: "1.2k" },
    { name: "Outlook", state: "run", count: "312" },
    { name: "Teams", state: "done", count: "884" },
    { name: "SharePoint", state: "done", count: "206" },
    { name: "Acumatica", state: "done", count: "54" },
  ]},
  { label: "Ground", nodes: [
    { name: "Supabase", state: "run", count: "queue 12" },
    { name: "Chunking", state: "run", count: "8" },
    { name: "Embedding", state: "run", count: "6" },
    { name: "Knowledge graph", state: "done", count: "—" },
  ]},
  { label: "Reason", nodes: [
    { name: "Deep Read Agent", state: "run", count: "3" },
    { name: "Reasoning Agent", state: "queue", count: "2" },
  ]},
  { label: "Outputs", nodes: [
    { name: "Project Intelligence", state: "done", count: "—" },
    { name: "Executive Brief", state: "done", count: "—" },
    { name: "Tasks", state: "run", count: "47" },
    { name: "Risks", state: "done", count: "9" },
    { name: "Change Events", state: "err", count: "1" },
    { name: "Progress Reports", state: "done", count: "—" },
    { name: "Meeting Prep", state: "queue", count: "—" },
  ]},
];

/* ---- Section 4 — company brain ---- */
export interface BrainType {
  key: string;
  label: string;
  varName: string;
  /** Literal fallback so the canvas always has a color even if the CSS var can't be read. */
  color: string;
  count: number;
  names: string[];
}

export const BRAIN_TYPES: BrainType[] = [
  { key: "project", label: "Projects", varName: "--aios-n-project", color: "hsl(215 76% 70%)", count: 6, names: ["Morrisville DC", "Aurora Cold Storage", "Pinnacle Logistics", "Redstone Fulfillment", "Cedar Ridge Warehouse", "Gateway Distribution"] },
  { key: "meeting", label: "Meetings", varName: "--aios-n-meeting", color: "hsl(211 80% 68%)", count: 11, names: ["OAC weekly", "Pre-con kickoff", "Design review", "Owner sync", "Field coordination", "Budget review"] },
  { key: "person", label: "People", varName: "--aios-n-person", color: "hsl(178 58% 54%)", count: 7, names: ["B. Reyes (PM)", "M. Chen (Supt)", "D. Okafor (PE)", "L. Nash (Est)", "K. Ruiz (VDC)"] },
  { key: "client", label: "Clients", varName: "--aios-n-client", color: "hsl(150 54% 56%)", count: 5, names: ["Prologis", "Lineage", "NFI", "GXO", "Americold"] },
  { key: "doc", label: "Documents", varName: "--aios-n-doc", color: "hsl(224 72% 74%)", count: 8, names: ["Subcontract exhibit", "RFP addendum", "Insurance cert", "Buyout log", "Bid tab"] },
  { key: "drawing", label: "Drawings", varName: "--aios-n-drawing", color: "hsl(338 78% 72%)", count: 6, names: ["A-201 plan", "S-500 details", "FP-100 sprinkler", "E-300 power", "M-400 mech"] },
  { key: "decision", label: "Decisions", varName: "--aios-n-decision", color: "hsl(250 80% 76%)", count: 5, names: ["Switch to ESFR", "Phase the slab pour", "Accept alt roofing"] },
  { key: "task", label: "Tasks", varName: "--aios-n-task", color: "hsl(190 68% 58%)", count: 9, names: ["Submit RFI-042", "Chase COI", "Update schedule", "Route submittal", "Send buyout"] },
  { key: "risk", label: "Risks", varName: "--aios-n-risk", color: "hsl(0 74% 66%)", count: 4, names: ["Long-lead switchgear", "Weather delay", "Permit hold"] },
  { key: "opportunity", label: "Opportunities", varName: "--aios-n-opp", color: "hsl(193 70% 60%)", count: 4, names: ["Add-alt canopy", "Early completion bonus", "Self-perform concrete"] },
];

/* ---- Section 5 — learning loop ---- */
export const LOOP_STAGES = [
  "Meeting", "AI analysis", "Task generated", "User feedback",
  "Correction", "Prompt updated", "Evaluation", "Model improved",
];

export interface LoopMetric { value: string; label: string; good?: boolean; }
export const LOOP_METRICS: LoopMetric[] = [
  { value: "94.2%", label: "Accuracy", good: true },
  { value: "1.8%", label: "Hallucination rate" },
  { value: "91%", label: "Positive feedback", good: true },
  { value: "312", label: "Corrections logged" },
  { value: "48", label: "Prompt revisions" },
  { value: "0.89", label: "Avg confidence" },
  { value: "73%", label: "Auto-approvals", good: true },
  { value: "27%", label: "Human overrides" },
];

/* ---- Section 6 — outputs ---- */
export interface OutputRow {
  name: string;
  icon: string;
  today: number;
  week: number;
  month: number;
}
export const OUTPUT_ROWS: OutputRow[] = [
  { name: "Executive Briefs", icon: "brief", today: 1, week: 7, month: 29 },
  { name: "Project Intelligence Reports", icon: "intel", today: 4, week: 23, month: 94 },
  { name: "Progress Reports", icon: "progress", today: 6, week: 31, month: 128 },
  { name: "Tasks", icon: "task", today: 47, week: 268, month: 1094 },
  { name: "Risks", icon: "risk", today: 9, week: 41, month: 163 },
  { name: "Decisions", icon: "decision", today: 12, week: 58, month: 214 },
  { name: "Change Events", icon: "co", today: 2, week: 11, month: 38 },
  { name: "Potential Change Orders", icon: "co", today: 3, week: 9, month: 27 },
  { name: "Project Summaries", icon: "summary", today: 5, week: 26, month: 101 },
  { name: "Meeting Prep Reports", icon: "prep", today: 8, week: 44, month: 172 },
  { name: "Documentation Updates", icon: "doc", today: 14, week: 79, month: 306 },
  { name: "Email Drafts", icon: "email", today: 22, week: 131, month: 512 },
];

/* ---- Section 7 — agent team ---- */
export interface Agent {
  name: string;
  health: Health;
  tasks: string;
  latency: string;
  tokens: string;
  lastRun: string;
}
export const CHIEF: Agent = { name: "Chief of Staff", health: "green", tasks: "11 agents", latency: "1.2s", tokens: "4.1M/day", lastRun: "orchestrating" };
export const AGENTS: Agent[] = [
  { name: "Meeting Agent", health: "green", tasks: "312", latency: "0.8s", tokens: "2.1M", lastRun: "2m ago" },
  { name: "Documentation Agent", health: "green", tasks: "208", latency: "1.1s", tokens: "1.4M", lastRun: "just now" },
  { name: "Estimating Agent", health: "yellow", tasks: "44", latency: "2.6s", tokens: "640k", lastRun: "14m ago" },
  { name: "Executive Brief Agent", health: "green", tasks: "29", latency: "1.4s", tokens: "890k", lastRun: "1h ago" },
  { name: "Accounting Agent", health: "green", tasks: "96", latency: "0.9s", tokens: "520k", lastRun: "5m ago" },
  { name: "Project Intelligence Agent", health: "green", tasks: "94", latency: "1.7s", tokens: "1.8M", lastRun: "just now" },
  { name: "QA Agent", health: "yellow", tasks: "61", latency: "3.1s", tokens: "410k", lastRun: "22m ago" },
  { name: "Drawing Review Agent", health: "green", tasks: "37", latency: "4.2s", tokens: "1.1M", lastRun: "8m ago" },
  { name: "Schedule Agent", health: "red", tasks: "5", latency: "—", tokens: "0", lastRun: "2d ago" },
  { name: "Email Agent", health: "green", tasks: "512", latency: "0.6s", tokens: "2.4M", lastRun: "just now" },
  { name: "Knowledge Agent", health: "green", tasks: "884", latency: "0.4s", tokens: "3.2M", lastRun: "just now" },
];

/* ---- Section 8 — tool library ---- */
export interface Tool {
  name: string;
  icon: string;
  tagline: string;
  status: ToolStatus;
  purpose: string;
  capabilities: string[];
  integrations: string[];
  usage: string;
  updated: string;
}
export interface ToolCategory { name: string; tools: Tool[]; }

export const TOOL_CATEGORIES: ToolCategory[] = [
  { name: "Executive Intelligence", tools: [
    { name: "Executive Daily Brief", icon: "brief", tagline: "The portfolio in one read", status: "live", purpose: "Each morning, a leadership-level synthesis of what needs attention across every project.", capabilities: ["Cross-project synthesis", "Decision queue", "Why-it-matters framing"], integrations: ["Fireflies", "Outlook", "Supabase"], usage: "29 briefs this month", updated: "Updated 2d ago" },
    { name: "Project Intelligence", icon: "intel", tagline: "Every project, understood", status: "live", purpose: "A living understanding of each project assembled from all its communications and documents.", capabilities: ["Per-project synthesis", "Status & momentum", "Open-item tracking"], integrations: ["All sources", "Knowledge graph"], usage: "94 reports this month", updated: "Updated 1d ago" },
    { name: "Accounting Dashboard", icon: "account", tagline: "The latest approved financial view", status: "beta", purpose: "Portfolio financial reporting sourced from the latest approved accounting import.", capabilities: ["Cash & WIP", "Over/under billings", "Portfolio rollup"], integrations: ["Acumatica", "Supabase"], usage: "manual imports", updated: "Updated 3d ago" },
    { name: "AI Meeting Prep", icon: "prep", tagline: "Walk in ready", status: "live", purpose: "Compiles relevant history, open items and likely questions before every meeting.", capabilities: ["Auto history pull", "Open-item recap", "Suggested questions"], integrations: ["Fireflies", "Outlook", "Calendar"], usage: "172 prep reports", updated: "Updated 4d ago" },
  ]},
  { name: "Project Management", tools: [
    { name: "AI Chat Assistant", icon: "chat", tagline: "Ask the company anything", status: "live", purpose: "A grounded assistant that answers from your projects with citations back to the source.", capabilities: ["Cited answers", "Cross-corpus retrieval", "Follow-up reasoning"], integrations: ["Supabase", "Knowledge graph"], usage: "2.3k queries/mo", updated: "Updated today" },
    { name: "AI Progress Reports", icon: "progress", tagline: "Status without the meeting", status: "live", purpose: "Assembles progress narratives per project, highlighting movement and blockers.", capabilities: ["Auto narrative", "Delta since last", "Blocker surfacing"], integrations: ["All sources"], usage: "128 reports/mo", updated: "Updated 1d ago" },
    { name: "AI Change Event Detector", icon: "detect", tagline: "Catch it before it costs", status: "beta", purpose: "Scans communications for language that signals a scope, cost or schedule change.", capabilities: ["Signal detection", "Evidence linking", "Early flagging"], integrations: ["Fireflies", "Outlook", "Teams"], usage: "3 flagged today", updated: "Updated 5d ago" },
    { name: "AI Record Creation", icon: "record", tagline: "Speak it into the system", status: "live", purpose: "Turns natural language and documents into structured records with fields pre-filled.", capabilities: ["NL → record", "Field validation", "Bulk create"], integrations: ["Supabase"], usage: "1.1k records/mo", updated: "Updated 2d ago" },
    { name: "AI Documentation", icon: "doc", tagline: "Docs that write themselves", status: "live", purpose: "Generates and maintains project documentation from the live corpus.", capabilities: ["Auto-generation", "Always current", "Templated output"], integrations: ["All sources"], usage: "306 updates/mo", updated: "Updated today" },
  ]},
  { name: "Estimating & Design", tools: [
    { name: "App Estimator", icon: "estimate", tagline: "Faster, defensible estimates", status: "beta", purpose: "Builds estimates from historical projects and current scope with comparable jobs.", capabilities: ["Historical comps", "Unit-cost anchoring", "Scope parsing"], integrations: ["Supabase", "Acumatica"], usage: "44 estimates/mo", updated: "Updated 1w ago" },
    { name: "AI Drawings / Submittal Reviews", icon: "drawing", tagline: "Read the set, flag conflicts", status: "beta", purpose: "Reviews drawings and submittals against requirements and prior revisions.", capabilities: ["OCR + parsing", "Conflict detection", "Revision compare"], integrations: ["SharePoint", "Supabase"], usage: "37 reviews/mo", updated: "Updated 6d ago" },
  ]},
  { name: "Automation & Data", tools: [
    { name: "Agent Team Orchestration", icon: "orchestra", tagline: "Specialists on a shared bus", status: "live", purpose: "A coordinator routes each job to the specialist agent best suited to it.", capabilities: ["Task routing", "Result merging", "Health monitoring"], integrations: ["All agents"], usage: "11 agents live", updated: "Updated today" },
    { name: "Company Knowledge Base", icon: "kb", tagline: "Institutional memory", status: "live", purpose: "Every meeting, email, document and decision, embedded and retrievable.", capabilities: ["Vector search", "Hybrid retrieval", "Access-scoped"], integrations: ["Supabase", "All sources"], usage: "18.2M vectors", updated: "Updated today" },
    { name: "Email Assistant", icon: "email", tagline: "Inbox that drafts back", status: "live", purpose: "Reads incoming email in project context and drafts grounded replies.", capabilities: ["Context drafting", "Action extraction", "Auto-filing"], integrations: ["Outlook", "Supabase"], usage: "512 drafts/mo", updated: "Updated 1d ago" },
  ]},
];

/* ---- Section 9 — roadmap kanban ---- */
export type Priority = "high" | "med" | "low";
export interface RoadmapCard {
  /** Stable unique id — used as the dnd-kit sortable id and React key so drag/drop
   * never depends on the (potentially duplicated / editable) display name. */
  id: string;
  name: string; owner: string; priority: Priority; progress: number; needs: string;
}
export interface RoadmapColumn { name: string; varName: string; cards: RoadmapCard[]; }

export const ROADMAP_COLUMNS: RoadmapColumn[] = [
  { name: "Planned", varName: "--aios-faint", cards: [
    { id: "rm-bid-board", name: "Bid Board", owner: "Reyes", priority: "med", progress: 8, needs: "Supabase schema" },
    { id: "rm-client-portal", name: "Client Portal", owner: "Chen", priority: "low", progress: 5, needs: "Auth + RLS" },
    { id: "rm-content-creator", name: "AI Content Creator", owner: "Nash", priority: "low", progress: 3, needs: "Brand kit" },
  ]},
  { name: "Designing", varName: "--aios-s3", cards: [
    { id: "rm-ai-schedule", name: "AI Schedule", owner: "Ruiz", priority: "high", progress: 22, needs: "P6 export" },
    { id: "rm-manhour", name: "Manhour Projections", owner: "Nash", priority: "med", progress: 18, needs: "Historical labor" },
    { id: "rm-sales-research", name: "Sales / Prospecting Research", owner: "Reyes", priority: "med", progress: 15, needs: "Lookalike model" },
    { id: "rm-pm-followup", name: "Project Manager Follow-up", owner: "Chen", priority: "high", progress: 30, needs: "Task engine" },
  ]},
  { name: "In Development", varName: "--aios-accent", cards: [
    { id: "rm-training", name: "Internal Training Platform", owner: "Okafor", priority: "med", progress: 55, needs: "Content pipeline" },
    { id: "rm-wip", name: "WIP Report Automation", owner: "Nash", priority: "high", progress: 68, needs: "Approved accounting data" },
    { id: "rm-psr", name: "PSR Report Automation", owner: "Reyes", priority: "med", progress: 47, needs: "Cost feed" },
    { id: "rm-field-logs", name: "Field Daily Logs (voice → log)", owner: "Chen", priority: "high", progress: 62, needs: "Whisper + agent" },
  ]},
  { name: "Coming Next", varName: "--aios-good", cards: [
    { id: "rm-closeout", name: "Closeout Automation", owner: "Ruiz", priority: "med", progress: 90, needs: "Sub follow-up" },
    { id: "rm-rfi-followup", name: "RFI Follow-up", owner: "Okafor", priority: "high", progress: 84, needs: "RFI engine" },
    { id: "rm-issue-pattern", name: "Issue Pattern Recognition", owner: "Nash", priority: "med", progress: 78, needs: "Historical issues" },
    { id: "rm-doc-intel", name: "Project Documentation Intelligence", owner: "Reyes", priority: "high", progress: 81, needs: "Doc corpus" },
  ]},
];

/* ---- Section 10 — impact ---- */
export interface ImpactMetric { value: string; label: string; accent?: boolean; }
export const IMPACT_METRICS: ImpactMetric[] = [
  { value: "1,840", label: "Hours saved this quarter", accent: true },
  { value: "4,210", label: "Tasks automated" },
  { value: "1,290", label: "Meetings analyzed" },
  { value: "38.4k", label: "Emails processed" },
  { value: "27", label: "Risks prevented early", accent: true },
  { value: "$2.1M", label: "Potential CO revenue surfaced", accent: true },
  { value: "19", label: "Schedule issues detected" },
  { value: "$680k", label: "Cost savings identified", accent: true },
  { value: "+31%", label: "Productivity gain" },
  { value: "1.2s", label: "Avg response time" },
  { value: "94%", label: "AI confidence" },
  { value: "18.9k", label: "Questions answered" },
];

/* ---- pillars ---- */
export interface Pillar { num: string; name: string; desc: string; }
export const PILLARS: Record<string, Pillar> = {
  observe: { num: "01", name: "Observe", desc: "Ingest everything the company knows — meetings, mail, chat, files — and watch the knowledge base grow." },
  understand: { num: "02", name: "Understand", desc: "Reason over the corpus, connect it into a living company brain, and get sharper from feedback." },
  act: { num: "03", name: "Act", desc: "Turn understanding into the deliverables the company runs on — briefs, intelligence, tasks, risks, decisions." },
  automate: { num: "04", name: "Automate", desc: "A team of specialist agents and a library of tools that do the work — orchestrated, monitored, on call." },
  evolve: { num: "05", name: "Evolve", desc: "Where the system is heading, and the measurable impact it is already delivering." },
};

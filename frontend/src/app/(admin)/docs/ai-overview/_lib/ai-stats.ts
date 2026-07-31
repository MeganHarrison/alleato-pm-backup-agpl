import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

const TOOLS_DIR = path.join(process.cwd(), "src", "lib", "ai", "tools");

const TOOL_PATTERN = /\b\w+:\s*tool\(\{/g;

export type AgentName =
  | "business-development"
  | "financial-analysis"
  | "marketing-strategy"
  | "operations-review"
  | "people-capacity"
  | "risk-review";
export type AgentStatus = "live" | "designed";

export interface AgentSummary {
  name: AgentName;
  label: string;
  description: string;
  status: AgentStatus;
  promptFile: string;
}

export interface ToolDomain {
  id: string;
  label: string;
  description: string;
  file: string;
  count: number;
}

const TOOL_DOMAINS: Omit<ToolDomain, "count">[] = [
  {
    id: "project",
    label: "Project intelligence",
    description: "Reads project details, budgets, risks, meetings, and documents.",
    file: "project-tools.ts",
  },
  {
    id: "financial",
    label: "Financial analysis",
    description: "Margin, cash flow, budget variance, and forecast queries used by the CFO.",
    file: "financial.ts",
  },
  {
    id: "operational",
    label: "Operational reads",
    description: "RFIs, submittals, change orders, daily logs, and operational status.",
    file: "operational.ts",
  },
  {
    id: "acumatica",
    label: "Acumatica ERP",
    description: "Live accounting data: vendors, GL accounts, journal entries, customer invoices.",
    file: "acumatica.ts",
  },
  {
    id: "intelligence",
    label: "Intelligence packets",
    description: "Composed briefings, executive summaries, and operating reads.",
    file: "intelligence-tools.ts",
  },
  {
    id: "schedule",
    label: "Schedule",
    description: "Project schedules, critical path, and milestone tracking.",
    file: "schedule-tools.ts",
  },
  {
    id: "forecast",
    label: "Forecast",
    description: "Forward-looking projections: burn rate, completion probability, margin trajectory.",
    file: "forecast-tools.ts",
  },
  {
    id: "outlook",
    label: "Outlook & Teams",
    description: "Drafting replies, inbox triage, and Teams escalation through the Microsoft EA.",
    file: "outlook-operations.ts",
  },
  {
    id: "actions",
    label: "Write actions",
    description: "Approval-gated mutations: creating tasks, sending drafts, marking items.",
    file: "action-tools.ts",
  },
  {
    id: "workspace",
    label: "Workspace & navigation",
    description: "Help search, app navigation, and feature discovery surfaces.",
    file: "workspace-tools.ts",
  },
  {
    id: "structured-queries",
    label: "Structured queries",
    description: "Typed SQL-style reads against Supabase tables.",
    file: "structured-queries.ts",
  },
  {
    id: "document-intelligence",
    label: "Document intelligence",
    description: "PDF/contract parsing, OCR, and structured extraction from uploaded files.",
    file: "document-intelligence.ts",
  },
  {
    id: "progress-report",
    label: "Progress reports",
    description: "Pulls and composes weekly/monthly project status reports.",
    file: "progress-report-tools.ts",
  },
  {
    id: "marketing",
    label: "Marketing & content",
    description: "Brand voice, content drafting, and outbound copy assistance.",
    file: "marketing.ts",
  },
  {
    id: "web-search",
    label: "Web search",
    description: "Public-web research used by the Research agent.",
    file: "web-search.ts",
  },
];

async function countToolsInFile(file: string): Promise<number> {
  try {
    const source = await fs.readFile(path.join(TOOLS_DIR, file), "utf8");
    const matches = source.match(TOOL_PATTERN);
    return matches?.length ?? 0;
  } catch {
    return 0;
  }
}

export async function loadToolDomains(): Promise<ToolDomain[]> {
  const counts = await Promise.all(
    TOOL_DOMAINS.map(async (domain) => ({
      ...domain,
      count: await countToolsInFile(domain.file),
    })),
  );
  return counts.filter((domain) => domain.count > 0);
}

export async function loadTotalToolCount(): Promise<number> {
  const domains = await loadToolDomains();
  return domains.reduce((sum, domain) => sum + domain.count, 0);
}

const EVE_SKILLS: ReadonlyArray<Omit<AgentSummary, "status">> = [
  {
    name: "business-development",
    label: "Business development",
    description: "Pipeline, pursuits, positioning, and growth analysis.",
    promptFile:
      "agents/alleato-assistant/agent/skills/business-development.md",
  },
  {
    name: "financial-analysis",
    label: "Financial analysis",
    description: "Margin, cash, budget, forecast, and financial risk analysis.",
    promptFile:
      "agents/alleato-assistant/agent/skills/financial-analysis.md",
  },
  {
    name: "marketing-strategy",
    label: "Marketing strategy",
    description: "Market signals, campaigns, content, and positioning analysis.",
    promptFile:
      "agents/alleato-assistant/agent/skills/marketing-strategy.md",
  },
  {
    name: "operations-review",
    label: "Operations review",
    description: "Delivery, schedule, commitments, RFIs, and execution analysis.",
    promptFile:
      "agents/alleato-assistant/agent/skills/operations-review.md",
  },
  {
    name: "people-capacity",
    label: "People and capacity",
    description: "Staffing, ownership, workload, and organizational capacity analysis.",
    promptFile:
      "agents/alleato-assistant/agent/skills/people-capacity.md",
  },
  {
    name: "risk-review",
    label: "Risk review",
    description: "Cross-project risk, evidence gaps, exposure, and mitigation analysis.",
    promptFile:
      "agents/alleato-assistant/agent/skills/risk-review.md",
  },
];

export async function loadAgents(): Promise<AgentSummary[]> {
  return EVE_SKILLS.map((skill) => ({ ...skill, status: "live" }));
}

export interface ModelEntry {
  role: string;
  model: string;
  why: string;
  inputCostPer1M: number | null;
  outputCostPer1M: number | null;
}

export function loadModelRegistry(): ModelEntry[] {
  return [
    {
      role: "Eve",
      model: "Configured by EVE_ALLEATO_ASSISTANT_MODEL",
      why: "One runtime applies the six executive skills and invokes authenticated production tools.",
      inputCostPer1M: null,
      outputCostPer1M: null,
    },
    {
      role: "Microsoft Executive Assistant",
      model: "gpt-5.4-mini",
      why: "Inbox/calendar operator work; latency matters more than depth.",
      inputCostPer1M: 0.25,
      outputCostPer1M: 1,
    },
    {
      role: "Synthesis & long-context reads",
      model: "gpt-4.1",
      why: "Reading large packet contexts before producing the final answer.",
      inputCostPer1M: 2,
      outputCostPer1M: 8,
    },
    {
      role: "Titles & micro-artifacts",
      model: "gpt-4.1-nano",
      why: "One-line tasks like naming chats: sub-cent per call.",
      inputCostPer1M: 0.1,
      outputCostPer1M: 0.4,
    },
    {
      role: "Embeddings",
      model: "text-embedding-3-large",
      why: "Vector store for RAG. 3072-dim halfvec, 109K+ chunks indexed.",
      inputCostPer1M: 0.13,
      outputCostPer1M: null,
    },
  ];
}

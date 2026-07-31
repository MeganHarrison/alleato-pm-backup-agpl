/**
 * C-Suite Multi-Agent Types
 *
 * Shared types for the Alleato AI executive team architecture.
 * Each agent is a domain specialist with its own system prompt,
 * tool set, and personality. The Strategist orchestrates them.
 *
 * See: docs/AI-CSUITE-ARCHITECTURE.md
 */

// ---------------------------------------------------------------------------
// Agent identifiers
// ---------------------------------------------------------------------------

export const AGENT_NAMES = {
  STRATEGIST: "strategist",
  CFO: "cfo",
  COO: "coo",
  CHRO: "chro",
  CRO: "cro",
  VP_BD: "vpbd",
  CMO: "cmo",
} as const;

export type AgentName = (typeof AGENT_NAMES)[keyof typeof AGENT_NAMES];

/** Human-readable labels shown in the UI */
export const AGENT_LABELS: Record<AgentName, string> = {
  strategist: "Chief Strategist",
  cfo: "CFO",
  coo: "COO",
  chro: "CHRO",
  cro: "CRO",
  vpbd: "VP of Business Development",
  cmo: "CMO",
};

/** Short descriptions for the agent selector UI */
export const AGENT_DESCRIPTIONS: Record<AgentName, string> = {
  strategist: "Cross-functional strategy and synthesis",
  cfo: "Financial analysis, budgets, cash flow, and margin",
  coo: "Operations, scheduling, and project execution",
  chro: "People, capacity, and team health",
  cro: "Risk, compliance, contracts, and claims",
  vpbd: "Growth, client relationships, and market positioning",
  cmo: "Brand, content strategy, campaigns, and marketing execution",
};

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

/** The Strategist's decision about which agent(s) to consult. */
export interface RoutingDecision {
  /** The agents to consult, in order of relevance. */
  agents: AgentName[];
  /** Brief rationale for the routing (used for debugging / transparency). */
  rationale: string;
  /** Whether this requires cross-functional synthesis from the Strategist. */
  requiresSynthesis: boolean;
  /** The original user query that triggered the routing. */
  query: string;
}

// ---------------------------------------------------------------------------
// Agent responses
// ---------------------------------------------------------------------------

/** Confidence level for an agent's assessment. */
export type ConfidenceLevel = "high" | "medium" | "low";

/** A single alert or concern surfaced by an agent. */
export interface AgentAlert {
  /** Severity: critical needs immediate action, warning needs attention soon. */
  severity: "critical" | "warning" | "info";
  /** Short, specific description of the alert. */
  message: string;
  /** The project this alert relates to, if applicable. */
  projectId?: number;
  /** The project name for display. */
  projectName?: string;
}

/** The structured response from a domain agent. */
export interface AgentResponse {
  /** Which agent produced this response. */
  agent: AgentName;
  /** The full analysis text (markdown). */
  content: string;
  /** How confident the agent is in this analysis. */
  confidence: ConfidenceLevel;
  /** Proactive alerts surfaced during analysis. */
  alerts: AgentAlert[];
  /** Which tools the agent called to produce this response. */
  toolsCalled: string[];
  /** Processing time in milliseconds (for performance monitoring). */
  durationMs?: number;
}

/** The Strategist's final synthesized response to the user. */
export interface SynthesizedResponse {
  /** The final response text shown to the user (markdown). */
  content: string;
  /** Which agents contributed to this response. */
  contributors: AgentName[];
  /** The individual agent responses (for transparency / drill-down). */
  agentResponses: AgentResponse[];
  /** The routing decision that produced this response. */
  routing: RoutingDecision;
  /** Aggregated alerts from all agents, sorted by severity. */
  alerts: AgentAlert[];
}

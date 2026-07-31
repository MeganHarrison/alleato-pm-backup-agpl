/**
 * C-Suite Orchestrator
 *
 * Routes user messages to domain-specialist agents (CFO, COO, etc.),
 * lets each specialist call its own tools, and returns the specialist's
 * analysis for the Strategist to synthesize.
 *
 * The orchestrator is designed to be called FROM the existing chat route's
 * Strategist agent via "consult" tools. It is NOT a replacement for the
 * chat route — it is the engine behind `consultCFO`, `consultCOO`, etc.
 *
 * Architecture:
 *   Chat Route → streamText(Strategist prompt + consult tools)
 *                   └─ consultCFO tool → orchestrator.consultAgent("cfo", question)
 *                                          └─ ToolLoopAgent(CFO prompt + financial tools)
 *
 * See: docs/AI-CSUITE-ARCHITECTURE.md
 */

import { ToolLoopAgent, isStepCount, tool, type ModelMessage, type ToolSet } from "ai";
import { z } from "zod";
import { getLanguageModel } from "@/lib/ai/providers";
import {
  createProjectTools,
  type CreateProjectToolsOptions,
} from "@/lib/ai/tools/project-tools";
import { createToolContext } from "@/lib/ai/tools/tool-context";
import {
  microsoftAssistantBackendUrl,
  microsoftAssistantAdminApiKey,
  defaultMicrosoftMailbox,
} from "@/lib/ai/microsoft-backend-config";
import {
  createWebSearchTools,
  type CreateWebSearchToolsOptions,
} from "@/lib/ai/tools/web-search";
import {
  createActionTools,
  type ActionToolsOptions,
} from "@/lib/ai/tools/action-tools";
import {
  createFeatureRequestTools,
  type FeatureRequestToolsOptions,
} from "@/lib/ai/tools/feature-request-tools";
import {
  createMarketingTools,
  type MarketingToolsOptions,
} from "@/lib/ai/tools/marketing";
import {
  createProgressReportTools,
  type ProgressReportToolsOptions,
} from "@/lib/ai/tools/progress-report-tools";
import { createWorkspaceTools } from "@/lib/ai/tools/workspace-tools";
import {
  createStructuredOutputTools,
  type CreateStructuredOutputToolsOptions,
} from "@/lib/ai/tools/structured-output";
import { createDocumentIntelligenceTools } from "@/lib/ai/tools/document-intelligence";
import { createIntelligenceTools } from "@/lib/ai/tools/intelligence-tools";
import { createExecutiveBriefTools } from "@/lib/ai/tools/executive-brief-tools";
import { createAssistantSelfInspectionTools } from "@/lib/ai/assistant-self-knowledge";
import {
  AI_ASSISTANT_CHAT_WORKFLOW_ID,
  filterRegisteredToolSet,
  toolVisibilityForFactory,
  type AssistantToolVisibility,
} from "@/lib/ai/tool-registry";
import { buildSkillInjectionContext } from "@/lib/ai/services/skill-injection-service";
import { strategistSystemPrompt } from "@/lib/ai/agents/strategist";
import { soul } from "@/lib/ai/soul";
import { identity } from "@/lib/ai/identity";
import { I_DONT_KNOW_REFLEX_PROMPT } from "@/lib/ai/persona-and-memory";
import { cfoSystemPrompt } from "@/lib/ai/agents/cfo";
import { cooSystemPrompt } from "@/lib/ai/agents/coo";
import { croSystemPrompt } from "@/lib/ai/agents/cro";
import { chroSystemPrompt } from "@/lib/ai/agents/chro";
import { vpbdSystemPrompt } from "@/lib/ai/agents/vpbd";
import { cmoSystemPrompt } from "@/lib/ai/agents/cmo";
import type {
  AgentName,
  AgentResponse,
  ConfidenceLevel,
} from "@/lib/ai/agents/types";
import {
  directResearchToolNames,
  type ChatTurnResearchContract,
} from "@/lib/ai/retrieval/research-contract";

type StrategistToolOptions = CreateProjectToolsOptions &
  CreateWebSearchToolsOptions &
  ActionToolsOptions &
  FeatureRequestToolsOptions &
  MarketingToolsOptions &
  ProgressReportToolsOptions &
  CreateStructuredOutputToolsOptions & {
  sessionId?: string;
  includeActionTools?: boolean;
  researchContract?: ChatTurnResearchContract;
};

const MICROSOFT_OPERATOR_TOOL_NAMES = new Set([
  "getRecentEmails",
  "searchEmails",
  "searchTeamsMessages",
  "searchExternalDocuments",
  "readOutlookEmailThread",
  "getOutlookOperationalStatus",
  "draftOutlookEmail",
  "createOutlookCalendarInvite",
  "sendTeamsMessage",
]);

function omitMicrosoftOperatorTools(
  tools: ToolSet,
  allowedToolNames: ReadonlySet<string> = new Set(),
): ToolSet {
  return Object.fromEntries(
    Object.entries(tools).filter(
      ([name]) =>
        !MICROSOFT_OPERATOR_TOOL_NAMES.has(name) || allowedToolNames.has(name),
    ),
  ) as ToolSet;
}

function registeredProjectTools(
  userId: string,
  options: CreateProjectToolsOptions,
  policy: RegistryToolPolicy = {},
  onVisibility?: ToolVisibilityRecorder,
): ToolSet {
  return registeredFactoryTools({
    tools: createProjectTools(userId, options),
    factoryModulePath: "frontend/src/lib/ai/tools/project-tools.ts",
    policy,
    onVisibility,
  });
}

function registeredActionTools(
  userId: string,
  options: ActionToolsOptions,
  policy: RegistryToolPolicy = {},
  onVisibility?: ToolVisibilityRecorder,
): ToolSet {
  return registeredFactoryTools({
    tools: createActionTools(userId, options),
    factoryModulePath: "frontend/src/lib/ai/tools/action-tools.ts",
    policy,
    onVisibility,
  });
}

type RegistryToolPolicy = NonNullable<
  Parameters<typeof filterRegisteredToolSet>[0]["policy"]
>;

type ToolVisibilitySnapshot = AssistantToolVisibility & {
  factoryModulePath: string;
};

type ToolVisibilityRecorder = (snapshot: ToolVisibilitySnapshot) => void;

function registeredFactoryTools(input: {
  tools: ToolSet;
  factoryModulePath: string;
  policy?: RegistryToolPolicy;
  onVisibility?: ToolVisibilityRecorder;
}): ToolSet {
  input.onVisibility?.({
    factoryModulePath: input.factoryModulePath,
    ...toolVisibilityForFactory({
      workflowId: AI_ASSISTANT_CHAT_WORKFLOW_ID,
      factoryModulePath: input.factoryModulePath,
      policy: input.policy,
    }),
  });

  return filterRegisteredToolSet({
    tools: input.tools,
    workflowId: AI_ASSISTANT_CHAT_WORKFLOW_ID,
    factoryModulePath: input.factoryModulePath,
    policy: input.policy,
  });
}

async function callMicrosoftExecutiveAssistant(input: {
  userId: string;
  sessionId?: string;
  question: string;
  context?: string;
  mailboxUserId?: string;
  projectId?: number;
  approvedSkillContext?: string;
}) {
  const response = await fetch(
    `${microsoftAssistantBackendUrl()}/api/intelligence/microsoft-executive-assistant`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Admin-Api-Key": microsoftAssistantAdminApiKey(),
      },
      body: JSON.stringify({
        userId: input.userId,
        sessionId: input.sessionId,
        prompt: input.context
          ? `Context from the Chief Strategist:\n${input.context}\n\nRequest:\n${input.question}`
          : input.question,
        mailboxUserId: input.mailboxUserId ?? defaultMicrosoftMailbox(),
        projectId: input.projectId,
        approvedSkillContext: input.approvedSkillContext || undefined,
        trigger: "strategist_delegation",
      }),
    },
  );

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      success: false,
      error:
        typeof body?.detail === "string"
          ? body.detail
          : body?.detail?.answer ??
            `Microsoft Executive Assistant failed with HTTP ${response.status}.`,
      details: body?.detail ?? body,
    };
  }
  return { success: true, ...body };
}

// ---------------------------------------------------------------------------
// Agent Registry
// ---------------------------------------------------------------------------

/** Configuration for a single domain-specialist agent. */
export interface AgentConfig {
  /** Human-readable name (e.g. "CFO"). */
  name: string;
  /** Emoji icon used in Council Mode responses (e.g. "💰"). */
  icon: string;
  /** The agent's full system prompt defining personality and expertise. */
  systemPrompt: string;
  /** The AI Gateway model ID to use for this agent. */
  modelId: string;
  /** A short description of the agent's domain, used for routing hints. */
  description: string;
  /**
   * Keywords that suggest a user question falls in this agent's domain.
   * Used by the keyword-based router. Case-insensitive.
   */
  triggerKeywords: string[];
  /**
   * Factory that creates the agent's tool set.
   * Receives the userId so tools can scope data access.
   * Optionally receives onTrace so sub-agent tool calls are reported
   * back to the top-level trace collector.
   * Omit to use the default createProjectTools(userId, options).
   */
  createTools?: (
    userId: string,
    options?: StrategistToolOptions,
  ) => ToolSet;
}

// ---------------------------------------------------------------------------
// The registry itself
// ---------------------------------------------------------------------------

/**
 * Registry of all domain-specialist agents.
 *
 * Adding a new agent is a 3-step process:
 *   1. Add its config to this object.
 *   2. Add a `consultXxx` tool in `createStrategistTools`.
 *   3. Add the agent name to `AGENT_NAMES` in `agents/types.ts`.
 *
 * Every specialist must retain web-search access through
 * createDefaultSpecialistTools. Regulatory, market, client, and jurisdictional
 * questions often require current outside sources even when the primary domain
 * is finance, operations, risk, people, BD, or marketing.
 */
export const agentRegistry: Record<string, AgentConfig> = {
  cfo: {
    name: "CFO",
    icon: "💰",
    systemPrompt: cfoSystemPrompt,
    modelId: "openai/gpt-5.4-mini",
    description:
      "Financial analysis, budgets, cash flow, margins, contracts, change orders, invoicing, retention",
    triggerKeywords: [
      // Core financial terms
      "budget",
      "cost",
      "margin",
      "cash flow",
      "cashflow",
      "invoice",
      "invoicing",
      "payment",
      "contract",
      "change order",
      "change event",
      "retention",
      "billing",
      "revenue",
      "profit",
      "loss",
      "expense",
      "expenditure",
      "financial",
      "finance",
      "money",
      "dollar",
      "spend",
      "spending",
      "pay app",
      "pay application",
      "commitment",
      "committed",
      "uncommitted",
      "exposure",
      "receivable",
      "payable",
      "direct cost",
      "cost code",
      "line item",
      "original budget",
      "revised budget",
      "budget growth",
      "overrun",
      "under budget",
      "over budget",
      "collection",
      "owe",
      "owes",
      "owed",
      "how much",
      "total value",
      "forecast",
      "variance",
      "budget vs actual",
      "cost to complete",
      "cost at completion",
      "percentage of completion",
      // Acumatica ERP / live accounting data
      "acumatica",
      "erp",
      "ap aging",
      "ar aging",
      "accounts payable",
      "accounts receivable",
      "cash position",
      "vendor spend",
      "purchase order",
      "gl journal",
      "general ledger",
      "journal entry",
      "outstanding bill",
      "outstanding invoice",
      "overdue payable",
      "overdue receivable",
      "live accounting",
      "accounting system",
      "net cash",
      "inflow",
      "outflow",
      "project budget",
      "project list",
    ],
  },

  coo: {
    name: "COO",
    icon: "🏗️",
    systemPrompt: cooSystemPrompt,
    modelId: "openai/gpt-5.4-mini",
    description:
      "Operations, scheduling, procurement velocity, RFIs, submittals, subcontractor performance, action item accountability, field execution",
    triggerKeywords: [
      "schedule",
      "timeline",
      "milestone",
      "delay",
      "delayed",
      "overdue",
      "critical path",
      "task",
      "tasks",
      "dependency",
      "dependencies",
      "behind",
      "on track",
      "completion",
      "percent complete",
      "rfi",
      "rfis",
      "request for information",
      "submittal",
      "submittals",
      "shop drawing",
      "material submission",
      "approval",
      "ball in court",
      "vendor",
      "subcontractor",
      "sub",
      "subs",
      "trade",
      "trades",
      "trade partner",
      "procurement",
      "action item",
      "action items",
      "follow up",
      "accountable",
      "accountability",
      "who owns",
      "who is responsible",
      "responsible party",
      "open items",
      "outstanding items",
      "field",
      "site",
      "on site",
      "construction progress",
      "work in place",
      "execution",
      "operational",
      "operations",
      "oac meeting",
      "owner meeting",
      "meeting prep",
      "what needs attention",
      "what is overdue",
      "what is blocking",
      "blocking",
      "blocker",
      "bottleneck",
    ],
  },

  cro: {
    name: "CRO",
    icon: "🛡️",
    systemPrompt: croSystemPrompt,
    modelId: "openai/gpt-5.4-mini",
    description:
      "Risk identification, financial exposure, contract risk, claim signals, procurement risk, and portfolio-level risk patterns",
    triggerKeywords: [
      "risk",
      "risks",
      "risky",
      "at risk",
      "exposure",
      "claim",
      "claims",
      "dispute",
      "disputed",
      "contested",
      "unresolved",
      "warning",
      "critical",
      "red flag",
      "flags",
      "flagged",
      "concern",
      "concerns",
      "issue",
      "issues",
      "problem",
      "problems",
      "liability",
      "notice",
      "reservation of rights",
      "contract risk",
      "compliance",
      "scope creep",
      "unpriced",
      "unquantified",
      "change event",
      "change events",
      "orphaned",
      "missing commitment",
      "budget overrun",
      "overrun",
      "blow",
      "blown",
      "contingency",
      "liquidated damages",
      "ld",
      "substantial completion",
      "delay damages",
      "what could go wrong",
      "worst case",
      "downside",
      "portfolio risk",
      "risk dashboard",
      "risk scan",
      "risk assessment",
      "risk profile",
      "risk signal",
      "risk signals",
    ],
  },

  chro: {
    name: "CHRO",
    icon: "👥",
    systemPrompt: chroSystemPrompt,
    modelId: "openai/gpt-5.4-mini",
    description:
      "People and capacity: team composition, staffing gaps, action item accountability, subcontractor relationships, institutional knowledge, and lessons learned",
    triggerKeywords: [
      // Team / people
      "who is on",
      "who's on",
      "team",
      "staff",
      "staffing",
      "roster",
      "directory",
      "personnel",
      "person",
      "people",
      "who handles",
      "who owns",
      "who is responsible",
      "responsible party",
      "contact",
      "contacts",
      "reach out",
      "pm",
      "project manager",
      "superintendent",
      "super",
      "owner rep",
      "architect",
      // Capacity
      "capacity",
      "overloaded",
      "stretched",
      "bandwidth",
      "availability",
      "workload",
      "too many projects",
      "spread thin",
      // Accountability
      "accountable",
      "accountability",
      "follow through",
      "follow-through",
      "action item owner",
      "who is accountable",
      // Knowledge
      "lesson learned",
      "lessons learned",
      "best practice",
      "best practices",
      "institutional knowledge",
      "what have we learned",
      "knowledge base",
      "company knowledge",
      "certification",
      "capability",
      "capabilities",
      // Subcontractor / vendor relationships
      "sub relationship",
      "trade relationship",
      "vendor relationship",
      // Org / roles
      "org",
      "org structure",
      "role",
      "roles",
      "hire",
      "hiring",
      "onboard",
      "offboard",
      "departure",
      "new hire",
      "transition",
      // Person-specific sentiment / concerns
      "stress",
      "stresses",
      "stressed",
      "worried",
      "worries",
      "concern",
      "concerns",
      "frustrated",
      "frustration",
      "thinks about",
      "feels about",
      "what does",
      "how does",
      "opinion",
    ],
  },

  vpbd: {
    name: "VP of Business Development",
    icon: "🤝",
    systemPrompt: vpbdSystemPrompt,
    modelId: "openai/gpt-5.4-mini",
    description:
      "Pipeline, client relationships, revenue trajectory, competitive positioning, company differentiators, past project references, and proposal preparation",
    triggerKeywords: [
      // Pipeline
      "pipeline",
      "pursuit",
      "pursuits",
      "bid",
      "bids",
      "bidding",
      "proposal",
      "proposals",
      "estimating",
      "estimate",
      "new work",
      "new project",
      "win",
      "winning",
      "won",
      "lost",
      "award",
      "awarded",
      "rfp",
      "rfq",
      "request for proposal",
      "go no go",
      "go/no-go",
      "pursue",
      // Client relationships
      "client",
      "clients",
      "owner relationship",
      "client relationship",
      "repeat work",
      "repeat client",
      "relationship",
      "business development",
      "bd",
      "business dev",
      "account",
      // Revenue / growth
      "revenue",
      "growth",
      "backlog",
      "future work",
      "revenue gap",
      "revenue horizon",
      "pipeline value",
      // Competitive / positioning
      "differentiator",
      "differentiators",
      "competitive",
      "competition",
      "competitors",
      "what makes us different",
      "our strengths",
      "positioning",
      "brand",
      // References / past performance
      "past project",
      "past performance",
      "reference",
      "references",
      "case study",
      "case studies",
      "portfolio",
      "track record",
      "similar project",
      "comparable project",
      // BD meeting prep
      "bd meeting",
      "client meeting",
      "interview",
      "pitch",
      "presentation",
    ],
    createTools: (userId: string, options?: StrategistToolOptions) => {
      // VP BD gets the full project tools which include:
      // getPortfolioOverview (with all phase filters), getFinancialAnalysis,
      // getCompanyKnowledge, semanticSearch, searchMeetingsByTopic,
      // getMeetingDetails, getProjectDetails, getProjectRiskAnalysis,
      // getHistoricalTrends, and getCrossProjectComparison.
      // Plus web search for competitive/market intelligence.
      return {
        ...registeredProjectTools(userId, options ?? {}, {
          actorMode: "user_delegated",
          allowWrites: false,
          allowDelivery: false,
        }),
        ...registeredFactoryTools({
          tools: createWebSearchTools(options),
          factoryModulePath: "frontend/src/lib/ai/tools/web-search.ts",
          policy: {
            actorMode: "user_delegated",
            allowWrites: false,
            allowDelivery: false,
          },
        }),
      } as ToolSet; // ToolSet is an index signature — spread inference requires explicit cast
    },
  },

  cmo: {
    name: "CMO",
    icon: "📣",
    systemPrompt: cmoSystemPrompt,
    modelId: "openai/gpt-5.4-mini",
    description:
      "Brand, reputation, content calendars, campaigns, thought leadership, website/newsletter content, case studies, testimonials, and marketing performance",
    triggerKeywords: [
      "brand",
      "marketing",
      "content",
      "content calendar",
      "campaign",
      "social",
      "linkedin",
      "thought leadership",
      "website",
      "case study",
      "case studies",
      "testimonial",
      "testimonials",
      "newsletter",
      "audience",
      "positioning",
      "reputation",
      "story",
      "publish",
      "announcement",
      "event",
      "award",
    ],
    createTools: (userId: string, options?: StrategistToolOptions) => {
      return {
        ...registeredFactoryTools({
          tools: createMarketingTools(userId, options),
          factoryModulePath: "frontend/src/lib/ai/tools/marketing.ts",
          policy: {
            actorMode: "user_delegated",
            allowWrites: true,
            allowDelivery: false,
          },
        }),
        ...registeredProjectTools(userId, options ?? {}, {
          actorMode: "user_delegated",
          allowWrites: false,
          allowDelivery: false,
        }),
        ...registeredFactoryTools({
          tools: createWebSearchTools(options),
          factoryModulePath: "frontend/src/lib/ai/tools/web-search.ts",
          policy: {
            actorMode: "user_delegated",
            allowWrites: false,
            allowDelivery: false,
          },
        }),
        ...registeredFactoryTools({
          tools: createDocumentIntelligenceTools(userId, options),
          factoryModulePath:
            "frontend/src/lib/ai/tools/document-intelligence.ts",
          policy: {
            actorMode: "user_delegated",
            allowWrites: false,
            allowDelivery: false,
          },
        }),
      } as ToolSet;
    },
  },
};

function createDefaultSpecialistTools(
  userId: string,
  options?: StrategistToolOptions,
): ToolSet {
  return {
    ...registeredProjectTools(userId, options ?? {}, {
      actorMode: "user_delegated",
      allowWrites: false,
      allowDelivery: false,
    }),
    ...registeredFactoryTools({
      tools: createWebSearchTools(options),
      factoryModulePath: "frontend/src/lib/ai/tools/web-search.ts",
      policy: {
        actorMode: "user_delegated",
        allowWrites: false,
        allowDelivery: false,
      },
    }),
    ...registeredFactoryTools({
      tools: createIntelligenceTools(options),
      factoryModulePath: "frontend/src/lib/ai/tools/intelligence-tools.ts",
      policy: {
        actorMode: "user_delegated",
        allowWrites: false,
        allowDelivery: false,
      },
    }),
  } as ToolSet;
}

export function createSpecialistAgentTools(
  agentId: string,
  userId: string,
  options?: StrategistToolOptions,
): ToolSet {
  const config = agentRegistry[agentId];
  const domainTools = config?.createTools
    ? config.createTools(userId, options)
    : createDefaultSpecialistTools(userId, options);

  return {
    ...domainTools,
    ...registeredFactoryTools({
      tools: createWebSearchTools(options),
      factoryModulePath: "frontend/src/lib/ai/tools/web-search.ts",
      policy: {
        actorMode: "user_delegated",
        allowWrites: false,
        allowDelivery: false,
      },
    }),
  } as ToolSet;
}

const SPECIALIST_WEB_SEARCH_INSTRUCTIONS = `

## External Web Research

You have access to live web-search tools: searchWeb, researchCompany, and searchConstructionMarket. Use them whenever the user asks about current outside knowledge, local or jurisdictional requirements, regulations, market conditions, competitors, companies, PUD/zoning requirements, or anything that may not live in Alleato's first-party project data. Cite web source URLs or source titles returned by the tool. If web search is unavailable or fails, say that directly and continue only with clearly labeled internal-data limits.`;

// ---------------------------------------------------------------------------
// Conversation history forwarding
// ---------------------------------------------------------------------------

/**
 * Maximum number of recent user/assistant turns forwarded to a sub-agent.
 *
 * Bounded to control sub-agent prompt size and token spend. Increase only if
 * follow-up coherence regressions appear; raising this directly multiplies
 * sub-agent input tokens.
 */
const SUB_AGENT_HISTORY_TURNS = 6;

/**
 * Reduces the Strategist's calling messages into a clean user/assistant
 * transcript suitable for a sub-agent. Strips tool-call and tool-result
 * messages — the sub-agent has its own tools and must not be confused by
 * tool calls it did not make.
 */
function extractConversationHistory(
  messages: ModelMessage[] | undefined,
  agentId: string,
): ModelMessage[] {
  if (!messages || messages.length === 0) return [];

  try {
    const textTurns: ModelMessage[] = [];

    for (const message of messages) {
      if (message.role !== "user" && message.role !== "assistant") continue;

      const text =
        typeof message.content === "string"
          ? message.content
          : message.content
              .filter((part) => part.type === "text")
              .map((part) => (part as { text: string }).text)
              .join("\n")
              .trim();

      if (!text) continue;

      textTurns.push({ role: message.role, content: text } as ModelMessage);
    }

    // Drop the trailing user turn — it is the question we already pass
    // explicitly to the sub-agent, including it would duplicate it.
    if (textTurns.length > 0 && textTurns[textTurns.length - 1].role === "user") {
      textTurns.pop();
    }

    return textTurns.slice(-SUB_AGENT_HISTORY_TURNS);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "unknown error";
    // Rule 1: do not silently swallow. Log and proceed with empty history
    // rather than crashing the sub-agent consultation.
    console.error(
      `[orchestrator] Failed to extract conversation history for ${agentId}:`,
      errorMessage,
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// Agent Execution
// ---------------------------------------------------------------------------

/**
 * Consults a single domain specialist agent.
 *
 * This creates a separate AI call with the agent's own system prompt and
 * tools, lets the agent reason and call tools, then returns its analysis.
 *
 * @param agentId - The agent to consult (e.g. "cfo")
 * @param question - The question or task for the agent
 * @param userId - The authenticated user's ID (for tool data scoping)
 * @param context - Optional additional context from the Strategist
 * @returns The agent's structured response
 */
export async function consultAgent(
  agentId: string,
  question: string,
  userId: string,
  context?: string,
  options?: {
    onTrace?: (trace: Record<string, unknown>) => void;
    pinnedProjectId?: number;
    conversationHistory?: ModelMessage[];
  },
): Promise<AgentResponse> {
  const config = agentRegistry[agentId];
  if (!config) {
    return {
      agent: agentId as AgentName,
      content: `Agent "${agentId}" is not registered. Available agents: ${Object.keys(agentRegistry).join(", ")}`,
      confidence: "low",
      alerts: [],
      toolsCalled: [],
    };
  }

  const startTime = Date.now();
  const toolsCalled: string[] = [];

  // Build the agent's tools with tracing — thread onTrace so sub-agent
  // tool calls are reported back to the top-level trace collector
  const toolOptions = {
    onTrace: options?.onTrace,
    pinnedProjectId: options?.pinnedProjectId,
  };
  const agentTools = createSpecialistAgentTools(agentId, userId, toolOptions);

  const userMessage = context
    ? `Context from the Chief Strategist:\n${context}\n\nQuestion:\n${question}`
    : question;

  try {
    const agent = new ToolLoopAgent({
      model: getLanguageModel(config.modelId),
      instructions: `${config.systemPrompt}${SPECIALIST_WEB_SEARCH_INSTRUCTIONS}`,
      tools: agentTools,
      stopWhen: isStepCount(5),
    });

    const SUB_AGENT_TIMEOUT_MS = Number(
      process.env.SUB_AGENT_TIMEOUT_MS ?? 15_000,
    );
    const history = options?.conversationHistory ?? [];
    const generatePromise = agent.generate({
      messages: [
        ...history,
        { role: "user", content: userMessage },
      ],
    });
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(
              `Sub-agent ${agentId} exceeded ${SUB_AGENT_TIMEOUT_MS}ms timeout`,
            ),
          ),
        SUB_AGENT_TIMEOUT_MS,
      );
    });
    const result = await Promise.race([generatePromise, timeoutPromise]);

    // Extract which tools were called from the steps
    for (const step of result.steps) {
      for (const call of step.toolCalls) {
        if (!toolsCalled.includes(call.toolName)) {
          toolsCalled.push(call.toolName);
        }
      }
    }

    // Determine confidence based on whether tools returned data
    let confidence: ConfidenceLevel = "high";
    if (toolsCalled.length === 0) {
      confidence = "medium"; // Agent answered without data — less reliable
    }

    const durationMs = Date.now() - startTime;

    return {
      agent: agentId as AgentName,
      content: result.text,
      confidence,
      alerts: [], // Agents will populate alerts in future iterations
      toolsCalled,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return {
      agent: agentId as AgentName,
      content: `The ${config.name} encountered an error while analyzing: ${errorMessage}`,
      confidence: "low",
      alerts: [
        {
          severity: "warning",
          message: `${config.name} agent error: ${errorMessage}`,
        },
      ],
      toolsCalled,
      durationMs,
    };
  }
}

/**
 * Consults multiple agents in parallel and returns all responses.
 */
export async function consultAgents(
  agentIds: string[],
  question: string,
  userId: string,
  context?: string,
  options?: {
    onTrace?: (trace: Record<string, unknown>) => void;
    pinnedProjectId?: number;
    conversationHistory?: ModelMessage[];
  },
): Promise<AgentResponse[]> {
  const promises = agentIds.map((id) =>
    consultAgent(id, question, userId, context, options),
  );
  return Promise.all(promises);
}

// ---------------------------------------------------------------------------
// Strategist Tools (consult* tools used by the Strategist agent)
// ---------------------------------------------------------------------------

/**
 * Creates the tools available to the Strategist agent.
 *
 * These are the "consult" tools — each one delegates to a domain specialist.
 * The Strategist's streamText call uses these tools the same way a regular
 * agent uses data-fetching tools.
 *
 * Also includes the user's regular project tools so the Strategist can
 * answer questions directly when no specialist is needed.
 */
function makeConsultTool(
  agentId: string,
  toolDescription: string,
  questionDescribe: string,
  contextRole: string,
  userId: string,
  options: { onTrace?: (trace: Record<string, unknown>) => void; pinnedProjectId?: number },
) {
  return tool({
    description: toolDescription,
    inputSchema: z.object({
      question: z.string().describe(questionDescribe),
      context: z
        .string()
        .optional()
        .describe(
          `Optional additional context to help the ${contextRole} understand the broader question being answered.`,
        ),
    }),
    execute: async (
      { question, context },
      { messages } = { messages: [], toolCallId: "", context: {} },
    ) => {
      const conversationHistory = extractConversationHistory(messages, agentId);
      const response = await consultAgent(agentId, question, userId, context, {
        onTrace: options.onTrace,
        pinnedProjectId: options.pinnedProjectId,
        conversationHistory,
      });
      return {
        agent: response.agent,
        analysis: response.content,
        confidence: response.confidence,
        toolsUsed: response.toolsCalled,
        durationMs: response.durationMs,
        alerts: response.alerts,
      };
    },
  });
}

export function createStrategistTools(
  userId: string,
  options: StrategistToolOptions = {},
) {
  const visibilitySnapshots: ToolVisibilitySnapshot[] = [];
  const recordVisibility: ToolVisibilityRecorder = (snapshot) => {
    visibilitySnapshots.push(snapshot);
  };
  const registryPolicy: RegistryToolPolicy = {
    actorMode: "user_delegated",
    allowWrites: Boolean(options.includeActionTools),
    allowDelivery: false,
    selectedProjectId: options.pinnedProjectId ?? null,
  };

  // One ToolContext per strategist request, threaded into the project + action
  // factory trees so they share a single set of clients instead of each
  // constructing their own.
  const ctx = createToolContext({
    userId,
    pinnedProjectId: options.pinnedProjectId,
  });
  const toolOptions = { ...options, ctx };
  const directSourceToolNames = directResearchToolNames(
    options.researchContract,
  );

  // Include the base project tools so the Strategist can answer
  // general questions without routing to a specialist
  const baseTools = omitMicrosoftOperatorTools(
    registeredProjectTools(userId, toolOptions, registryPolicy, recordVisibility),
    directSourceToolNames,
  );
  const strategistActionTools = options.includeActionTools
    ? omitMicrosoftOperatorTools(
        registeredActionTools(userId, toolOptions, registryPolicy, recordVisibility),
      )
    : {};
  const featureRequestTools = registeredFactoryTools({
    tools: createFeatureRequestTools(userId, options),
    factoryModulePath: "frontend/src/lib/ai/tools/feature-request-tools.ts",
    policy: registryPolicy,
    onVisibility: recordVisibility,
  });
  const progressReportTools = registeredFactoryTools({
    tools: createProgressReportTools(userId, options),
    factoryModulePath: "frontend/src/lib/ai/tools/progress-report-tools.ts",
    policy: registryPolicy,
    onVisibility: recordVisibility,
  });
  const workspaceTools = registeredFactoryTools({
    tools: createWorkspaceTools(userId, { onTrace: options.onTrace }),
    factoryModulePath: "frontend/src/lib/ai/tools/workspace-tools.ts",
    policy: registryPolicy,
    onVisibility: recordVisibility,
  });
  const webSearchTools = registeredFactoryTools({
    tools: createWebSearchTools(options),
    factoryModulePath: "frontend/src/lib/ai/tools/web-search.ts",
    policy: registryPolicy,
    onVisibility: recordVisibility,
  });
  const structuredOutputTools = registeredFactoryTools({
    tools: createStructuredOutputTools(options),
    factoryModulePath: "frontend/src/lib/ai/tools/structured-output.ts",
    policy: registryPolicy,
    onVisibility: recordVisibility,
  });
  const documentIntelligenceTools = registeredFactoryTools({
    tools: createDocumentIntelligenceTools(userId, options),
    factoryModulePath: "frontend/src/lib/ai/tools/document-intelligence.ts",
    policy: registryPolicy,
    onVisibility: recordVisibility,
  });
  const intelligenceTools = registeredFactoryTools({
    tools: createIntelligenceTools({ onTrace: options.onTrace }),
    factoryModulePath: "frontend/src/lib/ai/tools/intelligence-tools.ts",
    policy: registryPolicy,
    onVisibility: recordVisibility,
  });
  const executiveBriefTools = registeredFactoryTools({
    tools: createExecutiveBriefTools({ onTrace: options.onTrace }),
    factoryModulePath: "frontend/src/lib/ai/tools/executive-brief-tools.ts",
    policy: registryPolicy,
    onVisibility: recordVisibility,
  });
  const strategistBaseTools = baseTools;

  const toolsWithoutSelfInspection = {
    ...webSearchTools,
    ...structuredOutputTools,
    ...strategistActionTools,
    ...featureRequestTools,
    ...progressReportTools,
    ...workspaceTools,
    ...documentIntelligenceTools,
    ...intelligenceTools,
    ...executiveBriefTools,
    // The Strategist's specialist consultation tools
    consultCFO: makeConsultTool(
      "cfo",
      "Consult the CFO (Chief Financial Officer) for financial analysis. " +
        "Use this for ANY question about money: budgets, costs, margins, " +
        "cash flow, contracts, change orders, invoicing, retention, pay " +
        "applications, financial health, or profitability. The CFO has " +
        "access to real financial data and will call its own tools to " +
        "analyze it. Pass the user's question (or your reformulated " +
        "version) as the question parameter.",
      "The financial question to analyze. Be specific — include project names if the user mentioned them.",
      "CFO",
      userId,
      options,
    ),

    consultCOO: makeConsultTool(
      "coo",
      "Consult the COO (Chief Operating Officer) for operational analysis. " +
        "Use this for ANY question about project execution: schedule health, " +
        "milestones, overdue tasks, critical path, RFI status, submittal " +
        "pipeline, subcontractor performance, procurement velocity, action " +
        "item accountability, field progress, or meeting prep. The COO has " +
        "access to real operational data and will call its own tools to " +
        "analyze it.",
      "The operational question to analyze. Be specific — include project names and the type of operational data needed.",
      "COO",
      userId,
      options,
    ),

    consultCRO: makeConsultTool(
      "cro",
      "Consult the CRO (Chief Risk Officer) for risk analysis. " +
        "Use this for ANY question about project or portfolio risk: financial " +
        "exposure, unpriced change events, contract risk, claim signals, " +
        "procurement risk (aging RFIs/submittals), schedule risk, budget " +
        "overrun risk, dispute patterns, or portfolio-level risk ranking. " +
        "Also use for 'what could go wrong?' or 'what should I be worried about?' " +
        "questions. The CRO has access to real risk data and will call its " +
        "own tools to analyze it.",
      "The risk question to analyze. Be specific — include project names and the type of risk being assessed.",
      "CRO",
      userId,
      options,
    ),

    consultCHRO: makeConsultTool(
      "chro",
      "Consult the CHRO (Chief Human Resources Officer) for people and capacity analysis. " +
        "Use this for ANY question about team composition, staffing gaps, capacity constraints, " +
        "action item accountability patterns, subcontractor relationships, institutional knowledge, " +
        "or lessons learned. Examples: 'Who is on this project?', 'Is anyone stretched too thin?', " +
        "'Who owns this action item?', 'What have we learned about [topic]?'.",
      "The people or capacity question to analyze. Be specific — include project names and the type of information needed.",
      "CHRO",
      userId,
      options,
    ),

    consultVPBD: makeConsultTool(
      "vpbd",
      "Consult the VP of Business Development for pipeline, client relationship, " +
        "and growth analysis. Use this for ANY question about the pursuit pipeline, " +
        "projects in estimating or planning, revenue trajectory, client relationship health, " +
        "competitive positioning, company differentiators, proposal preparation, " +
        "or past project references. Examples: 'What's in our pipeline?', " +
        "'How is the client relationship on X?', 'What are our differentiators?', " +
        "'Help me prep for a BD meeting'.",
      "The business development question to analyze. Be specific — include client names, project types, or sectors where relevant.",
      "VP BD",
      userId,
      options,
    ),

    consultCMO: makeConsultTool(
      "cmo",
      "Consult the CMO (Chief Marketing Officer) for brand, content, campaign, " +
        "and marketing execution. Use this for ANY question about content calendars, " +
        "LinkedIn or social posts, website/newsletter updates, case studies, " +
        "testimonials, announcements, thought leadership, audience positioning, " +
        "reputation, or turning project wins and owner updates into draft content. " +
        "The CMO must call source-discovery and persistence tools before making " +
        "factual marketing claims or saving draft assets.",
      "The marketing question or content planning task to analyze. Include channels, audience, date range, and project context if the user mentioned them.",
      "CMO",
      userId,
      options,
    ),

    consultMicrosoftExecutiveAssistant: tool({
      description:
        "Delegate Microsoft operator work to the Microsoft Executive Assistant specialist. " +
        "Use this for Outlook inbox triage, email search, drafting Outlook replies, Teams message review/escalation, " +
        "calendar review, Microsoft file context, and Microsoft follow-up workflows. The Strategist must not do this work directly.",
      inputSchema: z.object({
        question: z
          .string()
          .describe("The Microsoft operator request to delegate. Include the user's exact ask and the desired output."),
        context: z
          .string()
          .optional()
          .describe("Optional context from the Chief Strategist, selected project, or current conversation."),
        mailboxUserId: z
          .string()
          .optional()
          .describe("Optional Outlook mailbox email. If omitted, the configured operator mailbox is used."),
        projectId: z
          .number()
          .optional()
          .describe("Optional Alleato project ID for project-scoped Microsoft context."),
      }),
      execute: async ({ question, context, mailboxUserId, projectId }) => {
        const resolvedProjectId = projectId ?? options.pinnedProjectId;
        let approvedSkillContext = "";
        try {
          const skillContext = await buildSkillInjectionContext({
            userId,
            messageText: [question, context].filter(Boolean).join("\n\n"),
            selectedProjectId: resolvedProjectId,
            surface: "microsoft_executive_assistant",
            allowedCategories: ["email", "teams"],
            limit: 3,
          });
          approvedSkillContext = skillContext.block;
        } catch (error) {
          console.error("[microsoft-executive-assistant] failed to load approved email/teams skills", {
            message: error instanceof Error ? error.message : "Unknown skill context error",
          });
        }

        const response = await callMicrosoftExecutiveAssistant({
          userId,
          sessionId: options.sessionId,
          question,
          context,
          mailboxUserId,
          projectId: resolvedProjectId,
          approvedSkillContext: approvedSkillContext || undefined,
        });
        options.onTrace?.({
          toolName: "consultMicrosoftExecutiveAssistant",
          status: response.success ? "success" : "error",
          projectId: resolvedProjectId ?? null,
          input: {
            question,
            context,
            mailboxUserId,
            projectId,
            approvedSkillContextIncluded: Boolean(approvedSkillContext),
          },
          response,
        });
        return response;
      },
    }),

    // Include base project tools so the Strategist can answer
    // questions directly when no specialist route is needed
    ...strategistBaseTools,
  } as ToolSet; // ToolSet is an index signature — spread inference requires explicit cast

  const selfInspectionTools = createAssistantSelfInspectionTools({
    userId,
    sessionId: options.sessionId,
    availableToolNames: Object.keys(toolsWithoutSelfInspection).sort(),
    onTrace: options.onTrace,
  });

  const strategistTools = {
    ...selfInspectionTools,
    ...toolsWithoutSelfInspection,
  } as ToolSet;

  options.onTrace?.({
    toolName: "assistantToolVisibility",
    workflowId: AI_ASSISTANT_CHAT_WORKFLOW_ID,
    actorMode: registryPolicy.actorMode,
    allowWrites: registryPolicy.allowWrites,
    allowDelivery: registryPolicy.allowDelivery,
    visibleToolNames: Object.keys(strategistTools).sort(),
    hiddenTools: visibilitySnapshots.flatMap((snapshot) =>
      snapshot.hiddenTools.map((tool) => ({
        ...tool,
        factoryModulePath: snapshot.factoryModulePath,
      })),
    ),
  });

  return strategistTools;
}

// ---------------------------------------------------------------------------
// Strategist Configuration
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Council Mode
// ---------------------------------------------------------------------------

/**
 * Builds the system prompt injection for Council Mode.
 *
 * Council Mode is the Alleato equivalent of BMAD's party-mode. Instead of the
 * Strategist synthesizing specialist input into a single voice, each specialist
 * speaks directly — labeled with their icon and role — and the Strategist adds
 * only a brief closing synthesis.
 *
 * The user hears the raw expert perspectives, not a pre-digested summary.
 * Each specialist still calls their own tools, so responses are grounded in
 * real data. The difference is presentation: multi-voice, not single-voice.
 *
 * Formatting contract:
 *   [icon] **[Role]**
 *   [specialist's full analysis]
 *
 *   ---
 *
 *   ⚡ **Chief Strategist**
 *   [1–2 sentence synthesis of the key tension or decision]
 */
export function buildCouncilModePromptInjection(): string {
  // Build a formatted roster of all available specialists for the prompt
  const specialistRoster = Object.entries(agentRegistry)
    .map(([, cfg]) => `- ${cfg.icon} **${cfg.name}** — ${cfg.description}`)
    .join("\n");

  return `

## ⚡ COUNCIL MODE ACTIVE

You are now facilitating a C-Suite council session. Your role fundamentally changes.

**Normal mode:** You consult specialists and synthesize their findings into one voice.
**Council mode:** You present EACH specialist's analysis in their own voice, then add a brief closing statement.

### How to respond in Council Mode

1. **Select 2–3 specialists** most relevant to the question. If the question is clearly multi-domain (e.g. "how's the business?"), use 3–4. Never use all five for a single question — focus.

2. **Call each specialist** using their consult tool. Let them do their full analysis with tool calls.

3. **Present each specialist's response verbatim**, prefixed with their icon and role header:

\`\`\`
[icon] **[Role]**
[specialist's analysis — do NOT summarize, paraphrase, or cut]
\`\`\`

4. **Add a thin horizontal rule** between each specialist section:
\`---\`

5. **Close with the Chief Strategist's synthesis** — 1–2 sentences maximum. This is YOUR voice. State the single most important decision, tension, or action that emerges from the council's perspectives.

\`\`\`
---

⚡ **Chief Strategist**
[1–2 sentences: the key insight that connects the specialist views]
\`\`\`

### Specialist Roster
${specialistRoster}

### Council Mode Rules (NON-NEGOTIABLE)

- **Never strip specialist responses.** Present them in full. Do not paraphrase or condense.
- **Never put the Chief Strategist synthesis first.** Lead with the specialists, close with synthesis.
- **Never consult more than 4 specialists** for one message. Pick the most relevant.
- **Let specialists disagree.** If the CFO says the budget is tight and the VP BD sees a pipeline opportunity, show both. The tension is the value.
- **Your synthesis is 2 sentences, max.** The specialists did the analysis. You name the decision.
- **Cite the specialists when cross-referencing.** If the COO's operational issue connects to the CFO's cash concern, note it: "As both the COO and CFO flagged..."

### Example Council Mode Response Structure

\`\`\`
💰 **CFO**
[Full CFO analysis with data and source citations]

---

🏗️ **COO**
[Full COO analysis with data and source citations]

---

🛡️ **CRO**
[Full CRO analysis with data and source citations]

---

⚡ **Chief Strategist**
The financial exposure and schedule slippage on Cedar Park are compounding — the owner meeting on Thursday needs a recovery plan, not just a status update. Recommend calling an internal alignment session before Thursday.
\`\`\`
`;
}

/** Model used for the Strategist agent. */
export const STRATEGIST_MODEL = "openai/gpt-5.5";

/**
 * Returns the full Strategist system prompt.
 *
 * Injects soul (personality/tone) and identity (role/self-concept) BEFORE
 * the operational strategist instructions. This ensures the agent speaks
 * like a real person — warm, direct, conversational — rather than a
 * committee of labeled C-suite agents.
 *
 * The soul and identity layers are the HIGHEST PRIORITY personality
 * instructions. The strategist routing logic is operational plumbing
 * that happens behind the scenes.
 */
export function getStrategistSystemPrompt(): string {
  const today = new Date().toISOString().split("T")[0];
  return `${soul}

${identity}

${I_DONT_KNOW_REFLEX_PROMPT}

${strategistSystemPrompt}

## Runtime Date Context
Today is ${today} (YYYY-MM-DD).
Interpret relative date phrases (today, yesterday, this week) against this date and verify with tools before answering.`;
}

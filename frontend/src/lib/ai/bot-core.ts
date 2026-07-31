/**
 * Shared bot core — the AI logic used by both the web UI chat route
 * and external chat platform adapters (Slack, Teams, Telegram).
 *
 * Extracts the common orchestrator setup (system prompt assembly,
 * tool creation, memory injection) so it can be called from any channel.
 */

import {
  generateText,
  streamText,
  isStepCount,
  type ModelMessage,
  type ToolSet,
} from "ai";
import { classifyAssistantIntent } from "@/lib/ai/intent-router";
import { getLanguageModel } from "@/lib/ai/providers";
import {
  buildCouncilModePromptInjection,
  createStrategistTools,
  getStrategistSystemPrompt,
  STRATEGIST_MODEL,
} from "@/lib/ai/orchestrator";
import {
  generateConversationMemory,
  getRecentConversationSummaries,
  buildRecentConversationsBlock,
} from "@/lib/ai/services/conversation-memory";
import {
  getMemoriesForSession,
  buildMemoryContextPayload,
  type AiMemory,
} from "@/lib/ai/services/ai-memory-service";
import {
  buildAiProfileContextPacket,
  renderAiProfileContextPacketBlock,
} from "@/lib/ai/ai-profile-context-packet";
import { extractAndStoreMemories } from "@/lib/ai/services/memory-extraction";
import { proposeHumanGatedLearningCandidates } from "@/lib/ai/learning-proposals/human-gated-learning";
import {
  buildAgentLearningContextBlock,
  getRelevantAgentLearnings,
  type AgentLearningUsageSummary,
} from "@/lib/ai/services/agent-learning-service";
import {
  buildTaskGenerationTrainingBlock,
  shouldLoadTaskTrainingContext,
} from "@/lib/ai/services/task-training-service";
import { renderAssistantToolRoutingGuide } from "@/lib/ai/tool-registry";
import {
  buildSkillInjectionContext,
  type SkillInjectionUsageSummary,
} from "@/lib/ai/services/skill-injection-service";
import {
  listArtifacts,
  buildWorkspaceContextBlock,
} from "@/lib/ai/services/workspace-artifact-service";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { toSessionUuid } from "@/lib/ai/session-id";
import { loadCurrentUserProfilePayload } from "@/lib/users/current-user-profile-server";
import type { Json } from "@/types/database.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BotCoreOptions {
  /** Supabase user ID — required for tool data scoping */
  userId: string;
  /** The user's message text */
  messageText: string;
  /** Optional session ID for memory persistence */
  sessionId?: string;
  /** Optional selected project context */
  selectedProjectId?: number;
  /** Enable council mode (multi-voice) */
  councilMode?: boolean;
  /** Conversation history as ModelMessages (for multi-turn) */
  conversationHistory?: ModelMessage[];
  /** Trace callback for tool calls */
  onTrace?: (trace: Record<string, unknown>) => void;
  /** Callback for learnings injected into the prompt */
  onLearningUsage?: (usage: BotLearningUsageSummary) => void;
  /** Callback for approved skills injected into the prompt */
  onSkillUsage?: (usage: SkillInjectionUsageSummary | null) => void;
  /** Channel this response will be posted to — used to inject platform-specific formatting rules */
  platform?: "teams" | "web";
  /** Arbitrary metadata passed through from the adapter (logged, not used in generation) */
  metadata?: Record<string, unknown>;
}

export interface MemoryUsageSummary {
  totalUsed: number;
  preferencesUsed: number;
  relevantUsed: number;
  teamUsed: number;
  recentConversationsUsed: number;
  retrieved?: {
    preferences: number;
    relevant: number;
    team: number;
  };
  memories: Array<{
    id: string;
    type: string;
    content: string;
    projectId?: number | null;
    visibility?: string;
    similarity?: number;
    rankingScore?: number;
    rankingReason?: string;
  }>;
}

export interface BotLearningUsageSummary extends AgentLearningUsageSummary {}

export type BotSkillUsageSummary = SkillInjectionUsageSummary;

export interface BotCoreResult {
  /** The generated response text */
  text: string;
  /** Where the response text came from after channel-safe normalization */
  responseSource: "model_text" | "tool_result" | "empty_result_fallback";
  /** Raw model text length before tool-result fallback normalization */
  rawTextLength: number;
  /** Tool calls made during generation */
  toolTrace: Array<Record<string, unknown>>;
  /** Token usage */
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

type ToolResultLike = {
  toolName?: unknown;
  output?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function renderToolOutput(output: unknown): string | null {
  const direct = asNonEmptyString(output);
  if (direct) return direct;

  if (!isRecord(output)) return null;

  const message = asNonEmptyString(output.message);
  if (message) return message;

  const error = asNonEmptyString(output.error);
  if (error) return `I could not complete that request: ${error}`;

  const preview = output.preview;
  if (isRecord(preview)) {
    const fields = isRecord(preview.fields) ? preview.fields : {};
    const title =
      asNonEmptyString(fields.title) ??
      asNonEmptyString(fields.name) ??
      asNonEmptyString(fields.subject);
    if (title) {
      return `I prepared this for review: ${title}. Reply confirm to proceed.`;
    }
  }

  return null;
}

function collectToolResults(result: unknown): ToolResultLike[] {
  if (!isRecord(result)) return [];

  const directResults = Array.isArray(result.toolResults)
    ? (result.toolResults as ToolResultLike[])
    : [];
  const stepResults = Array.isArray(result.steps)
    ? result.steps.flatMap((step) => {
        if (!isRecord(step) || !Array.isArray(step.toolResults)) return [];
        return step.toolResults as ToolResultLike[];
      })
    : [];

  return [...stepResults, ...directResults];
}

function renderToolTraceOutput(toolTrace: Array<Record<string, unknown>>): string | null {
  for (const trace of [...toolTrace].reverse()) {
    const text = renderToolOutput(trace.output);
    if (text) return text;

    const error = asNonEmptyString(trace.error);
    if (error) return `I could not complete that request: ${error}`;
  }

  return null;
}

export function normalizeBotResponseText(params: {
  modelText: string;
  generationResult: unknown;
  toolTrace: Array<Record<string, unknown>>;
}): Pick<BotCoreResult, "text" | "responseSource" | "rawTextLength"> {
  const modelText = params.modelText.trim();
  if (modelText.length > 0) {
    return {
      text: modelText,
      responseSource: "model_text",
      rawTextLength: params.modelText.length,
    };
  }

  const toolResults = collectToolResults(params.generationResult);
  for (const result of [...toolResults].reverse()) {
    const text = renderToolOutput(result.output);
    if (text) {
      return {
        text,
        responseSource: "tool_result",
        rawTextLength: params.modelText.length,
      };
    }
  }

  const traceText = renderToolTraceOutput(params.toolTrace);
  if (traceText) {
    return {
      text: traceText,
      responseSource: "tool_result",
      rawTextLength: params.modelText.length,
    };
  }

  return {
    text:
      "I processed the request, but the model returned tool activity without a final message. Nothing was posted from an empty response; please retry or check the assistant run log.",
    responseSource: "empty_result_fallback",
    rawTextLength: params.modelText.length,
  };
}

// ---------------------------------------------------------------------------
// System prompt assembly (shared between web UI and bot channels)
// ---------------------------------------------------------------------------

// Teams collapses single \n to a space. Double newlines (blank lines) are
// required for any visual break. This block is injected at the end of the
// system prompt so it overrides any earlier prose-style instructions.
const TEAMS_FORMATTING_BLOCK = `
## Teams Formatting Rules (MANDATORY — you are in Microsoft Teams)
Teams collapses single newlines into spaces. A wall of text is unreadable. ALWAYS:
- Use a blank line (double newline) between every bullet point.
- Use a blank line before the first bullet in any list.
- Keep responses to 5 items or fewer — ruthlessly prioritise.
- Never write paragraphs longer than 2 sentences. Break them into bullets.
- Structure every multi-point response as: one-line intro → bulleted list → one-line close.
- Do NOT use headers (#, ##). Bold section labels (**Label:**) instead.
- Bold the project name or key term at the start of each bullet.
`;

function toProfilePacketMemory(memory: AiMemory) {
  return {
    id: memory.id,
    type: memory.type,
    content: memory.content,
    confidence: memory.confidence,
    importance: memory.importance,
    project_id: memory.project_id,
    source: memory.source,
    visibility: memory.visibility ?? "private",
    created_at: memory.created_at,
    last_accessed_at: memory.last_accessed_at ?? null,
    access_count: memory.access_count ?? null,
  };
}

export async function assembleSystemPrompt(options: {
  userId: string;
  messageText: string;
  selectedProjectId?: number;
  councilMode?: boolean;
  sessionId?: string;
  isFirstTurn?: boolean;
  platform?: "teams" | "web";
  onMemoryUsage?: (usage: MemoryUsageSummary) => void;
  onLearningUsage?: (usage: BotLearningUsageSummary) => void;
  onSkillUsage?: (usage: BotSkillUsageSummary | null) => void;
}): Promise<string> {
  const {
    userId,
    messageText,
    selectedProjectId,
    councilMode,
    sessionId,
    isFirstTurn = true,
    platform,
    onMemoryUsage,
    onLearningUsage,
    onSkillUsage,
  } = options;

  let systemPrompt = getStrategistSystemPrompt();
  const contextHealth: string[] = [];
  const toolRoutingGuide = renderAssistantToolRoutingGuide();
  if (toolRoutingGuide) {
    systemPrompt = systemPrompt + "\n\n---\n\n" + toolRoutingGuide;
  }

  // Inject user memories
  if (messageText) {
    try {
      const [
        { preferences, relevant, team, errors: memoryErrors },
        recentSummaries,
        activeArtifacts,
        currentUserProfile,
      ] = await Promise.all([
        getMemoriesForSession({
          userId,
          firstMessage: messageText,
          projectId: selectedProjectId,
        }),
        isFirstTurn && sessionId
          ? getRecentConversationSummaries(userId, sessionId, 3)
          : Promise.resolve([]),
        isFirstTurn
          ? listArtifacts({
              userId,
              projectId: selectedProjectId ?? null,
              status: "draft",
              limit: 5,
            }).catch(() => [])
          : Promise.resolve([]),
        loadCurrentUserProfilePayload({
          serviceClient: createServiceClient(),
          user: { id: userId },
          where: "bot-core/assembleSystemPrompt#ai-profile-context",
        }).catch((error) => {
          const message =
            error instanceof Error
              ? error.message
              : "Unknown AI profile context error";
          contextHealth.push(`AI profile context could not be loaded: ${message}`);
          return null;
        }),
      ]);
      if (memoryErrors.length > 0) {
        contextHealth.push(
          `Memory context partially unavailable: ${memoryErrors.join("; ")}`,
        );
      }
      const relevantLearnings = await getRelevantAgentLearnings({
        messageText,
        projectId: selectedProjectId,
        limit: 4,
      });
      let skillContextBlock = "";
      let skillUsage: BotSkillUsageSummary | null = null;
      try {
        const skillContext = await buildSkillInjectionContext({
          userId,
          messageText,
          selectedProjectId,
          surface: platform === "teams" ? "teams" : "ai_assistant_chat",
          limit: 4,
        });
        skillContextBlock = skillContext.block;
        skillUsage = skillContext.usage;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown skill context error";
        contextHealth.push(
          `Skill Library context could not be loaded: ${message}`,
        );
      }

      const { block: memoryBlock, selected: selectedMemories } =
        buildMemoryContextPayload(preferences, relevant, team, {
          projectId: selectedProjectId,
        });
      const { block: learningBlock, selected: selectedLearnings } =
        buildAgentLearningContextBlock(relevantLearnings);
      const usedMemories = selectedMemories.slice(0, 12).map((memory) => ({
        id: memory.id,
        type: memory.type,
        content: memory.content,
        projectId: memory.project_id,
        visibility: memory.visibility,
        similarity: memory.similarity,
        rankingScore: memory.ranking_score,
        rankingReason: memory.ranking_reason,
      }));
      const usedPreferenceIds = new Set(
        selectedMemories
          .filter((memory) => memory.type === "preference")
          .map((memory) => memory.id),
      );
      const usedTeamIds = new Set(
        selectedMemories
          .filter((memory) => memory.visibility === "team")
          .map((memory) => memory.id),
      );
      onMemoryUsage?.({
        totalUsed: usedMemories.length,
        preferencesUsed: usedPreferenceIds.size,
        relevantUsed:
          selectedMemories.length - usedPreferenceIds.size - usedTeamIds.size,
        teamUsed: usedTeamIds.size,
        recentConversationsUsed: recentSummaries.length,
        retrieved: {
          preferences: preferences.length,
          relevant: relevant.length,
          team: team.length,
        },
        memories: usedMemories,
      });
      onLearningUsage?.({
        totalUsed: selectedLearnings.length,
        learnings: selectedLearnings.map((learning) => ({
          id: learning.id,
          title: learning.title,
          source: learning.source,
          preventionPrompt: learning.prevention_prompt,
        })),
      });
      onSkillUsage?.(skillUsage);
      const recentBlock = buildRecentConversationsBlock(recentSummaries);

      const workspaceBlock = buildWorkspaceContextBlock(activeArtifacts);
      const aiProfileBlock = renderAiProfileContextPacketBlock(
        buildAiProfileContextPacket({
          user: currentUserProfile,
          memories: selectedMemories.map(toProfilePacketMemory),
          activeProjectId: selectedProjectId ?? null,
          maxMemories: 5,
        }),
      );
      // Append after the static strategist prompt — static content first is
      // required for OpenAI's prefix-based automatic prompt caching.
      const contextParts = [
        aiProfileBlock,
        recentBlock,
        memoryBlock,
        learningBlock,
        skillContextBlock,
        workspaceBlock,
      ].filter(Boolean);
      if (contextParts.length > 0) {
        systemPrompt = systemPrompt + "\n\n---\n\n" + contextParts.join("\n\n");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown memory context error";
      contextHealth.push(
        `Memory and learning context could not be loaded: ${message}`,
      );
      onMemoryUsage?.({
        totalUsed: 0,
        preferencesUsed: 0,
        relevantUsed: 0,
        teamUsed: 0,
        recentConversationsUsed: 0,
        memories: [],
      });
      onLearningUsage?.({
        totalUsed: 0,
        learnings: [],
      });
      onSkillUsage?.(null);
    }
  }

  if (shouldLoadTaskTrainingContext(messageText)) {
    try {
      const taskTrainingBlock = await buildTaskGenerationTrainingBlock({
        projectId: selectedProjectId ?? null,
      });

      if (taskTrainingBlock) {
        systemPrompt = systemPrompt + `\n\n---\n\n${taskTrainingBlock}`;
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown task training error";
      contextHealth.push(
        `Task generation feedback context could not be loaded: ${message}`,
      );
    }
  }

  // Selected project context
  if (selectedProjectId) {
    try {
      const supabase = createServiceClient();
      const { data: project } = await serviceDb.from("projects")
        .select("name, project_number, phase, health_status")
        .eq("id", selectedProjectId)
        .single();

      if (project) {
        const projectLine = [
          project.name,
          project.project_number ? `#${project.project_number}` : null,
          project.phase ? `Phase: ${project.phase}` : null,
          project.health_status ? `Status: ${project.health_status}` : null,
        ]
          .filter(Boolean)
          .join(" · ");

        systemPrompt +=
          `\n\n## Active Project Context\n` +
          `The user has pinned: **${projectLine}**\n` +
          `Assume all project-specific questions refer to this project unless the user explicitly mentions a different one. ` +
          `Skip disambiguation steps and go straight to retrieving data for this project.`;
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown project context error";
      contextHealth.push(
        `Pinned project context could not be loaded: ${message}`,
      );
    }
  }

  // Risk routing override
  if (messageText && isPortfolioRiskQuery(messageText)) {
    systemPrompt +=
      "\n\n## Runtime Risk Routing Override\n" +
      "For THIS request, you MUST call consultCFO before any other tool. " +
      "Then ensure CFO analysis includes getProjectsWithRisks output before final answer.";
  }

  // Council mode
  if (councilMode) {
    systemPrompt += buildCouncilModePromptInjection();
  }

  if (contextHealth.length > 0) {
    systemPrompt +=
      "\n\n## Runtime Context Health\n" +
      "Some context providers failed before generation. Do not ignore this. " +
      "If the missing context affects the answer, say what could not be checked, " +
      "what you can still answer from available sources, and what would make the next answer stronger.\n" +
      contextHealth.map((item) => `- ${item}`).join("\n");
  }

  // Teams-specific formatting rules injected LAST so they take highest priority.
  if (platform === "teams") {
    systemPrompt += TEAMS_FORMATTING_BLOCK;
  }

  return systemPrompt;
}

export async function assembleLeanAdvisorSystemPrompt(options: {
  messageText: string;
  selectedProjectId?: number;
  intentLabel: string;
}): Promise<string> {
  const { messageText, selectedProjectId, intentLabel } = options;
  const today = new Date().toISOString().split("T")[0];
  const contextHealth: string[] = [];
  const parts = [
    "You are Alleato AI, a senior construction project advisor inside Alleato PM.",
    [
      "## Runtime Date Context",
      `Today is ${today} (YYYY-MM-DD). Interpret relative dates against this date.`,
    ].join("\n"),
    [
      "## Lean Advisor Contract",
      `The request is classified as ${intentLabel}.`,
      "Use the available tools before answering. Favor current packets, structured project data, meetings, emails, Teams messages, documents, and source-health metadata over generic construction advice.",
      "Lead with the answer. Keep the response decision-oriented, specific, and grounded in the tool results. Explain source gaps when a relevant source is missing, empty, stale, or timed out.",
      "For owner-style portfolio/status/risk questions, identify the 2-3 items that matter most, why they matter, and the first action to take.",
      "Do not narrate tool usage. Do not end with generic optional offers.",
    ].join("\n"),
    ["## User Request", messageText.slice(0, 1200)].join("\n"),
  ];

  if (selectedProjectId) {
    try {
      const supabase = createServiceClient();
      const { data: project } = await serviceDb.from("projects")
        .select("name, project_number, phase, health_status")
        .eq("id", selectedProjectId)
        .single();

      if (project) {
        const projectLine = [
          project.name,
          project.project_number ? `#${project.project_number}` : null,
          project.phase ? `Phase: ${project.phase}` : null,
          project.health_status ? `Status: ${project.health_status}` : null,
        ]
          .filter(Boolean)
          .join(" · ");

        parts.push(
          [
            "## Active Project Context",
            `The user has pinned: **${projectLine}**.`,
            "Assume project-specific questions refer to this project unless the user explicitly mentions a different one.",
          ].join("\n"),
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown project context error";
      contextHealth.push(
        `Pinned project context could not be loaded: ${message}`,
      );
    }
  }

  if (contextHealth.length > 0) {
    parts.push(
      [
        "## Runtime Context Health",
        "Some context providers failed before generation. If the missing context affects the answer, say what could not be checked.",
        contextHealth.map((item) => `- ${item}`).join("\n"),
      ].join("\n"),
    );
  }

  return parts.join("\n\n---\n\n");
}

export async function assembleTaskWriteSystemPrompt(options: {
  userId: string;
  messageText: string;
  selectedProjectId?: number;
  platform?: "teams" | "web";
}): Promise<string> {
  const { messageText, selectedProjectId, platform } = options;
  const today = new Date().toISOString().split("T")[0];
  const contextHealth: string[] = [];
  const createTaskInstruction =
    platform === "teams"
      ? "For new follow-ups, reminders, and action items, call `createGeneratedTask` with `confirmed: false`; in Teams, that tool call writes the task directly through the audited task-write path and returns the created task link. Do not ask for a second confirmation after the user already asked you to create the task."
      : "For new follow-ups, reminders, and action items, call `createGeneratedTask` with `confirmed: false` so the UI can render a preview card.";
  const parts = [
    "You are Alleato AI inside Alleato PM.",
    [
      "## Runtime Date Context",
      `Today is ${today} (YYYY-MM-DD). Interpret relative dates against this date.`,
    ].join("\n"),
    [
      "## Task Write Contract",
      "The user is asking to create, modify, close, reassign, reprioritize, reschedule, or delete a Tasks page action item.",
      `Use the available Tasks page tools. ${createTaskInstruction}`,
      "For updates or deletes, first use the available task lookup tool when the user did not provide a task id, then call `updateGeneratedTask` or `deleteGeneratedTask` with `confirmed: false` if a matching task is found.",
      "Do not answer with a plain-text task preview when a tool call can produce the preview. If the target task cannot be identified, say exactly what identifying detail is missing.",
    ].join("\n"),
  ];

  if (selectedProjectId) {
    try {
      const supabase = createServiceClient();
      const { data: project } = await serviceDb.from("projects")
        .select("name, project_number, phase, health_status")
        .eq("id", selectedProjectId)
        .single();

      if (project) {
        const projectLine = [
          project.name,
          project.project_number ? `#${project.project_number}` : null,
          project.phase ? `Phase: ${project.phase}` : null,
          project.health_status ? `Status: ${project.health_status}` : null,
        ]
          .filter(Boolean)
          .join(" · ");

        parts.push(
          [
            "## Active Project Context",
            `The user has pinned: **${projectLine}**.`,
            "Use this project for project-specific task writes unless the user explicitly names a different project.",
          ].join("\n"),
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown project context error";
      contextHealth.push(
        `Pinned project context could not be loaded: ${message}`,
      );
    }
  }

  if (shouldLoadTaskTrainingContext(messageText)) {
    try {
      const taskTrainingBlock = await buildTaskGenerationTrainingBlock({
        projectId: selectedProjectId ?? null,
      });
      if (taskTrainingBlock) parts.push(taskTrainingBlock);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown task training error";
      contextHealth.push(
        `Task generation feedback context could not be loaded: ${message}`,
      );
    }
  }

  if (contextHealth.length > 0) {
    parts.push(
      [
        "## Runtime Context Health",
        "Some context providers failed before generation. Do not ignore this.",
        ...contextHealth.map((item) => `- ${item}`),
      ].join("\n"),
    );
  }

  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Non-streaming generation (for chat platform bots)
// ---------------------------------------------------------------------------

/**
 * Generate a complete response using the C-Suite orchestrator.
 * Used by Slack/Teams/Telegram bots where streaming is handled by Chat SDK.
 */
export async function generateBotResponse(
  options: BotCoreOptions,
): Promise<BotCoreResult> {
  const toolTrace: Array<Record<string, unknown>> = [];
  const intent = classifyAssistantIntent(options.messageText, {
    selectedProjectId: options.selectedProjectId ?? null,
  });
  const isTaskWriteIntent = intent === "task_write";

  // Auto-load history from DB when a sessionId is present and no history was
  // explicitly provided. This makes it impossible for a caller to forget —
  // passing sessionId is enough to get multi-turn memory automatically.
  if (options.sessionId && !options.conversationHistory) {
    const prior = await loadConversationHistory(options.sessionId);
    if (prior.length) options.conversationHistory = prior;
  }

  const tools = createStrategistTools(options.userId, {
    onTrace: (trace) => {
      toolTrace.push(trace);
      options.onTrace?.(trace);
    },
    pinnedProjectId: options.selectedProjectId,
    includeActionTools: isTaskWriteIntent,
    generatedTaskWriteMode:
      isTaskWriteIntent && options.platform === "teams" ? "direct" : "preview",
  });

  const systemPrompt = isTaskWriteIntent
    ? await assembleTaskWriteSystemPrompt({
        userId: options.userId,
        messageText: options.messageText,
        selectedProjectId: options.selectedProjectId,
        platform: options.platform,
      })
    : await assembleSystemPrompt({
        userId: options.userId,
        messageText: options.messageText,
        selectedProjectId: options.selectedProjectId,
        councilMode: options.councilMode,
        sessionId: options.sessionId,
        isFirstTurn: !options.conversationHistory?.length,
        platform: options.platform,
        onLearningUsage: options.onLearningUsage,
        onSkillUsage: options.onSkillUsage,
      });

  const messages: ModelMessage[] = options.conversationHistory?.length
    ? [
        ...options.conversationHistory,
        { role: "user" as const, content: options.messageText },
      ]
    : [{ role: "user" as const, content: options.messageText }];

  const result = await generateText({
    model: getLanguageModel(STRATEGIST_MODEL),
    instructions: systemPrompt,
    messages,
    tools: tools as unknown as ToolSet,
    stopWhen: isStepCount(7),
  });

  const usage = result.usage;
  const normalized = normalizeBotResponseText({
    modelText: result.text,
    generationResult: result,
    toolTrace,
  });

  return {
    text: normalized.text,
    responseSource: normalized.responseSource,
    rawTextLength: normalized.rawTextLength,
    toolTrace,
    usage: usage
      ? {
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
        }
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Streaming generation (for chat platform bots that support streaming)
// ---------------------------------------------------------------------------

/**
 * Stream a response using the C-Suite orchestrator.
 * Returns an AI SDK streamText result whose stream/textStream can be
 * passed directly to Chat SDK's thread.post().
 */
export async function streamBotResponse(options: BotCoreOptions) {
  const toolTrace: Array<Record<string, unknown>> = [];
  const intent = classifyAssistantIntent(options.messageText, {
    selectedProjectId: options.selectedProjectId ?? null,
  });
  const isTaskWriteIntent = intent === "task_write";

  if (options.sessionId && !options.conversationHistory) {
    const prior = await loadConversationHistory(options.sessionId);
    if (prior.length) options.conversationHistory = prior;
  }

  const tools = createStrategistTools(options.userId, {
    onTrace: (trace) => {
      toolTrace.push(trace);
      options.onTrace?.(trace);
    },
    pinnedProjectId: options.selectedProjectId,
    includeActionTools: isTaskWriteIntent,
    generatedTaskWriteMode:
      isTaskWriteIntent && options.platform === "teams" ? "direct" : "preview",
  });

  const systemPrompt = isTaskWriteIntent
    ? await assembleTaskWriteSystemPrompt({
        userId: options.userId,
        messageText: options.messageText,
        selectedProjectId: options.selectedProjectId,
        platform: options.platform,
      })
    : await assembleSystemPrompt({
        userId: options.userId,
        messageText: options.messageText,
        selectedProjectId: options.selectedProjectId,
        councilMode: options.councilMode,
        sessionId: options.sessionId,
        isFirstTurn: !options.conversationHistory?.length,
        platform: options.platform,
        onLearningUsage: options.onLearningUsage,
        onSkillUsage: options.onSkillUsage,
      });

  const messages: ModelMessage[] = options.conversationHistory?.length
    ? [
        ...options.conversationHistory,
        { role: "user" as const, content: options.messageText },
      ]
    : [{ role: "user" as const, content: options.messageText }];

  const result = streamText({
    model: getLanguageModel(STRATEGIST_MODEL),
    instructions: systemPrompt,
    messages,
    tools: tools as unknown as ToolSet,
    stopWhen: isStepCount(7),
  });

  return { result, toolTrace };
}

// ---------------------------------------------------------------------------
// Post-response background tasks
// ---------------------------------------------------------------------------

/**
 * Run background memory tasks after a bot response is sent.
 * Call this in a fire-and-forget pattern (e.g., waitUntil).
 */
export async function runPostResponseTasks(
  sessionId: string,
  userId: string,
  options: {
    selectedProjectId?: number | null;
    responseMessageId?: string | null;
  } = {},
): Promise<void> {
  try {
    await generateConversationMemory(sessionId, userId);
  } catch (e) {
    console.error("[bot-core][conversation-memory] failed:", e);
  }

  try {
    await extractAndStoreMemories(sessionId, userId);
  } catch (e) {
    console.error("[bot-core][memory-extraction] failed:", e);
  }

  try {
    const result = await proposeHumanGatedLearningCandidates({
      sessionId,
      userId,
      selectedProjectId: options.selectedProjectId ?? null,
      responseMessageId: options.responseMessageId ?? null,
    });
    if (result.status === "failed") {
      console.error("[bot-core][human-gated-learning] failed:", result.error);
    }
  } catch (e) {
    console.error("[bot-core][human-gated-learning] threw:", e);
  }
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

/**
 * Persist a message to chat_history for memory continuity.
 */
export async function persistChatMessage(params: {
  sessionId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createServiceClient();
  const sessionUuid = toSessionUuid(params.sessionId);
  const { error } = await serviceDb.from("chat_history").insert({
    session_id: sessionUuid,
    user_id: params.userId,
    role: params.role,
    content: params.content,
    ...(params.metadata ? { metadata: params.metadata as Json } : {}),
  });
  if (error) {
    console.error("[persistChatMessage] insert failed", {
      error: error.message,
      code: (error as { code?: string }).code,
      hint: (error as { hint?: string }).hint,
      sessionId: params.sessionId,
      sessionUuid,
      userId: params.userId,
      role: params.role,
      platform: params.metadata?.platform,
    });
    throw new Error(`persistChatMessage failed: ${error.message}`);
  }
}

/**
 * Load recent conversation history from chat_history for a given session.
 * Returns messages in chronological order, ready to pass as conversationHistory.
 * Caps at the last N turns to keep context manageable.
 */
export async function loadConversationHistory(
  sessionId: string,
  maxTurns = 10,
): Promise<ModelMessage[]> {
  const supabase = createServiceClient();
  const sessionUuid = toSessionUuid(sessionId);
  const { data, error } = await serviceDb.from("chat_history")
    .select("role, content")
    .eq("session_id", sessionUuid)
    .order("created_at", { ascending: false })
    .limit(maxTurns * 2);

  if (error || !data?.length) return [];

  // Reverse to chronological order (oldest first)
  return (data as Array<{ role: "user" | "assistant"; content: string }>)
    .reverse()
    .map((row) => (({
    role: row.role,
    content: row.content
  }) as ModelMessage));
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function isPortfolioRiskQuery(text: string): boolean {
  const normalized = text.toLowerCase();
  const hasRiskLanguage =
    normalized.includes("risk") ||
    normalized.includes("risky") ||
    normalized.includes("at risk") ||
    normalized.includes("critical item") ||
    normalized.includes("critical items") ||
    normalized.includes("exposure");
  const hasPortfolioLanguage =
    normalized.includes("project") ||
    normalized.includes("projects") ||
    normalized.includes("portfolio") ||
    normalized.includes("jobs");
  return hasRiskLanguage && hasPortfolioLanguage;
}

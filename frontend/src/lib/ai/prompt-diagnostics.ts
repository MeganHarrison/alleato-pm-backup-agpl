import { createHash } from "node:crypto";
import type { ModelMessage, ToolSet } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";

import { assembleSystemPrompt } from "@/lib/ai/bot-core";
import {
  loadAssistantSourceHealthContext,
  type AssistantSourceHealthReason,
} from "@/lib/ai/source-health";
import type { Database } from "@/types/database.types";

type AssembleDiagnosticPromptOptions = {
  userId: string;
  messageText: string;
  selectedProjectId?: number;
  councilMode?: boolean;
  sessionId?: string;
  isFirstTurn?: boolean;
  includeSourceHealth?: boolean;
  sourceHealthReason?: AssistantSourceHealthReason;
  supabase?: SupabaseClient<Database>;
  additionalContextBlocks?: Array<{
    id: string;
    label: string;
    content: string;
  }>;
};

export type SystemPromptSectionSummary = {
  id: string;
  label: string;
  present: boolean;
};

export type AssistantPromptDiagnostics = {
  prompt: string;
  promptHash: string;
  charCount: number;
  approxTokenCount: number;
  sections: SystemPromptSectionSummary[];
  additionalContextBlockIds: string[];
};

const SECTION_MARKERS: Array<{ id: string; label: string; pattern: RegExp }> = [
  { id: "soul", label: "Soul / voice", pattern: /## Soul\b/ },
  { id: "identity", label: "Identity", pattern: /## Identity\b/ },
  {
    id: "search_first",
    label: "Search-first uncertainty rule",
    pattern: /SEARCH FIRST, ADMIT LAST/,
  },
  {
    id: "strategist",
    label: "Chief Strategist operating prompt",
    pattern: /Chief Strategist of Alleato AI/,
  },
  {
    id: "runtime_date",
    label: "Runtime date context",
    pattern: /## Runtime Date Context\b/,
  },
  {
    id: "tool_routing_policy",
    label: "Tool routing policy",
    pattern: /## Tool Routing Policy\b/,
  },
  {
    id: "recent_conversations",
    label: "Recent conversation summaries",
    pattern: /## Recent Conversation/i,
  },
  {
    id: "memory",
    label: "Durable memory context",
    pattern:
      /## What I Know About You And Your Projects|## Relevant Memories|## Memory/i,
  },
  {
    id: "agent_learnings",
    label: "Agent learning guardrails",
    pattern: /agent learning|prevention prompt|## Relevant Agent Learnings/i,
  },
  {
    id: "workspace_artifacts",
    label: "Workspace artifacts",
    pattern: /workspace artifact|## Active Workspace/i,
  },
  {
    id: "active_project",
    label: "Pinned project context",
    pattern: /## Active Project Context\b/,
  },
  {
    id: "task_training",
    label: "Task generation training context",
    pattern: /task generation|task feedback|## Task/i,
  },
  {
    id: "source_health",
    label: "Source sync health context",
    pattern: /## Source Sync Health\b/,
  },
  {
    id: "runtime_context_health",
    label: "Runtime context health warnings",
    pattern: /## Runtime Context Health\b/,
  },
  {
    id: "intelligence_packet",
    label: "Project intelligence packet context",
    pattern:
      /# Current Project Intelligence Packet|# Project Intelligence Packet/,
  },
  {
    id: "retrieval_context",
    label: "Retrieval planner context",
    pattern:
      /# Vector Search Results|# Project Briefing Snapshot|# Source-Specific RAG Result/,
  },
];

export function assertNonEmptySystemPrompt(
  systemPrompt: string,
  where: string,
): string {
  if (systemPrompt.trim().length > 0) return systemPrompt;

  throw new Error(
    [
      `${where} refused to call the AI SDK with an empty system prompt.`,
      "Cause: prompt assembly returned an empty string.",
      "Detection gap: the streamText call previously lacked an explicit assertion for missing strategist context.",
      "Prevention: assemble the strategist prompt before generation and keep this guard in the streamText payload path.",
    ].join(" "),
  );
}

export function buildAiSdkPromptPayload(params: {
  where: string;
  systemPrompt: string;
  messages: ModelMessage[];
  tools?: ToolSet;
}): { instructions: string; messages: ModelMessage[]; tools?: ToolSet } {
  const instructions = assertNonEmptySystemPrompt(
    params.systemPrompt,
    params.where,
  );
  return {
    instructions,
    messages: params.messages,
    ...(params.tools ? { tools: params.tools } : {}),
  };
}

export function redactSystemPrompt(prompt: string): string {
  return prompt
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\b\d{3}[-.)\s]?\d{3}[-.\s]?\d{4}\b/g, "[redacted-phone]")
    .replace(/\b[A-Za-z0-9+/]{32,}={0,2}\b/g, "[redacted-token]");
}

export function summarizeSystemPrompt(
  prompt: string,
): SystemPromptSectionSummary[] {
  return SECTION_MARKERS.map((section) => ({
    id: section.id,
    label: section.label,
    present: section.pattern.test(prompt),
  }));
}

export async function assembleAssistantPromptDiagnostics(
  options: AssembleDiagnosticPromptOptions,
): Promise<AssistantPromptDiagnostics> {
  let prompt = await assembleSystemPrompt({
    userId: options.userId,
    messageText: options.messageText,
    selectedProjectId: options.selectedProjectId,
    councilMode: options.councilMode,
    sessionId: options.sessionId,
    isFirstTurn: options.isFirstTurn,
  });

  if (options.includeSourceHealth) {
    if (!options.supabase) {
      throw new Error(
        "Source-health prompt diagnostics require a Supabase client.",
      );
    }
    const sourceHealth = await loadAssistantSourceHealthContext({
      supabase: options.supabase,
      reason: options.sourceHealthReason ?? "source_status_request",
    });
    prompt += `\n\n---\n\n${sourceHealth.promptInjection}`;
  }

  const additionalContextBlocks = options.additionalContextBlocks ?? [];
  for (const block of additionalContextBlocks) {
    if (block.content.trim()) {
      prompt += `\n\n---\n\n## ${block.label}\n${block.content}`;
    }
  }

  assertNonEmptySystemPrompt(prompt, "assembleAssistantPromptDiagnostics");

  return {
    prompt,
    promptHash: createHash("sha256").update(prompt).digest("hex"),
    charCount: prompt.length,
    approxTokenCount: Math.ceil(prompt.length / 4),
    sections: summarizeSystemPrompt(prompt),
    additionalContextBlockIds: additionalContextBlocks.map((block) => block.id),
  };
}

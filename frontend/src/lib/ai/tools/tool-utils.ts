import {
  tool as defineAiSdkTool,
  type Tool,
  type ToolExecutionOptions,
} from "ai";
import OpenAI from "openai";
import { createServiceClient } from "@/lib/supabase/service";
import { type ToolGuardrails } from "./guardrails";
import {
  getOpenAICompatibleClientConfig,
  getOpenAIModelId,
} from "@/lib/ai/provider-config";
import { type ValidatedEmbedding } from "@/lib/ai/retrieval/retrieve-chunks";

// ---------------------------------------------------------------------------
// Embedding config registry
// ---------------------------------------------------------------------------
// Index dimensions are schema-bound. Changing a model requires a matching
// pgvector index migration (e.g. halfvec(3072) → re-index all rows).

export const EMBEDDING = {
  /**
   * halfvec(3072) — the ONLY embedding model for active columns.
   * Covers: document_chunks.embedding, document_metadata.summary_embedding,
   * and all source types within document_chunks (ai_memory, meeting_*, email, etc).
   * Use this for ALL new vector queries.
   */
  LARGE: { model: "text-embedding-3-large", dimensions: 3072 } as const,
  /**
   * vector(1536) — DEPRECATED. The conversation_memories table this was designed
   * for does not exist in the database. Do NOT use against any active column —
   * document_chunks.embedding is halfvec(3072) and using SMALL against it produces
   * silent garbage similarity scores. Retained only so the generateEmbedding type
   * signature remains stable. If you are tempted to use EMBEDDING.SMALL in new
   * code, stop — use EMBEDDING.LARGE.
   */
  SMALL: { model: "text-embedding-3-small", dimensions: 1536 } as const,
} as const;

/**
 * Generate an embedding and return it JSON-stringified for use in RPC args.
 * NOTE: The return value is already a JSON string — do NOT wrap it in JSON.stringify() again.
 * Pass the result directly as the RPC argument (e.g. `query_embedding: queryEmbedding`).
 *
 * GUARDRAIL: Returns ValidatedEmbedding (branded type), so only this function can produce
 * values acceptable to the RPC. Prevents raw-array encoding bugs at compile time.
 */
export async function generateEmbedding(
  openai: OpenAI,
  input: string,
  config: typeof EMBEDDING.LARGE | typeof EMBEDDING.SMALL,
): Promise<ValidatedEmbedding> {
  const modelId = getOpenAIModelId(config.model);
  const resp = await openai.embeddings.create({
    model: modelId,
    input,
    ...(config.dimensions !== 1536 ? { dimensions: config.dimensions } : {}),
  });
  if (!resp.data[0]?.embedding) {
    throw new Error(
      `Embedding API returned empty data for model ${modelId}. Check API key and gateway config.`,
    );
  }
  return JSON.stringify(resp.data[0].embedding) as ValidatedEmbedding;
}

// ---------------------------------------------------------------------------
// Briefing & reranking helpers (shared by semanticSearch + searchMeetingsByTopic)
// ---------------------------------------------------------------------------

/** Keywords that signal a PM briefing intent — used to tune ranking and recall. */
export function isBriefingQuery(query: string): boolean {
  const q = query.toLowerCase();
  return [
    "latest", "brief", "briefing", "catch me up", "update",
    "what's happening", "what is happening", "status", "how is", "how's",
    "progress", "any news", "what happened", "recent", "risk", "risks",
    "tracking", "right now", "should know",
  ].some((kw) => q.includes(kw));
}

const BRIEFING_SOURCE_PRIORITY: Record<string, number> = {
  meeting_transcript: 0,
  meeting_summary: 1,
  email: 2,
  teams_channel: 3,
  teams_message: 4,
  teams_dm: 5,
  insight: 6,
  knowledge_base: 7,
};

export function rankBriefingSourcePriority(sourceTable: string): number {
  return BRIEFING_SOURCE_PRIORITY[sourceTable] ?? 8;
}

/** Rerank candidates using LLM as cross-encoder. Returns indices sorted by relevance. */
export async function rerankWithLLM(
  openai: OpenAI,
  query: string,
  candidates: Array<{ content: string; sourceTable: string }>,
  topK: number = 10,
): Promise<number[]> {
  try {
    const candidateList = candidates
      .slice(0, 20)
      .map((c, i) => `[${i}] (${c.sourceTable}) ${c.content.substring(0, 300)}`)
      .join("\n\n");

    const briefingHint = isBriefingQuery(query)
      ? " For project status or briefing queries, prefer recent meeting transcripts, emails, and Teams messages over general reference documents."
      : "";

    const response = await openai.chat.completions.create({
      model: getOpenAIModelId("gpt-4.1-mini"),
      temperature: 0,
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content:
            "You are a relevance judge for a construction project management assistant. " +
            "Given a query and numbered text passages, return ONLY a JSON array of passage " +
            "indices sorted by relevance to the query, most relevant first. " +
            "Include only passages that are actually relevant." +
            briefingHint +
            " Example output: [3, 0, 7, 1]",
        },
        {
          role: "user",
          content: `Query: ${query}\n\nPassages:\n${candidateList}`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim() || "[]";
    const jsonText = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
    const indices = JSON.parse(jsonText) as number[];
    return indices
      .filter((i) => typeof i === "number" && i >= 0 && i < candidates.length)
      .slice(0, topK);
  } catch (err) {
    // Reranking failed — fall back to vector-similarity order.
    // Structured log so Vercel log drain / alerting can detect reranker degradation.
    console.error(JSON.stringify({
      event: "reranker_fallback",
      query_length: query.length,
      candidate_count: candidates.length,
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    }));
    return candidates.slice(0, topK).map((_, i) => i);
  }
}

export type ToolTracePayload = {
  tool: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  timestamp: string;
};

type TraceOptions = {
  onTrace?: (trace: ToolTracePayload) => void;
  pinnedProjectId?: number;
};

type ToolContext = Record<string, unknown>;

/**
 * Typed tool-error envelope returned by `withTrace` when an executor throws.
 *
 * The `__toolError: true` discriminator is a Rule 1 guardrail: the model is
 * instructed (in `strategistSystemPrompt`) to recognize this exact shape and
 * tell the user the data is unavailable instead of summarizing the message
 * as if it were content. Plain `{ error: string }` shapes are reserved for
 * soft business-logic signals (e.g. "no project access") and are NOT this
 * envelope.
 */
export type ToolErrorResult = {
  __toolError: true;
  source: string;
  message: string;
  guidance: string;
};

export function isToolErrorResult(value: unknown): value is ToolErrorResult {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { __toolError?: unknown }).__toolError === true
  );
}

export function asNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function withTrace<
  TInput extends Record<string, unknown>,
  TResult,
  TContext extends ToolContext = ToolContext,
>(
  name: string,
  options: TraceOptions,
  execute: (
    input: TInput,
    executionOptions?: ToolExecutionOptions<TContext>,
  ) => Promise<TResult>,
  errorGuidance: string,
): (
  input: TInput,
  executionOptions?: ToolExecutionOptions<TContext>,
) => Promise<TResult | ToolErrorResult> {
  return async (
    input: TInput,
    executionOptions?: ToolExecutionOptions<TContext>,
  ): Promise<TResult | ToolErrorResult> => {
    const executionInput = applyPinnedProjectInput(input, options);
    try {
      const output = await execute(executionInput, executionOptions);
      options.onTrace?.({
        tool: name,
        input: executionInput,
        output,
        timestamp: new Date().toISOString(),
      });
      return output;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown tool error";
      const stack = error instanceof Error ? error.stack : undefined;
      options.onTrace?.({
        tool: name,
        input: executionInput,
        error: message,
        timestamp: new Date().toISOString(),
      });
      console.error(
        JSON.stringify({
          event: "tool_error",
          tool: name,
          input: executionInput,
          error: message,
          stack,
          timestamp: new Date().toISOString(),
        }),
      );
      const envelope: ToolErrorResult = {
        __toolError: true,
        source: name,
        message,
        guidance: errorGuidance,
      };
      return envelope;
    }
  };
}

/** Lazy OpenAI singleton — routes through AI Gateway when configured, otherwise direct OpenAI. */
let _openai: OpenAI | null = null;
export function getOpenAI(): OpenAI {
  if (!_openai) {
    const config = getOpenAICompatibleClientConfig("OpenAI tool client");
    _openai = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
  }
  return _openai;
}

export { getOpenAIModelId } from "@/lib/ai/provider-config";

/**
 * withWriteTrace — for mutation tools.
 * Re-throws on error so failures surface loudly in the stream rather than
 * returning a silent structured {error} response. Contrast with withTrace
 * (read tools) which catches and returns structured errors.
 */
export function withWriteTrace<
  TInput extends Record<string, unknown>,
  TResult,
  TContext extends ToolContext = ToolContext,
>(
  name: string,
  options: TraceOptions,
  execute: (
    input: TInput,
    executionOptions?: ToolExecutionOptions<TContext>,
  ) => Promise<TResult>,
): (
  input: TInput,
  executionOptions?: ToolExecutionOptions<TContext>,
) => Promise<TResult> {
  return async (
    input: TInput,
    executionOptions?: ToolExecutionOptions<TContext>,
  ): Promise<TResult> => {
    const executionInput = applyPinnedProjectInput(input, options);
    try {
      const output = await execute(executionInput, executionOptions);
      options.onTrace?.({ tool: name, input: executionInput, output, timestamp: new Date().toISOString() });
      return output;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      options.onTrace?.({ tool: name, input: executionInput, error: message, timestamp: new Date().toISOString() });
      throw error;
    }
  };
}

function applyPinnedProjectInput<TInput extends Record<string, unknown>>(
  input: TInput,
  options: TraceOptions,
): TInput {
  const pinnedProjectId = options.pinnedProjectId;
  if (
    typeof pinnedProjectId !== "number" ||
    !Number.isFinite(pinnedProjectId) ||
    !Object.prototype.hasOwnProperty.call(input, "projectId")
  ) {
    return input;
  }

  const currentProjectId = input.projectId;
  if (currentProjectId === pinnedProjectId) {
    return input;
  }

  return {
    ...input,
    projectId: pinnedProjectId,
  };
}

type SharedToolDefinition<
  TInput extends Record<string, unknown>,
  TResult,
  TContext extends ToolContext = ToolContext,
> = {
  description?: string;
  title?: string;
  inputSchema: Tool<TInput, TResult, TContext>["inputSchema"];
  inputExamples?: Tool<TInput, TResult, TContext>["inputExamples"];
  strict?: Tool<TInput, TResult, TContext>["strict"];
  execute: (
    input: TInput,
    executionOptions?: ToolExecutionOptions<TContext>,
  ) => Promise<TResult>;
};

export function defineReadTool<
  TInput extends Record<string, unknown>,
  TResult,
  TContext extends ToolContext = ToolContext,
>(
  name: string,
  options: { onTrace?: (trace: ToolTracePayload) => void },
  definition: SharedToolDefinition<TInput, TResult, TContext> & {
    errorGuidance: string;
  },
): Tool<TInput, TResult | ToolErrorResult, TContext> {
  const { errorGuidance, execute, ...toolDefinition } = definition;
  const tracedExecute: NonNullable<Tool<TInput, unknown, TContext>["execute"]> =
    withTrace(name, options, execute, errorGuidance);
  const toolDefinitionWithTrace = defineAiSdkTool<TInput, unknown, TContext>({
      ...toolDefinition,
      outputSchema: undefined,
      execute: tracedExecute,
    }) as Tool<TInput, TResult | ToolErrorResult, TContext>;
  return toolDefinitionWithTrace;
}

export function defineWriteTool<
  TInput extends Record<string, unknown>,
  TResult,
  TContext extends ToolContext = ToolContext,
>(
  name: string,
  options: { onTrace?: (trace: ToolTracePayload) => void },
  definition: SharedToolDefinition<TInput, TResult, TContext>,
): Tool<TInput, TResult, TContext> {
  const { execute, ...toolDefinition } = definition;
  const tracedExecute: NonNullable<Tool<TInput, unknown, TContext>["execute"]> =
    withWriteTrace(name, options, execute);
  const toolDefinitionWithTrace = defineAiSdkTool<TInput, unknown, TContext>({
      ...toolDefinition,
      outputSchema: undefined,
      execute: tracedExecute,
    }) as Tool<TInput, TResult, TContext>;
  return toolDefinitionWithTrace;
}

export async function resolveProject(
  supabase: ReturnType<typeof createServiceClient>,
  guardrails: ToolGuardrails,
  projectId?: number,
  projectName?: string,
): Promise<{ id: number; name: string } | { error: string }> {
  const scopedProjectIds = await guardrails.getScopedProjectIds(projectId);
  if (scopedProjectIds.length === 0) {
    return { error: "You do not have access to that project." };
  }

  const effectiveProjectId =
    scopedProjectIds.length === 1
        ? scopedProjectIds[0]
        : typeof projectId === "number" && Number.isFinite(projectId)
          ? projectId
        : undefined;

  if (effectiveProjectId) {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name")
      .eq("id", effectiveProjectId)
      .single();
    if (error || !data) return { error: `Project ${effectiveProjectId} not found` };
    return { id: data.id, name: data.name ?? "" };
  }
  if (projectName) {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name")
      .in("id", scopedProjectIds)
      .ilike("name", `%${projectName}%`)
      .limit(1)
      .single();
    if (error || !data)
      return { error: `No project found matching "${projectName}"` };
    return { id: data.id, name: data.name ?? "" };
  }
  return { error: "Provide either projectId or projectName" };
}

/**
 * Model pricing lookup table for cost estimation.
 *
 * Called from /api/ai-assistant/usage-stats and /api/admin/ai-system-health.
 * Prices are USD per 1M tokens as of May 2026. Entries marked `estimated: true`
 * are Vercel AI Gateway aliases whose underlying model may change.
 */

export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
  provider: string;
  estimated?: boolean;
}

// Fallback rate used when a model ID is not in the lookup table.
// Based on mid-tier GPT-4 class pricing.
export const FALLBACK_PRICING: ModelPricing = {
  inputPer1M: 1.5,
  outputPer1M: 6.0,
  provider: "unknown",
  estimated: true,
};

// All entries use the prefixed form (provider/model-id).
// normalizeModelId() converts bare IDs to this form before lookup.
const PRICING_MAP: Record<string, ModelPricing> = {
  // ── OpenAI via Vercel AI Gateway (estimated: aliases may change) ────────────
  "openai/gpt-5.4": { inputPer1M: 2.5, outputPer1M: 10.0, provider: "openai", estimated: true },
  "openai/gpt-5.5": { inputPer1M: 3.0, outputPer1M: 15.0, provider: "openai", estimated: true },
  "openai/gpt-5.4-mini": { inputPer1M: 0.15, outputPer1M: 0.6, provider: "openai", estimated: true },

  // ── OpenAI GPT-4.1 family ────────────────────────────────────────────────────
  "openai/gpt-4.1": { inputPer1M: 2.0, outputPer1M: 8.0, provider: "openai" },
  "openai/gpt-4.1-mini": { inputPer1M: 0.4, outputPer1M: 1.6, provider: "openai" },
  "openai/gpt-4.1-nano": { inputPer1M: 0.1, outputPer1M: 0.4, provider: "openai" },

  // ── OpenAI GPT-4o family ──────────────────────────────────────────────────────
  "openai/gpt-4o": { inputPer1M: 2.5, outputPer1M: 10.0, provider: "openai" },
  "openai/gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6, provider: "openai" },

  // ── OpenAI reasoning models ────────────────────────────────────────────────────
  "openai/o4-mini": { inputPer1M: 1.1, outputPer1M: 4.4, provider: "openai" },

  // ── Anthropic Claude 4.x (hyphenated API IDs — matches Anthropic SDK output) ──
  "anthropic/claude-opus-4-7": { inputPer1M: 15.0, outputPer1M: 75.0, provider: "anthropic" },
  "anthropic/claude-sonnet-4-6": { inputPer1M: 3.0, outputPer1M: 15.0, provider: "anthropic" },
  "anthropic/claude-haiku-4-5-20251001": { inputPer1M: 0.8, outputPer1M: 4.0, provider: "anthropic" },

  // ── Anthropic Claude (dot-notation aliases) ──────────────────────────────────
  "anthropic/claude-sonnet-4.5": { inputPer1M: 3.0, outputPer1M: 15.0, provider: "anthropic" },
  "anthropic/claude-opus-4.5": { inputPer1M: 15.0, outputPer1M: 75.0, provider: "anthropic" },
  "anthropic/claude-haiku-4.5": { inputPer1M: 0.8, outputPer1M: 4.0, provider: "anthropic" },

  // ── Embedding models (no output cost) ─────────────────────────────────────────
  "openai/text-embedding-3-large": { inputPer1M: 0.13, outputPer1M: 0, provider: "embedding" },
  "openai/text-embedding-3-small": { inputPer1M: 0.02, outputPer1M: 0, provider: "embedding" },
};

/** Normalises a model ID to the prefixed form (e.g. "gpt-4o" → "openai/gpt-4o"). */
export function normalizeModelId(id: string): string {
  if (!id) return id;
  const trimmed = id.trim().toLowerCase();
  if (trimmed.includes("/")) return trimmed;
  if (trimmed.startsWith("claude-")) return `anthropic/${trimmed}`;
  if (
    trimmed.startsWith("gpt-") ||
    trimmed.startsWith("o1-") ||
    trimmed.startsWith("o3-") ||
    trimmed.startsWith("o4-") ||
    trimmed.startsWith("text-embedding-")
  )
    return `openai/${trimmed}`;
  // For unrecognized model IDs, return as-is to avoid wrong provider attribution
  return trimmed;
}

export function getModelPricing(id: string): ModelPricing | null {
  if (!id) return null;
  return PRICING_MAP[normalizeModelId(id)] ?? null;
}

export function estimateCost(id: string, inputTokens: number, outputTokens: number): number {
  const pricing = getModelPricing(id);
  if (!pricing) return 0;
  return (inputTokens / 1_000_000) * pricing.inputPer1M + (outputTokens / 1_000_000) * pricing.outputPer1M;
}

export function estimateCostWithFallback(
  id: string,
  inputTokens: number,
  outputTokens: number,
): { cost: number; pricing: ModelPricing; matchedModel: string | null } {
  const pricing = getModelPricing(id);
  if (pricing) {
    const cost = (inputTokens / 1_000_000) * pricing.inputPer1M + (outputTokens / 1_000_000) * pricing.outputPer1M;
    return { cost, pricing, matchedModel: id };
  }
  const cost =
    (inputTokens / 1_000_000) * FALLBACK_PRICING.inputPer1M +
    (outputTokens / 1_000_000) * FALLBACK_PRICING.outputPer1M;
  return { cost, pricing: FALLBACK_PRICING, matchedModel: null };
}

export function listKnownModels(): string[] {
  return Object.keys(PRICING_MAP);
}

/**
 * Extracts the model id from a chat_history metadata blob.
 *
 * The assistant write path (api/ai-assistant/chat/handler-v2.ts) records the
 * model under the `model` key — NOT `modelId`. Reading the wrong key made the
 * AI System Health "Models in use" table report every call as "unknown".
 * Always go through this helper so the reader and writer can never drift again.
 * Falls back to `modelId` for any legacy rows that used the old key.
 */
export function extractModelId(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "";
  const meta = metadata as Record<string, unknown>;
  const model = meta.model ?? meta.modelId;
  return typeof model === "string" ? model : "";
}

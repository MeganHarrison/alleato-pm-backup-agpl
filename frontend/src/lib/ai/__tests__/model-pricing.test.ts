import {
  normalizeModelId,
  getModelPricing,
  estimateCost,
  estimateCostWithFallback,
  extractModelId,
  FALLBACK_PRICING,
} from "../model-pricing";

describe("normalizeModelId", () => {
  it("returns already-prefixed IDs unchanged", () => {
    expect(normalizeModelId("anthropic/claude-sonnet-4-6")).toBe("anthropic/claude-sonnet-4-6");
    expect(normalizeModelId("openai/gpt-4o")).toBe("openai/gpt-4o");
  });

  it("prefixes claude- models with anthropic/", () => {
    expect(normalizeModelId("claude-sonnet-4-6")).toBe("anthropic/claude-sonnet-4-6");
    expect(normalizeModelId("claude-haiku-4-5-20251001")).toBe("anthropic/claude-haiku-4-5-20251001");
    expect(normalizeModelId("claude-opus-4.5")).toBe("anthropic/claude-opus-4.5");
  });

  it("prefixes gpt- models with openai/", () => {
    expect(normalizeModelId("gpt-4o")).toBe("openai/gpt-4o");
    expect(normalizeModelId("gpt-4.1-mini")).toBe("openai/gpt-4.1-mini");
  });

  it("prefixes o1-/o3-/o4- reasoning models with openai/", () => {
    expect(normalizeModelId("o4-mini")).toBe("openai/o4-mini");
  });

  it("prefixes text-embedding- models with openai/", () => {
    expect(normalizeModelId("text-embedding-3-large")).toBe("openai/text-embedding-3-large");
  });

  it("returns unrecognized model IDs unchanged without adding a wrong prefix", () => {
    expect(normalizeModelId("gemini-pro")).toBe("gemini-pro");
    expect(normalizeModelId("command-r")).toBe("command-r");
  });

  it("lowercases and trims input", () => {
    expect(normalizeModelId("  GPT-4O  ")).toBe("openai/gpt-4o");
    expect(normalizeModelId("Claude-Sonnet-4-6")).toBe("anthropic/claude-sonnet-4-6");
  });

  it("returns the input unchanged when id is empty", () => {
    expect(normalizeModelId("")).toBe("");
  });
});

describe("getModelPricing", () => {
  it("returns correct pricing for a known hyphenated Anthropic model ID", () => {
    const pricing = getModelPricing("claude-sonnet-4-6");
    expect(pricing).not.toBeNull();
    expect(pricing?.provider).toBe("anthropic");
    expect(pricing?.inputPer1M).toBe(3.0);
    expect(pricing?.outputPer1M).toBe(15.0);
  });

  it("returns correct pricing for a prefixed Anthropic model ID", () => {
    const pricing = getModelPricing("anthropic/claude-sonnet-4-6");
    expect(pricing).not.toBeNull();
    expect(pricing?.inputPer1M).toBe(3.0);
  });

  it("returns correct pricing for a known OpenAI model ID", () => {
    const pricing = getModelPricing("gpt-4o");
    expect(pricing).not.toBeNull();
    expect(pricing?.provider).toBe("openai");
    expect(pricing?.inputPer1M).toBe(2.5);
  });

  it("returns null for an unknown model", () => {
    expect(getModelPricing("gemini-pro")).toBeNull();
    expect(getModelPricing("unknown-model-xyz")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(getModelPricing("")).toBeNull();
  });
});

describe("estimateCostWithFallback", () => {
  it("returns exact pricing for a known model", () => {
    const { cost, pricing, matchedModel } = estimateCostWithFallback("claude-sonnet-4-6", 1_000_000, 1_000_000);
    expect(matchedModel).toBe("claude-sonnet-4-6");
    expect(pricing.estimated).toBeFalsy();
    // 1M input @ $3 + 1M output @ $15 = $18
    expect(cost).toBeCloseTo(18.0);
  });

  it("uses fallback pricing for an unknown model and sets matchedModel to null", () => {
    const { cost, pricing, matchedModel } = estimateCostWithFallback("gemini-ultra", 1_000_000, 1_000_000);
    expect(matchedModel).toBeNull();
    expect(pricing).toBe(FALLBACK_PRICING);
    // 1M input @ $1.5 + 1M output @ $6 = $7.5
    expect(cost).toBeCloseTo(7.5);
  });

  it("returns zero cost for zero tokens", () => {
    const { cost } = estimateCostWithFallback("claude-sonnet-4-6", 0, 0);
    expect(cost).toBe(0);
  });
});

describe("extractModelId", () => {
  // Guardrail: the chat write path records the model under `model`, not `modelId`.
  // Reading the wrong key made AI System Health report every call as "unknown".
  it("reads the `model` key written by the chat handler", () => {
    expect(extractModelId({ model: "openai/gpt-5.4", usage: {} })).toBe("openai/gpt-5.4");
  });

  it("falls back to the legacy `modelId` key", () => {
    expect(extractModelId({ modelId: "anthropic/claude-sonnet-4-6" })).toBe("anthropic/claude-sonnet-4-6");
  });

  it("prefers `model` over `modelId` when both exist", () => {
    expect(extractModelId({ model: "openai/gpt-5.4", modelId: "old" })).toBe("openai/gpt-5.4");
  });

  it("returns empty string for missing/invalid metadata", () => {
    expect(extractModelId(null)).toBe("");
    expect(extractModelId(undefined)).toBe("");
    expect(extractModelId({})).toBe("");
    expect(extractModelId({ model: 42 })).toBe("");
  });
});

describe("estimateCost", () => {
  it("computes cost correctly for a known model", () => {
    // 500K input @ $3/1M + 200K output @ $15/1M = $1.50 + $3.00 = $4.50
    expect(estimateCost("claude-sonnet-4-6", 500_000, 200_000)).toBeCloseTo(4.5);
  });

  it("returns 0 for an unknown model", () => {
    expect(estimateCost("not-a-real-model", 1_000_000, 1_000_000)).toBe(0);
  });
});

export const AI_ASSISTANT_MODELS = [
  {
    id: "deep-agents/strategist",
    label: "Deep Agents",
    description: "Backend strategist harness",
  },
  {
    id: "openai/gpt-5.4",
    label: "GPT-5.4",
    description: "Primary strategist model",
  },
  {
    id: "openai/gpt-5.5",
    label: "GPT-5.5",
    description: "Newest general model",
  },
  {
    id: "openai/gpt-5.4-mini",
    label: "GPT-5.4 Mini",
    description: "Faster lightweight model",
  },
] as const;

export type AiAssistantModelId = (typeof AI_ASSISTANT_MODELS)[number]["id"];

export const DEEP_AGENTS_STRATEGIST_MODEL: AiAssistantModelId =
  "deep-agents/strategist";

export const DEFAULT_AI_ASSISTANT_MODEL: AiAssistantModelId = "openai/gpt-5.4";

export function isAiAssistantModelId(value: unknown): value is AiAssistantModelId {
  return (
    typeof value === "string" &&
    AI_ASSISTANT_MODELS.some((model) => model.id === value)
  );
}

export function isDeepAgentsStrategistModelId(
  value: unknown,
): value is typeof DEEP_AGENTS_STRATEGIST_MODEL {
  return value === DEEP_AGENTS_STRATEGIST_MODEL;
}

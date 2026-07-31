import {
  AI_ASSISTANT_MODELS,
  DEEP_AGENTS_STRATEGIST_MODEL,
  DEFAULT_AI_ASSISTANT_MODEL,
  isAiAssistantModelId,
  isDeepAgentsStrategistModelId,
} from "../assistant-models";

describe("AI assistant model registry", () => {
  it("exposes Deep Agents as a selectable strategist model", () => {
    expect(AI_ASSISTANT_MODELS[0]).toMatchObject({
      id: DEEP_AGENTS_STRATEGIST_MODEL,
      label: "Deep Agents",
      description: "Backend strategist harness",
    });
    expect(isAiAssistantModelId(DEEP_AGENTS_STRATEGIST_MODEL)).toBe(true);
    expect(isDeepAgentsStrategistModelId(DEEP_AGENTS_STRATEGIST_MODEL)).toBe(
      true,
    );
  });

  it("keeps the default model on the AI SDK provider path", () => {
    expect(DEFAULT_AI_ASSISTANT_MODEL).toBe("openai/gpt-5.4");
    expect(isDeepAgentsStrategistModelId(DEFAULT_AI_ASSISTANT_MODEL)).toBe(
      false,
    );
  });
});

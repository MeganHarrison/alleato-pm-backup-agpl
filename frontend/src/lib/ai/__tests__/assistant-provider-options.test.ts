import {
  buildAssistantOpenAiProviderOptions,
  hasFunctionTools,
} from "@/lib/ai/assistant-provider-options";

describe("buildAssistantOpenAiProviderOptions", () => {
  it("OMITS reasoningEffort when function tools are attached (gpt-5.4 rejects the combo)", () => {
    const opts = buildAssistantOpenAiProviderOptions(true);
    expect(opts.textVerbosity).toBe("low");
    expect("reasoningEffort" in opts).toBe(false);
  });

  it("sends reasoningEffort 'low' when no function tools are attached", () => {
    const opts = buildAssistantOpenAiProviderOptions(false);
    expect(opts.textVerbosity).toBe("low");
    expect(opts.reasoningEffort).toBe("low");
  });
});

describe("hasFunctionTools", () => {
  it("is true only for a non-empty tool set", () => {
    expect(hasFunctionTools({ search: () => {} })).toBe(true);
    expect(hasFunctionTools({})).toBe(false);
    expect(hasFunctionTools(undefined)).toBe(false);
    expect(hasFunctionTools(null)).toBe(false);
  });
});

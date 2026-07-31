import {
  formatAIProviderFailure,
  getAiProviderPath,
  getOpenAICompatibleClientConfig,
  getOpenAIModelId,
  usesAiGateway,
} from "../provider-config";

describe("AI provider config", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("prefers Vercel AI Gateway when the gateway key is configured", () => {
    delete process.env.AI_PROVIDER_PATH;
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.AI_GATEWAY_API_KEY = "test-gateway-key";

    expect(getAiProviderPath()).toBe("vercel_gateway");
    expect(usesAiGateway()).toBe(true);
    expect(getOpenAIModelId("gpt-4.1-mini")).toBe("openai/gpt-4.1-mini");
    expect(getOpenAICompatibleClientConfig("test request")).toMatchObject({
      apiKey: "test-gateway-key",
      baseURL: "https://ai-gateway.vercel.sh/v1",
      providerPath: "vercel_gateway",
    });
  });

  it("uses direct OpenAI when explicitly selected", () => {
    process.env.AI_PROVIDER_PATH = "openai";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.AI_GATEWAY_API_KEY = "test-gateway-key";

    expect(getAiProviderPath()).toBe("openai");
    expect(usesAiGateway()).toBe(false);
    expect(getOpenAIModelId("openai/gpt-4.1-mini")).toBe("gpt-4.1-mini");
    expect(getOpenAICompatibleClientConfig("test request")).toMatchObject({
      apiKey: "test-openai-key",
      providerPath: "openai",
    });
  });

  it("uses Vercel AI Gateway when explicitly selected", () => {
    process.env.AI_PROVIDER_PATH = "vercel_gateway";
    process.env.AI_GATEWAY_API_KEY = "test-gateway-key";
    delete process.env.OPENAI_API_KEY;

    expect(getAiProviderPath()).toBe("vercel_gateway");
    expect(usesAiGateway()).toBe(true);
    expect(getOpenAIModelId("gpt-4.1-mini")).toBe("openai/gpt-4.1-mini");
    expect(getOpenAICompatibleClientConfig("test request")).toMatchObject({
      apiKey: "test-gateway-key",
      baseURL: "https://ai-gateway.vercel.sh/v1",
      providerPath: "vercel_gateway",
    });
  });

  it("fails loudly for a missing direct OpenAI key", () => {
    process.env.AI_PROVIDER_PATH = "openai";
    delete process.env.OPENAI_API_KEY;

    expect(() => getOpenAICompatibleClientConfig("Daily Brief refresh")).toThrow(
      "Daily Brief refresh requires OPENAI_API_KEY",
    );
  });

  it("fails loudly for an unsupported provider path", () => {
    process.env.AI_PROVIDER_PATH = "mystery";

    expect(() => getAiProviderPath()).toThrow(
      'Unsupported AI_PROVIDER_PATH "mystery"',
    );
  });

  it("adds quota and prevention context to provider failures", () => {
    process.env.AI_PROVIDER_PATH = "vercel_gateway";

    const message = formatAIProviderFailure(
      new Error("402 Insufficient funds"),
      "Daily Brief refresh",
    );

    expect(message).toContain('Daily Brief refresh failed on AI provider path "vercel_gateway"');
    expect(message).toContain("Provider quota/billing appears");
    expect(message).toContain("Prevention:");
  });
});

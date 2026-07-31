const mockTraceScore = jest.fn();
const mockTraceGeneration = jest.fn();
const mockTrace = jest.fn(() => ({
  generation: mockTraceGeneration,
  score: mockTraceScore,
}));
const mockFlushAsync = jest.fn().mockResolvedValue(undefined);
const mockGenerationUpdate = jest.fn();
const mockGenerationEnd = jest.fn();
const mockStartObservation = jest.fn(() => ({
  update: mockGenerationUpdate,
  end: mockGenerationEnd,
}));

jest.mock("langfuse", () => ({
  Langfuse: jest.fn().mockImplementation(() => ({
    trace: mockTrace,
    flushAsync: mockFlushAsync,
  })),
}));
jest.mock("@langfuse/tracing", () => ({
  startObservation: mockStartObservation,
}));
jest.mock("ai", () => ({
  generateObject: jest.fn(),
}));

import {
  startChatGenerationObservation,
  traceChatCompletion,
} from "../langfuse-trace";

describe("direct Langfuse trace quality", () => {
  const originalSecretKey = process.env.LANGFUSE_SECRET_KEY;
  const originalPublicKey = process.env.LANGFUSE_PUBLIC_KEY;

  beforeAll(() => {
    process.env.LANGFUSE_SECRET_KEY = "test-secret";
    process.env.LANGFUSE_PUBLIC_KEY = "test-public";
  });

  afterAll(() => {
    process.env.LANGFUSE_SECRET_KEY = originalSecretKey;
    process.env.LANGFUSE_PUBLIC_KEY = originalPublicKey;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses a specialized upstream quality contract instead of generic activity scoring", async () => {
    await traceChatCompletion({
      userId: "user-1",
      sessionId: "session-1",
      modelId: "openai/gpt-4.1-mini",
      input: "Analyze the complete review collection",
      output: "A prioritized executive answer with cited evidence.",
      intent: "source_lookup",
      qualityScore: 92,
      qualityReasons: [
        "typed executive thesis present",
        "semantic advisor review passed",
      ],
      toolTrace: [
        {
          tool: "meetingCollectionAnalysis",
          status: "success",
          output: { coverage: { retrieved: 30 } },
        },
      ],
    });

    expect(mockTraceScore).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "response_quality",
        value: 0.92,
        comment:
          "typed executive thesis present; semantic advisor review passed",
      }),
    );
    expect(mockFlushAsync).toHaveBeenCalledTimes(1);
  });

  it("adds exactly one generation child to the active chat trace", () => {
    const generation = startChatGenerationObservation({
      model: "openai/gpt-4.1-mini",
      input: "What matters most today?",
      maxOutputTokens: 1200,
      intent: "latest_status",
      planReason: "followup_to_prior_briefing",
    });

    generation.complete({
      output: "A concise, source-backed answer.",
      finishReason: "stop",
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      toolCallNames: ["microsoftInbox"],
    });
    generation.complete({ output: "must not update twice" });

    expect(mockStartObservation).toHaveBeenCalledWith(
      "ai-assistant-generation",
      expect.objectContaining({
        model: "openai/gpt-4.1-mini",
        input: "What matters most today?",
      }),
      { asType: "generation" },
    );
    expect(mockGenerationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        output: "A concise, source-backed answer.",
        usageDetails: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      }),
    );
    expect(mockGenerationEnd).toHaveBeenCalledTimes(1);
  });
});

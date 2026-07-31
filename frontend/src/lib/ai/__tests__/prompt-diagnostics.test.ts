jest.mock("@/lib/ai/bot-core", () => ({
  assembleSystemPrompt: jest.fn(),
}));

jest.mock("@/lib/ai/source-health", () => ({
  loadAssistantSourceHealthContext: jest.fn(),
}));

import { assembleSystemPrompt } from "@/lib/ai/bot-core";
import { loadAssistantSourceHealthContext } from "@/lib/ai/source-health";
import {
  assembleAssistantPromptDiagnostics,
  assertNonEmptySystemPrompt,
  buildAiSdkPromptPayload,
  redactSystemPrompt,
} from "../prompt-diagnostics";

const mockAssembleSystemPrompt = assembleSystemPrompt as jest.MockedFunction<
  typeof assembleSystemPrompt
>;
const mockLoadAssistantSourceHealthContext =
  loadAssistantSourceHealthContext as jest.MockedFunction<
    typeof loadAssistantSourceHealthContext
  >;

describe("prompt diagnostics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("builds an AI SDK prompt payload only when the system prompt is non-empty", () => {
    const payload = buildAiSdkPromptPayload({
      where: "test-stream",
      systemPrompt: "You are Alleato AI.",
      messages: [{ role: "user", content: "hello" }],
    });

    expect(payload.instructions).toBe("You are Alleato AI.");
    expect(payload.messages).toHaveLength(1);
  });

  it("fails loudly before streamText can run with an empty system prompt", () => {
    expect(() => assertNonEmptySystemPrompt("   ", "test-stream")).toThrow(
      /refused to call the AI SDK with an empty system prompt/i,
    );
  });

  it("detects base and dynamic prompt sections in the assembled runtime prompt", async () => {
    mockAssembleSystemPrompt.mockResolvedValue(
      [
        "## Soul",
        "## Identity",
        "SEARCH FIRST, ADMIT LAST",
        "You are the Chief Strategist of Alleato AI.",
        "## Runtime Date Context",
        "## Tool Routing Policy",
        "- searchTeamsMessages: Use when user asks for Teams messages.",
        "## Active Project Context",
        "The user has pinned: Ulta Beauty Fresno.",
      ].join("\n\n"),
    );
    mockLoadAssistantSourceHealthContext.mockResolvedValue({
      metadata: {
        generatedAt: "2026-05-11T00:00:00.000Z",
        reason: "source_status_request",
        overallStatus: "healthy",
        missingStage: null,
        counts: {
          sources: 1,
          criticalSources: 0,
          warningSources: 0,
          unembedded: 0,
          uncompiled: 0,
          failedSubscriptions: 0,
          expiringSubscriptions: 0,
        },
        sources: [],
        alerts: [],
      },
      promptInjection: "## Source Sync Health\nOverall status: healthy",
      trace: { tool: "assistantSourceHealth" },
    });

    const diagnostics = await assembleAssistantPromptDiagnostics({
      userId: "user-1",
      messageText: "latest on Ulta",
      selectedProjectId: 127,
      includeSourceHealth: true,
      supabase: {} as never,
      additionalContextBlocks: [
        {
          id: "test_packet",
          label: "Current Project Intelligence Packet",
          content: "Use this packet as primary evidence.",
        },
      ],
    });

    expect(diagnostics.prompt).toContain("## Soul");
    expect(diagnostics.prompt).toContain("## Source Sync Health");
    expect(diagnostics.prompt).toContain("Current Project Intelligence Packet");
    expect(diagnostics.charCount).toBeGreaterThan(0);
    expect(diagnostics.approxTokenCount).toBeGreaterThan(0);
    expect(diagnostics.promptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(diagnostics.additionalContextBlockIds).toEqual(["test_packet"]);
    expect(diagnostics.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "soul", present: true }),
        expect.objectContaining({ id: "identity", present: true }),
        expect.objectContaining({ id: "search_first", present: true }),
        expect.objectContaining({ id: "strategist", present: true }),
        expect.objectContaining({ id: "runtime_date", present: true }),
        expect.objectContaining({ id: "tool_routing_policy", present: true }),
        expect.objectContaining({ id: "active_project", present: true }),
        expect.objectContaining({ id: "source_health", present: true }),
        expect.objectContaining({ id: "intelligence_packet", present: true }),
      ]),
    );
  });

  it("redacts obvious credentials before returning diagnostic prompt text", () => {
    const redacted = redactSystemPrompt(
      "Contact owner@example.com or 555-123-4567 with token abcdefghijklmnopqrstuvwxyzABCDEF123456.",
    );

    expect(redacted).not.toContain("owner@example.com");
    expect(redacted).not.toContain("555-123-4567");
    expect(redacted).not.toContain("abcdefghijklmnopqrstuvwxyzABCDEF123456");
    expect(redacted).toContain("[redacted-email]");
    expect(redacted).toContain("[redacted-phone]");
    expect(redacted).toContain("[redacted-token]");
  });
});

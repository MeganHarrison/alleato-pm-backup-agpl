/**
 * Regression tests for createStrategistFailureResponse.
 *
 * Bug: The AI assistant always returned a static failure string when the AI Gateway
 * returned finishReason: "other" (empty text). This regression test ensures the
 * response is contextual (not generic) and the function never silently regresses.
 *
 * @see CLAUDE.md Rules 14 & 15 — Bug Fix Completion Gate + Regression Test Gate
 * @see frontend/src/app/api/ai-assistant/chat/route.ts — where this is called
 */

import { createStrategistFailureResponse } from "../strategist-failure-response";

describe("createStrategistFailureResponse", () => {
  const baseParams = {
    cause: "AI Gateway returned finishReason: other with empty text",
    selectedProjectId: undefined as number | undefined,
    toolTrace: [] as Array<Record<string, unknown>>,
    userMessage: undefined as string | undefined,
  };

  it("returns a contextual, non-trivial string (regression: must include cause)", () => {
    const result = createStrategistFailureResponse(baseParams);
    expect(result).toContain(baseParams.cause);
    expect(result.length).toBeGreaterThan(50);
  });

  it("includes no-project hint when selectedProjectId is undefined", () => {
    const result = createStrategistFailureResponse({ ...baseParams, selectedProjectId: undefined });
    expect(result).toContain("No project was pinned");
  });

  it("includes pinned-project hint when selectedProjectId is set", () => {
    const result = createStrategistFailureResponse({ ...baseParams, selectedProjectId: 67 });
    expect(result).toContain("The pinned project context was included");
  });

  it("summarizes failed tools from toolTrace", () => {
    const trace = [
      { tool: "semanticSearch", error: "network timeout", timestamp: new Date().toISOString() },
      { tool: "projectContext", output: { rows: 3 }, timestamp: new Date().toISOString() },
    ];
    const result = createStrategistFailureResponse({ ...baseParams, toolTrace: trace });
    expect(result).toContain("semanticSearch");
    expect(result).toContain("1 source");
  });

  it("handles empty toolTrace gracefully", () => {
    const result = createStrategistFailureResponse({ ...baseParams, toolTrace: [] });
    expect(result).toContain("did not get far enough to retrieve");
  });

  it("includes user message context when provided", () => {
    const result = createStrategistFailureResponse({
      ...baseParams,
      userMessage: "What is the budget status for Vermillion Rise?",
    });
    expect(result).toContain("Vermillion Rise");
  });

  it("truncates long user messages at 180 characters with ellipsis", () => {
    const longMessage = "A".repeat(300);
    const result = createStrategistFailureResponse({ ...baseParams, userMessage: longMessage });
    expect(result).toContain("...");
    expect(result).not.toContain("A".repeat(200));
  });

  it("omits scoped follow-up when userMessage is undefined", () => {
    const result = createStrategistFailureResponse({ ...baseParams, userMessage: undefined });
    expect(result).toContain("I still need a successful retrieval pass");
    // The scoped variant uses 'on: "' — should not appear without a userMessage
    expect(result).not.toContain('on: "');
  });
});

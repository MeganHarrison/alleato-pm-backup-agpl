import {
  AI_ASSISTANT_CHAT_WORKFLOW_ID,
  assistantToolsForWorkflow,
  validateAssistantToolRegistry,
  GLOBAL_ASSISTANT_TOOL_REGISTRY,
} from "../tool-registry";

describe("ASRS AI assistant tool registry", () => {
  it("keeps the global registry valid and exposes only read/source ASRS tools", () => {
    expect(validateAssistantToolRegistry(GLOBAL_ASSISTANT_TOOL_REGISTRY)).toEqual({
      ok: true,
      duplicateNames: [],
      missingPolicyMetadata: [],
    });

    const tools = assistantToolsForWorkflow({
      workflowId: AI_ASSISTANT_CHAT_WORKFLOW_ID,
    }).filter((entry) => entry.owner === "asrs_intelligence");

    expect(tools.map((entry) => entry.name).sort()).toEqual([
      "evaluateFmds2026Configuration",
      "searchFmds2026Evidence",
    ]);
    expect(tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "searchFmds2026Evidence",
          capabilities: ["read", "source"],
          requiresWritePermission: false,
          requiresDeliveryPermission: false,
          evidencePolicy: expect.objectContaining({ requiresSourceRefs: true }),
          factory: expect.objectContaining({
            modulePath: "frontend/src/lib/ai/tools/asrs-intelligence.ts",
          }),
        }),
        expect.objectContaining({
          name: "evaluateFmds2026Configuration",
          capabilities: ["read", "source"],
          requiresWritePermission: false,
          requiresDeliveryPermission: false,
        }),
      ]),
    );
  });
});

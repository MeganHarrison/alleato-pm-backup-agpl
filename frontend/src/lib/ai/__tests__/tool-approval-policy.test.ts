import {
  createAssistantToolApprovalPolicy,
  resolveAssistantToolApproval,
  resolveToolApprovalSecret,
  ToolApprovalConfigurationError,
} from "@/lib/ai/tool-approval-policy";
import type { AssistantToolRegistryEntry } from "@/lib/ai/tool-registry";
import { GLOBAL_ASSISTANT_TOOL_REGISTRY } from "@/lib/ai/tool-registry";

function registryEntry(
  overrides: Partial<AssistantToolRegistryEntry>,
): AssistantToolRegistryEntry {
  return {
    name: "searchProject",
    description: "Test tool",
    owningAdapter: "test",
    inputSchemaName: "test.input",
    outputSchemaName: "test.output",
    failureShape: "structured_error",
    metadata: {},
    owner: "ai_assistant",
    category: "workflow",
    capabilities: ["read"],
    workflows: ["ai_assistant_chat"],
    actorModes: ["user_delegated"],
    requiresProjectScope: false,
    requiresWritePermission: false,
    requiresDeliveryPermission: false,
    evidencePolicy: {
      sourceBearing: false,
      requiresSourceRefs: false,
      ledgerRequired: false,
    },
    ...overrides,
  } as AssistantToolRegistryEntry;
}

describe("AI assistant tool approval policy", () => {
  const registry = [
    registryEntry({ name: "searchProject" }),
    registryEntry({
      name: "createTask",
      capabilities: ["write"],
      requiresWritePermission: true,
    }),
    registryEntry({
      name: "sendTeamsMessage",
      capabilities: ["write", "delivery"],
      requiresWritePermission: true,
      requiresDeliveryPermission: true,
    }),
  ];

  it("requires user approval for registered write and delivery calls", () => {
    expect(
      resolveAssistantToolApproval({
        toolName: "createTask",
        toolInput: { confirmed: true },
        registry,
      }),
    ).toBe("user-approval");
    expect(
      resolveAssistantToolApproval({
        toolName: "sendTeamsMessage",
        toolInput: { message: "Escalate" },
        registry,
      }),
    ).toBe("user-approval");
  });

  it("requires approval for exact Prime Contract writes but not side-effect-free previews", () => {
    expect(
      resolveAssistantToolApproval({
        toolName: "createPrimeContract",
        toolInput: { confirmed: false },
        registry: GLOBAL_ASSISTANT_TOOL_REGISTRY,
      }),
    ).toBeUndefined();
    expect(
      resolveAssistantToolApproval({
        toolName: "createPrimeContract",
        toolInput: { confirmed: true },
        registry: GLOBAL_ASSISTANT_TOOL_REGISTRY,
      }),
    ).toBe("user-approval");

    expect(
      resolveAssistantToolApproval({
        toolName: "editPrimeContractSov",
        toolInput: { confirmed: false },
        registry: GLOBAL_ASSISTANT_TOOL_REGISTRY,
      }),
    ).toBeUndefined();
    expect(
      resolveAssistantToolApproval({
        toolName: "editPrimeContractSov",
        toolInput: { confirmed: true },
        registry: GLOBAL_ASSISTANT_TOOL_REGISTRY,
      }),
    ).toBe("user-approval");
  });

  it("does not gate reads or side-effect-free preview calls", () => {
    expect(
      resolveAssistantToolApproval({
        toolName: "searchProject",
        toolInput: { query: "AC1" },
        registry,
      }),
    ).toBeUndefined();
    expect(
      resolveAssistantToolApproval({
        toolName: "createTask",
        toolInput: { confirmed: false },
        registry,
      }),
    ).toBeUndefined();
  });

  it("gates allowlisted MCP artifact writes supplied by runtime discovery", () => {
    expect(
      resolveAssistantToolApproval({
        toolName: "mcp_excalidraw_create_view",
        toolInput: { elements: [] },
        registry,
        additionalApprovalRequiredToolNames: ["mcp_excalidraw_create_view"],
      }),
    ).toBe("user-approval");
  });

  it("adapts the registry decision to the AI SDK generic policy", () => {
    const policy = createAssistantToolApprovalPolicy(registry);
    expect(
      policy({
        toolCall: {
          type: "tool-call",
          toolCallId: "call-1",
          toolName: "createTask",
          input: { confirmed: true },
          dynamic: false,
        },
        tools: undefined,
        toolsContext: undefined,
        runtimeContext: undefined as never,
        messages: [],
      }),
    ).toBe("user-approval");
  });

  it("fails loudly when action tools lack a shared high-entropy secret", () => {
    expect(() =>
      resolveToolApprovalSecret({ actionToolsEnabled: true, env: {} }),
    ).toThrow(ToolApprovalConfigurationError);
    expect(() =>
      resolveToolApprovalSecret({
        actionToolsEnabled: true,
        env: { TOOL_APPROVAL_SECRET: "too-short" },
      }),
    ).toThrow("TOOL_APPROVAL_SECRET must contain at least 32 bytes");
  });

  it("returns the shared secret only for action-capable surfaces", () => {
    const secret = "a".repeat(32);
    expect(
      resolveToolApprovalSecret({
        actionToolsEnabled: true,
        env: { TOOL_APPROVAL_SECRET: secret },
      }),
    ).toBe(secret);
    expect(
      resolveToolApprovalSecret({ actionToolsEnabled: false, env: {} }),
    ).toBeUndefined();
  });
});

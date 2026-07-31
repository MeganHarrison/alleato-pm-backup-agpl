jest.mock("server-only", () => ({}));
jest.mock("@/lib/ai/providers", () => ({
  getLanguageModel: jest.fn(),
}));
jest.mock("@/lib/ai/tool-registry", () => ({
  AI_ASSISTANT_CHAT_WORKFLOW_ID: "ai_assistant_chat",
  filterRegisteredToolSet: jest.fn(
    ({ tools }: { tools: Record<string, unknown> }) => tools,
  ),
  toolVisibilityForFactory: jest.fn(() => ({
    visibleToolNames: [],
    hiddenTools: [],
  })),
  toolDefinitionsForWorkflow: jest.fn(() => []),
}));
jest.mock("@/lib/ai/tools/project-tools", () => ({
  createProjectTools: jest.fn(() => ({ getProjectDetails: { description: "mock" } })),
}));
jest.mock("@/lib/ai/tools/web-search", () => ({
  createWebSearchTools: jest.fn(() => ({ searchWeb: { description: "mock" } })),
}));
jest.mock("@/lib/ai/tools/action-tools", () => ({
  createActionTools: jest.fn(() => ({})),
}));
jest.mock("@/lib/ai/tools/feature-request-tools", () => ({
  createFeatureRequestTools: jest.fn(() => ({})),
}));
jest.mock("@/lib/ai/tools/progress-report-tools", () => ({
  createProgressReportTools: jest.fn(() => ({})),
}));
jest.mock("@/lib/ai/tools/workspace-tools", () => ({
  createWorkspaceTools: jest.fn(() => ({})),
}));
jest.mock("@/lib/ai/tools/structured-output", () => ({
  createStructuredOutputTools: jest.fn(() => ({})),
}));
jest.mock("@/lib/ai/tools/document-intelligence", () => ({
  createDocumentIntelligenceTools: jest.fn(() => ({})),
}));
jest.mock("@/lib/ai/tools/marketing", () => ({
  createMarketingTools: jest.fn(() => ({
    createContentCalendarDraft: { description: "mock" },
  })),
}));

import { AGENT_DESCRIPTIONS, AGENT_LABELS, AGENT_NAMES } from "../agents/types";
import {
  agentRegistry,
  createSpecialistAgentTools,
  createStrategistTools,
} from "../orchestrator";

describe("CMO agent registration", () => {
  it("registers CMO labels, description, routing keywords, and consult tool", () => {
    expect(AGENT_NAMES.CMO).toBe("cmo");
    expect(AGENT_LABELS.cmo).toBe("CMO");
    expect(AGENT_DESCRIPTIONS.cmo).toContain("Brand");
    expect(agentRegistry.cmo?.triggerKeywords).toEqual(
      expect.arrayContaining([
        "content calendar",
        "linkedin",
        "case study",
        "testimonial",
        "campaign",
      ]),
    );

    const strategistTools = createStrategistTools("user-1");
    expect(strategistTools).toHaveProperty("consultCMO");
    expect(strategistTools).not.toHaveProperty("createContentCalendarDraft");
  });

  it("keeps web search available to every specialist agent", () => {
    for (const agentId of Object.keys(agentRegistry)) {
      const tools = createSpecialistAgentTools(agentId, "user-1");

      expect(tools).toHaveProperty("searchWeb");
    }
  });
});

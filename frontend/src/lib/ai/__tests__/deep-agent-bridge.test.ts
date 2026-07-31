import {
  buildDeepAgentResearchEvidenceWidget,
  formatDeepAgentAppExpertContext,
  formatDeepAgentExecutiveDirectResponse,
  formatDeepAgentResearchContext,
  formatDeepAgentResearchDirectResponse,
  shouldUseDeepAgentAppExpertBridge,
  shouldUseDeepAgentExecutiveBridge,
  shouldUseDeepAgentResearchBridge,
  shouldUseDeepAgentResearchDirectResponse,
  type DeepAppExpertResponse,
  type DeepResearchResponse,
} from "../deep-agent-bridge";

const originalEnv = process.env;

beforeEach(() => {
  process.env = {
    ...originalEnv,
    BACKEND_URL: "https://backend.example.test",
    PYTHON_BACKEND_URL: "",
  };
});

afterEach(() => {
  process.env = originalEnv;
});

const researchPacket: DeepResearchResponse = {
  answer:
    "Research is available with cited web context and enough detail for a direct answer.",
  mode: "deep_agents",
  sources: [
    {
      title: "Example source",
      url: "https://example.com/source",
      sourceType: "web",
    },
  ],
  toolTrace: [
    {
      agent: "research",
      tool: "deepagents_research_runtime",
      status: "success",
      durationMs: 120,
    },
  ],
  skillsLoaded: ["deep-agents-core"],
  orchestrator: "research",
};

const appExpertPacket: DeepAppExpertResponse = {
  answer: "Use the project intelligence page for the current project brief.",
  mode: "deep_agents",
  sources: [
    {
      title: "Project intelligence route",
      sourceType: "sitemap",
      route: "/:projectId/intelligence",
      filePath: "frontend/src/app/(main)/[projectId]/intelligence/page.tsx",
      detail: "Current project intelligence surface.",
    },
  ],
  toolTrace: [
    {
      agent: "app-expert",
      tool: "feature_registry",
      status: "success",
      durationMs: 44,
    },
  ],
  skillsLoaded: ["app-expert"],
  approvedSkillContext: null,
  orchestrator: "app-expert",
};

describe("Deep Agents live bridge", () => {
  it("derives bridge availability from backend URL, not a separate frontend flag", () => {
    process.env = {
      ...originalEnv,
      BACKEND_URL: "",
      PYTHON_BACKEND_URL: "",
    };

    expect(shouldUseDeepAgentResearchBridge({ intent: "external_research" })).toBe(false);
    expect(shouldUseDeepAgentAppExpertBridge({ intent: "app_help" })).toBe(false);
    expect(
      shouldUseDeepAgentExecutiveBridge({
        intent: "latest_status",
        planReason: "executive_deep_agent_broad_operator_question",
      }),
    ).toBe(false);
  });

  it("routes only live research and app-help bridge intents", () => {
    expect(shouldUseDeepAgentResearchBridge({ intent: "external_research" })).toBe(true);
    expect(shouldUseDeepAgentResearchBridge({ intent: "latest_status" })).toBe(false);
    expect(shouldUseDeepAgentAppExpertBridge({ intent: "app_help" })).toBe(true);
    expect(shouldUseDeepAgentAppExpertBridge({ intent: "latest_status" })).toBe(false);
    expect(
      shouldUseDeepAgentExecutiveBridge({
        intent: "latest_status",
        planReason: "executive_deep_agent_broad_operator_question",
      }),
    ).toBe(true);
    expect(
      shouldUseDeepAgentExecutiveBridge({
        intent: "risk_review",
        planReason: "followup_to_prior_briefing",
      }),
    ).toBe(false);
  });

  it("formats research context and evidence widgets", () => {
    expect(formatDeepAgentResearchContext(researchPacket)).toContain(
      "Backend research synthesis",
    );
    expect(shouldUseDeepAgentResearchDirectResponse(researchPacket)).toBe(true);
    expect(buildDeepAgentResearchEvidenceWidget(researchPacket)).toMatchObject({
      id: "deep-agent-research-evidence",
      sources: [{ href: "https://example.com/source" }],
    });
  });

  it("never leaks developer-facing source-coverage notes into the user answer", () => {
    const noSourcePacket: DeepResearchResponse = {
      ...researchPacket,
      answer: "## Status\n\nPortfolio is active with a few decision-gated jobs.\n",
      sources: [],
    };

    const research = formatDeepAgentResearchDirectResponse(noSourcePacket);
    const executive = formatDeepAgentExecutiveDirectResponse(noSourcePacket);

    for (const output of [research, executive]) {
      expect(output).toBe(
        "## Status\n\nPortfolio is active with a few decision-gated jobs.",
      );
      expect(output).not.toContain("Source coverage note");
      expect(output).not.toContain("backend tool trace");
      expect(output).not.toContain("audit-ready evidence");
    }
  });

  it("formats app expert context without project-status bridge wiring", () => {
    expect(formatDeepAgentAppExpertContext(appExpertPacket)).toContain(
      "Backend app answer",
    );
    expect(formatDeepAgentAppExpertContext(appExpertPacket)).toContain(
      "/:projectId/intelligence",
    );
  });
});

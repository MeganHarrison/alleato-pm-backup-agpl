import { workflowDefinitionSchema } from "../contracts";
import {
  EXECUTIVE_DAILY_BRIEF_WORKFLOW,
  EXECUTIVE_DAILY_BRIEF_WORKFLOW_ID,
  executiveDailyBriefSourcePolicyMetadata,
} from "../executive-daily-brief-workflow";
import {
  EXECUTIVE_DAILY_BRIEF_SOURCE_ADAPTERS,
  requiredExecutiveBriefSourceFamilies,
} from "../source-adapters";
import {
  createExecutiveDailyBriefToolPolicy,
  EXECUTIVE_DAILY_BRIEF_TOOL_REGISTRY,
  executiveDailyBriefToolScope,
  visibleToolsForPolicy,
} from "../tool-registry";
import { toolDefinitionsForWorkflow } from "@/lib/ai/tool-registry";

describe("Executive Daily Brief workflow pack", () => {
  it("declares the workflow pack, evidence policy, delivery policy, and runtime budget", () => {
    const parsed = workflowDefinitionSchema.parse(
      EXECUTIVE_DAILY_BRIEF_WORKFLOW,
    );

    expect(parsed.workflowId).toBe(EXECUTIVE_DAILY_BRIEF_WORKFLOW_ID);
    expect(parsed.evidencePolicy.requireSourceRefs).toBe(true);
    expect(parsed.evidencePolicy.allowSyntheticEvidence).toBe(false);
    expect(parsed.deliveryPolicy.requireDeliveryAttemptRecord).toBe(true);
    expect(parsed.runtimeBudget.maxToolCalls).toBeGreaterThan(0);
    expect(parsed.failureModes).toContain("delivery_disabled");
  });

  it("centralizes every source adapter required by the brief", () => {
    const adapterIds = EXECUTIVE_DAILY_BRIEF_SOURCE_ADAPTERS.map(
      (adapter) => adapter.adapterId,
    );

    expect(adapterIds).toEqual(
      expect.arrayContaining([
        "fireflies_meetings",
        "outlook_email",
        "teams_messages",
        "documents_rag",
        "acumatica_financials",
        "project_intelligence_packets",
      ]),
    );
    for (const adapter of EXECUTIVE_DAILY_BRIEF_SOURCE_ADAPTERS) {
      expect(adapter.outputRecordType).toBe("evidence_ref");
      expect(adapter.healthRecordType).toBe("source_health_snapshot");
      expect(adapter.supportedHealthStates).toEqual(
        expect.arrayContaining([
          "loaded",
          "stale",
          "missing",
          "degraded",
          "failed",
          "skipped",
        ]),
      );
    }
  });

  it("exports source policy metadata used by run construction", () => {
    const metadata = executiveDailyBriefSourcePolicyMetadata();

    expect(metadata.workflowId).toBe(EXECUTIVE_DAILY_BRIEF_WORKFLOW_ID);
    expect(metadata.minimumEvidenceRefsPerClaim).toBe(1);
    expect(metadata.requiredSourceFamilies).toEqual(
      requiredExecutiveBriefSourceFamilies(),
    );
    expect(metadata.requiredSourceFamilies).toEqual(
      expect.arrayContaining([
        "meeting",
        "email",
        "teams",
        "document",
        "rag",
        "acumatica",
        "project_intelligence",
      ]),
    );
  });

  it("exposes canonical packet Teams delivery without reopening generation tools", () => {
    const policy = createExecutiveDailyBriefToolPolicy({
      allowDelivery: true,
      allowWrites: true,
      allowedChannels: ["teams"],
    });

    const visibleToolNames = visibleToolsForPolicy(
      EXECUTIVE_DAILY_BRIEF_TOOL_REGISTRY,
      policy,
    ).map((toolDefinition) => toolDefinition.name);

    expect(visibleToolNames).toEqual(
      expect.arrayContaining([
        "read-current-daily-executive-brief",
        "fetch-daily-executive-brief-sources",
        "build-teams-daily-brief-payload",
        "send-teams-daily-brief",
      ]),
    );
    expect(visibleToolNames).not.toEqual(
      expect.arrayContaining([
        "generate-executive-daily-brief-packet",
        "persist-executive-daily-brief-artifact",
        "send-email-daily-brief",
      ]),
    );
  });

  it("builds its registry from the global assistant registry", () => {
    const globalDefinitions = toolDefinitionsForWorkflow({
      workflowId: EXECUTIVE_DAILY_BRIEF_WORKFLOW_ID,
      allowedToolNames: EXECUTIVE_DAILY_BRIEF_WORKFLOW.allowedTools,
    });

    expect(EXECUTIVE_DAILY_BRIEF_TOOL_REGISTRY).toEqual(globalDefinitions);
  });

  it("only exposes Teams send when delivery and write policy allow it", () => {
    const scope = executiveDailyBriefToolScope({
      allowDelivery: true,
      allowWrites: true,
      allowedChannels: ["teams"],
    });

    expect(scope.visibleToolNames).toContain(
      "read-current-daily-executive-brief",
    );
    expect(scope.visibleToolNames).toContain("send-teams-daily-brief");
    expect(scope.visibleToolNames).not.toContain("send-email-daily-brief");

    const noDeliveryScope = executiveDailyBriefToolScope({
      allowDelivery: false,
      allowWrites: true,
      allowedChannels: ["teams"],
    });
    expect(noDeliveryScope.visibleToolNames).toContain(
      "build-teams-daily-brief-payload",
    );
    expect(noDeliveryScope.visibleToolNames).not.toContain(
      "send-teams-daily-brief",
    );

    const emailOnlyScope = executiveDailyBriefToolScope({
      allowDelivery: true,
      allowWrites: true,
      allowedChannels: ["email"],
    });
    expect(emailOnlyScope.visibleToolNames).not.toContain(
      "send-teams-daily-brief",
    );
  });

  it("stores actor, project, and source access filters in the workflow policy", () => {
    const scope = executiveDailyBriefToolScope({
      actorMode: "user_delegated",
      allowDelivery: false,
      allowWrites: true,
      allowedProjectIds: [760, 1009],
      allowedSourceFamilies: ["document", "rag", "teams"],
      allowedChannels: ["teams"],
    });

    expect(scope.policy.actorMode).toBe("user_delegated");
    expect(scope.policy.allowedProjectIds).toEqual([760, 1009]);
    expect(scope.policy.allowedSourceFamilies).toEqual([
      "teams",
      "document",
      "rag",
    ]);
    expect(scope.visibleToolNames).toContain("fetch-document-rag-sources");
    expect(scope.visibleToolNames).toContain("fetch-teams-message-sources");
    expect(scope.visibleToolNames).not.toContain("fetch-outlook-email-sources");
    expect(scope.visibleToolNames).not.toContain(
      "fetch-acumatica-financial-sources",
    );
  });

  it("fails loudly when source policy denies every workflow source family", () => {
    expect(() =>
      executiveDailyBriefToolScope({
        allowDelivery: false,
        allowWrites: true,
        allowedSourceFamilies: ["daily_recap"],
      }),
    ).toThrow(
      "Executive Daily Brief tool policy must allow at least one workflow source family.",
    );
  });
});

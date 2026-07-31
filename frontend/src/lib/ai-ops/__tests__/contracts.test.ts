import {
  aiEventSchema,
  aiRunSchema,
  deliveryAttemptSchema,
  evidenceRefSchema,
  toolDefinitionSchema,
  toolPolicySchema,
  workflowDefinitionSchema,
} from "../contracts";

const runId = "11111111-1111-4111-8111-111111111111";

describe("ai-ops contracts", () => {
  it("requires every evidence ref to carry inspectable source identity and excerpt", () => {
    expect(() =>
      evidenceRefSchema.parse({
        sourceFamily: "email",
        sourceId: "email-1",
        sourceTitle: "Owner approval email",
        excerpt: "Owner approval is ready but not signed.",
        confidence: "high",
      }),
    ).not.toThrow();

    expect(() =>
      evidenceRefSchema.parse({
        sourceFamily: "email",
        sourceId: "email-1",
        sourceTitle: "Owner approval email",
        confidence: "high",
      }),
    ).toThrow();
  });

  it("requires runs to include workflow identity, status, source health, and artifacts", () => {
    const parsed = aiRunSchema.parse({
      workflowId: "executive_daily_brief",
      workflowVersion: "2026-06-19",
      triggerType: "preview_request",
      surface: "executive_daily_brief",
      title: "Executive Daily Brief",
      userGoal: "Generate the Executive Daily Brief.",
      normalizedGoal: "Generate evidence-linked owner briefing.",
      status: "running",
      permissionMode: "service",
      sourceHealth: [
        {
          sourceFamily: "email",
          resourceId: "outlook",
          resourceName: "Outlook",
          status: "loaded",
          checkedAt: "2026-06-19T04:00:00.000Z",
          loadedCount: 4,
        },
      ],
      artifacts: [],
    });

    expect(parsed.retryable).toBe(false);
    expect(parsed.sourceHealth).toHaveLength(1);
  });

  it("allows generated Daily Brief runs to carry their daily_recaps artifact id", () => {
    const parsed = aiRunSchema.parse({
      dailyRecapId: "33333333-3333-4333-8333-333333333333",
      workflowId: "executive_daily_brief",
      workflowVersion: "2026-06-19",
      triggerType: "preview_request",
      surface: "executive_daily_brief",
      title: "Executive Daily Brief",
      userGoal: "Generate the Executive Daily Brief.",
      normalizedGoal: "Generate evidence-linked owner briefing.",
      status: "succeeded",
      permissionMode: "service",
      sourceHealth: [],
      artifacts: [],
    });

    expect(parsed.dailyRecapId).toBe(
      "33333333-3333-4333-8333-333333333333",
    );
  });

  it("rejects runs without workflow version or source health shape", () => {
    expect(() =>
      aiRunSchema.parse({
        workflowId: "executive_daily_brief",
        triggerType: "preview_request",
        surface: "executive_daily_brief",
        title: "Executive Daily Brief",
        userGoal: "Generate the Executive Daily Brief.",
        normalizedGoal: "Generate evidence-linked owner briefing.",
        status: "running",
        permissionMode: "service",
        sourceHealth: [{ sourceFamily: "email" }],
        artifacts: [],
      }),
    ).toThrow();
  });

  it("requires delivery attempts to record channel, recipient, status, and attempt time", () => {
    expect(() =>
      deliveryAttemptSchema.parse({
        runId,
        channel: "teams",
        recipientId: "user-1",
        status: "dry_run",
        attemptedAt: "2026-06-19T04:00:00.000Z",
      }),
    ).not.toThrow();

    expect(() =>
      deliveryAttemptSchema.parse({
        runId,
        channel: "teams",
        recipientId: "user-1",
        attemptedAt: "2026-06-19T04:00:00.000Z",
      }),
    ).toThrow();
  });

  it("requires workflow packs to declare tools, source policy, evidence policy, delivery policy, and runtime budget", () => {
    const workflow = workflowDefinitionSchema.parse({
      workflowId: "executive_daily_brief",
      version: "2026-06-19",
      title: "Executive Daily Brief",
      allowedTools: ["fetch-email-sources", "send-teams-message"],
      sourcePolicy: {
        requiredSourceFamilies: ["email", "teams", "meeting"],
        freshnessMinutes: 4320,
        minimumEvidenceRefsPerClaim: 1,
        failWhenRequiredSourcesMissing: true,
      },
      evidencePolicy: {
        requireSourceRefs: true,
        minimumConfidence: "medium",
        allowSyntheticEvidence: false,
      },
      deliveryPolicy: {
        allowedChannels: ["teams", "email"],
        defaultDryRun: true,
        requireDeliveryAttemptRecord: true,
      },
      runtimeBudget: {
        timeoutMs: 120000,
        maxToolCalls: 20,
        maxModelCalls: 2,
      },
      failureModes: ["missing_required_source", "delivery_disabled"],
    });

    expect(workflow.sourcePolicy.minimumEvidenceRefsPerClaim).toBe(1);
  });

  it("requires tool definitions and policy to be explicit before model calls", () => {
    expect(() =>
      toolDefinitionSchema.parse({
        name: "fetch-email-sources",
        description: "Fetch recent email evidence.",
        owningAdapter: "outlook",
        inputSchemaName: "FetchEmailSourcesInput",
        outputSchemaName: "FetchEmailSourcesOutput",
        failureShape: "throws",
      }),
    ).not.toThrow();

    expect(() =>
      toolPolicySchema.parse({
        workflowId: "executive_daily_brief",
        allowedToolNames: ["fetch-email-sources"],
        actorMode: "service",
        allowedSourceFamilies: ["email"],
        allowDelivery: false,
        allowWrites: false,
      }),
    ).not.toThrow();
  });

  it("normalizes accepted event envelopes for preview and scheduled work", () => {
    expect(() =>
      aiEventSchema.parse({
        eventSource: "executive_daily_brief",
        eventType: "preview_request",
        status: "accepted",
        idempotencyKey: "executive_daily_brief:preview:1",
      }),
    ).not.toThrow();
  });
});

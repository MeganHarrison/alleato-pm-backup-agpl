import {
  AI_ASSISTANT_CHAT_WORKFLOW_ID,
  assistantToolsForWorkflow,
  assertUniqueAssistantToolNames,
  filterRegisteredToolSet,
  GLOBAL_ASSISTANT_TOOL_REGISTRY,
  renderAssistantToolRoutingGuide,
  toolDefinitionsForWorkflow,
  validateAssistantToolRegistry,
  type AssistantToolRegistryEntry,
} from "../tool-registry";
import type { ToolSet } from "ai";
import {
  createChangeOrderInputSchema,
  createChangeEventInputSchema,
  createCommitmentInputSchema,
  createGeneratedTaskInputSchema,
  createMeetingNoteInputSchema,
  createOutlookCalendarInviteInputSchema,
  createProjectCompanyInputSchema,
  createProjectContactInputSchema,
  createRFIInputSchema,
  createSubmittalInputSchema,
  createTaskInputSchema,
  deleteGeneratedTaskInputSchema,
  draftOutlookEmailInputSchema,
  flagProjectRiskInputSchema,
  generateProjectSummaryInputSchema,
  findProjectDocumentsInputSchema,
  getAcumaticaProjectBudgetInputSchema,
  getAcumaticaProjectListInputSchema,
  getAPAgingReportInputSchema,
  getARAgingReportInputSchema,
  getCashPositionReportInputSchema,
  getMeetingDetailsInputSchema,
  getMeetingsByDateInputSchema,
  getRecentEmailsInputSchema,
  getPurchaseOrderSummaryInputSchema,
  getRecentBillsInputSchema,
  getRecentInvoicesInputSchema,
  searchDocumentsInputSchema,
  searchEmailsInputSchema,
  searchExternalDocumentsInputSchema,
  searchMeetingsByTopicInputSchema,
  searchTeamsMessagesInputSchema,
  sendTeamsMessageInputSchema,
  semanticSearchInputSchema,
  getVendorSpendReportInputSchema,
  logDailyReportInputSchema,
  updateGeneratedTaskInputSchema,
  updateProjectStatusInputSchema,
  updateRFIStatusInputSchema,
} from "../tool-descriptors";
import {
  EXECUTIVE_DAILY_BRIEF_ALLOWED_TOOLS,
  EXECUTIVE_DAILY_BRIEF_WORKFLOW_ID,
} from "@/lib/ai-ops/executive-daily-brief-workflow";

function registryEntry(
  overrides: Partial<AssistantToolRegistryEntry> = {},
): AssistantToolRegistryEntry {
  return {
    name: "test-tool",
    description: "Test tool.",
    owningAdapter: "test_adapter",
    inputSchemaName: "TestInput",
    outputSchemaName: "TestOutput",
    failureShape: "throws",
    metadata: {},
    owner: "test",
    category: "project",
    capabilities: ["read"],
    workflows: ["test_workflow"],
    actorModes: ["service"],
    requiresProjectScope: false,
    requiresWritePermission: false,
    requiresDeliveryPermission: false,
    evidencePolicy: {
      sourceBearing: false,
      requiresSourceRefs: false,
      ledgerRequired: false,
    },
    factory: null,
    ...overrides,
  };
}

function testToolSet(names: string[]): ToolSet {
  return Object.fromEntries(
    names.map((name) => [
      name,
      {
        execute: jest.fn(),
      },
    ]),
  ) as ToolSet;
}

describe("global AI assistant tool registry", () => {
  it("validates the checked-in registry", () => {
    const validation = validateAssistantToolRegistry(
      GLOBAL_ASSISTANT_TOOL_REGISTRY,
    );

    expect(validation).toEqual({
      ok: true,
      duplicateNames: [],
      missingPolicyMetadata: [],
    });
  });

  it("fails loudly on duplicate tool names", () => {
    expect(() =>
      assertUniqueAssistantToolNames([
        registryEntry({ name: "duplicate-tool" }),
        registryEntry({ name: "duplicate-tool" }),
      ]),
    ).toThrow("Duplicate AI assistant tool registry names: duplicate-tool");
  });

  it("flags source-bearing tools without source family metadata", () => {
    const validation = validateAssistantToolRegistry([
      registryEntry({
        name: "source-tool",
        capabilities: ["read", "source"],
        evidencePolicy: {
          sourceBearing: true,
          requiresSourceRefs: true,
          ledgerRequired: true,
        },
      }),
    ]);

    expect(validation.ok).toBe(false);
    expect(validation.missingPolicyMetadata).toContain(
      "source-tool: sourceFamilies",
    );
  });

  it("flags delivery tools without channel metadata", () => {
    const validation = validateAssistantToolRegistry([
      registryEntry({
        name: "send-tool",
        capabilities: ["write", "delivery"],
        requiresWritePermission: true,
        requiresDeliveryPermission: true,
      }),
    ]);

    expect(validation.ok).toBe(false);
    expect(validation.missingPolicyMetadata).toContain(
      "send-tool: allowedChannels",
    );
  });

  it("exposes Executive Daily Brief as a filtered subset of the global registry", () => {
    const tools = assistantToolsForWorkflow({
      workflowId: EXECUTIVE_DAILY_BRIEF_WORKFLOW_ID,
      allowedToolNames: EXECUTIVE_DAILY_BRIEF_ALLOWED_TOOLS,
    });

    expect(tools.map((tool) => tool.name).sort()).toEqual(
      [...EXECUTIVE_DAILY_BRIEF_ALLOWED_TOOLS].sort(),
    );
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "read-current-daily-executive-brief",
        "fetch-daily-executive-brief-sources",
        "build-teams-daily-brief-payload",
        "send-teams-daily-brief",
      ]),
    );
    expect(
      tools
        .filter((tool) => tool.requiresDeliveryPermission)
        .map((tool) => tool.name),
    ).toEqual(["send-teams-daily-brief"]);
    expect(
      tools.find((tool) => tool.name === "build-teams-daily-brief-payload"),
    ).toMatchObject({
      owningAdapter: "daily_executive_brief_canonical_packet",
      allowedChannels: ["teams"],
      metadata: expect.objectContaining({
        sourceOfTruth: "intelligence_packets",
        targetSlug: "daily-executive-brief",
      }),
    });
    expect(
      tools.find((tool) => tool.name === "send-teams-daily-brief"),
    ).toMatchObject({
      requiresWritePermission: true,
      requiresDeliveryPermission: true,
      allowedChannels: ["teams"],
      metadata: expect.objectContaining({
        sourceOfTruth: "intelligence_packets",
        targetSlug: "daily-executive-brief",
      }),
    });
    expect(tools.map((tool) => tool.name)).not.toContain(
      "send-email-daily-brief",
    );
  });

  it("exposes project and action factories to the assistant chat workflow", () => {
    const tools = assistantToolsForWorkflow({
      workflowId: AI_ASSISTANT_CHAT_WORKFLOW_ID,
    });
    const names = tools.map((tool) => tool.name);

    expect(names).toEqual(
      expect.arrayContaining([
        "getProjectBriefingSnapshot",
        "getCommitmentsOverview",
        "getAPAgingReport",
        "semanticSearch",
        "getSopBacklog",
        "createChangeEvent",
        "createTask",
        "draftOutlookEmail",
        "sendTeamsMessage",
        "searchWeb",
        "captureFeatureRequestPacket",
        "createWeeklyProgressReportDraft",
        "saveWorkspaceArtifact",
        "extractStructuredActionBrief",
        "getSpecRequirements",
        "getDomainIntelligence",
        "readCurrentDailyExecutiveBrief",
        "createMarketingContentAsset",
      ]),
    );
    expect(
      tools.find((tool) => tool.name === "sendTeamsMessage"),
    ).toMatchObject({
      requiresWritePermission: true,
      requiresDeliveryPermission: true,
      allowedChannels: ["teams"],
    });
  });

  it("documents routing policy for key assistant source families", () => {
    const tools = assistantToolsForWorkflow({
      workflowId: AI_ASSISTANT_CHAT_WORKFLOW_ID,
    }).filter((tool) => tool.evidencePolicy.sourceBearing);

    const requiredFamilies = [
      "teams",
      "outlook",
      "email",
      "meeting",
      "fireflies",
      "document",
      "rag",
      "acumatica",
      "procore",
      "project_intelligence",
    ] as const;

    const missing = requiredFamilies.filter(
      (sourceFamily) =>
        !tools.some(
          (tool) =>
            tool.sourceFamilies?.includes(sourceFamily) &&
            tool.routingPolicy &&
            tool.routingPolicy.useWhen.length > 0 &&
            tool.routingPolicy.doNotUseWhen.length > 0 &&
            tool.routingPolicy.regressionPrompts.length > 0,
        ),
    );

    expect(missing).toEqual([]);
  });

  it("projects routing policy into AI Ops tool definition metadata", () => {
    const [definition] = toolDefinitionsForWorkflow({
      workflowId: AI_ASSISTANT_CHAT_WORKFLOW_ID,
      allowedToolNames: ["searchTeamsMessages"],
    });

    expect(definition?.metadata.routingPolicy).toMatchObject({
      useWhen: expect.arrayContaining([
        expect.stringContaining("Teams messages"),
      ]),
      doNotUseWhen: expect.arrayContaining([
        expect.stringContaining("Fireflies meetings"),
      ]),
      emptyResultBehavior: expect.stringContaining(
        "do not substitute meetings",
      ),
      regressionPrompts: expect.arrayContaining([
        "what insights can be found in the teams messages today?",
      ]),
    });
  });

  it("uses descriptor-owned setup for Outlook and Teams source-read tools", () => {
    const definitions = toolDefinitionsForWorkflow({
      workflowId: AI_ASSISTANT_CHAT_WORKFLOW_ID,
      allowedToolNames: [
        "getRecentEmails",
        "searchEmails",
        "searchTeamsMessages",
      ],
    });

    expect(definitions).toHaveLength(3);
    expect(
      definitions.map((definition) => [
        definition.name,
        definition.metadata.descriptorOwned,
        definition.metadata.inputSchemaOwned,
      ]),
    ).toEqual(
      expect.arrayContaining([
        ["getRecentEmails", true, true],
        ["searchEmails", true, true],
        ["searchTeamsMessages", true, true],
      ]),
    );
    expect(
      definitions.find((definition) => definition.name === "getRecentEmails")
        ?.description,
    ).toContain("Microsoft Graph live inbox first");
    expect(
      definitions.find(
        (definition) => definition.name === "searchTeamsMessages",
      )?.metadata.routingPolicy,
    ).toMatchObject({
      emptyResultBehavior: expect.stringContaining(
        "do not substitute meetings",
      ),
    });
  });

  it("uses descriptor-owned setup for meeting source-read tools", () => {
    const definitions = toolDefinitionsForWorkflow({
      workflowId: AI_ASSISTANT_CHAT_WORKFLOW_ID,
      allowedToolNames: [
        "getMeetingsByDate",
        "searchMeetingsByTopic",
        "getMeetingDetails",
      ],
    });

    expect(definitions).toHaveLength(3);
    expect(
      definitions.map((definition) => [
        definition.name,
        definition.metadata.descriptorOwned,
        definition.metadata.inputSchemaOwned,
        definition.metadata.sourceFamilies,
      ]),
    ).toEqual(
      expect.arrayContaining([
        ["getMeetingsByDate", true, true, ["meeting", "fireflies"]],
        ["searchMeetingsByTopic", true, true, ["meeting", "fireflies"]],
        ["getMeetingDetails", true, true, ["meeting", "fireflies"]],
      ]),
    );
    expect(
      definitions.find((definition) => definition.name === "getMeetingsByDate")
        ?.metadata.routingPolicy,
    ).toMatchObject({
      emptyResultBehavior: expect.stringContaining(
        "do not fill the gap with Teams/email",
      ),
      regressionPrompts: expect.arrayContaining([
        "what meetings were held today?",
      ]),
    });
  });

  it("uses descriptor-owned setup for broad document source-read tools", () => {
    const definitions = toolDefinitionsForWorkflow({
      workflowId: AI_ASSISTANT_CHAT_WORKFLOW_ID,
      allowedToolNames: [
        "semanticSearch",
        "searchExternalDocuments",
        "findProjectDocuments",
        "searchDocuments",
      ],
    });

    expect(definitions).toHaveLength(4);
    expect(
      definitions.map((definition) => [
        definition.name,
        definition.metadata.descriptorOwned,
        definition.metadata.inputSchemaOwned,
        definition.metadata.sourceFamilies,
      ]),
    ).toEqual(
      expect.arrayContaining([
        ["semanticSearch", true, true, ["document", "rag"]],
        ["searchExternalDocuments", true, true, ["document", "rag"]],
        ["findProjectDocuments", true, true, ["document", "rag"]],
        ["searchDocuments", true, true, ["document", "rag"]],
      ]),
    );
    expect(
      definitions.find((definition) => definition.name === "semanticSearch")
        ?.metadata.routingPolicy,
    ).toMatchObject({
      emptyResultBehavior: expect.stringContaining(
        "identify the queried source scope",
      ),
      regressionPrompts: expect.arrayContaining([
        "search documents for the insurance requirement",
      ]),
    });
  });

  it("uses descriptor-owned setup for Acumatica source-read tools", () => {
    const definitions = toolDefinitionsForWorkflow({
      workflowId: AI_ASSISTANT_CHAT_WORKFLOW_ID,
      allowedToolNames: [
        "getAcumaticaProjectBudget",
        "getAcumaticaProjectList",
        "getAPAgingReport",
        "getARAgingReport",
        "getCashPositionReport",
        "getVendorSpendReport",
        "getRecentBills",
        "getRecentInvoices",
        "getPurchaseOrderSummary",
      ],
    });

    expect(definitions).toHaveLength(9);
    expect(
      definitions.map((definition) => [
        definition.name,
        definition.metadata.descriptorOwned,
        definition.metadata.inputSchemaOwned,
        definition.metadata.sourceFamilies,
      ]),
    ).toEqual(
      expect.arrayContaining([
        ["getAcumaticaProjectBudget", true, true, ["acumatica"]],
        ["getAcumaticaProjectList", true, true, ["acumatica"]],
        ["getAPAgingReport", true, true, ["acumatica"]],
        ["getARAgingReport", true, true, ["acumatica"]],
        ["getCashPositionReport", true, true, ["acumatica"]],
        ["getVendorSpendReport", true, true, ["acumatica"]],
        ["getRecentBills", true, true, ["acumatica"]],
        ["getRecentInvoices", true, true, ["acumatica"]],
        ["getPurchaseOrderSummary", true, true, ["acumatica"]],
      ]),
    );
    expect(
      definitions.find(
        (definition) => definition.name === "getAcumaticaProjectBudget",
      )?.metadata.routingPolicy,
    ).toMatchObject({
      emptyResultBehavior: expect.stringContaining(
        "do not invent financial totals",
      ),
      regressionPrompts: expect.arrayContaining([
        "pull current AR aging from Acumatica",
      ]),
    });
  });

  it("uses descriptor-owned setup for core confirmed-write tools", () => {
    const definitions = toolDefinitionsForWorkflow({
      workflowId: AI_ASSISTANT_CHAT_WORKFLOW_ID,
      allowedToolNames: [
        "createChangeOrder",
        "createChangeEvent",
        "updateProjectStatus",
        "createRFI",
        "createTask",
        "createGeneratedTask",
        "updateGeneratedTask",
        "deleteGeneratedTask",
        "createProjectCompany",
        "createProjectContact",
        "flagProjectRisk",
        "updateRFIStatus",
        "createMeetingNote",
        "createSubmittal",
        "logDailyReport",
        "generateProjectSummary",
        "createCommitment",
        "createOutlookCalendarInvite",
        "draftOutlookEmail",
        "sendTeamsMessage",
      ],
    });

    expect(definitions).toHaveLength(20);
    expect(
      definitions.map((definition) => [
        definition.name,
        definition.metadata.descriptorOwned,
        definition.metadata.inputSchemaOwned,
        definition.metadata.confirmedWrite,
        definition.metadata.approvalRequired,
        definition.metadata.evidencePolicy,
        definition.metadata.capabilities,
      ]),
    ).toEqual(
      expect.arrayContaining([
        [
          "createChangeOrder",
          true,
          true,
          true,
          true,
          expect.objectContaining({ ledgerRequired: true }),
          ["write"],
        ],
        [
          "createChangeEvent",
          true,
          true,
          true,
          true,
          expect.objectContaining({ ledgerRequired: true }),
          ["write"],
        ],
        [
          "updateProjectStatus",
          true,
          true,
          true,
          true,
          expect.objectContaining({ ledgerRequired: true }),
          ["write"],
        ],
        [
          "createRFI",
          true,
          true,
          true,
          true,
          expect.objectContaining({ ledgerRequired: true }),
          ["write"],
        ],
        [
          "createTask",
          true,
          true,
          true,
          true,
          expect.objectContaining({ ledgerRequired: true }),
          ["write"],
        ],
        [
          "createGeneratedTask",
          true,
          true,
          true,
          true,
          expect.objectContaining({ ledgerRequired: true }),
          ["write"],
        ],
        [
          "updateGeneratedTask",
          true,
          true,
          true,
          true,
          expect.objectContaining({ ledgerRequired: true }),
          ["write"],
        ],
        [
          "deleteGeneratedTask",
          true,
          true,
          true,
          true,
          expect.objectContaining({ ledgerRequired: true }),
          ["write"],
        ],
        [
          "createProjectCompany",
          true,
          true,
          true,
          true,
          expect.objectContaining({ ledgerRequired: true }),
          ["write"],
        ],
        [
          "createProjectContact",
          true,
          true,
          true,
          true,
          expect.objectContaining({ ledgerRequired: true }),
          ["write"],
        ],
        [
          "flagProjectRisk",
          true,
          true,
          true,
          true,
          expect.objectContaining({ ledgerRequired: true }),
          ["write"],
        ],
        [
          "updateRFIStatus",
          true,
          true,
          true,
          true,
          expect.objectContaining({ ledgerRequired: true }),
          ["write"],
        ],
        [
          "createMeetingNote",
          true,
          true,
          true,
          true,
          expect.objectContaining({ ledgerRequired: true }),
          ["write"],
        ],
        [
          "createSubmittal",
          true,
          true,
          true,
          true,
          expect.objectContaining({ ledgerRequired: true }),
          ["write"],
        ],
        [
          "logDailyReport",
          true,
          true,
          true,
          true,
          expect.objectContaining({ ledgerRequired: true }),
          ["write"],
        ],
        [
          "generateProjectSummary",
          true,
          true,
          true,
          true,
          expect.objectContaining({ ledgerRequired: true }),
          ["write"],
        ],
        [
          "createCommitment",
          true,
          true,
          true,
          true,
          expect.objectContaining({ ledgerRequired: true }),
          ["write"],
        ],
        [
          "createOutlookCalendarInvite",
          true,
          true,
          true,
          true,
          expect.objectContaining({ ledgerRequired: true }),
          ["write", "delivery"],
        ],
        [
          "draftOutlookEmail",
          true,
          true,
          true,
          true,
          expect.objectContaining({ ledgerRequired: true }),
          ["write", "delivery"],
        ],
        [
          "sendTeamsMessage",
          true,
          true,
          true,
          true,
          expect.objectContaining({ ledgerRequired: true }),
          ["write", "delivery"],
        ],
      ]),
    );
    expect(
      definitions.map((definition) => [
        definition.name,
        definition.metadata.requiresDeliveryPermission,
        definition.metadata.allowedChannels,
        definition.metadata.deliveryAction,
      ]),
    ).toEqual(
      expect.arrayContaining([
        ["createOutlookCalendarInvite", true, ["email"], true],
        ["draftOutlookEmail", true, ["email"], true],
        ["sendTeamsMessage", true, ["teams"], true],
      ]),
    );
    expect(
      definitions.find((definition) => definition.name === "createTask")
        ?.description,
    ).toContain("use createGeneratedTask instead");
  });

  it("keeps source-read input schemas on the descriptor surface", () => {
    expect(getRecentEmailsInputSchema.parse({})).toMatchObject({
      daysBack: 1,
      direction: "mailbox",
      timeZone: "America/New_York",
      groupByThread: true,
      limit: 50,
    });
    expect(searchEmailsInputSchema.parse({ query: "permit delay" })).toEqual({
      query: "permit delay",
      matchCount: 8,
    });
    expect(
      searchTeamsMessagesInputSchema.parse({ query: "schedule delay" }),
    ).toEqual({
      query: "schedule delay",
      matchCount: 8,
    });
    expect(searchMeetingsByTopicInputSchema.parse({ topic: "OAC" })).toEqual({
      topic: "OAC",
      maxResults: 10,
    });
    expect(
      getMeetingDetailsInputSchema.parse({ meetingTitle: "Westfield OAC" }),
    ).toEqual({
      meetingTitle: "Westfield OAC",
      includeTranscript: false,
    });
    expect(getMeetingsByDateInputSchema.parse({})).toEqual({
      maxResults: 25,
    });
    expect(semanticSearchInputSchema.parse({ query: "insurance" })).toEqual({
      query: "insurance",
      matchCount: 10,
      threshold: 0.3,
      skipRerank: false,
    });
    expect(
      searchExternalDocumentsInputSchema.parse({
        query: "liquidated damages",
      }),
    ).toEqual({
      query: "liquidated damages",
      matchCount: 8,
    });
    expect(findProjectDocumentsInputSchema.parse({})).toEqual({
      category: "any",
      limit: 15,
    });
    expect(searchDocumentsInputSchema.parse({ query: "fire ratings" })).toEqual(
      {
        query: "fire ratings",
        maxResults: 10,
      },
    );
    expect(getAPAgingReportInputSchema.parse({})).toEqual({});
    expect(getARAgingReportInputSchema.parse({})).toEqual({});
    expect(getCashPositionReportInputSchema.parse({})).toEqual({
      windowDays: 90,
    });
    expect(
      getVendorSpendReportInputSchema.parse({ vendorId: "PROOUT" }),
    ).toEqual({
      vendorId: "PROOUT",
    });
    expect(getRecentBillsInputSchema.parse({})).toEqual({
      limit: 20,
    });
    expect(getRecentInvoicesInputSchema.parse({ status: "Open" })).toEqual({
      status: "Open",
      limit: 20,
    });
    expect(
      getAcumaticaProjectBudgetInputSchema.parse({ projectId: "25108" }),
    ).toEqual({
      projectId: "25108",
      typeFilter: "all",
    });
    expect(getAcumaticaProjectListInputSchema.parse({})).toEqual({});
    expect(getPurchaseOrderSummaryInputSchema.parse({})).toEqual({
      limit: 30,
    });
    expect(
      createChangeOrderInputSchema.parse({
        projectId: 101,
        title: "ASI 04 masonry revision",
      }),
    ).toEqual({
      projectId: 101,
      title: "ASI 04 masonry revision",
      status: "draft",
      confirmed: false,
    });
    expect(
      createChangeEventInputSchema.parse({
        projectId: 101,
        title: "Owner scope change",
      }),
    ).toMatchObject({
      projectId: 101,
      title: "Owner scope change",
      confirmed: false,
    });
    expect(
      updateProjectStatusInputSchema.parse({
        projectId: 101,
        healthStatus: "at_risk",
      }),
    ).toEqual({
      projectId: 101,
      healthStatus: "at_risk",
      confirmed: false,
    });
    expect(
      createRFIInputSchema.parse({
        projectId: 101,
        subject: "Slab opening",
        question: "Confirm sleeve location.",
      }),
    ).toMatchObject({
      projectId: 101,
      subject: "Slab opening",
      question: "Confirm sleeve location.",
      costImpact: "tbd",
      scheduleImpact: "tbd",
      confirmed: false,
    });
    expect(
      createTaskInputSchema.parse({
        projectId: 101,
        name: "Pour slab",
      }),
    ).toEqual({
      projectId: 101,
      name: "Pour slab",
      priority: "normal",
      confirmed: false,
    });
    expect(
      createGeneratedTaskInputSchema.parse({
        title: "Follow up on sleeve layout",
      }),
    ).toEqual({
      title: "Follow up on sleeve layout",
      priority: "normal",
      status: "open",
      confirmed: false,
    });
    expect(
      updateGeneratedTaskInputSchema.parse({
        taskId: "9e095a8e-7a1e-454a-a136-862b687ac49c",
        status: "done",
      }),
    ).toEqual({
      taskId: "9e095a8e-7a1e-454a-a136-862b687ac49c",
      status: "done",
      confirmed: false,
    });
    expect(
      deleteGeneratedTaskInputSchema.parse({
        taskId: "9e095a8e-7a1e-454a-a136-862b687ac49c",
      }),
    ).toEqual({
      taskId: "9e095a8e-7a1e-454a-a136-862b687ac49c",
      confirmed: false,
    });
    expect(
      createProjectCompanyInputSchema.parse({
        projectId: 101,
        name: "Acme Electric",
      }),
    ).toEqual({
      projectId: 101,
      name: "Acme Electric",
      companyType: "VENDOR",
      confirmed: false,
    });
    expect(
      createProjectContactInputSchema.parse({
        projectId: 101,
        firstName: "Sam",
        lastName: "Foreman",
      }),
    ).toEqual({
      projectId: 101,
      firstName: "Sam",
      lastName: "Foreman",
      makePrimaryCompanyContact: false,
      confirmed: false,
    });
    expect(
      flagProjectRiskInputSchema.parse({
        projectId: 101,
        title: "Permit delay",
        description: "AHJ review is holding rough-in.",
      }),
    ).toEqual({
      projectId: 101,
      title: "Permit delay",
      description: "AHJ review is holding rough-in.",
      severity: "medium",
      insightType: "general",
      confirmed: false,
    });
    expect(
      updateRFIStatusInputSchema.parse({
        projectId: 101,
        rfiNumber: 12,
        newStatus: "answered",
      }),
    ).toEqual({
      projectId: 101,
      rfiNumber: 12,
      newStatus: "answered",
      confirmed: false,
    });
    expect(
      createMeetingNoteInputSchema.parse({
        projectId: 101,
        title: "OAC Meeting",
        date: "2026-06-27",
        summary: "Discussed schedule recovery.",
      }),
    ).toEqual({
      projectId: 101,
      title: "OAC Meeting",
      date: "2026-06-27",
      summary: "Discussed schedule recovery.",
      confirmed: false,
    });
    expect(
      createSubmittalInputSchema.parse({
        projectId: 101,
        title: "Structural Steel Shop Drawings",
      }),
    ).toEqual({
      projectId: 101,
      title: "Structural Steel Shop Drawings",
      submittedBy: "TBD",
      status: "Draft",
      confirmed: false,
    });
    expect(
      logDailyReportInputSchema.parse({
        projectId: 101,
      }),
    ).toMatchObject({
      projectId: 101,
      confirmed: false,
    });
    expect(
      logDailyReportInputSchema.parse({
        projectId: 101,
      }).logDate,
    ).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(
      generateProjectSummaryInputSchema.parse({
        projectName: "Westfield",
      }),
    ).toEqual({
      projectName: "Westfield",
      confirmed: false,
    });
    expect(
      createCommitmentInputSchema.parse({
        projectId: 101,
        type: "subcontract",
        title: "Electrical Rough-In",
      }),
    ).toEqual({
      projectId: 101,
      type: "subcontract",
      title: "Electrical Rough-In",
      status: "Draft",
      confirmed: false,
    });
    expect(
      createOutlookCalendarInviteInputSchema.parse({
        subject: "Coordination Meeting",
        body: "Review open RFIs.",
        startDateTime: "2026-06-27T14:00:00",
        endDateTime: "2026-06-27T14:30:00",
        attendees: [{ email: "sam@example.com" }],
      }),
    ).toEqual({
      subject: "Coordination Meeting",
      body: "Review open RFIs.",
      startDateTime: "2026-06-27T14:00:00",
      endDateTime: "2026-06-27T14:30:00",
      timeZone: "Eastern Standard Time",
      location: "Microsoft Teams",
      attendees: [{ email: "sam@example.com", type: "required" }],
      isOnlineMeeting: true,
      confirmed: false,
    });
    expect(
      draftOutlookEmailInputSchema.parse({
        subject: "RE: Permit review",
        body: "I will confirm the review status today.",
      }),
    ).toEqual({
      subject: "RE: Permit review",
      body: "I will confirm the review status today.",
      toRecipients: [],
      ccRecipients: [],
      bccRecipients: [],
      importance: "normal",
      confirmed: false,
    });
    expect(
      sendTeamsMessageInputSchema.parse({
        recipientName: "Sam Foreman",
        message: "Can you confirm RFI 12 today?",
      }),
    ).toEqual({
      recipientName: "Sam Foreman",
      message: "Can you confirm RFI 12 today?",
      confirmed: false,
    });
  });

  it("renders compact runtime routing guidance from registry policy metadata", () => {
    const guide = renderAssistantToolRoutingGuide({
      allowedToolNames: ["searchTeamsMessages", "getMeetingsByDate"],
    });

    expect(guide).toContain("## Tool Routing Policy");
    expect(guide).toContain("searchTeamsMessages (teams)");
    expect(guide).toContain(
      "what insights can be found in the teams messages today",
    );
    expect(guide).toContain("do not substitute meetings");
    expect(guide).toContain("getMeetingsByDate (meeting, fireflies)");
  });

  it("filters runtime tool sets through registered factory metadata", () => {
    const registry = [
      registryEntry({
        name: "registeredRuntimeTool",
        workflows: [AI_ASSISTANT_CHAT_WORKFLOW_ID],
        factory: {
          modulePath: "frontend/src/lib/ai/tools/test-tools.ts",
          exportName: "createTestTools",
        },
      }),
    ];
    const registeredTool = { execute: jest.fn() };

    expect(
      Object.keys(
        filterRegisteredToolSet({
          registry,
          workflowId: AI_ASSISTANT_CHAT_WORKFLOW_ID,
          factoryModulePath: "frontend/src/lib/ai/tools/test-tools.ts",
          tools: { registeredRuntimeTool: registeredTool } as ToolSet,
        }),
      ),
    ).toEqual(["registeredRuntimeTool"]);
  });

  it("fails loudly when a runtime factory exposes an unregistered tool", () => {
    const registry = [
      registryEntry({
        name: "registeredRuntimeTool",
        workflows: [AI_ASSISTANT_CHAT_WORKFLOW_ID],
        factory: {
          modulePath: "frontend/src/lib/ai/tools/test-tools.ts",
          exportName: "createTestTools",
        },
      }),
    ];

    expect(() =>
      filterRegisteredToolSet({
        registry,
        workflowId: AI_ASSISTANT_CHAT_WORKFLOW_ID,
        factoryModulePath: "frontend/src/lib/ai/tools/test-tools.ts",
        tools: testToolSet([
          "registeredRuntimeTool",
          "unregisteredRuntimeTool",
        ]),
      }),
    ).toThrow(
      "Invalid AI assistant tool factory registration for frontend/src/lib/ai/tools/test-tools.ts: unregistered factory tools: unregisteredRuntimeTool",
    );
  });

  it("allows explicitly optional provider factories to be disabled", () => {
    const registry = [
      registryEntry({
        name: "optionalProviderTool",
        workflows: [AI_ASSISTANT_CHAT_WORKFLOW_ID],
        factory: {
          modulePath: "frontend/src/lib/ai/tools/optional-provider.ts",
          exportName: "createOptionalProviderTools",
        },
        metadata: {
          optionalFactory: true,
          provider: "test-provider",
        },
      }),
    ];

    expect(
      filterRegisteredToolSet({
        registry,
        workflowId: AI_ASSISTANT_CHAT_WORKFLOW_ID,
        factoryModulePath: "frontend/src/lib/ai/tools/optional-provider.ts",
        tools: {} as ToolSet,
      }),
    ).toEqual({});
  });

  it("hides write tools when the runtime policy does not allow writes", () => {
    const registry = [
      registryEntry({
        name: "readRuntimeTool",
        workflows: [AI_ASSISTANT_CHAT_WORKFLOW_ID],
        actorModes: ["user_delegated"],
        factory: {
          modulePath: "frontend/src/lib/ai/tools/test-tools.ts",
          exportName: "createTestTools",
        },
      }),
      registryEntry({
        name: "writeRuntimeTool",
        workflows: [AI_ASSISTANT_CHAT_WORKFLOW_ID],
        actorModes: ["user_delegated"],
        capabilities: ["write"],
        requiresWritePermission: true,
        factory: {
          modulePath: "frontend/src/lib/ai/tools/test-tools.ts",
          exportName: "createTestTools",
        },
      }),
    ];

    expect(
      Object.keys(
        filterRegisteredToolSet({
          registry,
          workflowId: AI_ASSISTANT_CHAT_WORKFLOW_ID,
          factoryModulePath: "frontend/src/lib/ai/tools/test-tools.ts",
          tools: testToolSet(["readRuntimeTool", "writeRuntimeTool"]),
          policy: {
            actorMode: "user_delegated",
            allowWrites: false,
            allowDelivery: false,
          },
        }),
      ),
    ).toEqual(["readRuntimeTool"]);
  });

  it("hides project-scoped tools when no project scope is selected", () => {
    const registry = [
      registryEntry({
        name: "globalReadTool",
        workflows: [AI_ASSISTANT_CHAT_WORKFLOW_ID],
        actorModes: ["user_delegated"],
        factory: {
          modulePath: "frontend/src/lib/ai/tools/test-tools.ts",
          exportName: "createTestTools",
        },
      }),
      registryEntry({
        name: "projectScopedTool",
        workflows: [AI_ASSISTANT_CHAT_WORKFLOW_ID],
        actorModes: ["user_delegated"],
        requiresProjectScope: true,
        factory: {
          modulePath: "frontend/src/lib/ai/tools/test-tools.ts",
          exportName: "createTestTools",
        },
      }),
    ];

    expect(
      Object.keys(
        filterRegisteredToolSet({
          registry,
          workflowId: AI_ASSISTANT_CHAT_WORKFLOW_ID,
          factoryModulePath: "frontend/src/lib/ai/tools/test-tools.ts",
          tools: testToolSet(["globalReadTool", "projectScopedTool"]),
          policy: {
            actorMode: "user_delegated",
            selectedProjectId: null,
          },
        }),
      ),
    ).toEqual(["globalReadTool"]);
  });

  it("hides source-scoped tools outside allowed source families", () => {
    const registry = [
      registryEntry({
        name: "documentTool",
        workflows: [AI_ASSISTANT_CHAT_WORKFLOW_ID],
        actorModes: ["user_delegated"],
        sourceFamilies: ["document", "rag"],
        factory: {
          modulePath: "frontend/src/lib/ai/tools/test-tools.ts",
          exportName: "createTestTools",
        },
      }),
      registryEntry({
        name: "emailTool",
        workflows: [AI_ASSISTANT_CHAT_WORKFLOW_ID],
        actorModes: ["user_delegated"],
        sourceFamilies: ["email", "outlook"],
        factory: {
          modulePath: "frontend/src/lib/ai/tools/test-tools.ts",
          exportName: "createTestTools",
        },
      }),
    ];

    expect(
      Object.keys(
        filterRegisteredToolSet({
          registry,
          workflowId: AI_ASSISTANT_CHAT_WORKFLOW_ID,
          factoryModulePath: "frontend/src/lib/ai/tools/test-tools.ts",
          tools: testToolSet(["documentTool", "emailTool"]),
          policy: {
            actorMode: "user_delegated",
            allowedSourceFamilies: ["document"],
          },
        }),
      ),
    ).toEqual(["documentTool"]);
  });

  it("returns AI Ops tool definitions for workflow consumers", () => {
    const definitions = toolDefinitionsForWorkflow({
      workflowId: EXECUTIVE_DAILY_BRIEF_WORKFLOW_ID,
      allowedToolNames: EXECUTIVE_DAILY_BRIEF_ALLOWED_TOOLS,
    });

    expect(definitions.map((tool) => tool.name)).toEqual(
      EXECUTIVE_DAILY_BRIEF_ALLOWED_TOOLS,
    );
    expect(definitions[0]?.metadata).toMatchObject({
      owner: "executive_daily_brief",
      workflows: [EXECUTIVE_DAILY_BRIEF_WORKFLOW_ID],
    });
  });
});

import { z } from "zod";
import type { ToolPolicy } from "@/lib/ai-ops/contracts";
import type {
  AssistantToolCategory,
  AssistantToolCapability,
  AssistantToolRegistryEntry,
  AssistantToolRoutingPolicy,
} from "@/lib/ai/tool-registry";
import {
  outlookRoutingPolicy,
  meetingRoutingPolicy,
  documentRoutingPolicy,
  acumaticaRoutingPolicy,
} from "@/lib/ai/routing-policies";
import {
  getRecentEmailsDescription,
  getRecentEmailsInputSchema,
  searchEmailsDescription,
  searchEmailsInputSchema,
  searchTeamsMessagesDescription,
  searchTeamsMessagesInputSchema,
  searchMeetingsByTopicDescription,
  searchMeetingsByTopicInputSchema,
  getMeetingDetailsDescription,
  getMeetingDetailsInputSchema,
  getMeetingsByDateDescription,
  getMeetingsByDateInputSchema,
  semanticSearchDescription,
  semanticSearchInputSchema,
  searchExternalDocumentsDescription,
  searchExternalDocumentsInputSchema,
  findProjectDocumentsDescription,
  findProjectDocumentsInputSchema,
  searchDocumentsDescription,
  searchDocumentsInputSchema,
  getAPAgingReportDescription,
  getAPAgingReportInputSchema,
  getARAgingReportDescription,
  getARAgingReportInputSchema,
  getCashPositionReportDescription,
  getCashPositionReportInputSchema,
  getVendorSpendReportDescription,
  getVendorSpendReportInputSchema,
  getRecentBillsDescription,
  getRecentBillsInputSchema,
  getRecentInvoicesDescription,
  getRecentInvoicesInputSchema,
  getAcumaticaProjectBudgetDescription,
  getAcumaticaProjectBudgetInputSchema,
  getAcumaticaProjectListDescription,
  getAcumaticaProjectListInputSchema,
  getPurchaseOrderSummaryDescription,
  getPurchaseOrderSummaryInputSchema,
  generatedTaskPrioritySchema,
  generatedTaskStatusSchema,
  projectCompanyTypeSchema,
  createChangeOrderDescription,
  createChangeOrderInputSchema,
  createChangeEventDescription,
  createChangeEventInputSchema,
  updateProjectStatusDescription,
  updateProjectStatusInputSchema,
  createRFIDescription,
  createRFIInputSchema,
  createTaskDescription,
  createTaskInputSchema,
  createGeneratedTaskDescription,
  createGeneratedTaskInputSchema,
  updateGeneratedTaskDescription,
  updateGeneratedTaskInputSchema,
  deleteGeneratedTaskDescription,
  deleteGeneratedTaskInputSchema,
  createProjectCompanyDescription,
  createProjectCompanyInputSchema,
  createProjectContactDescription,
  createProjectContactInputSchema,
  flagProjectRiskDescription,
  flagProjectRiskInputSchema,
  updateRFIStatusDescription,
  updateRFIStatusInputSchema,
  createMeetingNoteDescription,
  createMeetingNoteInputSchema,
  createSubmittalDescription,
  createSubmittalInputSchema,
  logDailyReportDescription,
  logDailyReportInputSchema,
  generateProjectSummaryDescription,
  generateProjectSummaryInputSchema,
  commitmentLineItemSchema,
  createCommitmentDescription,
  createCommitmentInputSchema,
  primeContractLineItemSchema,
  createPrimeContractDescription,
  createPrimeContractInputSchema,
  editPrimeContractSovRowSchema,
  editPrimeContractSovDescription,
  editPrimeContractSovInputSchema,
  draftOutlookEmailDescription,
  draftOutlookEmailInputSchema,
  sendTeamsMessageDescription,
  sendTeamsMessageInputSchema,
  outlookInviteAttendeeSchema,
  outlookMailRecipientSchema,
  createOutlookCalendarInviteDescription,
  createOutlookCalendarInviteInputSchema,
} from "@/lib/ai/tool-schemas";

// TODO: Remove these re-exports once all consumers import from
// "@/lib/ai/tool-schemas" or "@/lib/ai/routing-policies" directly.
// Removal criterion: zero imports of schemas/policies from this file.
export {
  getRecentEmailsDescription,
  getRecentEmailsInputSchema,
  searchEmailsDescription,
  searchEmailsInputSchema,
  searchTeamsMessagesDescription,
  searchTeamsMessagesInputSchema,
  searchMeetingsByTopicDescription,
  searchMeetingsByTopicInputSchema,
  getMeetingDetailsDescription,
  getMeetingDetailsInputSchema,
  getMeetingsByDateDescription,
  getMeetingsByDateInputSchema,
  semanticSearchDescription,
  semanticSearchInputSchema,
  searchExternalDocumentsDescription,
  searchExternalDocumentsInputSchema,
  findProjectDocumentsDescription,
  findProjectDocumentsInputSchema,
  searchDocumentsDescription,
  searchDocumentsInputSchema,
  getAPAgingReportDescription,
  getAPAgingReportInputSchema,
  getARAgingReportDescription,
  getARAgingReportInputSchema,
  getCashPositionReportDescription,
  getCashPositionReportInputSchema,
  getVendorSpendReportDescription,
  getVendorSpendReportInputSchema,
  getRecentBillsDescription,
  getRecentBillsInputSchema,
  getRecentInvoicesDescription,
  getRecentInvoicesInputSchema,
  getAcumaticaProjectBudgetDescription,
  getAcumaticaProjectBudgetInputSchema,
  getAcumaticaProjectListDescription,
  getAcumaticaProjectListInputSchema,
  getPurchaseOrderSummaryDescription,
  getPurchaseOrderSummaryInputSchema,
  generatedTaskPrioritySchema,
  generatedTaskStatusSchema,
  projectCompanyTypeSchema,
  createChangeOrderDescription,
  createChangeOrderInputSchema,
  createChangeEventDescription,
  createChangeEventInputSchema,
  updateProjectStatusDescription,
  updateProjectStatusInputSchema,
  createRFIDescription,
  createRFIInputSchema,
  createTaskDescription,
  createTaskInputSchema,
  createGeneratedTaskDescription,
  createGeneratedTaskInputSchema,
  updateGeneratedTaskDescription,
  updateGeneratedTaskInputSchema,
  deleteGeneratedTaskDescription,
  deleteGeneratedTaskInputSchema,
  createProjectCompanyDescription,
  createProjectCompanyInputSchema,
  createProjectContactDescription,
  createProjectContactInputSchema,
  flagProjectRiskDescription,
  flagProjectRiskInputSchema,
  updateRFIStatusDescription,
  updateRFIStatusInputSchema,
  createMeetingNoteDescription,
  createMeetingNoteInputSchema,
  createSubmittalDescription,
  createSubmittalInputSchema,
  logDailyReportDescription,
  logDailyReportInputSchema,
  generateProjectSummaryDescription,
  generateProjectSummaryInputSchema,
  commitmentLineItemSchema,
  createCommitmentDescription,
  createCommitmentInputSchema,
  primeContractLineItemSchema,
  createPrimeContractDescription,
  createPrimeContractInputSchema,
  editPrimeContractSovRowSchema,
  editPrimeContractSovDescription,
  editPrimeContractSovInputSchema,
  draftOutlookEmailDescription,
  draftOutlookEmailInputSchema,
  sendTeamsMessageDescription,
  sendTeamsMessageInputSchema,
  outlookInviteAttendeeSchema,
  outlookMailRecipientSchema,
  createOutlookCalendarInviteDescription,
  createOutlookCalendarInviteInputSchema,
};

type AssistantToolDescriptor = {
  name: string;
  description: string;
  owningAdapter: string;
  inputSchemaName: string;
  outputSchemaName: string;
  inputSchema: z.ZodTypeAny;
  owner: string;
  category: AssistantToolCategory;
  capabilities: AssistantToolCapability[];
  workflows: string[];
  actorModes: ToolPolicy["actorMode"][];
  sourceFamilies?: AssistantToolRegistryEntry["sourceFamilies"];
  allowedChannels?: AssistantToolRegistryEntry["allowedChannels"];
  requiresProjectScope: boolean;
  requiresWritePermission: boolean;
  requiresDeliveryPermission: boolean;
  evidencePolicy: AssistantToolRegistryEntry["evidencePolicy"];
  routingPolicy?: AssistantToolRoutingPolicy;
  factory: NonNullable<AssistantToolRegistryEntry["factory"]>;
  failureShape?: AssistantToolRegistryEntry["failureShape"];
  metadata?: AssistantToolRegistryEntry["metadata"];
};

const AI_ASSISTANT_CHAT_WORKFLOW_ID = "ai_assistant_chat";
const PROJECT_TOOL_FACTORY = {
  modulePath: "frontend/src/lib/ai/tools/project-tools.ts",
  exportName: "createProjectTools",
} as const;
const ACTION_TOOL_FACTORY = {
  modulePath: "frontend/src/lib/ai/tools/action-tools.ts",
  exportName: "createActionTools",
} as const;

const sourceReadDescriptorDefaults = {
  owner: "ai_assistant",
  workflows: [AI_ASSISTANT_CHAT_WORKFLOW_ID],
  actorModes: ["user_delegated"] as ToolPolicy["actorMode"][],
  capabilities: ["read"] as AssistantToolCapability[],
  requiresProjectScope: false,
  requiresWritePermission: false,
  requiresDeliveryPermission: false,
  evidencePolicy: {
    sourceBearing: true,
    requiresSourceRefs: false,
    ledgerRequired: false,
  },
  factory: PROJECT_TOOL_FACTORY,
  failureShape: "result_error" as const,
};

const confirmedWriteRoutingPolicy: AssistantToolRoutingPolicy = {
  useWhen: [
    "User explicitly asks the assistant to create, update, or record a project workflow item.",
    "The tool input includes enough project-scoped detail to prepare a confirmed write request.",
  ],
  doNotUseWhen: [
    "User is asking for analysis, search, summary, or source retrieval only.",
    "The user has not confirmed the write or required write fields are still ambiguous.",
    "A generated-preview tool is more appropriate than writing a persistent workflow record.",
  ],
  preferredFreshness:
    "Use the current user request and any provided project context; re-check access during execution before persisting.",
  emptyResultBehavior:
    "Return the tool's blocked/error result with the missing field, access, approval, or idempotency reason rather than claiming a write happened.",
  citationRule:
    "Confirmed writes do not cite source evidence by default; report the created or updated record id, status, and ledger/audit result when available.",
  regressionPrompts: [
    "create an RFI for this project",
    "update the project status to at risk",
    "create a change event for this scope issue",
  ],
};

const confirmedWriteDescriptorDefaults = {
  owner: "ai_assistant",
  workflows: [AI_ASSISTANT_CHAT_WORKFLOW_ID],
  actorModes: ["user_delegated"] as ToolPolicy["actorMode"][],
  capabilities: ["write"] as AssistantToolCapability[],
  requiresProjectScope: false,
  requiresWritePermission: true,
  requiresDeliveryPermission: false,
  evidencePolicy: {
    sourceBearing: false,
    requiresSourceRefs: false,
    ledgerRequired: true,
  },
  routingPolicy: confirmedWriteRoutingPolicy,
  factory: ACTION_TOOL_FACTORY,
  failureShape: "result_error" as const,
  metadata: {
    confirmedWrite: true,
    approvalRequired: true,
    idempotencySupported: true,
  },
};

const deliveryRoutingPolicy: AssistantToolRoutingPolicy = {
  useWhen: [
    "User explicitly asks the assistant to draft, schedule, invite, email, or message someone through Outlook or Teams.",
    "The tool input includes enough recipient, timing, subject, or message detail to prepare a confirmed delivery preview.",
  ],
  doNotUseWhen: [
    "User is asking for analysis, search, summary, or source retrieval only.",
    "The user has not confirmed the delivery action or required recipient/channel details are ambiguous.",
    "The requested channel is not one of the tool's allowed delivery channels.",
  ],
  preferredFreshness:
    "Use live Microsoft Graph or Teams-linked recipient data during execution, and verify channel configuration before writing delivery artifacts.",
  emptyResultBehavior:
    "Return the tool's blocked/error result with the missing recipient, mailbox, Teams-link, approval, or idempotency reason rather than claiming delivery occurred.",
  citationRule:
    "Delivery tools do not cite source evidence by default; report the created draft/event/message status, channel, recipient, and ledger/audit result when available.",
  regressionPrompts: [
    "draft an Outlook reply to Brandon",
    "schedule a Teams meeting with the project team",
    "send Sam a Teams message about the RFI",
  ],
};

const deliveryDescriptorDefaults = {
  ...confirmedWriteDescriptorDefaults,
  capabilities: ["write", "delivery"] as AssistantToolCapability[],
  requiresDeliveryPermission: true,
  routingPolicy: deliveryRoutingPolicy,
  metadata: {
    ...confirmedWriteDescriptorDefaults.metadata,
    deliveryAction: true,
  },
};


export const assistantSourceReadToolDescriptors: AssistantToolDescriptor[] = [
  {
    ...sourceReadDescriptorDefaults,
    name: "getRecentEmails",
    description: getRecentEmailsDescription,
    owningAdapter: "project_tools",
    inputSchemaName: "getRecentEmails.input",
    outputSchemaName: "getRecentEmails.output",
    inputSchema: getRecentEmailsInputSchema,
    category: "operational",
    sourceFamilies: ["outlook", "email"],
    routingPolicy: outlookRoutingPolicy,
  },
  {
    ...sourceReadDescriptorDefaults,
    name: "searchEmails",
    description: searchEmailsDescription,
    owningAdapter: "project_tools",
    inputSchemaName: "searchEmails.input",
    outputSchemaName: "searchEmails.output",
    inputSchema: searchEmailsInputSchema,
    category: "document",
    sourceFamilies: ["outlook", "email", "document", "rag"],
    routingPolicy: outlookRoutingPolicy,
  },
  {
    ...sourceReadDescriptorDefaults,
    name: "searchTeamsMessages",
    description: searchTeamsMessagesDescription,
    owningAdapter: "project_tools",
    inputSchemaName: "searchTeamsMessages.input",
    outputSchemaName: "searchTeamsMessages.output",
    inputSchema: searchTeamsMessagesInputSchema,
    category: "operational",
    sourceFamilies: ["teams"],
    routingPolicy: {
      useWhen: [
        "User asks about Teams messages, DMs, chats, threads, conversations, or Teams chatter.",
        "User asks for recent or same-day Teams message insights.",
      ],
      doNotUseWhen: [
        "User asks about Fireflies meetings or meeting transcripts without Teams.",
        "User asks about Outlook inbox or email triage.",
      ],
      preferredFreshness:
        "Use Teams-specific retrieval that checks live Microsoft Graph first when available, then synced Teams RAG rows.",
      emptyResultBehavior:
        "State that Teams retrieval returned no matching rows and do not substitute meetings or emails as if they were Teams results.",
      citationRule:
        "Cite as Teams message/conversation with title or channel and date.",
      regressionPrompts: [
        "what insights can be found in the teams messages today?",
        "show me recent Teams chatter about Westfield",
      ],
    },
  },
  {
    ...sourceReadDescriptorDefaults,
    name: "searchMeetingsByTopic",
    description: searchMeetingsByTopicDescription,
    owningAdapter: "project_tools",
    inputSchemaName: "searchMeetingsByTopic.input",
    outputSchemaName: "searchMeetingsByTopic.output",
    inputSchema: searchMeetingsByTopicInputSchema,
    category: "operational",
    sourceFamilies: ["meeting", "fireflies"],
    routingPolicy: meetingRoutingPolicy,
  },
  {
    ...sourceReadDescriptorDefaults,
    name: "getMeetingDetails",
    description: getMeetingDetailsDescription,
    owningAdapter: "project_tools",
    inputSchemaName: "getMeetingDetails.input",
    outputSchemaName: "getMeetingDetails.output",
    inputSchema: getMeetingDetailsInputSchema,
    category: "operational",
    sourceFamilies: ["meeting", "fireflies"],
    routingPolicy: meetingRoutingPolicy,
  },
  {
    ...sourceReadDescriptorDefaults,
    name: "getMeetingsByDate",
    description: getMeetingsByDateDescription,
    owningAdapter: "project_tools",
    inputSchemaName: "getMeetingsByDate.input",
    outputSchemaName: "getMeetingsByDate.output",
    inputSchema: getMeetingsByDateInputSchema,
    category: "operational",
    sourceFamilies: ["meeting", "fireflies"],
    routingPolicy: meetingRoutingPolicy,
  },
  {
    ...sourceReadDescriptorDefaults,
    name: "semanticSearch",
    description: semanticSearchDescription,
    owningAdapter: "project_tools",
    inputSchemaName: "semanticSearch.input",
    outputSchemaName: "semanticSearch.output",
    inputSchema: semanticSearchInputSchema,
    category: "document",
    sourceFamilies: ["document", "rag"],
    routingPolicy: documentRoutingPolicy,
  },
  {
    ...sourceReadDescriptorDefaults,
    name: "searchExternalDocuments",
    description: searchExternalDocumentsDescription,
    owningAdapter: "project_tools",
    inputSchemaName: "searchExternalDocuments.input",
    outputSchemaName: "searchExternalDocuments.output",
    inputSchema: searchExternalDocumentsInputSchema,
    category: "document",
    sourceFamilies: ["document", "rag"],
    routingPolicy: documentRoutingPolicy,
  },
  {
    ...sourceReadDescriptorDefaults,
    name: "findProjectDocuments",
    description: findProjectDocumentsDescription,
    owningAdapter: "project_tools",
    inputSchemaName: "findProjectDocuments.input",
    outputSchemaName: "findProjectDocuments.output",
    inputSchema: findProjectDocumentsInputSchema,
    category: "document",
    sourceFamilies: ["document", "rag"],
    routingPolicy: documentRoutingPolicy,
  },
  {
    ...sourceReadDescriptorDefaults,
    name: "searchDocuments",
    description: searchDocumentsDescription,
    owningAdapter: "project_tools",
    inputSchemaName: "searchDocuments.input",
    outputSchemaName: "searchDocuments.output",
    inputSchema: searchDocumentsInputSchema,
    category: "document",
    sourceFamilies: ["document", "rag"],
    routingPolicy: documentRoutingPolicy,
  },
  {
    ...sourceReadDescriptorDefaults,
    name: "getAPAgingReport",
    description: getAPAgingReportDescription,
    owningAdapter: "project_tools",
    inputSchemaName: "getAPAgingReport.input",
    outputSchemaName: "getAPAgingReport.output",
    inputSchema: getAPAgingReportInputSchema,
    category: "financial",
    sourceFamilies: ["acumatica"],
    routingPolicy: acumaticaRoutingPolicy,
  },
  {
    ...sourceReadDescriptorDefaults,
    name: "getARAgingReport",
    description: getARAgingReportDescription,
    owningAdapter: "project_tools",
    inputSchemaName: "getARAgingReport.input",
    outputSchemaName: "getARAgingReport.output",
    inputSchema: getARAgingReportInputSchema,
    category: "financial",
    sourceFamilies: ["acumatica"],
    routingPolicy: acumaticaRoutingPolicy,
  },
  {
    ...sourceReadDescriptorDefaults,
    name: "getCashPositionReport",
    description: getCashPositionReportDescription,
    owningAdapter: "project_tools",
    inputSchemaName: "getCashPositionReport.input",
    outputSchemaName: "getCashPositionReport.output",
    inputSchema: getCashPositionReportInputSchema,
    category: "financial",
    sourceFamilies: ["acumatica"],
    routingPolicy: acumaticaRoutingPolicy,
  },
  {
    ...sourceReadDescriptorDefaults,
    name: "getVendorSpendReport",
    description: getVendorSpendReportDescription,
    owningAdapter: "project_tools",
    inputSchemaName: "getVendorSpendReport.input",
    outputSchemaName: "getVendorSpendReport.output",
    inputSchema: getVendorSpendReportInputSchema,
    category: "financial",
    sourceFamilies: ["acumatica"],
    routingPolicy: acumaticaRoutingPolicy,
  },
  {
    ...sourceReadDescriptorDefaults,
    name: "getRecentBills",
    description: getRecentBillsDescription,
    owningAdapter: "project_tools",
    inputSchemaName: "getRecentBills.input",
    outputSchemaName: "getRecentBills.output",
    inputSchema: getRecentBillsInputSchema,
    category: "financial",
    sourceFamilies: ["acumatica"],
    routingPolicy: acumaticaRoutingPolicy,
  },
  {
    ...sourceReadDescriptorDefaults,
    name: "getRecentInvoices",
    description: getRecentInvoicesDescription,
    owningAdapter: "project_tools",
    inputSchemaName: "getRecentInvoices.input",
    outputSchemaName: "getRecentInvoices.output",
    inputSchema: getRecentInvoicesInputSchema,
    category: "financial",
    sourceFamilies: ["acumatica"],
    routingPolicy: acumaticaRoutingPolicy,
  },
  {
    ...sourceReadDescriptorDefaults,
    name: "getAcumaticaProjectBudget",
    description: getAcumaticaProjectBudgetDescription,
    owningAdapter: "project_tools",
    inputSchemaName: "getAcumaticaProjectBudget.input",
    outputSchemaName: "getAcumaticaProjectBudget.output",
    inputSchema: getAcumaticaProjectBudgetInputSchema,
    category: "financial",
    sourceFamilies: ["acumatica"],
    routingPolicy: acumaticaRoutingPolicy,
  },
  {
    ...sourceReadDescriptorDefaults,
    name: "getAcumaticaProjectList",
    description: getAcumaticaProjectListDescription,
    owningAdapter: "project_tools",
    inputSchemaName: "getAcumaticaProjectList.input",
    outputSchemaName: "getAcumaticaProjectList.output",
    inputSchema: getAcumaticaProjectListInputSchema,
    category: "financial",
    sourceFamilies: ["acumatica"],
    routingPolicy: acumaticaRoutingPolicy,
  },
  {
    ...sourceReadDescriptorDefaults,
    name: "getPurchaseOrderSummary",
    description: getPurchaseOrderSummaryDescription,
    owningAdapter: "project_tools",
    inputSchemaName: "getPurchaseOrderSummary.input",
    outputSchemaName: "getPurchaseOrderSummary.output",
    inputSchema: getPurchaseOrderSummaryInputSchema,
    category: "financial",
    sourceFamilies: ["acumatica"],
    routingPolicy: acumaticaRoutingPolicy,
  },
];

export const assistantActionToolDescriptors: AssistantToolDescriptor[] = [
  {
    ...confirmedWriteDescriptorDefaults,
    name: "createChangeOrder",
    description: createChangeOrderDescription,
    owningAdapter: "action_tools",
    inputSchemaName: "createChangeOrder.input",
    outputSchemaName: "createChangeOrder.output",
    inputSchema: createChangeOrderInputSchema,
    category: "workflow",
    sourceFamilies: ["procore", "system"],
  },
  {
    ...confirmedWriteDescriptorDefaults,
    name: "createChangeEvent",
    description: createChangeEventDescription,
    owningAdapter: "action_tools",
    inputSchemaName: "createChangeEvent.input",
    outputSchemaName: "createChangeEvent.output",
    inputSchema: createChangeEventInputSchema,
    category: "workflow",
    sourceFamilies: ["procore", "system"],
  },
  {
    ...confirmedWriteDescriptorDefaults,
    name: "updateProjectStatus",
    description: updateProjectStatusDescription,
    owningAdapter: "action_tools",
    inputSchemaName: "updateProjectStatus.input",
    outputSchemaName: "updateProjectStatus.output",
    inputSchema: updateProjectStatusInputSchema,
    category: "workflow",
    sourceFamilies: ["procore", "system"],
  },
  {
    ...confirmedWriteDescriptorDefaults,
    name: "createRFI",
    description: createRFIDescription,
    owningAdapter: "action_tools",
    inputSchemaName: "createRFI.input",
    outputSchemaName: "createRFI.output",
    inputSchema: createRFIInputSchema,
    category: "workflow",
    sourceFamilies: ["procore", "system"],
  },
  {
    ...confirmedWriteDescriptorDefaults,
    name: "createTask",
    description: createTaskDescription,
    owningAdapter: "action_tools",
    inputSchemaName: "createTask.input",
    outputSchemaName: "createTask.output",
    inputSchema: createTaskInputSchema,
    category: "workflow",
    sourceFamilies: ["procore", "system"],
  },
  {
    ...confirmedWriteDescriptorDefaults,
    name: "createGeneratedTask",
    description: createGeneratedTaskDescription,
    owningAdapter: "action_tools",
    inputSchemaName: "createGeneratedTask.input",
    outputSchemaName: "createGeneratedTask.output",
    inputSchema: createGeneratedTaskInputSchema,
    category: "workflow",
    sourceFamilies: ["procore", "system"],
  },
  {
    ...confirmedWriteDescriptorDefaults,
    name: "updateGeneratedTask",
    description: updateGeneratedTaskDescription,
    owningAdapter: "action_tools",
    inputSchemaName: "updateGeneratedTask.input",
    outputSchemaName: "updateGeneratedTask.output",
    inputSchema: updateGeneratedTaskInputSchema,
    category: "workflow",
    sourceFamilies: ["procore", "system"],
  },
  {
    ...confirmedWriteDescriptorDefaults,
    name: "deleteGeneratedTask",
    description: deleteGeneratedTaskDescription,
    owningAdapter: "action_tools",
    inputSchemaName: "deleteGeneratedTask.input",
    outputSchemaName: "deleteGeneratedTask.output",
    inputSchema: deleteGeneratedTaskInputSchema,
    category: "workflow",
    sourceFamilies: ["procore", "system"],
  },
  {
    ...confirmedWriteDescriptorDefaults,
    name: "createProjectCompany",
    description: createProjectCompanyDescription,
    owningAdapter: "action_tools",
    inputSchemaName: "createProjectCompany.input",
    outputSchemaName: "createProjectCompany.output",
    inputSchema: createProjectCompanyInputSchema,
    category: "workflow",
    sourceFamilies: ["procore", "system"],
  },
  {
    ...confirmedWriteDescriptorDefaults,
    name: "createProjectContact",
    description: createProjectContactDescription,
    owningAdapter: "action_tools",
    inputSchemaName: "createProjectContact.input",
    outputSchemaName: "createProjectContact.output",
    inputSchema: createProjectContactInputSchema,
    category: "workflow",
    sourceFamilies: ["procore", "system"],
  },
  {
    ...confirmedWriteDescriptorDefaults,
    name: "flagProjectRisk",
    description: flagProjectRiskDescription,
    owningAdapter: "action_tools",
    inputSchemaName: "flagProjectRisk.input",
    outputSchemaName: "flagProjectRisk.output",
    inputSchema: flagProjectRiskInputSchema,
    category: "workflow",
    sourceFamilies: ["procore", "system"],
  },
  {
    ...confirmedWriteDescriptorDefaults,
    name: "updateRFIStatus",
    description: updateRFIStatusDescription,
    owningAdapter: "action_tools",
    inputSchemaName: "updateRFIStatus.input",
    outputSchemaName: "updateRFIStatus.output",
    inputSchema: updateRFIStatusInputSchema,
    category: "workflow",
    sourceFamilies: ["procore", "system"],
  },
  {
    ...confirmedWriteDescriptorDefaults,
    name: "createMeetingNote",
    description: createMeetingNoteDescription,
    owningAdapter: "action_tools",
    inputSchemaName: "createMeetingNote.input",
    outputSchemaName: "createMeetingNote.output",
    inputSchema: createMeetingNoteInputSchema,
    category: "workflow",
    sourceFamilies: ["procore", "system"],
  },
  {
    ...confirmedWriteDescriptorDefaults,
    name: "createSubmittal",
    description: createSubmittalDescription,
    owningAdapter: "action_tools",
    inputSchemaName: "createSubmittal.input",
    outputSchemaName: "createSubmittal.output",
    inputSchema: createSubmittalInputSchema,
    category: "workflow",
    sourceFamilies: ["procore", "system"],
  },
  {
    ...confirmedWriteDescriptorDefaults,
    name: "logDailyReport",
    description: logDailyReportDescription,
    owningAdapter: "action_tools",
    inputSchemaName: "logDailyReport.input",
    outputSchemaName: "logDailyReport.output",
    inputSchema: logDailyReportInputSchema,
    category: "workflow",
    sourceFamilies: ["procore", "system"],
  },
  {
    ...confirmedWriteDescriptorDefaults,
    name: "generateProjectSummary",
    description: generateProjectSummaryDescription,
    owningAdapter: "action_tools",
    inputSchemaName: "generateProjectSummary.input",
    outputSchemaName: "generateProjectSummary.output",
    inputSchema: generateProjectSummaryInputSchema,
    category: "workflow",
    sourceFamilies: ["procore", "system"],
  },
  {
    ...confirmedWriteDescriptorDefaults,
    name: "createCommitment",
    description: createCommitmentDescription,
    owningAdapter: "action_tools",
    inputSchemaName: "createCommitment.input",
    outputSchemaName: "createCommitment.output",
    inputSchema: createCommitmentInputSchema,
    category: "workflow",
    sourceFamilies: ["procore", "system"],
  },
  {
    ...confirmedWriteDescriptorDefaults,
    name: "createPrimeContract",
    description: createPrimeContractDescription,
    owningAdapter: "action_tools",
    inputSchemaName: "createPrimeContract.input",
    outputSchemaName: "createPrimeContract.output",
    inputSchema: createPrimeContractInputSchema,
    category: "workflow",
    sourceFamilies: ["procore", "system"],
  },
  {
    ...confirmedWriteDescriptorDefaults,
    name: "editPrimeContractSov",
    description: editPrimeContractSovDescription,
    owningAdapter: "action_tools",
    inputSchemaName: "editPrimeContractSov.input",
    outputSchemaName: "editPrimeContractSov.output",
    inputSchema: editPrimeContractSovInputSchema,
    category: "workflow",
    sourceFamilies: ["procore", "system"],
  },
  {
    ...deliveryDescriptorDefaults,
    name: "createOutlookCalendarInvite",
    description: createOutlookCalendarInviteDescription,
    owningAdapter: "action_tools",
    inputSchemaName: "createOutlookCalendarInvite.input",
    outputSchemaName: "createOutlookCalendarInvite.output",
    inputSchema: createOutlookCalendarInviteInputSchema,
    category: "delivery",
    sourceFamilies: ["outlook", "email", "delivery"],
    allowedChannels: ["email"],
  },
  {
    ...deliveryDescriptorDefaults,
    name: "draftOutlookEmail",
    description: draftOutlookEmailDescription,
    owningAdapter: "action_tools",
    inputSchemaName: "draftOutlookEmail.input",
    outputSchemaName: "draftOutlookEmail.output",
    inputSchema: draftOutlookEmailInputSchema,
    category: "delivery",
    sourceFamilies: ["outlook", "email", "delivery"],
    allowedChannels: ["email"],
  },
  {
    ...deliveryDescriptorDefaults,
    name: "sendTeamsMessage",
    description: sendTeamsMessageDescription,
    owningAdapter: "action_tools",
    inputSchemaName: "sendTeamsMessage.input",
    outputSchemaName: "sendTeamsMessage.output",
    inputSchema: sendTeamsMessageInputSchema,
    category: "delivery",
    sourceFamilies: ["teams", "delivery"],
    allowedChannels: ["teams"],
  },
];

export const assistantToolDescriptorByName = new Map(
  [...assistantSourceReadToolDescriptors, ...assistantActionToolDescriptors].map((descriptor) => [
    descriptor.name,
    descriptor,
  ]),
);

export const assistantSourceReadToolDescriptorByName =
  assistantToolDescriptorByName;

const READONLY_MCP_TOOL_PATTERNS = [
  /^get/i,
  /^list/i,
  /^read/i,
  /^search/i,
  /^query/i,
  /^retrieve/i,
  /^find/i,
  /^lookup/i,
];

const DANGEROUS_MCP_TOOL_PATTERNS = [
  /apply/i,
  /create/i,
  /delete/i,
  /drop/i,
  /execute[_-]?sql/i,
  /insert/i,
  /migration/i,
  /mutate/i,
  /remove/i,
  /run[_-]?sql/i,
  /truncate/i,
  /update/i,
  /upsert/i,
  /write/i,
];

export type AssistantMcpToolDescriptor = {
  serverName: string;
  toolName: string;
  prefixedName: string;
  enabled: boolean;
  effect: "read" | "allowlisted_artifact_write" | "denied";
  reason:
    | "server_allowlist"
    | "generic_read_only"
    | "not_in_server_allowlist"
    | "dangerous_mutation_pattern"
    | "not_read_only_pattern";
  metadata: {
    descriptorOwned: true;
    runtimeDiscovered: true;
    serverName: string;
    originalToolName: string;
  };
};

export function assistantMcpToolDescriptor(input: {
  serverName: string;
  toolName: string;
  allowedTools?: readonly string[];
}): AssistantMcpToolDescriptor {
  const prefixedName = `mcp_${input.serverName}_${input.toolName}`;
  const metadata = {
    descriptorOwned: true,
    runtimeDiscovered: true,
    serverName: input.serverName,
    originalToolName: input.toolName,
  } as const;

  if (input.allowedTools) {
    const enabled = input.allowedTools.includes(input.toolName);
    return {
      serverName: input.serverName,
      toolName: input.toolName,
      prefixedName,
      enabled,
      effect: enabled ? "allowlisted_artifact_write" : "denied",
      reason: enabled ? "server_allowlist" : "not_in_server_allowlist",
      metadata,
    };
  }

  if (
    DANGEROUS_MCP_TOOL_PATTERNS.some((pattern) => pattern.test(input.toolName))
  ) {
    return {
      serverName: input.serverName,
      toolName: input.toolName,
      prefixedName,
      enabled: false,
      effect: "denied",
      reason: "dangerous_mutation_pattern",
      metadata,
    };
  }

  const enabled = READONLY_MCP_TOOL_PATTERNS.some((pattern) =>
    pattern.test(input.toolName),
  );
  return {
    serverName: input.serverName,
    toolName: input.toolName,
    prefixedName,
    enabled,
    effect: enabled ? "read" : "denied",
    reason: enabled ? "generic_read_only" : "not_read_only_pattern",
    metadata,
  };
}

export function registryEntryFromAssistantToolDescriptor(
  descriptor: AssistantToolDescriptor,
): AssistantToolRegistryEntry {
  if (!descriptor.description.trim()) {
    throw new Error(
      `Assistant tool descriptor ${descriptor.name} is missing a description`,
    );
  }
  if (!descriptor.inputSchema) {
    throw new Error(
      `Assistant tool descriptor ${descriptor.name} is missing an input schema`,
    );
  }
  if (!descriptor.routingPolicy) {
    throw new Error(
      `Assistant tool descriptor ${descriptor.name} is missing routing policy`,
    );
  }

  return {
    name: descriptor.name,
    description: descriptor.description,
    owningAdapter: descriptor.owningAdapter,
    inputSchemaName: descriptor.inputSchemaName,
    outputSchemaName: descriptor.outputSchemaName,
    failureShape: descriptor.failureShape ?? "result_error",
    metadata: {
      runtimeFactory: true,
      descriptorOwned: true,
      inputSchemaOwned: true,
      ...descriptor.metadata,
    },
    owner: descriptor.owner,
    category: descriptor.category,
    capabilities: descriptor.capabilities,
    workflows: descriptor.workflows,
    actorModes: descriptor.actorModes,
    sourceFamilies: descriptor.sourceFamilies,
    allowedChannels: descriptor.allowedChannels,
    requiresProjectScope: descriptor.requiresProjectScope,
    requiresWritePermission: descriptor.requiresWritePermission,
    requiresDeliveryPermission: descriptor.requiresDeliveryPermission,
    evidencePolicy: descriptor.evidencePolicy,
    routingPolicy: descriptor.routingPolicy,
    factory: descriptor.factory,
  };
}

import {
  buildChangeEventWorkflowDraft,
  type ChangeEventWorkflowDraft,
} from "@/lib/ai/change-event-workflow";

export type AssistantWidgetKind =
  | "draft_email"
  | "outlook_email_draft"
  | "calendar_invite"
  | "create_task"
  | "create_contact"
  | "task_summary"
  | "meeting_intelligence"
  | "outlook_inbox_summary"
  | "project_picker"
  | "owner_snapshot"
  | "owner_action_queue"
  | "meeting_insights"
  | "risk_exposure_packet"
  | "financial_pulse"
  | "creative_draft"
  | "source_evidence_drawer"
  | "record_write_preview"
  | "commitment_draft"
  | "prime_contract_draft"
  | "create_event"
  | "change_event_workflow"
  | "project_action_preview"
  | "decision_packet"
  | "feature_request_packet"
  | "executive_daily_brief";

export type AssistantWidgetField = {
  label: string;
  value: string;
  editable?: boolean;
  multiline?: boolean;
};

export type DraftEmailWidgetPayload = {
  type: "draft_email";
  id: string;
  title: string;
  emailFrom?: string;
  defaultTo: string;
  defaultSubject: string;
  defaultBody: string;
};

export type OutlookEmailDraftWidgetPayload = {
  type: "outlook_email_draft";
  id: string;
  title: string;
  status: "draft" | "created" | "blocked";
  mailboxUserId?: string | null;
  mode: "new_message" | "reply";
  subject: string;
  body: string;
  toRecipients: Array<{
    email: string;
    name?: string;
  }>;
  ccRecipients?: Array<{
    email: string;
    name?: string;
  }>;
  bccRecipients?: Array<{
    email: string;
    name?: string;
  }>;
  replyToGraphMessageId?: string | null;
  outlookDraftId?: string | null;
  outlookWebLink?: string | null;
  voiceProfile?: {
    path: string;
    version: string;
    summary?: string;
  } | null;
  adaptiveCard?: Record<string, unknown>;
  confirmPrompt: string;
};

export type CalendarInviteWidgetPayload = {
  type: "calendar_invite";
  id: string;
  title: string;
  status: "draft" | "created" | "blocked";
  organizerEmail?: string | null;
  subject: string;
  body: string;
  startDateTime: string;
  endDateTime: string;
  timeZone: string;
  location: string;
  projectId?: number | null;
  attendees: Array<{
    email: string;
    name?: string;
    type: "required" | "optional";
  }>;
  outlookEventId?: string | null;
  outlookWebLink?: string | null;
  teamsJoinUrl?: string | null;
  adaptiveCard: Record<string, unknown>;
  confirmPrompt: string;
};

export type CreateTaskWidgetPayload = {
  type: "create_task";
  id: string;
  title: string;
  defaultTitle: string;
  defaultBody: string;
  defaultDueDate?: string;
  defaultAssignee?: string;
  defaultPriority: "low" | "normal" | "high" | "critical";
  projectId?: number | null;
};

export type CreateContactWidgetPayload = {
  type: "create_contact";
  id: string;
  title: string;
  status: "draft" | "created";
  defaultFirstName: string;
  defaultLastName: string;
  defaultEmail?: string;
  defaultPhone?: string;
  defaultJobTitle?: string;
  defaultDepartment?: string;
  defaultCompanyName?: string;
  defaultNotes?: string;
  companyId?: string | null;
  contactHref?: string | null;
  confirmPrompt: string;
};

export type TaskSummaryWidgetItem = {
  id: string;
  title: string;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  dueDate?: string | null;
  assigneeName?: string | null;
  projectId?: number | null;
  projectName?: string | null;
  sourceTitle?: string | null;
  sourceSystem?: string | null;
  sourceDate?: string | null;
  createdAt: string;
  href: string;
};

export type TaskSummaryWidgetPayload = {
  type: "task_summary";
  id: string;
  title: string;
  subtitle: string;
  totalCount: number;
  dateLabel: string;
  emptyState?: string;
  items: TaskSummaryWidgetItem[];
};

export type MeetingIntelligenceWidgetItem = {
  id: string;
  title: string;
  projectId?: number | null;
  projectName?: string | null;
  date?: string | null;
  source?: string | null;
  summary?: string | null;
  criticalRisks: string[];
  decisions: string[];
  actionItems: string[];
  href: string;
};

export type MeetingIntelligenceWidgetPayload = {
  type: "meeting_intelligence";
  id: string;
  title: string;
  subtitle: string;
  dateLabel: string;
  meetingCount: number;
  criticalRiskCount: number;
  decisionCount: number;
  actionItemCount: number;
  topInsights: string[];
  recommendedNextActions: string[];
  emptyState?: string;
  meetings: MeetingIntelligenceWidgetItem[];
};

export type OutlookInboxSummaryWidgetItem = {
  id: string;
  graphMessageId?: string | null;
  conversationId?: string | null;
  subject: string;
  fromName?: string | null;
  fromEmail?: string | null;
  senders: string[];
  recipients: string[];
  receivedAt?: string | null;
  messageCount: number;
  hasAttachments: boolean;
  attentionScore: number;
  preview?: string | null;
  bodyText?: string | null;
  webLink?: string | null;
  projectIds: number[];
  recommendedAction: string;
  replyPrompt: string;
  draftPrompt: string;
  /** True only when a real Outlook draft reply already exists for this thread. */
  draftReady?: boolean;
  /** Short preview of the prepared draft reply, shown when draftReady is true. */
  draftPreview?: string | null;
};

export type OutlookInboxSummaryWidgetPayload = {
  type: "outlook_inbox_summary";
  id: string;
  title: string;
  subtitle: string;
  dateLabel: string;
  summary: string;
  dataCutoffNote?: string | null;
  mailbox?: string | null;
  totalCount: number;
  threadCount?: number | null;
  actionSummary: string;
  items: OutlookInboxSummaryWidgetItem[];
  emptyState?: string;
};

export type ProjectPickerWidgetPayload = {
  type: "project_picker";
  id: string;
  title: string;
  subtitle: string;
  actionLabel?: string;
  intent: "owner_snapshot" | "owner_action_queue" | "meeting_insights" | "risk_review" | "financial_pulse" | "general";
  projects: Array<{
    projectId: number;
    name: string;
    client?: string | null;
    phase?: string | null;
    state?: string | null;
    summary?: string | null;
    contractValue?: string | null;
    activityLabel?: string | null;
    meetingCount?: number | null;
    openCriticalItems?: number | null;
    healthStatus?: string | null;
    prompt: string;
  }>;
  emptyState?: string;
};

export type CreateEventWidgetPayload = {
  type: "create_event";
  id: string;
  title: string;
  dateLabel: string;
  dateNumber: string;
  defaultTitle: string;
  defaultTime: string;
  defaultLocation: string;
  defaultAgenda: string;
  projectId?: number | null;
};

export type ProjectActionPreviewWidgetPayload = {
  type: "project_action_preview";
  id: string;
  title: string;
  actionType: "rfi" | "change_event" | "generic";
  projectId?: number | null;
  fields: AssistantWidgetField[];
  confirmPrompt: string;
};

export type ChangeEventWorkflowWidgetPayload = {
  type: "change_event_workflow";
  id: string;
  title: string;
  draft: ChangeEventWorkflowDraft;
};

export type DecisionPacketWidgetPayload = {
  type: "decision_packet";
  id: string;
  title: string;
  recommendation: string;
  confidence: "low" | "medium" | "high";
  impacts: AssistantWidgetField[];
  risks: string[];
  nextActions: string[];
};

export type SourceEvidenceItem = {
  id: string;
  title: string;
  sourceType:
    | "meeting"
    | "email"
    | "teams"
    | "document"
    | "project_record"
    | "accounting"
    | "knowledge";
  date?: string;
  snippet?: string;
  href?: string;
  confidence?: "low" | "medium" | "high";
};

export type OwnerActionItem = {
  id: string;
  title: string;
  description?: string;
  projectId?: number | null;
  projectName?: string | null;
  ownerName?: string | null;
  dueDate?: string | null;
  priority: "low" | "normal" | "high" | "critical";
  sourceType?:
    | "meeting"
    | "email"
    | "teams"
    | "task"
    | "rfi"
    | "submittal"
    | "change_event"
    | "risk";
  sourceTitle?: string | null;
  href?: string;
  recommendedAction:
    | "review"
    | "assign"
    | "create_task"
    | "draft_message"
    | "create_rfi"
    | "create_change_event"
    | "save_insight";
  confidence: "low" | "medium" | "high";
};

export type OwnerSnapshotWidgetPayload = {
  type: "owner_snapshot";
  id: string;
  title: string;
  projectId: number;
  projectName: string;
  status: "on_track" | "watch" | "critical" | "unknown";
  asOf: string;
  summary: string;
  healthSignals: Array<{
    label: string;
    value: string;
    status: "good" | "watch" | "critical" | "neutral";
  }>;
  money: {
    contractValue?: string;
    committed?: string;
    exposure?: string;
    unbilledChanges?: string;
    marginSignal?: string;
  };
  schedule: {
    status: "on_track" | "watch" | "critical" | "unknown";
    blockers: string[];
    upcomingMilestones: string[];
  };
  risks: Array<{
    id?: string;
    title: string;
    severity: "low" | "medium" | "high" | "critical";
    reason: string;
    href?: string;
  }>;
  ownerActions: OwnerActionItem[];
  recentMovement: Array<{
    label: string;
    sourceType: "meeting" | "email" | "teams" | "document" | "project_record" | "accounting" | "knowledge";
    date?: string;
    href?: string;
  }>;
  dataGaps: string[];
  sources: SourceEvidenceItem[];
};

export type OwnerActionQueueWidgetPayload = {
  type: "owner_action_queue";
  id: string;
  title: string;
  subtitle: string;
  totalCount: number;
  groups: Array<{
    id: string;
    title: string;
    priority: "now" | "next" | "watch";
    items: OwnerActionItem[];
  }>;
  emptyState?: string;
};

export type MeetingInsightItem = {
  id: string;
  title: string;
  detail?: string;
  ownerName?: string | null;
  dueDate?: string | null;
  sourceTitle?: string | null;
  sourceHref?: string | null;
  confidence: "low" | "medium" | "high";
};

export type MeetingInsightsWidgetPayload = {
  type: "meeting_insights";
  id: string;
  title: string;
  subtitle: string;
  dateLabel: string;
  projectId?: number | null;
  projectName?: string | null;
  metrics: {
    meetingCount: number;
    decisionCount: number;
    actionItemCount: number;
    riskCount: number;
    unresolvedQuestionCount: number;
  };
  decisions: MeetingInsightItem[];
  promises: MeetingInsightItem[];
  risks: MeetingInsightItem[];
  unresolvedQuestions: MeetingInsightItem[];
  suggestedTasks: OwnerActionItem[];
  sources: SourceEvidenceItem[];
};

export type RiskExposurePacketWidgetPayload = {
  type: "risk_exposure_packet";
  id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  projectId?: number | null;
  projectName?: string | null;
  summary: string;
  estimatedImpact?: string;
  exposureType: "cost" | "schedule" | "contract" | "billing" | "vendor" | "quality" | "unknown";
  evidence: SourceEvidenceItem[];
  affectedRecords: Array<{
    label: string;
    recordType: string;
    href?: string;
  }>;
  options: Array<{
    label: string;
    tradeoff: string;
    recommended?: boolean;
  }>;
  nextActions: OwnerActionItem[];
  dataGaps: string[];
};

export type FinancialPulseWidgetPayload = {
  type: "financial_pulse";
  id: string;
  title: string;
  subtitle: string;
  asOf: string;
  scope: "project" | "portfolio" | "company";
  projectId?: number | null;
  kpis: Array<{
    label: string;
    value: string;
    delta?: string;
    status: "good" | "watch" | "critical" | "neutral";
  }>;
  variances: Array<{
    label: string;
    actual: string;
    expected?: string;
    variance?: string;
    href?: string;
  }>;
  alerts: RiskExposurePacketWidgetPayload[];
  recommendedActions: OwnerActionItem[];
  sources: SourceEvidenceItem[];
};

export type CreativeDraftWidgetPayload = {
  type: "creative_draft";
  id: string;
  title: string;
  audience: "owner" | "client" | "subcontractor" | "internal" | "public" | "proposal";
  format: "email" | "linkedin" | "case_study" | "proposal_blurb" | "meeting_recap" | "memo";
  tone: "direct" | "polished" | "warm" | "firm" | "executive";
  sourceFacts: Array<{
    label: string;
    value: string;
    sourceHref?: string;
  }>;
  bannedClaims: string[];
  draftTitle?: string;
  draftBody: string;
  sourceCheck: {
    status: "source_backed" | "needs_review" | "unsupported";
    notes: string[];
  };
};

export type SourceEvidenceDrawerWidgetPayload = {
  type: "source_evidence_drawer";
  id: string;
  title: string;
  sources: SourceEvidenceItem[];
};

export type RecordWritePreviewWidgetPayload = {
  type: "record_write_preview";
  id: string;
  title: string;
  safetyLevel: "medium" | "high";
  actionLabel: string;
  target: {
    table: string;
    recordType: "task" | "rfi" | "change_event" | "risk" | "email" | "project_status" | "budget" | "unknown";
    projectId?: number | null;
    existingRecordHref?: string;
  };
  fields: AssistantWidgetField[];
  sourceEvidence: SourceEvidenceItem[];
  validation: Array<{
    label: string;
    status: "pass" | "warning" | "fail";
    message: string;
  }>;
  confirmPrompt: string;
};

export type CommitmentDraftWidgetPayload = {
  type: "commitment_draft";
  id: string;
  title: string;
  commitmentType: "subcontract" | "purchase_order";
  projectId: number;
  contractNumber: string;
  vendorName?: string | null;
  vendorResolved: boolean;
  fields: AssistantWidgetField[];
  validation: Array<{
    label: string;
    status: "pass" | "warning" | "fail";
    message: string;
  }>;
  lineItems: Array<{
    id: string;
    costCode?: string | null;
    description: string;
    amount: number;
    quantity?: number | null;
    unitCost?: number | null;
    uom?: string | null;
  }>;
  totalAmount: number;
  confirmPrompt: string;
};

export type PrimeContractDraftWidgetPayload = {
  type: "prime_contract_draft";
  id: string;
  title: string;
  status: "draft" | "created" | "partial" | "blocked";
  projectId: number;
  contractNumber: string;
  ownerCompanyId?: string | null;
  ownerCompanyName?: string | null;
  sovSource: "manual" | "budget" | "workbook";
  sourceLineIds?: string[];
  workbookRows?: Array<{
    sourceSheet: "General Conditions" | "Details";
    rowNumber: number;
    costCode: string;
    costTypeCode: string;
    description: string;
    workDescription?: string | null;
    budgetAmount: number;
    unitQty?: number | null;
    unitOfMeasure?: string | null;
    unitCost?: number | null;
    warnings: string[];
  }>;
  workbookOmittedRows?: number;
  savedMarkups?: Array<{
    id: string;
    markupType: string;
    percentage: number;
    compound: boolean;
  }>;
  fields: AssistantWidgetField[];
  validation: Array<{
    label: string;
    status: "pass" | "warning" | "fail";
    message: string;
  }>;
  lineItems: Array<{
    id: string;
    budgetCodeId?: string | null;
    costCodeId?: string | null;
    description: string;
    amount: number;
    quantity?: number | null;
    unitCost?: number | null;
    unitOfMeasure?: string | null;
  }>;
  totalAmount: number;
  plannedWrites: {
    contractRows: number;
    sovRows: number;
  };
  recordId?: string | null;
  recordHref?: string | null;
  failures?: Array<{
    lineNumber?: number;
    description: string;
    message: string;
  }>;
  confirmPrompt: string;
};

export type ExecutiveDailyBriefWidgetPayload = {
  type: "executive_daily_brief";
  id: string;
  briefId: string;
  generatedAt: string;
  summary: {
    needsBrandon: number;
    waitingOnOthers: number;
    importantUpdates: number;
    topProjects: number;
  };
  financialPulse: {
    totalOutstandingAR: number;
    totalOverdueAR: number;
    pendingCORevenue: number;
    topOverdueProjects: Array<{ project: string; overdue: number }>;
  } | null;
  topItems: Array<{
    lane: string;
    project: string;
    title: string;
    nextMove: string;
  }>;
  sourceHealth: {
    email?: { count: number; latest: string; status: string } | null;
    teams?: { count: number; latest: string; status: string } | null;
    meetings?: { count: number; latest: string; status: string } | null;
  };
};

export type AssistantWidgetPayload =
  | DraftEmailWidgetPayload
  | OutlookEmailDraftWidgetPayload
  | CalendarInviteWidgetPayload
  | CreateTaskWidgetPayload
  | CreateContactWidgetPayload
  | TaskSummaryWidgetPayload
  | MeetingIntelligenceWidgetPayload
  | OutlookInboxSummaryWidgetPayload
  | ProjectPickerWidgetPayload
  | OwnerSnapshotWidgetPayload
  | OwnerActionQueueWidgetPayload
  | MeetingInsightsWidgetPayload
  | RiskExposurePacketWidgetPayload
  | FinancialPulseWidgetPayload
  | CreativeDraftWidgetPayload
  | SourceEvidenceDrawerWidgetPayload
  | RecordWritePreviewWidgetPayload
  | CommitmentDraftWidgetPayload
  | PrimeContractDraftWidgetPayload
  | CreateEventWidgetPayload
  | ChangeEventWorkflowWidgetPayload
  | ProjectActionPreviewWidgetPayload
  | DecisionPacketWidgetPayload
  | ExecutiveDailyBriefWidgetPayload
  | import("@/lib/feature-requests/types").FeatureRequestPacketWidgetPayload;

export type AssistantWidgetDataPart = {
  type: "data-assistant-widget";
  id?: string;
  data: {
    widget: AssistantWidgetPayload;
  };
};

export const ASSISTANT_WIDGET_TYPES = [
  "draft_email",
  "outlook_email_draft",
  "calendar_invite",
  "create_task",
  "create_contact",
  "task_summary",
  "meeting_intelligence",
  "outlook_inbox_summary",
  "project_picker",
  "owner_snapshot",
  "owner_action_queue",
  "meeting_insights",
  "risk_exposure_packet",
  "financial_pulse",
  "creative_draft",
  "source_evidence_drawer",
  "record_write_preview",
  "commitment_draft",
  "prime_contract_draft",
  "create_event",
  "change_event_workflow",
  "project_action_preview",
  "decision_packet",
  "feature_request_packet",
  "executive_daily_brief",
] as const satisfies readonly AssistantWidgetKind[];

function normalizePrompt(prompt: string): string {
  return prompt.trim().replace(/\s+/g, " ");
}

function compactTitle(prompt: string, fallback: string): string {
  const normalized = normalizePrompt(prompt)
    .replace(/^(please\s+)?(draft|write|create|make|add|schedule|log)\s+/i, "")
    .replace(/\?+$/, "")
    .trim();
  if (!normalized) return fallback;
  return normalized.length > 82 ? `${normalized.slice(0, 79)}...` : normalized;
}

function nextDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

function containsAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

export function buildAssistantWidgetsFromPrompt(params: {
  prompt: string;
  selectedProjectId?: number | null;
}): AssistantWidgetPayload[] {
  const prompt = normalizePrompt(params.prompt);
  const lower = prompt.toLowerCase();
  const widgets: AssistantWidgetPayload[] = [];

  if (
    containsAny(lower, ["draft email", "write email", "send email", "email to"])
  ) {
    const title = compactTitle(prompt, "Draft email");
    widgets.push({
      type: "draft_email",
      id: "draft-email",
      title: "Draft email",
      defaultTo: "",
      defaultSubject: title,
      defaultBody: [
        "Hi,",
        "",
        "I wanted to follow up on the item below:",
        "",
        prompt,
        "",
        "Please let me know what you need from our side.",
        "",
        "Thanks,",
      ].join("\n"),
    });
  }

  if (
    containsAny(lower, ["create task", "add task", "make a task", "assign "])
  ) {
    widgets.push({
      type: "create_task",
      id: "create-task",
      title: "Create task",
      defaultTitle: compactTitle(prompt, "New project task"),
      defaultBody: prompt,
      defaultDueDate: nextDate(7),
      defaultPriority: lower.includes("urgent") || lower.includes("critical")
        ? "critical"
        : lower.includes("high priority")
          ? "high"
          : "normal",
      projectId: params.selectedProjectId ?? null,
    });
  }

  if (
    containsAny(lower, [
      "create event",
      "create meeting",
      "schedule meeting",
      "add to calendar",
      "calendar invite",
      "outlook invite",
      "send invite",
      "calendar",
    ])
  ) {
    widgets.push({
      type: "calendar_invite",
      id: "calendar-invite",
      title: "Calendar invite",
      status: "draft",
      subject: compactTitle(prompt, "Project meeting"),
      body: prompt,
      startDateTime: `${nextDate(1)}T09:00`,
      endDateTime: `${nextDate(1)}T09:30`,
      timeZone: "Eastern Standard Time",
      location: "Microsoft Teams",
      attendees: [],
      projectId: params.selectedProjectId ?? null,
      adaptiveCard: {
        type: "AdaptiveCard",
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
        version: "1.5",
        body: [
          {
            type: "TextBlock",
            text: compactTitle(prompt, "Project meeting"),
            weight: "Bolder",
            size: "Medium",
            wrap: true,
          },
          {
            type: "FactSet",
            facts: [
              { title: "Start", value: "Needs date/time" },
              { title: "End", value: "Needs date/time" },
              { title: "Location", value: "Microsoft Teams" },
              { title: "Attendees", value: "Needs attendees" },
              { title: "Status", value: "draft" },
            ],
          },
        ],
        actions: [],
      },
      confirmPrompt:
        "Create this Outlook calendar invite with createOutlookCalendarInvite. Show the final preview first and wait for my confirmation.",
    });
  }

  if (containsAny(lower, ["create rfi", "draft rfi", "write rfi"])) {
    const title = compactTitle(prompt, "Draft RFI");
    widgets.push({
      type: "project_action_preview",
      id: "rfi-preview",
      title: "RFI preview",
      actionType: "rfi",
      projectId: params.selectedProjectId ?? null,
      fields: [
        { label: "Subject", value: title, editable: true },
        { label: "Question", value: prompt, editable: true, multiline: true },
        { label: "Cost impact", value: "tbd", editable: true },
        { label: "Schedule impact", value: "tbd", editable: true },
      ],
      confirmPrompt:
        "Create an RFI from this preview. Show the final write preview first and wait for my confirmation.",
    });
  }

  if (
    containsAny(lower, [
      "create change event",
      "create change request",
      "log change event",
      "log change request",
      "draft change event",
      "draft change request",
      "change request",
      "change event",
    ])
  ) {
    widgets.push({
      type: "change_event_workflow",
      id: "change-event-workflow",
      title: "Change event workflow",
      draft: buildChangeEventWorkflowDraft({
        prompt,
        selectedProjectId: params.selectedProjectId ?? null,
      }),
    });
  }

  if (
    containsAny(lower, [
      "should we",
      "recommend",
      "approve",
      "decision",
      "risk",
      "impact",
    ])
  ) {
    widgets.push({
      type: "decision_packet",
      id: "decision-packet",
      title: "Decision packet",
      recommendation:
        "Treat this as a review item until the assistant confirms the supporting project evidence.",
      confidence: "medium",
      impacts: [
        { label: "Financial impact", value: "Needs source-backed amount" },
        { label: "Schedule impact", value: "Needs current project context" },
        { label: "Owner action", value: "Confirm responsible party before executing" },
      ],
      risks: [
        "Missing source evidence could lead to the wrong owner or cost treatment.",
        "A write action should stay preview-only until the final fields are confirmed.",
      ],
      nextActions: [
        "Ask the assistant to pull source evidence for this decision.",
        "Convert the decision into an RFI, change event, task, or email draft once the fields are confirmed.",
      ],
    });
  }

  return widgets;
}

export function isAssistantWidgetPayload(
  value: unknown,
): value is AssistantWidgetPayload {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.type === "string" &&
    ASSISTANT_WIDGET_TYPES.includes(record.type as AssistantWidgetKind)
  );
}

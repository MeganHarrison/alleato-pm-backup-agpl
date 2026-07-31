"use client";

import { AssistantWidgetRenderer } from "@/components/ai-assistant/assistant-widget-renderer";
import { SectionRuleHeading } from "@/components/layout/spacing";
import type { AssistantWidgetPayload } from "@/lib/ai/assistant-widgets";

const sourceEvidence = [
  {
    id: "meeting-1",
    title: "Owner OAC meeting",
    sourceType: "meeting" as const,
    date: "2026-05-12",
    snippet:
      "Owner requested a decision on the proposed ceiling revisions before procurement is released.",
    href: "/meetings/meeting-1",
    confidence: "high" as const,
  },
  {
    id: "email-1",
    title: "Architect email thread",
    sourceType: "email" as const,
    date: "2026-05-11",
    snippet:
      "Architect confirmed the sketch changes the corridor finish scope and may affect lead time.",
    confidence: "medium" as const,
  },
];

const ownerActions = [
  {
    id: "action-1",
    title: "Confirm ceiling revision pricing path",
    description: "Decide whether to carry this as an allowance draw or formal change event.",
    projectId: 983,
    projectName: "Union Collective",
    ownerName: "Project Executive",
    dueDate: "2026-05-15",
    priority: "high" as const,
    sourceType: "meeting" as const,
    sourceTitle: "Owner OAC meeting",
    recommendedAction: "create_change_event" as const,
    confidence: "high" as const,
    href: "/983/tasks/action-1",
  },
  {
    id: "action-2",
    title: "Send owner update on risk exposure",
    projectId: 983,
    projectName: "Union Collective",
    ownerName: "PM",
    dueDate: "2026-05-16",
    priority: "normal" as const,
    sourceType: "email" as const,
    recommendedAction: "draft_message" as const,
    confidence: "medium" as const,
  },
];

const widgets: AssistantWidgetPayload[] = [
  {
    type: "draft_email",
    id: "draft-email",
    title: "Draft owner follow-up",
    emailFrom: "pm@alleatogroup.com",
    defaultTo: "owner@example.com",
    defaultSubject: "Union Collective ceiling revision follow-up",
    defaultBody:
      "Hi,\n\nFollowing up on the ceiling revision discussed yesterday. We are confirming pricing and schedule exposure before releasing procurement.\n\nThanks,",
  },
  {
    type: "outlook_email_draft",
    id: "outlook-email-draft",
    title: "Outlook email draft",
    status: "created",
    mailboxUserId: "pm@alleatogroup.com",
    mode: "reply",
    subject: "RE: Ceiling revision",
    body:
      "Thanks for sending this over. We will validate the cost and schedule exposure and come back with a source-backed recommendation.",
    toRecipients: [{ email: "owner@example.com", name: "Owner Rep" }],
    ccRecipients: [{ email: "architect@example.com", name: "Architect" }],
    bccRecipients: [],
    replyToGraphMessageId: "message-1",
    outlookDraftId: "draft-1",
    outlookWebLink: "https://outlook.office.com/mail/deeplink/compose/draft-1",
    voiceProfile: {
      path: "docs/architecture/memory/brandon-brand-voice/brandon-email-voice-profile.md",
      version: "2026-05-13",
    },
    adaptiveCard: {},
    confirmPrompt: "Open in Outlook to review and send.",
  },
  {
    type: "calendar_invite",
    id: "calendar-invite",
    title: "Coordination meeting",
    status: "draft",
    organizerEmail: "pm@alleatogroup.com",
    subject: "Ceiling revision coordination",
    body: "Review pricing path, owner decision timing, and procurement impact.",
    startDateTime: "2026-05-14T10:00",
    endDateTime: "2026-05-14T10:30",
    timeZone: "Eastern Standard Time",
    location: "Microsoft Teams",
    projectId: 983,
    attendees: [
      { email: "owner@example.com", name: "Owner Rep", type: "required" },
      { email: "architect@example.com", name: "Architect", type: "optional" },
    ],
    adaptiveCard: {},
    confirmPrompt: "Create this invite after final confirmation.",
  },
  {
    type: "create_task",
    id: "create-task",
    title: "Create task",
    defaultTitle: "Validate ceiling revision exposure",
    defaultBody: "Confirm pricing, schedule impact, and owner decision path.",
    defaultDueDate: "2026-05-15",
    defaultAssignee: "PM",
    defaultPriority: "high",
    projectId: 983,
  },
  {
    type: "create_contact",
    id: "create-contact",
    title: "Create contact",
    status: "draft",
    defaultFirstName: "Jane",
    defaultLastName: "Doe",
    defaultEmail: "jane.doe@vulcanfp.com",
    defaultPhone: "(317) 555-1234",
    defaultJobTitle: "Project Manager",
    defaultDepartment: "Operations",
    defaultCompanyName: "Vulcan Fire Protection Services, Inc.",
    defaultNotes: "Primary PM contact for the fire protection scope.",
    companyId: null,
    contactHref: null,
    confirmPrompt:
      "Create this contact in the directory with createContact (confirmed). Show the final form first and wait for my confirmation.",
  },
  {
    type: "task_summary",
    id: "task-summary",
    title: "Generated tasks today",
    subtitle: "Open follow-ups created from meetings and email",
    totalCount: 2,
    dateLabel: "May 13, 2026",
    items: [
      {
        id: "task-1",
        title: "Validate ceiling revision exposure",
        description: "Confirm pricing, schedule impact, and owner decision path.",
        status: "open",
        priority: "high",
        dueDate: "2026-05-15",
        assigneeName: "PM",
        projectId: 983,
        projectName: "Union Collective",
        sourceTitle: "Owner OAC meeting",
        sourceSystem: "Fireflies",
        sourceDate: "2026-05-12",
        createdAt: "2026-05-13",
        href: "/983/tasks/task-1",
      },
    ],
  },
  {
    type: "meeting_intelligence",
    id: "meeting-intelligence",
    title: "Meeting intelligence",
    subtitle: "Structured readout from recent project meetings",
    dateLabel: "Last 7 days",
    meetingCount: 3,
    criticalRiskCount: 1,
    decisionCount: 2,
    actionItemCount: 5,
    topInsights: [
      "Ceiling revision needs owner direction before procurement release.",
      "Schedule exposure is still unpriced.",
    ],
    recommendedNextActions: [
      "Create a change event preview.",
      "Send owner-facing decision summary.",
    ],
    meetings: [
      {
        id: "meeting-1",
        title: "Owner OAC meeting",
        projectId: 983,
        projectName: "Union Collective",
        date: "2026-05-12",
        source: "Fireflies",
        summary: "Team reviewed ceiling revision impact and next decision points.",
        criticalRisks: ["Procurement may be released before pricing is resolved."],
        decisions: ["Carry as review item until the cost path is confirmed."],
        actionItems: ["PM to validate exposure."],
        href: "/meetings/meeting-1",
      },
    ],
  },
  {
    type: "project_picker",
    id: "project-picker",
    title: "Pick a project",
    subtitle: "This request could match more than one active project.",
    intent: "risk_review",
    projects: [
      {
        projectId: 983,
        name: "Union Collective",
        client: "Union Collective",
        phase: "Construction",
        state: "Active",
        summary: "Mixed-use project with open ceiling revision risk.",
        contractValue: "$4.8M",
        meetingCount: 12,
        openCriticalItems: 1,
        healthStatus: "watch",
        prompt: "Use Union Collective for this request.",
      },
      {
        projectId: 760,
        name: "Brookville Road Goodwill",
        client: "Goodwill",
        phase: "Closeout",
        state: "Active",
        summary: "Closeout-heavy project with open document follow-ups.",
        contractValue: "$2.1M",
        meetingCount: 8,
        prompt: "Use Brookville Road Goodwill for this request.",
      },
    ],
  },
  {
    type: "owner_snapshot",
    id: "owner-snapshot",
    title: "Owner snapshot",
    projectId: 983,
    projectName: "Union Collective",
    status: "watch",
    asOf: "2026-05-13",
    summary:
      "Project is generally moving, but ceiling revision pricing and procurement timing need an owner decision.",
    healthSignals: [
      { label: "Cost", value: "Watch", status: "watch" },
      { label: "Schedule", value: "At risk", status: "critical" },
      { label: "Docs", value: "Current", status: "good" },
    ],
    money: {
      contractValue: "$4.8M",
      committed: "$3.2M",
      exposure: "$42K review item",
      unbilledChanges: "$18K",
      marginSignal: "Hold pending CE",
    },
    schedule: {
      status: "watch",
      blockers: ["Pricing path not confirmed"],
      upcomingMilestones: ["Procurement release"],
    },
    risks: [
      {
        id: "risk-1",
        title: "Unpriced ceiling revision",
        severity: "high",
        reason: "Work may proceed before owner approval.",
      },
    ],
    ownerActions,
    recentMovement: [
      { label: "Owner OAC meeting", sourceType: "meeting", date: "2026-05-12" },
      { label: "Architect email thread", sourceType: "email", date: "2026-05-11" },
    ],
    dataGaps: ["Current subcontractor quote is not attached yet."],
    sources: sourceEvidence,
  },
  {
    type: "owner_action_queue",
    id: "owner-action-queue",
    title: "Owner action queue",
    subtitle: "Items that need a human decision before the assistant writes anything.",
    totalCount: 2,
    groups: [
      { id: "now", title: "Needs decision now", priority: "now", items: [ownerActions[0]] },
      { id: "next", title: "Next follow-up", priority: "next", items: [ownerActions[1]] },
    ],
  },
  {
    type: "meeting_insights",
    id: "meeting-insights",
    title: "Meeting insights",
    subtitle: "Decisions, promises, risks, and unresolved questions from recent meetings.",
    dateLabel: "Last 7 days",
    projectId: 983,
    projectName: "Union Collective",
    metrics: {
      meetingCount: 3,
      decisionCount: 2,
      actionItemCount: 5,
      riskCount: 1,
      unresolvedQuestionCount: 2,
    },
    decisions: [
      {
        id: "decision-1",
        title: "Hold procurement release until pricing is reviewed",
        detail: "Owner wants cost clarity first.",
        confidence: "high",
      },
    ],
    promises: [
      {
        id: "promise-1",
        title: "PM will return with pricing path",
        ownerName: "PM",
        dueDate: "2026-05-15",
        confidence: "medium",
      },
    ],
    risks: [
      {
        id: "risk-1",
        title: "Unpriced scope could hit schedule",
        detail: "Subcontractor quote is missing.",
        confidence: "medium",
      },
    ],
    unresolvedQuestions: [
      {
        id: "question-1",
        title: "Is owner approval required before release?",
        confidence: "medium",
      },
    ],
    suggestedTasks: ownerActions,
    sources: sourceEvidence,
  },
  {
    type: "risk_exposure_packet",
    id: "risk-exposure",
    title: "Unpriced ceiling revision",
    severity: "high",
    projectId: 983,
    projectName: "Union Collective",
    summary:
      "The ceiling revision may create cost and schedule exposure if procurement is released before pricing is approved.",
    estimatedImpact: "$42K plus lead-time risk",
    exposureType: "cost",
    evidence: sourceEvidence,
    affectedRecords: [{ label: "Change event needed", recordType: "change_event" }],
    options: [
      { label: "Create change event", tradeoff: "Best audit trail", recommended: true },
      { label: "Carry as allowance note", tradeoff: "Fast but weaker control" },
    ],
    nextActions: ownerActions,
    dataGaps: ["Subcontractor quote is still missing."],
  },
  {
    type: "financial_pulse",
    id: "financial-pulse",
    title: "Financial pulse",
    subtitle: "Cost exposure and billing signals for the selected project.",
    asOf: "2026-05-13",
    scope: "project",
    projectId: 983,
    kpis: [
      { label: "Contract", value: "$4.8M", status: "neutral" },
      { label: "Committed", value: "$3.2M", delta: "67% committed", status: "good" },
      { label: "Exposure", value: "$42K", delta: "Needs CE", status: "watch" },
    ],
    variances: [
      { label: "Ceiling revision", actual: "$42K", expected: "$0", variance: "+$42K" },
    ],
    alerts: [],
    recommendedActions: ownerActions,
    sources: sourceEvidence,
  },
  {
    type: "creative_draft",
    id: "creative-draft",
    title: "Owner update draft",
    audience: "owner",
    format: "email",
    tone: "executive",
    sourceFacts: [
      { label: "Open risk", value: "Ceiling revision remains unpriced." },
      { label: "Next action", value: "PM is validating cost and schedule exposure." },
    ],
    bannedClaims: ["Do not claim owner approval has been received."],
    draftTitle: "Union Collective ceiling revision",
    draftBody:
      "We are tracking the ceiling revision as a decision item. Our next step is to validate the pricing and schedule exposure before procurement is released.",
    sourceCheck: {
      status: "needs_review",
      notes: ["Quote attachment is still missing."],
    },
  },
  {
    type: "source_evidence_drawer",
    id: "source-evidence-drawer",
    title: "Source evidence drawer",
    sources: sourceEvidence,
  },
  {
    type: "record_write_preview",
    id: "record-write-preview",
    title: "Record write preview",
    safetyLevel: "high",
    actionLabel: "Confirm write",
    target: {
      table: "change_events",
      recordType: "change_event",
      projectId: 983,
    },
    fields: [
      { label: "Title", value: "Unpriced ceiling revision", editable: true },
      {
        label: "Description",
        value: "Create CE for pricing and schedule exposure.",
        editable: true,
        multiline: true,
      },
      { label: "Status", value: "open", editable: true },
    ],
    sourceEvidence,
    validation: [
      { label: "Project", status: "pass", message: "Project resolved." },
      { label: "Source evidence", status: "warning", message: "Quote attachment missing." },
    ],
    confirmPrompt: "Create this change event after confirmation.",
  },
  {
    type: "create_event",
    id: "create-event",
    title: "Schedule coordination",
    dateLabel: "May",
    dateNumber: "14",
    defaultTitle: "Ceiling revision coordination",
    defaultTime: "10:00 AM",
    defaultLocation: "Microsoft Teams",
    defaultAgenda: "Review pricing path, owner approval, and procurement timing.",
    projectId: 983,
  },
  {
    type: "project_action_preview",
    id: "project-action-preview",
    title: "Change event preview",
    actionType: "change_event",
    projectId: 983,
    fields: [
      { label: "Title", value: "Unpriced ceiling revision", editable: true },
      {
        label: "Description",
        value: "Potential cost and schedule exposure from revised ceiling scope.",
        editable: true,
        multiline: true,
      },
      { label: "Scope", value: "Owner request", editable: true },
      { label: "Status", value: "open", editable: true },
    ],
    confirmPrompt: "Build a final write preview for this change event.",
  },
  {
    type: "decision_packet",
    id: "decision-packet",
    title: "Decision packet",
    recommendation:
      "Create a change event before procurement release so cost and schedule exposure are traceable.",
    confidence: "medium",
    impacts: [
      { label: "Financial impact", value: "$42K review item" },
      { label: "Schedule impact", value: "Lead-time risk if released late" },
      { label: "Owner action", value: "Approve pricing path" },
    ],
    risks: [
      "Proceeding without a CE weakens audit trail.",
      "Pricing may be disputed if source evidence is incomplete.",
    ],
    nextActions: [
      "Attach subcontractor quote.",
      "Send owner decision summary.",
      "Create CE preview.",
    ],
  },
  {
    type: "outlook_inbox_summary",
    id: "outlook-inbox-summary",
    title: "Inbox summary",
    subtitle: "Recent emails relevant to Union Collective",
    dateLabel: "Today",
    summary: "You have 3 emails requiring attention today. A draft reply has been prepared for 2 of them.",
    totalCount: 3,
    actionSummary: "1 reply needed, 1 task creation, 1 invoice to route",
    items: [
      {
        id: "email-1",
        subject: "RE: Ceiling revision pricing — need decision",
        fromName: "Sarah Chen",
        fromEmail: "schen@architectstudio.com",
        senders: ["schen@architectstudio.com"],
        receivedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        preview: "Attached is the updated spec sheet. We need a decision by EOD Friday to hold the lead time.",
        bodyText: "Hi Team,\n\nAttached is the updated ceiling revision spec sheet with revised pricing from the subcontractor.\n\nWe need a decision by EOD Friday to hold the lead time. If procurement is released without pricing approval we risk a $42K exposure.\n\nPlease advise.\n\nSarah",
        recommendedAction: "Reply confirming pricing review timeline and owner decision path.",
        projectIds: [983],
        messageCount: 3,
        hasAttachments: true,
        replyPrompt: "Draft a reply to Sarah Chen confirming the pricing review timeline and owner decision path for the ceiling revision.",
        draftPrompt: "Draft a new email to the team about the ceiling revision pricing decision timeline.",
        draftReady: true,
        draftPreview: "Hi Sarah — thanks for the updated spec. We'll have the owner's pricing decision back to you before EOD Friday to protect the lead time. Holding procurement until then to avoid the $42K exposure.",
        attentionScore: 9,
        recipients: [],
        conversationId: null,
        graphMessageId: null,
        webLink: "https://outlook.office.com/mail/",
      },
      {
        id: "email-2",
        subject: "Union Collective — Owner walkthrough notes",
        fromName: "Brandon Clymer",
        fromEmail: "bclymer@alleatogroup.com",
        senders: ["bclymer@alleatogroup.com"],
        receivedAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
        preview: "Notes from yesterday's walkthrough. Three open items from the owner on finish selections.",
        bodyText: "Team,\n\nHere are my notes from yesterday's owner walkthrough:\n\n1. Owner wants to revisit corridor finish selections — decision needed before procurement\n2. MEP coordination gap flagged in Level 2 — contractor to address by next week\n3. Owner requested updated schedule showing ceiling revision impact\n\nI'll follow up with a formal meeting recap.\n\nBrandon",
        recommendedAction: "Create tasks for the three open owner items and draft a recap email.",
        projectIds: [983],
        messageCount: 1,
        hasAttachments: false,
        replyPrompt: "Draft a reply to Brandon's walkthrough notes creating tasks for the three open owner items.",
        draftPrompt: "Draft a meeting recap email summarizing the owner walkthrough items.",
        attentionScore: 7,
        recipients: [],
        conversationId: null,
        graphMessageId: null,
        webLink: "https://outlook.office.com/mail/",
      },
      {
        id: "email-3",
        subject: "Invoice #1047 — Ready for review",
        fromName: "Miller Mechanical",
        fromEmail: "invoices@millermechanical.com",
        senders: ["invoices@millermechanical.com"],
        receivedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        preview: "Please find attached Invoice #1047 for $18,400 for work completed through May 10.",
        bodyText: "Hello,\n\nPlease find attached Invoice #1047 in the amount of $18,400.00 for mechanical work completed through May 10, 2026 on the Union Collective project.\n\nPlease process at your earliest convenience.\n\nThank you,\nMiller Mechanical",
        recommendedAction: "Route to accounting and verify against contract schedule of values.",
        projectIds: [983],
        messageCount: 1,
        hasAttachments: true,
        replyPrompt: "Draft a reply to Miller Mechanical acknowledging receipt of Invoice #1047 and routing it to accounting.",
        draftPrompt: "Draft a forwarding email to accounting with Invoice #1047 details.",
        draftReady: true,
        draftPreview: "Forwarding Invoice #1047 from Miller Mechanical ($18,400, work through May 10) to accounting for processing. Please verify against the Union Collective schedule of values before release.",
        attentionScore: 6,
        recipients: [],
        conversationId: null,
        graphMessageId: null,
        webLink: "https://outlook.office.com/mail/",
      },
    ],
  },
  {
    type: "feature_request_packet",
    id: "feature-request-packet",
    title: "AI widget gallery request",
    requestId: "feature-request-1",
    status: "ready_for_planning",
    readinessLabel: "Ready for planning",
    readyForBuild: false,
    openQuestions: ["Should this become a permanent design-system route?"],
    acceptanceCriteriaCount: 3,
    linearIssueUrl: null,
    linearSyncStatus: "not_started",
    handoffPath: null,
    detailHref: "/feature-requests/feature-request-1",
  },
];

const GENERATIVE_UI_COMPONENTS: Array<{
  type: string;
  label: string;
  trigger: string;
  description: string;
  category: "action" | "data" | "intelligence" | "communication";
}> = [
  { type: "outlook_inbox_summary", label: "Outlook Inbox Summary", trigger: "Email triage questions", description: "Email cards with sender avatar, body preview, relevance feedback, and Reply / AI Draft / Project / Task / Tag actions.", category: "communication" },
  { type: "outlook_email_draft", label: "Outlook Email Draft", trigger: "Draft / send email commands", description: "Full Outlook-connected draft with to/cc/bcc, status badge (draft → created), voice profile attribution, and Adaptive Card preview.", category: "communication" },
  { type: "draft_email", label: "Draft Email (simple)", trigger: "Write an email to…", description: "Lightweight compose card with editable to / subject / body fields. No Outlook connection required.", category: "communication" },
  { type: "calendar_invite", label: "Calendar Invite", trigger: "Schedule a meeting / send invite", description: "Outlook calendar event with attendees, start/end time, Teams join link, and Adaptive Card preview.", category: "communication" },
  { type: "create_task", label: "Create Task", trigger: "Create a task / add to do", description: "Task creation form with title, body, due date, assignee, priority, and project linkage.", category: "action" },
  { type: "create_contact", label: "Create Contact", trigger: "Add a contact / create a new contact", description: "Brand-themed directory contact form (company, name, job title, email, phone, department, notes) that the assistant prefills with everything it already knows. Writes to public.people on confirm.", category: "action" },
  { type: "project_action_preview", label: "Project Action Preview", trigger: "Create an RFI / log a change event", description: "Editable field-by-field preview before writing an RFI or change event to the database. Includes a confirm prompt.", category: "action" },
  { type: "record_write_preview", label: "Record Write Preview", trigger: "AI proposes a database write", description: "Safety-gated write preview with field list, source evidence, validation pass/fail rows, and a confirm prompt.", category: "action" },
  { type: "create_event", label: "Create Event", trigger: "Add to calendar / create meeting", description: "Quick-create calendar event card with title, time, location, and agenda fields.", category: "action" },
  { type: "decision_packet", label: "Decision Packet", trigger: "Should we / recommend / approve", description: "Recommendation card with confidence level, financial/schedule/owner impacts, risk bullets, and next action steps.", category: "intelligence" },
  { type: "owner_snapshot", label: "Owner Snapshot", trigger: "Project health / status overview", description: "Full project dashboard: health signals, money summary (contract value, committed, exposure), schedule blockers, risk register, owner action queue, and recent movement.", category: "intelligence" },
  { type: "owner_action_queue", label: "Owner Action Queue", trigger: "What do I need to do / action items", description: "Priority-grouped action queue (Now / Next / Watch) with source-backed items and recommended actions.", category: "intelligence" },
  { type: "risk_exposure_packet", label: "Risk Exposure Packet", trigger: "Risk / exposure / what could go wrong", description: "Risk assessment with severity, estimated impact, evidence, affected records, resolution options, and owner actions.", category: "intelligence" },
  { type: "financial_pulse", label: "Financial Pulse", trigger: "Financial summary / budget / cost status", description: "KPI grid, variance table, active risk alerts, and recommended financial actions.", category: "intelligence" },
  { type: "meeting_intelligence", label: "Meeting Intelligence", trigger: "Meeting summary / what happened in meetings", description: "Meeting rollup with counts, top insights, recommended next actions, and per-meeting drill-down (risks / decisions / action items).", category: "intelligence" },
  { type: "meeting_insights", label: "Meeting Insights", trigger: "Insights from meetings / what was decided", description: "Per-project meeting analysis: decisions, promises, risks, unresolved questions, suggested tasks, and source citations.", category: "intelligence" },
  { type: "task_summary", label: "Task Summary", trigger: "List my tasks / open action items", description: "Structured task register with status, priority, assignee, due date, source, and deep-link to each task.", category: "data" },
  { type: "project_picker", label: "Project Picker", trigger: "Which project (when context is ambiguous)", description: "Project selection launcher that routes follow-up intents (owner snapshot, action queue, meeting insights, etc.) to the right project.", category: "data" },
  { type: "source_evidence_drawer", label: "Source Evidence Drawer", trigger: "Show me your sources / where did that come from", description: "Collapsible evidence panel with source type icons, dates, snippets, and confidence levels for each cited document.", category: "data" },
  { type: "creative_draft", label: "Creative Draft", trigger: "Write a LinkedIn post / proposal / case study", description: "Source-backed creative writing with audience/tone/format metadata, banned-claims guard, and a source-check status (source_backed / needs_review / unsupported).", category: "communication" },
  { type: "feature_request_packet", label: "Feature Request Packet", trigger: "I want / I wish the app could…", description: "Structured feature request capture with priority signal, user context, and direct-to-Linear filing.", category: "action" },
];

const AISDK_FEATURES: Array<{
  feature: string;
  usage: string;
  where: string;
  badge: string;
}> = [
  { feature: "streamText", usage: "Main chat handler and agentic bot core. Streams token-by-token text and tool calls to the client.", where: "handler-v2.ts, bot-core.ts, artifacts/text", badge: "Core" },
  { feature: "generateText", usage: "Meeting prep generation (multi-step), fallback chain, Procore RAG Q&A, structured output via Output.object().", where: "meeting prep, procore-docs/ask, fallback-chain, bot-core", badge: "Core" },
  { feature: "streamObject", usage: "Streaming structured JSON for artifact creation and updates (code editor, spreadsheet).", where: "artifacts/code/server, artifacts/sheet/server", badge: "Core" },
  { feature: "generateObject", usage: "Structured output for project-intelligence summaries and LLM-as-judge response scoring.", where: "project-intelligence-summary, llm-judge", badge: "Core" },
  { feature: "tool()", usage: "28+ registered tools across 6 tool files: financial, operational, project, Acumatica, schedule, forecast, Outlook operations.", where: "lib/ai/tools/", badge: "Tools" },
  { feature: "Output.object() / Output.array()", usage: "Structured output from generateText without switching to generateObject — used for action briefs, suggestion arrays, and memory extraction.", where: "structured-output.ts, request-suggestions.ts, memory-extraction.ts", badge: "Tools" },
  { feature: "stopWhen: isStepCount(N)", usage: "Agentic loop cap: 10 steps for the main chat assistant, 7 steps for meeting prep generation.", where: "handler-v2.ts, meeting prep route", badge: "Agents" },
  { feature: "smoothStream({ chunking: 'word' })", usage: "Word-level token smoothing on text artifact streaming to prevent jittery rendering.", where: "artifacts/text/server.ts", badge: "Streaming" },
  { feature: "useChat (@ai-sdk/react)", usage: "Client-side chat state, message list, input handling, and status tracking across 5 chat surfaces.", where: "widget-ai-chat, executive-chat-panel, rag-chat-page, ask-alleato, procore-docs", badge: "React" },
  { feature: "DefaultChatTransport", usage: "Custom transport configuration for useChat — sets base URL, credentials, and retry behavior.", where: "widget-ai-chat, chat.tsx, ask-alleato", badge: "React" },
  { feature: "lastAssistantMessageIsCompleteWithApprovalResponses", usage: "Human-in-the-loop pattern — detects when the assistant has proposed an action and is waiting for user confirmation before executing a write.", where: "useAskAlleatoChat.ts", badge: "HITL" },
  { feature: "DataUIPart / data-assistant-widget", usage: "Custom data parts streamed from handler-v2 to the client. The widget registry maps each type to its React component. This is the generative UI backbone.", where: "handler-v2.ts → chat-area.tsx → AssistantWidgetRenderer", badge: "Generative UI" },
  { feature: "DynamicToolUIPart / ToolUIPart", usage: "Tool call and tool result rendering in the chat UI — shows expandable accordion cards for each tool invocation.", where: "chat-area.tsx, ai-elements/tool.tsx", badge: "Generative UI" },
  { feature: "dataStream.write()", usage: "Artifact servers write delta / code-delta / sheet-delta parts into the AI SDK data stream for real-time artifact updates.", where: "artifacts/code, text, sheet servers", badge: "Streaming" },
  { feature: "providerOptions", usage: "Provider-specific generation options (e.g. Anthropic extended thinking budget) passed through the artifact generation pipeline.", where: "artifacts/text/server.ts", badge: "Providers" },
  { feature: "Vercel AI Gateway (BYOK)", usage: "All LLM calls route through ai-gateway.vercel.sh. Zero-data-retention mode. Provider keys stay with OpenAI — Vercel bills nothing for token usage.", where: "lib/ai/providers.ts", badge: "Providers" },
  { feature: "text-embedding-3-large (halfvec 3072)", usage: "Document embedding for all 24K+ chunks in document_chunks. Used for vector search, RAG retrieval, and meeting compilation.", where: "ai-memory-service, backend sync pipeline", badge: "Embeddings" },
];

const CATEGORY_COLORS: Record<string, string> = {
  action: "bg-primary/10 text-primary",
  data: "bg-muted text-muted-foreground",
  intelligence: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  communication: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

const BADGE_COLORS: Record<string, string> = {
  "Core": "bg-primary/10 text-primary",
  "Tools": "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  "Agents": "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  "Streaming": "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  "React": "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  "HITL": "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  "Generative UI": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  "Providers": "bg-muted text-muted-foreground",
  "Embeddings": "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
};

export function AiWidgetGalleryClient() {
  return (
    <main className="min-h-screen bg-muted/20 px-6 py-8 text-foreground">
      <div className="mx-auto max-w-5xl space-y-12">
        <header className="space-y-2">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            AI chat generated UI
          </p>
          <h1 className="text-2xl font-semibold">Assistant widget gallery</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Static samples rendered through the live AssistantWidgetRenderer
            registry. These are the custom <code className="rounded bg-muted px-1 py-0.5 text-xs">data-assistant-widget</code> cards, not the
            generic tool-call accordions.
          </p>
        </header>

        {/* Live widget samples */}
        <section className="grid gap-5 lg:grid-cols-2">
          {widgets.map((widget) => (
            <div key={widget.id} className="min-w-0">
              <AssistantWidgetRenderer
                widget={widget}
                selectedProjectId={983}
                onSubmit={() => undefined}
                onEditDraft={() => undefined}
              />
            </div>
          ))}
        </section>

        {/* Generative UI component reference */}
        <section className="space-y-4">
          <div className="space-y-1.5">
            <SectionRuleHeading label="Generative UI components" />
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              All {GENERATIVE_UI_COMPONENTS.length} registered widget types. Each is emitted by the AI as a{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">data-assistant-widget</code> data part and rendered client-side by the AssistantWidgetRenderer registry.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {GENERATIVE_UI_COMPONENTS.map((c) => (
              <div key={c.type} className="rounded-lg bg-card px-4 py-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">{c.label}</span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${CATEGORY_COLORS[c.category]}`}>
                    {c.category}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-5">{c.description}</p>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] text-muted-foreground/60">Trigger:</span>
                  <span className="text-[10px] italic text-muted-foreground">{c.trigger}</span>
                </div>
                <code className="block text-[10px] text-muted-foreground/50">{c.type}</code>
              </div>
            ))}
          </div>
        </section>

        {/* AI SDK features */}
        <section className="space-y-4">
          <div className="space-y-1.5">
            <SectionRuleHeading label="AI SDK features in use" />
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Every Vercel AI SDK feature actively used in this codebase, with the exact file locations and purpose.
            </p>
          </div>

          <div className="overflow-hidden rounded-lg bg-muted/40">
            <div className="grid grid-cols-[auto_1fr_auto] gap-0 divide-y divide-border/50">
              {/* Header */}
              <div className="col-span-3 grid grid-cols-[220px_1fr_140px] gap-0 bg-muted/50 px-4 py-2">
                <span className="text-[11px] font-medium uppercase text-muted-foreground">Feature</span>
                <span className="text-[11px] font-medium uppercase text-muted-foreground">Usage</span>
                <span className="text-[11px] font-medium uppercase text-muted-foreground">Where</span>
              </div>
              {AISDK_FEATURES.map((f) => (
                <div key={f.feature} className="col-span-3 grid grid-cols-[220px_1fr_140px] items-start gap-0 px-4 py-3">
                  <div className="space-y-1 pr-3">
                    <code className="block text-xs font-semibold text-foreground">{f.feature}</code>
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${BADGE_COLORS[f.badge] ?? "bg-muted text-muted-foreground"}`}>
                      {f.badge}
                    </span>
                  </div>
                  <p className="pr-3 text-xs leading-5 text-muted-foreground">{f.usage}</p>
                  <p className="text-[10px] leading-4 text-muted-foreground/60 [overflow-wrap:anywhere]">{f.where}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

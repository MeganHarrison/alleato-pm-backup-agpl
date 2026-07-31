import {
  ASSISTANT_WIDGET_TYPES,
  buildAssistantWidgetsFromPrompt,
  isAssistantWidgetPayload,
  type AssistantWidgetDataPart,
  type CommitmentDraftWidgetPayload,
  type PrimeContractDraftWidgetPayload,
  type MeetingInsightsWidgetPayload,
  type OutlookInboxSummaryWidgetPayload,
} from "../assistant-widgets";
import { ASSISTANT_WIDGET_RENDERER_TYPES } from "@/components/ai-assistant/assistant-widget-renderer";

describe("assistant widget registry", () => {
  it("accepts every registered generative UI widget type", () => {
    for (const type of ASSISTANT_WIDGET_TYPES) {
      expect(isAssistantWidgetPayload({ type })).toBe(true);
    }
  });

  it("rejects malformed or unsupported widget payloads", () => {
    expect(isAssistantWidgetPayload(null)).toBe(false);
    expect(isAssistantWidgetPayload({})).toBe(false);
    expect(isAssistantWidgetPayload({ type: "openai_widget_builder_json" })).toBe(false);
  });

  it("keeps the payload registry and renderer registry in lockstep", () => {
    expect([...ASSISTANT_WIDGET_RENDERER_TYPES].sort()).toEqual(
      [...ASSISTANT_WIDGET_TYPES].sort(),
    );
  });

  it("generates the guided change-event workflow widget instead of a generic action preview", () => {
    const widgets = buildAssistantWidgetsFromPrompt({
      prompt: "Can you help me create a new change event?",
      selectedProjectId: 25125,
    });

    expect(widgets).toHaveLength(1);
    expect(widgets[0]?.type).toBe("change_event_workflow");
    expect(widgets[0]).toMatchObject({
      id: "change-event-workflow",
      title: "Change event workflow",
      draft: {
        projectId: 25125,
        readyForPreview: false,
      },
    });
  });

  it("accepts the source-specific meeting insights widget data part", () => {
    const widget: MeetingInsightsWidgetPayload = {
      type: "meeting_insights",
      id: "meeting-insights",
      title: "Recent meeting insights",
      subtitle: "Decisions, promises, risks, questions, and suggested follow-ups from meeting retrieval.",
      dateLabel: "Last 60 days",
      projectId: 983,
      projectName: null,
      metrics: {
        meetingCount: 1,
        decisionCount: 1,
        actionItemCount: 1,
        riskCount: 1,
        unresolvedQuestionCount: 1,
      },
      decisions: [
        {
          id: "meeting-1-decision",
          title: "Team confirmed the revised owner decision.",
          sourceTitle: "Owner coordination meeting",
          sourceHref: "/983/meetings/meeting-1",
          confidence: "medium",
        },
      ],
      promises: [
        {
          id: "meeting-1-promise",
          title: "Project Manager needs to follow up by Friday.",
          sourceTitle: "Owner coordination meeting",
          sourceHref: "/983/meetings/meeting-1",
          confidence: "medium",
        },
      ],
      risks: [
        {
          id: "meeting-1-risk",
          title: "Late response could delay procurement.",
          sourceTitle: "Owner coordination meeting",
          sourceHref: "/983/meetings/meeting-1",
          confidence: "medium",
        },
      ],
      unresolvedQuestions: [
        {
          id: "meeting-1-question",
          title: "Confirm final approval path.",
          sourceTitle: "Owner coordination meeting",
          sourceHref: "/983/meetings/meeting-1",
          confidence: "medium",
        },
      ],
      suggestedTasks: [
        {
          id: "meeting-task-1",
          title: "Project Manager needs to follow up by Friday.",
          projectId: 983,
          projectName: null,
          ownerName: "Project Manager",
          priority: "high",
          sourceType: "meeting",
          sourceTitle: "Owner coordination meeting",
          href: "/983/meetings/meeting-1",
          recommendedAction: "create_task",
          confidence: "medium",
        },
      ],
      sources: [
        {
          id: "meeting-source-1",
          title: "Owner coordination meeting",
          sourceType: "meeting",
          date: "2026-05-13T12:00:00.000Z",
          snippet: "Team confirmed the revised owner decision.",
          href: "/983/meetings/meeting-1",
          confidence: "medium",
        },
      ],
    };
    const dataPart: AssistantWidgetDataPart = {
      type: "data-assistant-widget",
      id: "assistant-widget-meeting-insights",
      data: { widget },
    };

    expect(isAssistantWidgetPayload(dataPart.data.widget)).toBe(true);
    expect(dataPart.data.widget.type).toBe("meeting_insights");
  });

  it("accepts the Outlook inbox summary generative UI widget data part", () => {
    const widget: OutlookInboxSummaryWidgetPayload = {
      type: "outlook_inbox_summary",
      id: "recent-email-inbox",
      title: "Important Outlook emails",
      subtitle: "Ranked by likely action needed, with the actual message text shown in readable cards.",
      dateLabel: "Today",
      summary: "Found 46 emails in 26 threads received today.",
      dataCutoffNote: "Outlook email sync last completed May 14, 1:12 PM ET.",
      mailbox: "bclymer@alleatogroup.com",
      totalCount: 46,
      threadCount: 26,
      actionSummary: "1 thread looks actionable.",
      items: [
        {
          id: "thread-1",
          graphMessageId: "message-1",
          conversationId: "conversation-1",
          subject: "RE: Closeout MTV 2 Project",
          fromName: "Kennedy, JP",
          fromEmail: "jpkennedy@radial.com",
          senders: ["jpkennedy@radial.com", "kmass@alleatogroup.com"],
          recipients: ["kmass@alleatogroup.com", "jdawson@alleatogroup.com"],
          receivedAt: "2026-05-14T16:00:42Z",
          messageCount: 3,
          hasAttachments: true,
          attentionScore: 6,
          preview: "Ok yes please get me final bill today.",
          bodyText: "Ok yes please get me final bill today.",
          webLink: "https://outlook.office.com/mail/inbox/id/thread-1",
          projectIds: [],
          recommendedAction: "Reply with the billing/payment next step.",
          replyPrompt: [
            "OUTLOOK_INBOX_CARD_ACTION",
            "Mode: reply",
            "Draft a short Outlook reply to this email thread.",
          ].join("\n"),
          draftPrompt: [
            "OUTLOOK_INBOX_CARD_ACTION",
            "Mode: new",
            "Draft a short Outlook email about this inbox item.",
          ].join("\n"),
        },
      ],
    };
    const dataPart: AssistantWidgetDataPart = {
      type: "data-assistant-widget",
      id: "assistant-widget-recent-email-inbox",
      data: { widget },
    };

    expect(isAssistantWidgetPayload(dataPart.data.widget)).toBe(true);
    expect(dataPart.data.widget.type).toBe("outlook_inbox_summary");
  });

  it("accepts the commitment draft generative UI widget data part", () => {
    const widget: CommitmentDraftWidgetPayload = {
      type: "commitment_draft",
      id: "commitment-draft-preview",
      title: "Subcontract draft",
      commitmentType: "subcontract",
      projectId: 25125,
      contractNumber: "SC-001",
      vendorName: "Acme Electric",
      vendorResolved: true,
      fields: [
        { label: "Title", value: "Electrical rough-in", editable: true },
        { label: "Vendor", value: "Acme Electric", editable: true },
      ],
      validation: [
        {
          label: "Vendor",
          status: "pass",
          message: "Vendor is linked to a company record.",
        },
      ],
      lineItems: [
        {
          id: "line-1",
          costCode: "26-0000",
          description: "Electrical rough-in",
          amount: 12500,
        },
      ],
      totalAmount: 12500,
      confirmPrompt: "Create this commitment with createCommitment.",
    };
    const dataPart: AssistantWidgetDataPart = {
      type: "data-assistant-widget",
      id: "assistant-widget-commitment-draft",
      data: { widget },
    };

    expect(isAssistantWidgetPayload(dataPart.data.widget)).toBe(true);
    expect(dataPart.data.widget.type).toBe("commitment_draft");
  });

  it("accepts the Prime Contract draft and receipt widget data part", () => {
    const widget: PrimeContractDraftWidgetPayload = {
      type: "prime_contract_draft",
      id: "prime-contract-draft-43-PC-0004",
      title: "Prime Contract draft",
      status: "draft",
      projectId: 43,
      contractNumber: "PC-0004",
      ownerCompanyId: null,
      ownerCompanyName: null,
      sovSource: "manual",
      workbookOmittedRows: 0,
      fields: [{ label: "Title", value: "Owner agreement", editable: true }],
      validation: [
        {
          label: "Schedule of Values",
          status: "pass",
          message: "1 row totaling $10,000.00.",
        },
      ],
      lineItems: [
        {
          id: "prime-contract-line-1",
          description: "General conditions",
          amount: 10000,
        },
      ],
      totalAmount: 10000,
      plannedWrites: { contractRows: 1, sovRows: 1 },
      confirmPrompt: "Create this Prime Contract with createPrimeContract.",
    };
    const dataPart: AssistantWidgetDataPart = {
      type: "data-assistant-widget",
      id: "assistant-widget-prime-contract-draft",
      data: { widget },
    };

    expect(isAssistantWidgetPayload(dataPart.data.widget)).toBe(true);
    expect(dataPart.data.widget.type).toBe("prime_contract_draft");
  });
});

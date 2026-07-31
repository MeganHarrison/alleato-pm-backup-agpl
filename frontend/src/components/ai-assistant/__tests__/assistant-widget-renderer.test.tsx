/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import {
  AssistantSourceEvidenceWidget,
  AssistantWidgetRenderer,
  shouldRenderAssistantDynamicToolComponent,
} from "../assistant-widget-renderer";
import { apiFetch } from "@/lib/api-client";
import type {
  CommitmentDraftWidgetPayload,
  OutlookEmailDraftWidgetPayload,
  OutlookInboxSummaryWidgetPayload,
  PrimeContractDraftWidgetPayload,
} from "@/lib/ai/assistant-widgets";

jest.mock("@/lib/api-client", () => ({
  apiFetch: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;

describe("AssistantSourceEvidenceWidget", () => {
  it("links revision-scoped FMDS evidence to its canonical in-app detail route", () => {
    render(
      <AssistantSourceEvidenceWidget
        sources={[
          {
            document_id: "chunk-1",
            snippet: "FMDS 8-34 April 2026 Table 2.1.4.5.4",
            metadata: {
              title: "FMDS0834 (2026-04), Table 2.1.4.5.4, PDF page 12",
              type: "fmds_table",
              url: "/fm-global/fm_global_tables/table-1",
            },
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("link", {
        name: /FMDS0834 \(2026-04\), Table 2\.1\.4\.5\.4, PDF page 12/i,
      }),
    ).toHaveAttribute("href", "/fm-global/fm_global_tables/table-1");
  });

  it("does not treat protocol-relative source metadata as an in-app route", () => {
    render(
      <AssistantSourceEvidenceWidget
        sources={[
          {
            snippet: "Untrusted source",
            metadata: {
              title: "Untrusted source",
              type: "fmds_table",
              url: "//example.com/unsafe",
            },
          },
        ]}
      />,
    );

    expect(
      screen.queryByRole("link", { name: /untrusted source/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Untrusted source")).toBeInTheDocument();
  });
});

describe("assistant dynamic tool rendering", () => {
  it("keeps approval visible until the approved tool has output", () => {
    const base = {
      type: "tool-createPrimeContract",
      approval: { id: "approval-1" },
    };

    expect(
      shouldRenderAssistantDynamicToolComponent({
        ...base,
        state: "approval-requested",
      }),
    ).toBe(false);
    expect(
      shouldRenderAssistantDynamicToolComponent({
        ...base,
        state: "output-available",
        output: { widget: { type: "prime_contract_draft" } },
      }),
    ).toBe(true);
  });
});

function createdOutlookDraftWidget(
  overrides: Partial<OutlookEmailDraftWidgetPayload> = {},
): OutlookEmailDraftWidgetPayload {
  return {
    type: "outlook_email_draft",
    id: "draft-message-id",
    title: "Outlook email draft",
    status: "created",
    mailboxUserId: "bclymer@alleatogroup.com",
    mode: "reply",
    subject: "RE: Brookville Road Goodwill",
    body: "Thanks. Let's make sure we understand the actual scope change.",
    toRecipients: [{ email: "jdawson@alleatogroup.com" }],
    ccRecipients: [{ email: "kgreen@alleatogroup.com" }],
    bccRecipients: [],
    replyToGraphMessageId: "source-message-id",
    outlookDraftId: "draft-message-id",
    outlookWebLink:
      "https://outlook.office.com/mail/deeplink/compose/draft-message-id",
    voiceProfile: {
      path: "docs/architecture/memory/brandon-brand-voice/brandon-email-voice-profile.md",
      version: "2026-05-13",
    },
    adaptiveCard: {},
    confirmPrompt: "Open it in Outlook to review and send.",
    ...overrides,
  };
}

describe("AssistantWidgetRenderer Outlook draft feedback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiFetchMock.mockResolvedValue({ success: true });
  });

  it("records good-tone feedback for a created Outlook draft", async () => {
    render(
      <AssistantWidgetRenderer
        widget={createdOutlookDraftWidget()}
        onSubmit={jest.fn()}
        onEditDraft={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /good tone/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/ai-assistant/email-draft-feedback",
        expect.objectContaining({
          method: "POST",
          body: expect.any(String),
        }),
      );
    });

    const payload = JSON.parse(
      String(apiFetchMock.mock.calls[0]?.[1]?.body),
    ) as Record<string, unknown>;
    expect(payload).toMatchObject({
      mailboxUserId: "bclymer@alleatogroup.com",
      graphDraftMessageId: "draft-message-id",
      graphSourceMessageId: "source-message-id",
      subject: "RE: Brookville Road Goodwill",
      signal: "good",
      reasonCategory: "good_tone",
      voiceProfilePath:
        "docs/architecture/memory/brandon-brand-voice/brandon-email-voice-profile.md",
      voiceProfileVersion: "2026-05-13",
    });
    expect(screen.getByText("Draft feedback recorded")).toBeInTheDocument();
  });

  it("does not show draft feedback controls before the Outlook draft exists", () => {
    render(
      <AssistantWidgetRenderer
        widget={createdOutlookDraftWidget({
          id: "outlook-email-draft-preview",
          status: "draft",
          outlookDraftId: null,
          outlookWebLink: null,
        })}
        onSubmit={jest.fn()}
        onEditDraft={jest.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /good tone/i }),
    ).not.toBeInTheDocument();
  });
});

describe("AssistantWidgetRenderer commitment draft", () => {
  function commitmentWidget(
    overrides: Partial<CommitmentDraftWidgetPayload> = {},
  ): CommitmentDraftWidgetPayload {
    return {
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
        {
          label: "Scope",
          value: "Electrical rough-in scope",
          editable: true,
          multiline: true,
        },
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
      ...overrides,
    };
  }

  it("renders a structured commitment draft and submits the final preview prompt", () => {
    const onSubmit = jest.fn();
    render(
      <AssistantWidgetRenderer
        widget={commitmentWidget()}
        onSubmit={onSubmit}
        onEditDraft={jest.fn()}
      />,
    );

    expect(screen.getByText("SC-001")).toBeInTheDocument();
    expect(screen.getAllByText("$12,500.00")).toHaveLength(2);
    expect(screen.getByText("Electrical rough-in")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /build final preview/i }),
    );
    expect(onSubmit).toHaveBeenCalledWith(
      expect.stringContaining("createCommitment"),
    );
    expect(onSubmit).toHaveBeenCalledWith(
      expect.stringContaining("Acme Electric"),
    );
  });

  it("blocks final preview submission when vendor validation fails", () => {
    render(
      <AssistantWidgetRenderer
        widget={commitmentWidget({
          vendorResolved: false,
          validation: [
            {
              label: "Vendor",
              status: "fail",
              message: "Resolve the vendor before creating the commitment.",
            },
          ],
        })}
        onSubmit={jest.fn()}
        onEditDraft={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /build final preview/i }),
    ).toBeDisabled();
    expect(screen.getByText(/resolve the vendor/i)).toBeInTheDocument();
  });
});

describe("AssistantWidgetRenderer Prime Contract draft", () => {
  function primeContractWidget(
    overrides: Partial<PrimeContractDraftWidgetPayload> = {},
  ): PrimeContractDraftWidgetPayload {
    return {
      type: "prime_contract_draft",
      id: "prime-contract-draft-43-PC-0004",
      title: "Prime Contract draft",
      status: "draft",
      projectId: 43,
      contractNumber: "PC-0004",
      ownerCompanyId: "00000000-0000-0000-0000-000000000002",
      ownerCompanyName: "Westfield Owner LLC",
      sovSource: "manual",
      fields: [
        {
          label: "Title",
          value: "Westfield Construction Agreement",
          editable: true,
        },
        {
          label: "Owner / client",
          value: "Westfield Owner LLC",
          editable: true,
        },
        { label: "Status", value: "draft", editable: true },
      ],
      validation: [
        {
          label: "Owner / client",
          status: "pass",
          message: "Westfield Owner LLC is linked to the Prime Contract.",
        },
      ],
      lineItems: [
        {
          id: "prime-contract-line-1",
          description: "General conditions",
          amount: 125000,
        },
      ],
      totalAmount: 125000,
      plannedWrites: { contractRows: 1, sovRows: 1 },
      recordId: null,
      recordHref: null,
      confirmPrompt: "Create this Prime Contract with createPrimeContract.",
      ...overrides,
    };
  }

  it("renders the write plan and requests explicit approval", () => {
    const onSubmit = jest.fn();
    render(
      <AssistantWidgetRenderer
        widget={primeContractWidget()}
        onSubmit={onSubmit}
        onEditDraft={jest.fn()}
      />,
    );

    expect(screen.getByText("PC-0004")).toBeInTheDocument();
    expect(screen.getByText("$125,000.00")).toBeInTheDocument();
    expect(screen.getByLabelText("SOV line 1 amount")).toHaveValue(
      "125,000.00",
    );
    expect(screen.getByText("1 contract + 1 SOV")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("SOV line 1 description"), {
      target: { value: "Updated general conditions" },
    });
    fireEvent.change(screen.getByLabelText("SOV line 1 amount"), {
      target: { value: "130000" },
    });
    expect(screen.getByText("$130,000.00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /request approval/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.stringContaining("createPrimeContract"),
    );
    expect(onSubmit).toHaveBeenCalledWith(
      expect.stringContaining('"confirmed": true'),
    );
    expect(onSubmit).toHaveBeenCalledWith(
      expect.stringContaining("Updated general conditions"),
    );
    expect(onSubmit).toHaveBeenCalledWith(expect.stringContaining("130000"));
  });

  it("locks workbook-backed rows and preserves workbook payload in the approval prompt", () => {
    const onSubmit = jest.fn();
    render(
      <AssistantWidgetRenderer
        widget={primeContractWidget({
          sovSource: "workbook",
          workbookRows: [
            {
              sourceSheet: "General Conditions",
              rowNumber: 12,
              costCode: "01-100",
              costTypeCode: "L",
              description: "General conditions",
              workDescription: null,
              budgetAmount: 125000,
              unitQty: 1,
              unitOfMeasure: "LS",
              unitCost: 125000,
              warnings: [],
            },
          ],
          workbookOmittedRows: 2,
        })}
        onSubmit={onSubmit}
        onEditDraft={jest.fn()}
      />,
    );

    expect(
      screen.queryByLabelText("SOV line 1 description"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("General conditions")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /request approval/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.stringContaining('"workbookRows"'),
    );
    expect(onSubmit).toHaveBeenCalledWith(
      expect.stringContaining('"workbookOmittedRows": 2'),
    );
    expect(onSubmit).toHaveBeenCalledWith(
      expect.stringContaining('"sourceSheet": "General Conditions"'),
    );
  });

  it("renders a canonical record link for a created receipt", () => {
    render(
      <AssistantWidgetRenderer
        widget={primeContractWidget({
          status: "created",
          title: "Prime Contract created",
          recordId: "contract-1",
          recordHref: "/43/prime-contracts/contract-1",
        })}
        onSubmit={jest.fn()}
        onEditDraft={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("link", { name: /open prime contract/i }),
    ).toHaveAttribute("href", "/43/prime-contracts/contract-1");
    expect(
      screen.queryByRole("button", { name: /request approval/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps budget-backed SOV rows read-only and preserves source IDs", () => {
    const onSubmit = jest.fn();
    render(
      <AssistantWidgetRenderer
        widget={primeContractWidget({
          sovSource: "budget",
          sourceLineIds: ["00000000-0000-0000-0000-000000000005"],
          savedMarkups: [
            {
              id: "markup-1",
              markupType: "fee",
              percentage: 5,
              compound: false,
            },
          ],
        })}
        onSubmit={onSubmit}
        onEditDraft={jest.fn()}
      />,
    );

    expect(
      screen.queryByLabelText("SOV line 1 description"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("SOV line 1 amount"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Saved markups (not applied)")).toBeInTheDocument();
    expect(screen.getByText("5%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /request approval/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.stringContaining('"sovSource": "budget"'),
    );
    expect(onSubmit).toHaveBeenCalledWith(
      expect.stringContaining('"00000000-0000-0000-0000-000000000005"'),
    );
  });
});

describe("AssistantWidgetRenderer Outlook inbox summary", () => {
  function inboxWidget(): OutlookInboxSummaryWidgetPayload {
    return {
      type: "outlook_inbox_summary",
      id: "recent-email-inbox",
      title: "Important Outlook emails",
      subtitle:
        "Ranked by likely action needed, with the actual message text shown in readable cards.",
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
          bodyText: [
            "Ok yes please get me final bill today.",
            "",
            "From: Kebba Mass <kmass@alleatogroup.com>",
            "Subject: RE: Closeout MTV 2 Project",
          ].join("\n"),
          webLink: "https://outlook.office.com/mail/inbox/id/thread-1",
          projectIds: [1009],
          recommendedAction: "Reply with the billing/payment next step.",
          replyPrompt: [
            "OUTLOOK_INBOX_CARD_ACTION",
            "Mode: reply",
            "Draft a short Outlook reply to this email thread.",
            "Subject: RE: Closeout MTV 2 Project",
            "Graph message ID: message-1",
          ].join("\n"),
          draftPrompt: [
            "OUTLOOK_INBOX_CARD_ACTION",
            "Mode: new",
            "Draft a short Outlook email about this inbox item.",
            "Subject: RE: Closeout MTV 2 Project",
          ].join("\n"),
        },
      ],
    };
  }

  it("renders Outlook inbox results as readable expandable email cards", () => {
    const onSubmit = jest.fn();
    render(
      <AssistantWidgetRenderer
        widget={inboxWidget()}
        onSubmit={onSubmit}
        onEditDraft={jest.fn()}
      />,
    );

    expect(
      screen.getByLabelText("Important Outlook emails"),
    ).toBeInTheDocument();
    expect(screen.getByText("RE: Closeout MTV 2 Project")).toBeInTheDocument();
    expect(
      screen.getByText("Ok yes please get me final bill today."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^reply$/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.stringContaining("OUTLOOK_INBOX_CARD_ACTION"),
    );
    expect(onSubmit).toHaveBeenCalledWith(
      expect.stringContaining("Graph message ID: message-1"),
    );
    expect(screen.getByRole("link", { name: /outlook/i })).toHaveAttribute(
      "href",
      "https://outlook.office.com/mail/inbox/id/thread-1",
    );
  });
});

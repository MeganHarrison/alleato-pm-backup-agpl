import {
  formatAiApprovalQueueEventLabel,
  getAiApprovalQueueMetadata,
  getAiApprovalQueuePreview,
  getAiApprovalQueueReviewChecks,
  getAiApprovalQueueRelatedHref,
  isAiApprovalQueueEventType,
  isAiApprovalQueueNotification,
} from "../ai-approval-queue";

describe("AI approval queue helpers", () => {
  it("accepts explicit approval and review-oriented event types", () => {
    expect(isAiApprovalQueueEventType("ai_change_event_awaiting_approval")).toBe(
      true,
    );
    expect(isAiApprovalQueueEventType("client_report_ready_to_send")).toBe(true);
    expect(isAiApprovalQueueEventType("outlook_email_requires_response")).toBe(
      true,
    );
    expect(isAiApprovalQueueEventType("custom_review_needed")).toBe(true);
  });

  it("rejects routine notification decisions", () => {
    expect(isAiApprovalQueueEventType("ai_memory_updated")).toBe(false);
    expect(isAiApprovalQueueEventType("rfi_assigned")).toBe(false);
    expect(isAiApprovalQueueEventType("routine_sync_completed")).toBe(false);
    expect(isAiApprovalQueueEventType(null)).toBe(false);
  });

  it("normalizes metadata and drops invalid values", () => {
    expect(
      getAiApprovalQueueMetadata({
        eventType: " client_report_ready_to_send ",
        requiredAction: " Review before sending. ",
        reason: " Client-facing delivery needs approval. ",
        failureLoudBehavior: " Preserve failed delivery state. ",
        source: " ai_notification_routing ",
        tier: " interrupt ",
        ignored: "value",
      }),
    ).toEqual({
      eventType: "client_report_ready_to_send",
      requiredAction: "Review before sending.",
      reason: "Client-facing delivery needs approval.",
      failureLoudBehavior: "Preserve failed delivery state.",
      source: "ai_notification_routing",
      tier: "interrupt",
    });

    expect(getAiApprovalQueueMetadata(null)).toEqual({});
    expect(getAiApprovalQueueMetadata(["bad", "metadata"])).toEqual({});
    expect(
      getAiApprovalQueueMetadata({
        eventType: 42,
        requiredAction: "",
      }),
    ).toEqual({});
  });

  it("matches only AI notification decisions with approval metadata", () => {
    expect(
      isAiApprovalQueueNotification({
        kind: "ai_notification_decision",
        metadata: { eventType: "ai_change_event_awaiting_approval" },
      }),
    ).toBe(true);

    expect(
      isAiApprovalQueueNotification({
        kind: "ai_notification_decision",
        metadata: { eventType: "ai_memory_updated" },
      }),
    ).toBe(false);

    expect(
      isAiApprovalQueueNotification({
        kind: "comment",
        metadata: { eventType: "client_report_ready_to_send" },
      }),
    ).toBe(false);
  });

  it("formats event labels for operational display", () => {
    expect(
      formatAiApprovalQueueEventLabel("ai_change_event_awaiting_approval"),
    ).toBe("Change Event Awaiting Approval");
    expect(formatAiApprovalQueueEventLabel(null)).toBe("AI review");
  });

  it("extracts preview fields for approval rows", () => {
    expect(
      getAiApprovalQueuePreview({
        eventType: "ai_commitment_awaiting_approval",
        preview: {
          table: "subcontracts",
          fields: {
            project_id: 43,
            title: "Electrical rough-in",
            contract_number: "SC-001",
            line_items: [
              { description: "Rough-in", amount: 12500 },
              { description: "Trim", amount: 5000 },
            ],
            ignored_null: null,
          },
        },
      }),
    ).toEqual({
      table: "subcontracts",
      fields: [
        { key: "project_id", label: "Project", value: "43" },
        { key: "title", label: "Title", value: "Electrical rough-in" },
        { key: "contract_number", label: "Contract number", value: "SC-001" },
        {
          key: "line_items",
          label: "Line items",
          value: "2 line items totaling $17,500.00",
        },
      ],
    });

    expect(getAiApprovalQueuePreview({ preview: { fields: [] } })).toBeNull();
    expect(getAiApprovalQueuePreview(null)).toBeNull();
  });

  it("builds explicit review checks from sensitive preview fields", () => {
    const preview = getAiApprovalQueuePreview({
      preview: {
        fields: {
          title: "Electrical rough-in",
          start_date: "2026-07-01",
          vendor_name_resolved: "Acme Electric",
          line_items: [{ description: "Rough-in", amount: 12500 }],
          scope: "TBD",
          expecting_revenue: true,
        },
      },
    });

    expect(getAiApprovalQueueReviewChecks(preview)).toEqual([
      {
        id: "generated-fields",
        label: "Generated fields match the intended record.",
      },
      {
        id: "dates",
        label: "Dates are correct.",
      },
      {
        id: "vendor",
        label: "Vendor and contract details are correct.",
      },
      {
        id: "line-items",
        label: "Line items and totals are correct.",
      },
      {
        id: "scope-revenue",
        label: "Scope and revenue assumptions are correct.",
      },
    ]);

    expect(getAiApprovalQueueReviewChecks(null)).toEqual([]);
  });

  it("builds related record links from notification context", () => {
    expect(
      getAiApprovalQueueRelatedHref({
        projectId: 25125,
        entityType: "change_events",
        entityId: "ce-1",
      }),
    ).toBe("/25125/change-events/ce-1");

    expect(
      getAiApprovalQueueRelatedHref({
        projectId: 25125,
        entityType: "progress-reports",
        entityId: "report-1",
      }),
    ).toBe("/25125/progress-reports/report-1");

    expect(
      getAiApprovalQueueRelatedHref({
        projectId: 25125,
        entityType: "custom_records",
        entityId: null,
      }),
    ).toBe("/25125/custom-records");

    expect(
      getAiApprovalQueueRelatedHref({
        projectId: null,
        entityType: "change_events",
        entityId: "ce-1",
      }),
    ).toBeNull();
  });
});

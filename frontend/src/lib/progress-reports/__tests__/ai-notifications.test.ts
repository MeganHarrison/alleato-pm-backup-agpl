import { recordAiNotificationDecision } from "@/lib/ai/notification-decision-ledger";
import { recordProgressReportAiGeneratedDecision } from "../ai-notifications";

jest.mock("@/lib/ai/notification-decision-ledger", () => ({
  recordAiNotificationDecision: jest.fn(),
}));

const mockRecordAiNotificationDecision =
  recordAiNotificationDecision as jest.MockedFunction<
    typeof recordAiNotificationDecision
  >;

describe("progress report AI notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecordAiNotificationDecision.mockResolvedValue({
      status: "recorded",
      decision: {
        tier: "interrupt",
        channels: ["in_app", "assistant_widget"],
        requiredAction: "Review recipients and content, then send or revise.",
        reason: "Client-facing communication needs review before delivery.",
        failureLoudBehavior:
          "Delivery state must show sent, failed, skipped, or blocked.",
        preferenceOverrideReason:
          "Teams delivery suppressed by preference; in-app visibility retained.",
      },
    });
  });

  it("records a non-Teams review decision for AI-generated report sections", async () => {
    await expect(
      recordProgressReportAiGeneratedDecision({
        userId: "user-1",
        projectId: 25125,
        reportId: "report-1",
        weekStart: "2026-06-15",
        weekEnd: "2026-06-21",
      }),
    ).resolves.toMatchObject({ status: "recorded" });

    expect(mockRecordAiNotificationDecision).toHaveBeenCalledWith({
      recipientUserId: "user-1",
      eventType: "client_report_ready_to_send",
      severity: "normal",
      projectId: 25125,
      entityType: "progress-reports",
      entityId: "report-1",
      eventKey: "progress_report:report-1:ai_generated",
      title: "AI progress report draft ready",
      body: "Review the AI-generated progress report sections for 2026-06-15 through 2026-06-21.",
      isUserOnRelatedPage: true,
      preferenceHints: { suppressTeams: true },
    });
  });
});

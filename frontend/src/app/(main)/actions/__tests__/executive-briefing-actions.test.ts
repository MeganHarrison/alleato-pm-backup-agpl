const mockRequireCapability = jest.fn();
const mockResolveAppBaseUrl = jest.fn();
const mockSendEmail = jest.fn();
const mockGetApiRouteUser = jest.fn();
const mockGetExecutiveBriefingDashboard = jest.fn();
const mockStartDailyBriefRun = jest.fn();
const mockRecordDraftEvidence = jest.fn();
const mockRecordEmailPayloadArtifact = jest.fn();
const mockRecordDeliveryAttempt = jest.fn();
const mockCompleteDailyBriefRun = jest.fn();
const mockFailDailyBriefRun = jest.fn();
const mockRevalidatePath = jest.fn();
const mockRedirect = jest.fn();

jest.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

jest.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}));

jest.mock("@/lib/app-capabilities", () => ({
  requireCurrentUserAppCapability: (...args: unknown[]) =>
    mockRequireCapability(...args),
}));

jest.mock("@/lib/email/client", () => ({
  resolveAppBaseUrl: (...args: unknown[]) => mockResolveAppBaseUrl(...args),
}));

jest.mock("@/lib/email/send", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

jest.mock("@/lib/executive/brandon-daily-update", () => ({
  DEFAULT_EXECUTIVE_WINDOW_DAYS: 3,
}));

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: (...args: unknown[]) => mockGetApiRouteUser(...args),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

jest.mock("@/lib/executive/executive-briefing-workflow", () => ({
  getExecutiveBriefingDashboard: (...args: unknown[]) =>
    mockGetExecutiveBriefingDashboard(...args),
  setExecutiveFollowUpState: jest.fn(),
}));

jest.mock("@/lib/ai-ops/executive-daily-brief-ledger", () => ({
  completeDailyBriefRun: (...args: unknown[]) =>
    mockCompleteDailyBriefRun(...args),
  failDailyBriefRun: (...args: unknown[]) => mockFailDailyBriefRun(...args),
  recordDeliveryAttempt: (...args: unknown[]) =>
    mockRecordDeliveryAttempt(...args),
  recordDraftEvidence: (...args: unknown[]) => mockRecordDraftEvidence(...args),
  recordEmailPayloadArtifact: (...args: unknown[]) =>
    mockRecordEmailPayloadArtifact(...args),
  sourceHealthForDraft: jest.fn(() => []),
  startDailyBriefRun: (...args: unknown[]) => mockStartDailyBriefRun(...args),
}));

import { sendExecutiveBriefingEmailAction } from "../executive-briefing-actions";

const runContext = {
  eventId: "event-1",
  runId: "run-1",
  startedAt: "2026-06-19T12:00:00.000Z",
  toolPolicy: {
    workflowId: "executive_daily_brief",
    allowedToolNames: ["build-email-daily-brief-payload"],
    actorMode: "service",
    allowedProjectIds: null,
    allowedSourceFamilies: ["project_intelligence"],
    allowDelivery: true,
    allowWrites: true,
    metadata: {},
  },
};

const draft = {
  id: "draft-1",
  recapDate: "2026-06-19",
  workflowStatus: "approved",
  approvedAt: "2026-06-19T12:00:00.000Z",
  approvedBy: "user-1",
  createdAt: "2026-06-19T12:00:00.000Z",
  updatedSummary: "Daily brief summary",
  packet: {
    generatedAt: "2026-06-19T12:00:00.000Z",
    windowDays: 3,
    retrievalOrder: [],
    sourceCoverage: [],
    retrievalNotes: [],
    sections: {
      needsBrandon: [],
      waitingOnOthers: [],
      importantUpdates: [],
    },
  },
};

function emailForm() {
  const formData = new FormData();
  formData.set("draftId", "draft-1");
  formData.set("recipients", "brandon@example.com, megan@example.com");
  formData.set("subject", "Daily operating brief");
  formData.set("introNote", "Review before standup.");
  return formData;
}

describe("executive briefing email action", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireCapability.mockResolvedValue(undefined);
    mockResolveAppBaseUrl.mockReturnValue("https://projects.example.com");
    mockGetApiRouteUser.mockResolvedValue({
      id: "user-1",
      email: "sender@example.com",
    });
    mockGetExecutiveBriefingDashboard.mockResolvedValue({
      draft,
      followUps: [],
      openFollowUps: [],
      staleFollowUps: [],
      liveFingerprints: new Set(),
      fingerprintMap: new Map(),
    });
    mockStartDailyBriefRun.mockResolvedValue(runContext);
    mockRecordEmailPayloadArtifact.mockResolvedValue({ id: "artifact-1" });
    mockCompleteDailyBriefRun.mockResolvedValue(undefined);
    mockFailDailyBriefRun.mockResolvedValue(undefined);
    mockRecordDeliveryAttempt.mockResolvedValue({ id: "attempt-1" });
    mockRecordDraftEvidence.mockResolvedValue({ id: "packet-artifact-1" });
    mockRedirect.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    });
  });

  it("records an AI Ops run, payload artifact, and recipient attempts for successful email send", async () => {
    mockSendEmail.mockResolvedValue({ id: "resend-1", error: null });

    await expect(sendExecutiveBriefingEmailAction(emailForm())).rejects.toThrow(
      "NEXT_REDIRECT:/actions?emailStatus=sent",
    );

    expect(mockStartDailyBriefRun).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "email_event",
        triggerType: "manual_email_send",
        deliveryTarget: { channel: "email", recipientCount: 2 },
      }),
    );
    expect(mockRecordDraftEvidence).toHaveBeenCalledWith(runContext, draft);
    expect(mockRecordEmailPayloadArtifact).toHaveBeenCalledWith(
      runContext,
      expect.objectContaining({
        title: "Executive Daily Brief email payload",
        contentType: "text/html",
      }),
    );
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "executive-briefing/draft-1/run-1",
        metadata: expect.objectContaining({ aiWorkRunId: "run-1" }),
      }),
    );
    expect(mockRecordDeliveryAttempt).toHaveBeenCalledTimes(2);
    expect(mockRecordDeliveryAttempt).toHaveBeenCalledWith(
      runContext,
      expect.objectContaining({
        artifactId: "artifact-1",
        channel: "email",
        recipientAddress: "brandon@example.com",
        status: "sent",
        providerMessageId: "resend-1",
      }),
    );
    expect(mockCompleteDailyBriefRun).toHaveBeenCalledWith(
      runContext,
      expect.objectContaining({
        status: "succeeded",
        dailyRecapId: "draft-1",
        deliveryStatus: "sent",
      }),
    );
  });

  it("records failed recipient attempts when the email provider returns an error", async () => {
    mockSendEmail.mockResolvedValue({
      id: null,
      error: { message: "Resend unavailable", name: "rate_limit" },
    });

    await expect(sendExecutiveBriefingEmailAction(emailForm())).rejects.toThrow(
      "NEXT_REDIRECT:/actions?emailStatus=failed",
    );

    expect(mockRecordDeliveryAttempt).toHaveBeenCalledTimes(2);
    expect(mockRecordDeliveryAttempt).toHaveBeenCalledWith(
      runContext,
      expect.objectContaining({
        channel: "email",
        status: "failed",
        failureCode: "EMAIL_PROVIDER_FAILED",
        failureMessage: "Resend unavailable",
        retryable: true,
      }),
    );
    expect(mockCompleteDailyBriefRun).toHaveBeenCalledWith(
      runContext,
      expect.objectContaining({
        status: "failed_retryable",
        deliveryStatus: "failed",
      }),
    );
  });
});

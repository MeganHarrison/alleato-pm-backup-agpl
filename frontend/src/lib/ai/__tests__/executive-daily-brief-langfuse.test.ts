import {
  executiveDailyBriefTraceMetadata,
  withExecutiveDailyBriefTrace,
} from "../executive-daily-brief-langfuse";
import {
  EXECUTIVE_DAILY_BRIEF_WORKFLOW_ID,
  EXECUTIVE_DAILY_BRIEF_WORKFLOW_VERSION,
} from "@/lib/ai-ops/executive-daily-brief-workflow";

describe("executive daily brief Langfuse helper", () => {
  const originalPublicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const originalSecretKey = process.env.LANGFUSE_SECRET_KEY;

  afterEach(() => {
    process.env.LANGFUSE_PUBLIC_KEY = originalPublicKey;
    process.env.LANGFUSE_SECRET_KEY = originalSecretKey;
  });

  it("adds workflow identity to trace metadata", () => {
    expect(
      executiveDailyBriefTraceMetadata({
        runId: "run-1",
        deliveryStatus: "dry_run",
      }),
    ).toEqual({
      workflowId: EXECUTIVE_DAILY_BRIEF_WORKFLOW_ID,
      workflowVersion: EXECUTIVE_DAILY_BRIEF_WORKFLOW_VERSION,
      surface: "executive_daily_brief",
      runId: "run-1",
      deliveryStatus: "dry_run",
    });
  });

  it("is a no-op wrapper when Langfuse credentials are not configured", async () => {
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;

    const result = await withExecutiveDailyBriefTrace(
      {
        name: "executive-daily-brief.test",
        sessionId: "test-session",
        triggerType: "unit_test",
      },
      async (context) => context,
    );

    expect(result).toEqual({ configured: false });
  });
});

import { excludeIntentionalSkipJobs, isIntentionalSkipJob } from "../_lifecycle";

/**
 * Guardrail for the pipeline-health map over-reporting bug: the ingestion
 * pipeline records intentional exclusions (interview-title meetings, low-content
 * docs) with `status="failed_permanent"`, so a naive "status starts with failed"
 * check painted the health map critical-red for documents that were correctly
 * skipped. `isIntentionalSkipJob` must recognize these so they are excluded from
 * critical failure alerts, while REAL failures still count.
 */
describe("isIntentionalSkipJob", () => {
  it("treats interview_title_excluded as an intentional skip", () => {
    expect(
      isIntentionalSkipJob({
        status: "failed_permanent",
        error_code: "interview_title_excluded",
        error_message:
          'INTENTIONALLY_EXCLUDED: Meeting title contains "Interview", so it is intentionally excluded.',
      }),
    ).toBe(true);
  });

  it("treats skipped_low_content as an intentional skip", () => {
    expect(
      isIntentionalSkipJob({
        status: "failed_permanent",
        error_code: "skipped_low_content",
        error_message: "Substantive text length 163 below minimum 200.",
      }),
    ).toBe(true);
  });

  it("treats the intentionally_excluded status as a skip", () => {
    expect(
      isIntentionalSkipJob({ status: "intentionally_excluded", error_code: null, error_message: null }),
    ).toBe(true);
  });

  it("matches the INTENTIONALLY_EXCLUDED message marker even for an unknown code", () => {
    expect(
      isIntentionalSkipJob({
        status: "failed_permanent",
        error_code: "some_future_skip_code",
        error_message: "INTENTIONALLY_EXCLUDED: new rule.",
      }),
    ).toBe(true);
  });

  it("does NOT skip a real retryable failure (ReadError)", () => {
    expect(
      isIntentionalSkipJob({
        status: "failed_retryable",
        error_code: "ReadError",
        error_message: "[Errno 35] Resource temporarily unavailable",
      }),
    ).toBe(false);
  });

  it("does NOT skip a real protocol failure", () => {
    expect(
      isIntentionalSkipJob({
        status: "failed_retryable",
        error_code: "RemoteProtocolError",
        error_message: "<ConnectionTerminated>",
      }),
    ).toBe(false);
  });

  it("does NOT skip a generic failed job with no error metadata", () => {
    expect(
      isIntentionalSkipJob({ status: "failed_permanent", error_code: null, error_message: null }),
    ).toBe(false);
  });

  it("removes intentional exclusions from actionable recovery collections only", () => {
    const recoveryJobs = excludeIntentionalSkipJobs([
      {
        id: "intentional",
        error_message: "INTENTIONALLY_EXCLUDED: Meeting title contains Interview.",
      },
      {
        id: "timeout",
        error_message: "canceling statement due to statement timeout",
      },
    ]);

    expect(recoveryJobs).toEqual([
      {
        id: "timeout",
        error_message: "canceling statement due to statement timeout",
      },
    ]);
  });
});

import {
  transitionExecutiveIntelligenceRun,
  createExecutiveIntelligenceRunStateStore,
} from "../executive-intelligence-run-state";

const base = {
  runId: "11111111-1111-4111-8111-111111111111",
  businessDate: "2026-07-21",
  status: "running" as const,
  attemptCount: 1,
  blocker: null,
  nextAttemptAt: null,
};

describe("Executive Intelligence run state", () => {
  it("rejects promotion without completion evidence", () => {
    expect(() => transitionExecutiveIntelligenceRun(base, "succeeded")).toThrow(
      "incomplete",
    );
  });

  it("requires blocker and next attempt for retryable failure", () => {
    expect(() =>
      transitionExecutiveIntelligenceRun(base, "failed_retryable", {
        nextAttemptAt: "2026-07-21T13:00:00.000Z",
      }),
    ).toThrow("actionable blocker");
  });

  it("allows a complete run to succeed and clears retry state", () => {
    expect(
      transitionExecutiveIntelligenceRun(
        { ...base, blocker: "temporary", nextAttemptAt: "2026-07-21T13:00:00.000Z" },
        "succeeded",
        { complete: true },
      ),
    ).toMatchObject({ status: "succeeded", blocker: null, nextAttemptAt: null });
  });

  it("resumes a due retry with a monotonic attempt count", async () => {
    const current = { ...base, status: "failed_retryable" as const, attemptCount: 2, nextAttemptAt: "2020-01-01T00:00:00.000Z" };
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      single: async () => ({ data: { id: current.runId, business_date: current.businessDate, status: current.status, attempt_count: current.attemptCount, blocker: "x", next_attempt_at: current.nextAttemptAt }, error: null }),
      update: (payload: unknown) => { builder.payload = payload; return builder; },
    };
    const store = createExecutiveIntelligenceRunStateStore({ from: () => builder } as never);
    await store.resume(current.runId);
    expect(builder.payload).toMatchObject({ status: "running", attempt_count: 3, blocker: null, next_attempt_at: null });
  });
});

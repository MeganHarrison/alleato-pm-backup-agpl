import { monthlyReviewPeriod, monthlyReviewRelease } from "../monthly-executive-review-contract";

const artifact = (integrity: "ready" | "blocked" = "ready") => ({ integrity }) as never;
const financial = (state: "ready" | "awaiting_close") => ({ state, freshness: state === "ready" ? "fresh" : "partial", warnings: [], recovery: "repair" });

describe("monthly executive review governance", () => {
  it("keeps the review draft until finance close and executive approval are both append-only events", () => {
    expect(monthlyReviewRelease(artifact(), financial("ready"), []).state).toBe("draft");
    expect(monthlyReviewRelease(artifact(), financial("ready"), [{ action: "finance_closed" } as never]).state).toBe("draft");
    expect(monthlyReviewRelease(artifact(), financial("ready"), [{ action: "finance_closed" } as never, { action: "executive_approved" } as never]).state).toBe("approved");
  });

  it("blocks rather than approving when financial source readiness is missing", () => {
    const result = monthlyReviewRelease(artifact(), financial("awaiting_close"), [{ action: "finance_closed" } as never, { action: "executive_approved" } as never]);
    expect(result.state).toBe("blocked");
    expect(result.reasons).toContain("Financial source readiness is not ready.");
  });

  it("uses the governed packet business month as the review period", () => {
    expect(monthlyReviewPeriod({ packet: { businessDate: "2026-07-16" } } as never)).toBe("2026-07-01");
  });
});

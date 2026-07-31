import { mapDeepReadRecordToSignals } from "@/lib/progress-reports/deep-read-signals";

// Shape mirrors a real `projectRecords[]` entry written by the daily deep read
// (project-intelligence/core/compile-daily-executive-brief.mjs → packet_json.projectRecords).
const REAL_RECORD = {
  projectId: 1009,
  projectName: "Union Collective",
  confidence: 0.78,
  whatChanged:
    "The project remains in preconstruction/design coordination with bidding, budget validation, and layout decisions still moving.",
  healthStatus: "watch",
  fieldRead: "No active field production; utility site visits needed to verify connections.",
  scheduleRead: "Final construction documents are still several weeks from hard bidding.",
  financialRead: "Alleato is soliciting preliminary estimates to confirm budget alignment.",
  activeRisks: ["Landscape scope above code minimum may add cost", "Final CDs are still several weeks away"],
  needsAttention: ["Landscape plan should be right-sized before bidder issue", "Horse fence requirement needs direction"],
  openDecisions: ["Whether to request a horse fence waiver", "Where electric should enter the building"],
};

describe("mapDeepReadRecordToSignals", () => {
  it("maps the whatChanged summary, health, and field/schedule/financial reads as evidence", () => {
    const signals = mapDeepReadRecordToSignals(REAL_RECORD);
    const primary = signals[0];
    expect(primary.title).toBe("What changed this week");
    expect(primary.summary).toContain("preconstruction/design coordination");
    expect(primary.whyItMatters).toBe("Project health: watch");
    // nextAction falls through to the first needs-attention item.
    expect(primary.nextAction).toBe("Landscape plan should be right-sized before bidder issue");
    expect(primary.evidence.map((e) => e.sourceTitle)).toEqual([
      "Field read",
      "Schedule read",
      "Financial read",
    ]);
    expect(primary.evidence.every((e) => e.sourceType === "daily_deep_read")).toBe(true);
  });

  it("emits needs-attention, active-risk, and open-decisions signals", () => {
    const signals = mapDeepReadRecordToSignals(REAL_RECORD);
    const titles = signals.map((s) => s.title);
    expect(titles).toContain("Landscape plan should be right-sized before bidder issue");
    expect(titles).toContain("Final CDs are still several weeks away");
    const decisions = signals.find((s) => s.title === "Open decisions");
    expect(decisions?.summary).toContain("horse fence waiver");
    expect(decisions?.nextAction).toBe("Whether to request a horse fence waiver");
  });

  it("caps output at 8 signals and skips empty reads", () => {
    const signals = mapDeepReadRecordToSignals(REAL_RECORD);
    expect(signals.length).toBeLessThanOrEqual(8);
    const sparse = mapDeepReadRecordToSignals({ whatChanged: "Only a summary.", scheduleRead: "" });
    expect(sparse).toHaveLength(1);
    expect(sparse[0].evidence).toHaveLength(0);
    expect(sparse[0].whyItMatters).toBeNull();
  });

  it("returns nothing for a degenerate record", () => {
    expect(mapDeepReadRecordToSignals({})).toEqual([]);
  });
});

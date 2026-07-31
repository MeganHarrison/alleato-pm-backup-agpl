import {
  STAGE_GRACE_MINUTES,
  ageMinutes,
  maturityCoverageStatus,
} from "../_lifecycle";

/**
 * Guardrail for the /pipeline-health "permanently amber/red" bug: the map judged
 * each stage on raw coverage over a rolling 24h cohort, so the newest documents
 * (whose feeding cron simply had not run yet) dragged every stage warning/red.
 * Health is now judged over the *mature* cohort only — docs past the stage's
 * grace window — so normal cron lag reads as flowing, while real stalls (mature
 * docs that never cleared) still surface.
 */
describe("ageMinutes", () => {
  const now = Date.UTC(2026, 5, 30, 12, 0, 0);

  it("returns minutes since the timestamp", () => {
    expect(ageMinutes(new Date(now - 90 * 60000).toISOString(), now)).toBeCloseTo(90, 5);
  });

  it("returns null for missing or unparseable input", () => {
    expect(ageMinutes(null, now)).toBeNull();
    expect(ageMinutes("not-a-date", now)).toBeNull();
  });
});

describe("maturityCoverageStatus", () => {
  it("is healthy when nothing is mature yet (all in flight)", () => {
    // Whole cohort is younger than the grace window -> nothing to judge.
    expect(maturityCoverageStatus(0, 0)).toBe("healthy");
  });

  it("is healthy when every mature doc has cleared", () => {
    expect(maturityCoverageStatus(10, 10)).toBe("healthy");
  });

  it("is warning when some mature docs are stuck", () => {
    expect(maturityCoverageStatus(7, 10)).toBe("warning");
  });

  it("is critical when no mature doc has cleared", () => {
    expect(maturityCoverageStatus(0, 10)).toBe("critical");
  });
});

describe("STAGE_GRACE_MINUTES", () => {
  it("gives sync no grace and downstream stages a lag budget that mirrors backend thresholds", () => {
    expect(STAGE_GRACE_MINUTES.synced).toBe(0);
    // vectorize/attribution ~ STALE_SYNC_MINUTES (120), tasks ~ STALE_EXTRACTION_MINUTES (1440),
    // intelligence ~ packet freshness (36h = 2160).
    expect(STAGE_GRACE_MINUTES.vectorized).toBe(120);
    expect(STAGE_GRACE_MINUTES.projectAssigned).toBe(120);
    expect(STAGE_GRACE_MINUTES.tasksExtracted).toBe(1440);
    expect(STAGE_GRACE_MINUTES.projectIntelligenceUpdated).toBe(2160);
  });
});

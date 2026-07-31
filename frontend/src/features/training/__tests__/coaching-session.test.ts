import {
  CAPABILITY_LADDER,
  coachingReviewDates,
  practiceRepSchema,
  publishCoachingSessionSchema,
  rungForScore,
} from "../coaching-session";
import {
  hasScoreDisagreement,
  isPracticeRepVague,
} from "../coaching-playbook";

const SKILL_A = "11111111-1111-4111-8111-111111111111";
const SKILL_B = "22222222-2222-4222-8222-222222222222";
const SKILL_C = "33333333-3333-4333-8333-333333333333";

describe("rungForScore", () => {
  it.each([
    [0, "aware"],
    [20, "aware"],
    [29, "aware"],
    [30, "assisted"],
    [59, "assisted"],
    [60, "independent"],
    [79, "independent"],
    [80, "recommends"],
    [89, "recommends"],
    [90, "teaches"],
    [100, "teaches"],
  ])("maps score %i to the %s rung", (score, slug) => {
    expect(rungForScore(score).slug).toBe(slug);
  });

  it("clamps out-of-range scores into the ladder", () => {
    expect(rungForScore(-40).slug).toBe("aware");
    expect(rungForScore(9000).slug).toBe("teaches");
  });

  it("covers 0-100 with no gaps between rungs", () => {
    for (let score = 0; score <= 100; score += 1) {
      const rung = rungForScore(score);
      expect(score).toBeGreaterThanOrEqual(rung.min);
      expect(score).toBeLessThanOrEqual(rung.max);
    }
    // Ladder is contiguous and ordered.
    for (let i = 1; i < CAPABILITY_LADDER.length; i += 1) {
      expect(CAPABILITY_LADDER[i].min).toBe(CAPABILITY_LADDER[i - 1].max + 1);
    }
  });
});

describe("coachingReviewDates", () => {
  it("derives 30/60/90-day review dates from a base date", () => {
    const dates = coachingReviewDates("2026-01-01");
    expect(dates.review30Date).toBe("2026-01-31");
    expect(dates.review60Date).toBe("2026-03-02"); // 60 days after Jan 1 (2026 not leap)
    expect(dates.review90Date).toBe("2026-04-01");
  });
});

function rep(overrides: Record<string, unknown>) {
  return practiceRepSchema.parse({ skillId: SKILL_A, ...overrides });
}

describe("isPracticeRepVague", () => {
  it("flags a rep with no action", () => {
    expect(isPracticeRepVague(rep({ action: "", frequency: "weekly", evidence: "log" }))).toBe(true);
  });
  it("flags a rep missing frequency or evidence", () => {
    expect(
      isPracticeRepVague(rep({ action: "Own the next five RFIs end to end", frequency: "", evidence: "log" })),
    ).toBe(true);
    expect(
      isPracticeRepVague(rep({ action: "Own the next five RFIs end to end", frequency: "weekly", evidence: "" })),
    ).toBe(true);
  });
  it("accepts a specific, observable rep", () => {
    expect(
      isPracticeRepVague(
        rep({
          action: "Own the next five RFIs end to end",
          frequency: "every RFI",
          evidence: "RFI log export",
        }),
      ),
    ).toBe(false);
  });
});

describe("hasScoreDisagreement", () => {
  const cal = (employeeScore: number | null, managerScore: number | null) => ({
    skillId: SKILL_A,
    employeeScore,
    managerScore,
    agreedScore: null,
    disagreement: "",
    experiment: "",
  });
  it("is true when scores differ by 20 or more", () => {
    expect(hasScoreDisagreement(cal(70, 50))).toBe(true);
    expect(hasScoreDisagreement(cal(50, 70))).toBe(true);
  });
  it("is false for small or missing gaps", () => {
    expect(hasScoreDisagreement(cal(70, 60))).toBe(false);
    expect(hasScoreDisagreement(cal(null, 60))).toBe(false);
    expect(hasScoreDisagreement(cal(70, null))).toBe(false);
  });
});

describe("publishCoachingSessionSchema", () => {
  const validRep = (skillId: string) => ({
    skillId,
    action: "Own the next five RFIs end to end",
    frequency: "every RFI",
    evidence: "RFI log export",
    measure: "turnaround under 48h",
    resource: "RFI SOP",
    feedbackOwner: "Marcus",
    feedbackTurnaround: "48h",
    firstDueDate: null,
  });
  const calibration = [
    { skillId: SKILL_A, employeeScore: 70, managerScore: 55, agreedScore: 60, disagreement: "", experiment: "" },
  ];

  it("accepts a valid 2-focus plan", () => {
    const result = publishCoachingSessionSchema.safeParse({
      focusSkillIds: [SKILL_A, SKILL_B],
      calibration,
      practicePlan: [validRep(SKILL_A), validRep(SKILL_B)],
      stopDoing: "",
      managerSupport: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects fewer than two focus skills", () => {
    const result = publishCoachingSessionSchema.safeParse({
      focusSkillIds: [SKILL_A],
      calibration,
      practicePlan: [validRep(SKILL_A)],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a focus skill with no matching rep", () => {
    const result = publishCoachingSessionSchema.safeParse({
      focusSkillIds: [SKILL_A, SKILL_B],
      calibration,
      practicePlan: [validRep(SKILL_A), validRep(SKILL_C)],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a focus rep missing action/frequency/evidence", () => {
    const result = publishCoachingSessionSchema.safeParse({
      focusSkillIds: [SKILL_A, SKILL_B],
      calibration,
      practicePlan: [
        validRep(SKILL_A),
        { ...validRep(SKILL_B), action: "" },
      ],
    });
    expect(result.success).toBe(false);
  });
});

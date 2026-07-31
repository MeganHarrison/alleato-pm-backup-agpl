import {
  clampSkillScore,
  createUnscoredDrafts,
  latestCheckinForRole,
  parseSkillPlanSnapshots,
  rankFocusAreas,
  rescoreDates,
  saveSkillCheckinSchema,
  skillDateKey,
  type SkillCheckin,
  type SkillDefinition,
  type SkillScoreSnapshot,
} from "../skill-growth";

const skills: SkillDefinition[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Scheduling",
    description: "Own the project schedule.",
    importance: 5,
    isCore: false,
    sortOrder: 10,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Documentation",
    description: "Leave a clean record.",
    importance: 2,
    isCore: true,
    sortOrder: 20,
  },
];

const scores: SkillScoreSnapshot[] = skills.map((skill, index) => ({
  skillId: skill.id,
  name: skill.name,
  score: 30 + index * 10,
  target: 70,
  importance: skill.importance,
  isCore: skill.isCore,
}));

function phases() {
  return [30, 60, 90].map((days) => ({
    days: days as 30 | 60 | 90,
    action: `Complete the ${days}-day rep.`,
    measure: `Review the ${days}-day evidence.`,
  }));
}

function plans() {
  return skills.map((skill, index) => ({
    skillId: skill.id,
    description: skill.description,
    evidence: {
      situation: "Weekly planning meeting.",
      behavior: "Prepared the constraint log.",
      outcome: "Owners closed constraints before the next meeting.",
    },
    frequency: "Weekly",
    resource: "Look-ahead SOP",
    feedback: "Manager reviews the next day",
    phases: phases(),
    isFocus: true,
    sortOrder: index,
  }));
}

it("uses Alleato local time for dated check-ins after the UTC day changes", () => {
  expect(skillDateKey(new Date("2026-07-27T00:30:00Z"))).toBe("2026-07-26");
});

describe("skill growth domain", () => {
  it("starts a new assessment without seeded score answers", () => {
    expect(createUnscoredDrafts(skills)).toEqual([
      expect.objectContaining({
        name: "Scheduling",
        score: null,
        target: null,
      }),
      expect.objectContaining({
        name: "Documentation",
        score: null,
        target: null,
      }),
    ]);
  });

  it("orders focus candidates by importance multiplied by positive gap", () => {
    const ranked = rankFocusAreas([
      { ...scores[0], score: 60, target: 70, importance: 5 },
      { ...scores[1], score: 30, target: 60, importance: 2 },
      {
        ...scores[1],
        skillId: "33333333-3333-4333-8333-333333333333",
        name: "Already there",
        score: 90,
        target: 80,
        importance: 5,
      },
    ]);

    expect(ranked.map((area) => area.name)).toEqual([
      "Documentation",
      "Scheduling",
    ]);
    expect(ranked.map((area) => area.focusScore)).toEqual([60, 50]);
  });

  it("restores the latest check-in for the selected role", () => {
    const checkins: SkillCheckin[] = ["2026-07-01", "2026-07-26"].map(
      (checkinDate, index) => ({
        id: String(index),
        roleId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        roleName: "Project Manager",
        checkinDate,
        scores,
        quarterLabel: "Q3 2026",
        feedbackPerson: null,
        feedbackFrequency: null,
        rescoreDays: 60,
        nextCheckinDate: index ? "2026-09-24" : "2026-08-30",
        makeTimeBy: null,
        plans: plans(),
        createdAt: `${checkinDate}T12:00:00Z`,
        updatedAt: `${checkinDate}T12:00:00Z`,
      }),
    );

    expect(
      latestCheckinForRole(checkins, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
        ?.id,
    ).toBe("1");
  });

  it("adapts legacy saved plans without weakening the new write schema", () => {
    expect(
      parseSkillPlanSnapshots([
        {
          skillId: skills[0].id,
          description: skills[0].description,
          evidence: "Built a recovery schedule.",
          action: "Update the look-ahead.",
          frequency: "Weekly",
          measure: "Milestones land on time.",
          isFocus: true,
          sortOrder: 0,
        },
      ])[0],
    ).toEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({
          behavior: "Built a recovery schedule.",
        }),
        phases: expect.arrayContaining([
          expect.objectContaining({ days: 30 }),
          expect.objectContaining({ days: 60 }),
          expect.objectContaining({ days: 90 }),
        ]),
      }),
    );
  });

  it("calculates 30, 60, and 90 day dates across month boundaries", () => {
    expect(rescoreDates("2026-07-26")).toEqual([
      { days: 30, date: "2026-08-25" },
      { days: 60, date: "2026-09-24" },
      { days: 90, date: "2026-10-24" },
    ]);
  });

  it("rejects incomplete focus selection and accepts the complete contract", () => {
    const payload = {
      roleId: null,
      checkinDate: "2026-07-26",
      quarterLabel: "Q3 2026",
      feedbackPerson: "Jamie",
      feedbackFrequency: "Every other Friday",
      rescoreDays: 60 as const,
      nextCheckinDate: "2026-09-24",
      makeTimeBy: "Delegate filing",
      focusSkillIds: skills.map((skill) => skill.id),
      scores: scores.map(({ skillId, score, target }) => ({
        skillId,
        score,
        target,
      })),
      plans: plans().map(
        ({ isFocus: _isFocus, sortOrder: _sortOrder, ...plan }) => plan,
      ),
    };

    expect(saveSkillCheckinSchema.safeParse(payload).success).toBe(true);
    expect(
      saveSkillCheckinSchema.safeParse({
        ...payload,
        focusSkillIds: [skills[0].id],
      }).success,
    ).toBe(false);
    expect(clampSkillScore(101)).toBe(100);
  });
});

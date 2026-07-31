import { LEVELS } from "@/app/(main)/training/own-your-growth/data";

import { LADDER, SOLO_LEVEL } from "../ladder-content";
import {
  ROLE_WHEEL_EXAMPLES,
  SKILL_WHEEL_STORY,
  SOLO_THRESHOLD,
  chapterPairsFor,
  countAtLevel,
  cumulativeValuesAt,
  storyPairsFor,
} from "../role-wheel-data";

/**
 * The hub shows the Skill Wheel and the proficiency ladder on the same page, so
 * they have to agree about where "Solo" sits, and the illustrative scores have
 * to keep matching the story's own copy ("3 of 8" -> every skill at Solo).
 * That agreement was broken once — the wheel counted Solo from 65, which the
 * ladder calls Capable. These tests are the guardrail.
 */
describe("skill wheel <-> proficiency ladder agreement", () => {
  it("takes the Solo bar from the shared ladder, not a local constant", () => {
    expect(SOLO_THRESHOLD).toBe(SOLO_LEVEL.value);
  });

  it("keeps the ladder in step with the scale the assessment scores against", () => {
    expect(LADDER.map((level) => [level.name, level.value])).toEqual(
      LEVELS.map((level) => [level.name, level.v]),
    );
  });
});

describe.each(ROLE_WHEEL_EXAMPLES.map((role) => [role.name, role] as const))(
  "%s illustrative progression",
  (_name, role) => {
    it("has eight skills, index-aligned with before/after", () => {
      expect(role.skills).toHaveLength(8);
      expect(role.before).toHaveLength(8);
      expect(role.after).toHaveLength(8);
    });

    it("opens on exactly 3 of 8 at Solo", () => {
      expect(countAtLevel(role.before)).toBe(3);
    });

    it("finishes with all 8 at Solo", () => {
      const final = cumulativeValuesAt(
        role,
        SKILL_WHEEL_STORY,
        SKILL_WHEEL_STORY.chapters.length - 1,
      );
      expect(countAtLevel(final)).toBe(8);
    });

    it("never moves a skill backwards", () => {
      role.before.forEach((value, index) => {
        expect(role.after[index]).toBeGreaterThanOrEqual(value);
      });
    });

    it("derives four focus pairs covering every skill exactly once", () => {
      const pairs = storyPairsFor(role);
      expect(pairs).toHaveLength(4);
      expect([...pairs.flat()].sort((a, b) => a - b)).toEqual([
        0, 1, 2, 3, 4, 5, 6, 7,
      ]);
    });

    it("attacks the weakest skills first", () => {
      const [firstPair] = storyPairsFor(role);
      const weakest = [...role.before].sort((a, b) => a - b).slice(0, 2);
      expect(firstPair.map((index) => role.before[index]).sort((a, b) => a - b))
        .toEqual(weakest);
    });

    it("highlights nothing in the opening chapter", () => {
      expect(chapterPairsFor(role, SKILL_WHEEL_STORY)[0]).toEqual([]);
    });
  },
);

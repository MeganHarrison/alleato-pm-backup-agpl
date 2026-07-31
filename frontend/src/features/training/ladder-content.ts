/**
 * The proficiency ladder — one shared definition of growth, used by the
 * /training hub's "From awareness to mastery" section.
 *
 * The rung VALUES AND NAMES are not defined here. They come from `LEVELS`, the
 * same scale the self-assessment scores against, so the hub can never drift
 * from what a person is actually rated on. This file only adds the explanatory
 * copy each rung needs to be understood without taking the assessment first.
 */

import { LEVELS } from "@/app/(main)/training/own-your-growth/data";

export interface LadderLevel {
  /** Canonical 0-100 rung, from LEVELS. */
  value: number;
  /** Canonical rung name, from LEVELS. */
  name: string;
  /** First-person one-liner for the staircase card. */
  short: string;
  /** The claim this rung lets you make — the detail panel headline. */
  claim: string;
  /** What the rung actually means in the work. */
  detail: string;
  /** The observable evidence, so this stays a bar and not a vibe. */
  readyLooksLike: string;
}

type LadderCopy = Omit<LadderLevel, "value" | "name">;

const COPY: Record<string, LadderCopy> = {
  Aware: {
    short: "I know what good looks like.",
    claim: "You can recognize the work.",
    detail:
      "You have seen it done and can follow along, but you have not owned a piece of it yourself yet.",
    readyLooksLike:
      "you can describe the steps and say why each one matters.",
  },
  Assisted: {
    short: "I can do it with a reliable guide.",
    claim: "You can follow the standard.",
    detail:
      "You can complete the work using an SOP, a template, or an experienced teammate to check the key decisions.",
    readyLooksLike:
      "you finish the task with guidance and respond well to corrections.",
  },
  Capable: {
    short: "I can own the common path.",
    claim: "You can run the normal case.",
    detail:
      "You handle the routine version start to finish on your own. Unusual conditions still send you looking for help.",
    readyLooksLike:
      "you only escalate the genuinely unusual, not the merely unfamiliar.",
  },
  Solo: {
    short: "I handle complexity and escalate well.",
    claim: "You can be trusted with the hard version.",
    detail:
      "You work through complexity on your own, document the decisions behind it, and bring problems forward before they grow.",
    readyLooksLike:
      "you escalate 1-3-1 — one problem, three options, one recommendation.",
  },
  Teach: {
    short: "I make the people around me better.",
    claim: "You can set the standard.",
    detail:
      "You can teach the Alleato way to someone new, and you improve the process itself rather than only following it.",
    readyLooksLike: "someone you taught now does it well without you.",
  },
};

export const LADDER: LadderLevel[] = LEVELS.map((level) => {
  const copy = COPY[level.name];
  if (!copy) {
    throw new Error(
      `ladder-content: no copy for proficiency level "${level.name}". ` +
        `Add it to COPY so the hub ladder stays in step with LEVELS.`,
    );
  }
  return { value: level.v, name: level.name, ...copy };
});

/**
 * The rung that counts as "can be left alone with it" — the bar the Skill
 * Wheel's centre readout ("N of 8 at Solo") measures against. Exported so the
 * wheel and the ladder cannot disagree about where the bar sits.
 */
export const SOLO_LEVEL: LadderLevel =
  LADDER.find((level) => level.name === "Solo") ?? LADDER[LADDER.length - 1];

/** Index of the rung the ladder opens on: the bar, not the bottom. */
export const DEFAULT_LADDER_INDEX = LADDER.indexOf(SOLO_LEVEL);

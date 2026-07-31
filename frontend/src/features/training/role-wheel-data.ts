/**
 * Shared data + geometry for the /training hub Skill Wheel.
 *
 * Consumed by the pinned, scroll-driven illustrative story (RoleWheelStory),
 * which is the /training hub's Skill Wheel section.
 *
 * It is deliberately mode-agnostic so the same wheel can later be fed real
 * check-in values (personalized mode) without a second component. See the
 * redesign notes: illustrative now, personalized after assessment.
 *
 * The `before`/`after` scores are tuned against the shared proficiency ladder:
 * exactly three skills start at or above Solo and all eight finish there, so
 * the centre readout runs "3 of 8" -> "8 of 8" across the four focus cycles.
 * Change SOLO_LEVEL and these need retuning, or the story stops matching its
 * own copy.
 */

import { SOLO_LEVEL } from "./ladder-content";

// ---------------------------------------------------------------------------
// Geometry (annular "wedge" wheel — each skill is a sector that grows radially)
// ---------------------------------------------------------------------------

export const WHEEL = {
  size: 440,
  center: 220,
  innerRadius: 68,
  outerRadius: 190,
  /** angular gap between wedges, in radians */
  gap: 0.032,
} as const;

// Round to 2 decimals so the SVG path strings are byte-identical between the
// Node SSR pass and the browser (Math.cos/Math.sin differ by a ULP across
// engines, which otherwise trips a React hydration mismatch on the `d` attr —
// the same class of bug HeroWheel works around by rendering only after mount).
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function polar(
  cx: number,
  cy: number,
  r: number,
  angle: number,
): [number, number] {
  return [round2(cx + r * Math.cos(angle)), round2(cy + r * Math.sin(angle))];
}

export function annularPath(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  a0: number,
  a1: number,
): string {
  const [x0o, y0o] = polar(cx, cy, rOut, a0);
  const [x1o, y1o] = polar(cx, cy, rOut, a1);
  const [x1i, y1i] = polar(cx, cy, rIn, a1);
  const [x0i, y0i] = polar(cx, cy, rIn, a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${x0o} ${y0o} A ${rOut} ${rOut} 0 ${large} 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${rIn} ${rIn} 0 ${large} 0 ${x0i} ${y0i} Z`;
}

function wedgeAngles(index: number, total: number): [number, number] {
  const step = (Math.PI * 2) / total;
  return [
    -Math.PI / 2 + index * step + WHEEL.gap,
    -Math.PI / 2 + (index + 1) * step - WHEEL.gap,
  ];
}

/** Full-height background track for a wedge. */
export function wedgeTrackD(index: number, total: number): string {
  const [a0, a1] = wedgeAngles(index, total);
  return annularPath(
    WHEEL.center,
    WHEEL.center,
    WHEEL.innerRadius,
    WHEEL.outerRadius,
    a0,
    a1,
  );
}

/** Filled portion of a wedge for a 0-100 score. */
export function wedgeFillD(index: number, total: number, value: number): string {
  const [a0, a1] = wedgeAngles(index, total);
  const clamped = Math.max(0, Math.min(100, value));
  const rFill =
    WHEEL.innerRadius +
    (WHEEL.outerRadius - WHEEL.innerRadius) * (clamped / 100);
  return annularPath(
    WHEEL.center,
    WHEEL.center,
    WHEEL.innerRadius,
    rFill,
    a0,
    a1,
  );
}

/** Position for the numeric axis label just outside a wedge. */
export function wedgeLabelPos(index: number, total: number): [number, number] {
  const [a0, a1] = wedgeAngles(index, total);
  return polar(
    WHEEL.center,
    WHEEL.center,
    WHEEL.outerRadius + 18,
    (a0 + a1) / 2,
  );
}

// ---------------------------------------------------------------------------
// "At Solo" readiness metric — the wheel center reads "N of 8 at Solo".
// Solo = the proficiency-ladder rung where the skill is performed reliably
// without supervision. A skill counts once its score clears this bar.
//
// Taken from the shared ladder rather than declared locally. A local constant
// could — and did — drift: this read 65, which the ladder calls Capable, so the
// wheel credited Capable work as Solo while the ladder on the same page said 80.
// ---------------------------------------------------------------------------

export const SOLO_THRESHOLD = SOLO_LEVEL.value;

export function countAtLevel(
  values: number[],
  threshold: number = SOLO_THRESHOLD,
): number {
  return values.reduce((total, value) => total + (value >= threshold ? 1 : 0), 0);
}

/**
 * Radius of the "Solo" bar, so the wheel can draw the threshold the centre
 * readout counts against. Without it, "N of 8 at Solo" is a number with no
 * visible bar — the viewer cannot see which wedges cleared it.
 */
export function thresholdRadius(threshold: number = SOLO_THRESHOLD): number {
  return (
    WHEEL.innerRadius +
    (WHEEL.outerRadius - WHEEL.innerRadius) * (threshold / 100)
  );
}

// ---------------------------------------------------------------------------
// Role model
// ---------------------------------------------------------------------------

export interface RoleSkill {
  name: string;
  /** One concrete example of what strong performance looks like. */
  hint: string;
}

export interface RoleFamily {
  name: string;
  /** Indices into the role's `skills` array. */
  skillIndices: number[];
}

export interface RoleWheelExample {
  id: string;
  name: string;
  promise: string;
  /** One sentence: what strong performance in this role looks like. */
  description: string;
  /** Proficiency bar expected before advancement. */
  expectedLevel: string;
  skills: RoleSkill[];
  families: RoleFamily[];
  /** Illustrative starting scores (0-100), index-aligned with `skills`. */
  before: number[];
  /** Illustrative scores after four focused practice cycles. */
  after: number[];
}

export const ROLE_WHEEL_EXAMPLES: RoleWheelExample[] = [
  {
    id: "project-manager",
    name: "Project Manager",
    promise: "Turn project controls into confident decisions.",
    description:
      "A strong PM keeps the commercial, contractual, and coordination systems under control without waiting to be asked.",
    expectedLevel: "Solo",
    skills: [
      { name: "Cost control", hint: "Forecasts to complete are current and defensible every month." },
      { name: "Contracts", hint: "Knows the terms cold and flags exposure before it becomes a claim." },
      { name: "Change management", hint: "Prices and logs changes fast, with a clean paper trail." },
      { name: "Scheduling", hint: "Reads the schedule for risk, not just status." },
      { name: "Procurement", hint: "Buys ahead of need and protects the critical path." },
      { name: "RFIs", hint: "Writes questions that get a usable answer the first time." },
      { name: "Submittals", hint: "Keeps the log ahead of procurement, never behind it." },
      { name: "Leadership", hint: "Runs the room and leaves owners more confident, not less." },
    ],
    families: [
      { name: "Project controls", skillIndices: [3, 0, 4, 2] },
      { name: "Delivery", skillIndices: [5, 6, 1] },
      { name: "Leadership", skillIndices: [7] },
    ],
    // 3 of 8 at Solo to start (Contracts, RFIs, Submittals); all 8 by the end.
    before: [58, 84, 46, 52, 61, 86, 82, 48],
    after: [83, 86, 81, 82, 84, 88, 85, 82],
  },
  {
    id: "project-engineer",
    name: "Project Engineer",
    promise: "Build the field-to-office judgment that keeps work moving.",
    description:
      "A strong PE turns drawings, RFIs, and submittals into decisions the field can build from — without escalating every question.",
    expectedLevel: "Solo",
    skills: [
      { name: "Drawing fluency", hint: "Finds the conflict in the set before the crew finds it in the field." },
      { name: "RFIs", hint: "Frames the question with the sketch and the answer options attached." },
      { name: "Submittals", hint: "Reviews against the spec section, not just the cover sheet." },
      { name: "Document control", hint: "Everyone is building from the current revision, every time." },
      { name: "Procurement", hint: "Tracks long-lead items so nothing surprises the schedule." },
      { name: "Field coordination", hint: "Walks the work and closes gaps before they become rework." },
      { name: "Quality control", hint: "Catches the defect at rough-in, not at closeout." },
      { name: "Communication", hint: "Writes the update the PM can forward without editing." },
    ],
    families: [
      { name: "Documents & controls", skillIndices: [0, 3, 2] },
      { name: "Field & procurement", skillIndices: [4, 5, 6] },
      { name: "Coordination", skillIndices: [1, 7] },
    ],
    // 3 of 8 at Solo to start (Submittals, Document control, Quality control),
    // climbing to 8 of 8 across the four focus cycles.
    before: [40, 48, 84, 82, 38, 45, 81, 52],
    after: [84, 82, 88, 86, 81, 83, 85, 84],
  },
  {
    id: "superintendent",
    name: "Superintendent",
    promise: "Make planning, coordination, and field leadership visible.",
    description:
      "A strong superintendent runs a look-ahead the trades trust and a site that stays safe, sequenced, and on plan.",
    expectedLevel: "Solo",
    skills: [
      { name: "Site logistics", hint: "Laydown, access, and hoisting are planned, not improvised." },
      { name: "Look-ahead planning", hint: "The three-week look-ahead is real and the trades believe it." },
      { name: "Trade coordination", hint: "Sequences work so crews are never waiting on each other." },
      { name: "Quality control", hint: "Sets the standard at the first installation, not the tenth." },
      { name: "Safety", hint: "The plan is lived on site, not filed in a binder." },
      { name: "Layout", hint: "Control lines are trusted because they are verified." },
      { name: "Daily reporting", hint: "The daily tells the story the schedule needs it to." },
      { name: "Field leadership", hint: "Foremen come to them early, with problems still small." },
    ],
    families: [
      { name: "Planning & logistics", skillIndices: [1, 0, 5] },
      { name: "Field execution", skillIndices: [2, 3, 4] },
      { name: "Leadership & reporting", skillIndices: [7, 6] },
    ],
    // 3 of 8 at Solo to start (Quality control, Safety, Daily reporting).
    before: [64, 48, 56, 84, 88, 54, 82, 59],
    after: [83, 82, 84, 86, 90, 81, 85, 83],
  },
];

// ---------------------------------------------------------------------------
// The illustrative pinned story. Each cycle raises ONE pair of wedges; earlier
// gains hold, so the compounding is visible without implying everything
// improved at once.
//
// The prose is deliberately role-agnostic and the pairs are DERIVED from the
// selected role's own lowest scores (see `storyPairsFor`). That is what lets a
// single story drive every role from the picker — the specifics arrive as data
// (the pair list names the real skills), never as hardcoded copy.
// ---------------------------------------------------------------------------

export interface StoryChapter {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
}

export interface WheelStory {
  /** Role shown when the viewer has not picked one. */
  defaultRoleId: string;
  chapters: StoryChapter[];
}

export const SKILL_WHEEL_STORY: WheelStory = {
  defaultRoleId: "project-engineer",
  chapters: [
    {
      key: "start",
      eyebrow: "An honest picture",
      title: "Growth starts with an honest picture.",
      body: "Eight capabilities, scored the way the work actually feels. The short wedges are not failures — they are where focus pays off first.",
    },
    {
      key: "cycle-1",
      eyebrow: "Focus cycle one",
      title: "Your gaps pick themselves.",
      body: "The two shortest wedges already decided what comes first. Two skills, not eight — everything else can wait its turn.",
    },
    {
      key: "cycle-2",
      eyebrow: "Focus cycle two",
      title: "Capability comes from reps, not courses.",
      body: "The first pair holds while the next two become the active work. Precise, repeated practice with specific feedback — that is the whole mechanism.",
    },
    {
      key: "cycle-3",
      eyebrow: "Focus cycle three",
      title: "Earlier gains hold while new ones compound.",
      body: "Nothing you already earned slips backward. That is what makes the change in shape worth trusting.",
    },
    {
      key: "cycle-4",
      eyebrow: "Ready to advance",
      title: "Promotion follows demonstrated capability — not course completion.",
      body: "The wheel settles into a balanced shape. Every skill is at Solo, backed by evidence — that is what readiness looks like.",
    },
  ],
};

export function getRoleById(id: string): RoleWheelExample {
  return (
    ROLE_WHEEL_EXAMPLES.find((role) => role.id === id) ?? ROLE_WHEEL_EXAMPLES[0]
  );
}

/**
 * The focus pairs for a role, weakest first: skills ordered by their starting
 * score and chunked two at a time. Eight skills produce exactly four pairs,
 * which is one per focus-cycle chapter.
 */
export function storyPairsFor(role: RoleWheelExample): number[][] {
  const weakestFirst = role.skills
    .map((_, index) => index)
    .sort((a, b) => role.before[a] - role.before[b]);

  const pairs: number[][] = [];
  for (let index = 0; index < weakestFirst.length; index += 2) {
    pairs.push(weakestFirst.slice(index, index + 2));
  }
  return pairs;
}

/**
 * Focus pair per chapter, index-aligned with `story.chapters`. Chapter 0 is the
 * opening picture and highlights nothing.
 */
export function chapterPairsFor(
  role: RoleWheelExample,
  story: WheelStory = SKILL_WHEEL_STORY,
): number[][] {
  const pairs = storyPairsFor(role);
  return story.chapters.map((_, index) =>
    index === 0 ? [] : (pairs[index - 1] ?? []),
  );
}

/**
 * Cumulative wedge values at the END of a given chapter index.
 * Chapter 0 (start) = all `before`; each later chapter applies its pair's
 * `after` values on top of the previous cumulative state.
 */
export function cumulativeValuesAt(
  role: RoleWheelExample,
  story: WheelStory,
  chapterIndex: number,
): number[] {
  const values = [...role.before];
  const pairs = chapterPairsFor(role, story);
  for (let index = 1; index <= chapterIndex; index += 1) {
    for (const skillIndex of pairs[index] ?? []) {
      values[skillIndex] = role.after[skillIndex];
    }
  }
  return values;
}

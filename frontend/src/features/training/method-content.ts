export interface MethodPrinciple {
  name: string;
  text: string;
}

export interface MethodStep {
  n: string;
  name: string;
  text: string;
}

export interface RubricRow {
  band: string;
  label: string;
  text: string;
}

export interface ToolkitItem {
  name: string;
  text: string;
}

/** Ported from training-source/data.js (`method`, `rubric`, `toolkit`, `proficiency`). */
export const METHOD_INTRO =
  "Broad goals (“get better at construction”) don't move the needle. Precise ones do. Here is the whole loop, with no download needed.";

export const METHOD_PRINCIPLES: MethodPrinciple[] = [
  {
    name: "Own it",
    text: "Nobody cares about your development more than you. You lead this, not your manager.",
  },
  {
    name: "Be brutally honest",
    text: "You can only fix a weakness you're willing to name. Sugar-coating wastes your own time.",
  },
  {
    name: "Get specific",
    text: "“Read drawings better” is a wish. “30 min/day on civil sheets, RFI one thing per job” is a plan.",
  },
  {
    name: "Focus your energy",
    text: "Don't improve everything. Pick a few; where focus goes, energy flows.",
  },
];

export const METHOD_STEPS: MethodStep[] = [
  {
    n: "1",
    name: "Start from your role's skills",
    text: "Open your role's skill list, then add, remove, or rename until it's the real work you do. Keep your 8 core skills for the wheel.",
  },
  {
    n: "2",
    name: "Rate yourself (0–100)",
    text: "Score each skill honestly against the rubric below using any exact number that's true (23, 71, whatever). For each, name one recent example that proves it.",
  },
  {
    n: "3",
    name: "Read your wheel",
    text: "Your scores draw the wheel automatically. Short wedges are your gaps; the faint ring is your target.",
  },
  {
    n: "4",
    name: "Confirm your focus",
    text: "The tool ranks your skills by the size of the gap between your score and your target. Confirm your top 2–4 biggest gaps and set a realistic target for each. Everything else waits.",
  },
  {
    n: "5",
    name: "Break into precise reps",
    text: "For each focus skill: a concrete, repeatable action, how often, and how you'll know you improved. Then name what you'll drop to make the time.",
  },
  {
    n: "6",
    name: "Cadence & re-score",
    text: "Do the reps and ask for specific feedback on your focus areas. Re-score at 30/60/90 days and watch the wheel fill out.",
  },
];

export const RUBRIC_INTRO =
  "These are reference points, not buckets. Use the exact number that's true (23, 71, or whatever a fair observer who watched you work would give). Don't round up to look good or down out of modesty. For each score, name one recent example that proves it.";

export const RUBRIC_ROWS: RubricRow[] = [
  {
    band: "~10",
    label: "Aware",
    text: "I've heard of it but haven't really done it.",
  },
  {
    band: "~40",
    label: "Assisted",
    text: "I can do it with an SOP or Claude, but a PM/Super needs to double-check my work.",
  },
  {
    band: "~65",
    label: "Capable",
    text: "I can do it on my own most of the time; still hit edge cases I'm unsure of.",
  },
  {
    band: "80",
    label: "Solo",
    text: "I do it solo, document my decisions, and escalate problems with a recommendation (1-3-1).",
  },
  {
    band: "100",
    label: "Teach",
    text: "I can teach “the Alleato way” of doing this to a new hire.",
  },
];

export const TOOLKIT_ITEMS: ToolkitItem[] = [
  {
    name: "The 1-3-1 rule",
    text: "When you're stuck, bring one problem, three possible solutions, and your one recommendation. Turns “I'm stuck” into leadership.",
  },
  {
    name: "The learning ladder",
    text: "1) Try it yourself → 2) Look it up (YouTube, AI/Claude, the drawings, the field) → 3) Bring a specific question → 4) Get coached → 5) Teach someone else.",
  },
  {
    name: "The “Stop-Doing” list",
    text: "Skill-building needs time. Use the Eisenhower Matrix: important-not-urgent gets scheduled; urgent-not-important gets delegated; the rest gets dropped.",
  },
  {
    name: "Mentor match",
    text: "For each focus skill, name someone at Alleato near 100% at it and book a 15-minute “sharper question” session.",
  },
];

export const PROFICIENCY_INTRO =
  "Advancement at Alleato follows capability, not tenure. Use this to see the reps between here and the next role.";

export const PROFICIENCY_ITEMS: string[] = [
  "You've mastered the core skills of your current role (mostly 80%+ on your wheel).",
  "You run your work solo, document decisions, and escalate with a recommendation, not just a problem.",
  "You've done the reps on real projects (field and superintendent time counts), not just watched.",
  "You make people around you better and can teach “the Alleato way.”",
];

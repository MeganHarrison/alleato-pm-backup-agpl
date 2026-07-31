/**
 * The Alleato scoring rubric, as levels rather than a paragraph to look up.
 *
 * Thresholds match the rubric already published on the My Growth page:
 * 0-20 aware, 30-50 completes parts with guidance, 60-70 handles normal work
 * independently, 80 documents decisions and recommends escalations, 100
 * teaches and improves the Alleato way.
 */
export interface RubricLevel {
  /** Lowest score that earns this label. */
  from: number;
  label: string;
  meaning: string;
}

export const RUBRIC_LEVELS: RubricLevel[] = [
  { from: 0, label: "Aware", meaning: "Knows it exists, has not done it" },
  { from: 30, label: "Guided", meaning: "Completes parts with guidance" },
  { from: 60, label: "Independent", meaning: "Handles normal work solo" },
  { from: 80, label: "Escalates", meaning: "Documents decisions, flags risk" },
  { from: 100, label: "Teaches", meaning: "Teaches and improves the method" },
];

export function levelForScore(score: number): RubricLevel {
  let match = RUBRIC_LEVELS[0];
  for (const level of RUBRIC_LEVELS) {
    if (score >= level.from) match = level;
  }
  return match;
}

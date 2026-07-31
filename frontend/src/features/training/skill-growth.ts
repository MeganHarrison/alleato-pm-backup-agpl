import { z } from "zod";

export const ALLEATO_CORE_CONTEXT = "alleato-core";
export const SKILL_GROWTH_TIME_ZONE = "America/Indiana/Indianapolis";
export const FOCUS_SKILL_MIN = 2;
export const FOCUS_SKILL_MAX = 4;
export const DEVELOPMENT_PHASES = [30, 60, 90] as const;
// Compatibility exports for the shared training barrel. Null is intentional:
// new assessments must never receive a seeded answer.
export const DEFAULT_SKILL_SCORE = null;
export const DEFAULT_SKILL_TARGET = null;

export const skillScoreInputSchema = z.object({
  skillId: z.string().uuid(),
  score: z.number().int().min(0).max(100),
  target: z.number().int().min(0).max(100),
});

export const skillScoreSnapshotSchema = skillScoreInputSchema.extend({
  name: z.string().trim().min(1).max(120),
  importance: z.number().int().min(1).max(5),
  isCore: z.boolean(),
});

export const skillScoreSnapshotsSchema = z
  .array(skillScoreSnapshotSchema)
  .min(1)
  .max(20);

/**
 * Evidence behind a score. Every field is optional at the contract level: the
 * guided assessment asks for one line per skill (stored as `behavior`) and the
 * full situation/behavior/outcome only for the focus skills, because requiring
 * three paragraphs for every skill is what stops check-ins being finished.
 * Which fields a given surface insists on is a UI decision, not a storage one.
 *
 * All three keys stay REQUIRED and may be empty strings, rather than optional
 * with a default. A .default() makes the schema's input and output types differ,
 * which parseJsonBody<T>(schema: z.ZodType<T>) cannot unify — it compiled only
 * because tsc was silently OOM-ing. Empty-but-present also matches what
 * validate_training_growth_plan() requires of the stored JSONB.
 */
export const skillEvidenceSchema = z.object({
  situation: z.string().trim().max(500),
  behavior: z.string().trim().max(500),
  outcome: z.string().trim().max(500),
});

export const developmentPhaseSchema = z.object({
  days: z.union([z.literal(30), z.literal(60), z.literal(90)]),
  action: z.string().trim().max(500),
  measure: z.string().trim().max(300),
});

export const skillPlanInputSchema = z.object({
  skillId: z.string().uuid(),
  description: z.string().max(500),
  evidence: skillEvidenceSchema,
  frequency: z.string().trim().max(160),
  resource: z.string().trim().max(300),
  feedback: z.string().trim().max(300),
  phases: z.array(developmentPhaseSchema).max(3),
});

export const skillPlanSnapshotSchema = skillPlanInputSchema.extend({
  isFocus: z.boolean(),
  sortOrder: z.number().int().min(0).max(100),
});

const legacySkillPlanSnapshotSchema = z.object({
  skillId: z.string().uuid(),
  description: z.string().max(500),
  evidence: z.string().max(500),
  action: z.string().max(500),
  frequency: z.string().max(160),
  measure: z.string().max(300),
  isFocus: z.boolean(),
  sortOrder: z.number().int().min(0).max(100),
});

export const skillPlanSnapshotsSchema = z
  .array(skillPlanSnapshotSchema)
  .min(1)
  .max(20);

export function parseSkillPlanSnapshots(value: unknown): SkillPlanSnapshot[] {
  const current = skillPlanSnapshotsSchema.safeParse(value);
  if (current.success) return current.data;

  const legacy = z
    .array(legacySkillPlanSnapshotSchema)
    .min(1)
    .max(20)
    .safeParse(value);
  if (!legacy.success) {
    throw new Error("Saved growth plans do not match a supported contract.");
  }

  return legacy.data.map((plan) => ({
    skillId: plan.skillId,
    description: plan.description,
    evidence: {
      situation: "Legacy check-in",
      behavior: plan.evidence || "No behavior was captured.",
      outcome: "No structured outcome was captured.",
    },
    frequency: plan.frequency,
    resource: "",
    feedback: "",
    phases: plan.isFocus
      ? DEVELOPMENT_PHASES.map((days) => ({
          days,
          action: plan.action,
          measure: plan.measure,
        }))
      : [],
    isFocus: plan.isFocus,
    sortOrder: plan.sortOrder,
  }));
}

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid YYYY-MM-DD date.")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Use a real calendar date.");

export const saveSkillCheckinSchema = z
  .object({
    roleId: z.string().uuid().nullable(),
    checkinDate: isoDateSchema,
    quarterLabel: z.string().trim().max(40),
    feedbackPerson: z.string().trim().max(100),
    feedbackFrequency: z.string().trim().max(160),
    rescoreDays: z.union([z.literal(30), z.literal(60), z.literal(90)]),
    nextCheckinDate: isoDateSchema,
    makeTimeBy: z.string().trim().max(300),
    focusSkillIds: z
      .array(z.string().uuid())
      .min(FOCUS_SKILL_MIN)
      .max(FOCUS_SKILL_MAX),
    scores: z.array(skillScoreInputSchema).min(1).max(20),
    plans: z.array(skillPlanInputSchema).min(1).max(20),
  })
  .superRefine((input, context) => {
    const scoreIds = new Set(input.scores.map((score) => score.skillId));
    const planIds = new Set(input.plans.map((plan) => plan.skillId));
    const focusIds = new Set(input.focusSkillIds);
    if (
      scoreIds.size !== input.scores.length ||
      planIds.size !== input.plans.length ||
      scoreIds.size !== planIds.size ||
      [...scoreIds].some((skillId) => !planIds.has(skillId))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["plans"],
        message:
          "The growth plan must include every scored skill exactly once.",
      });
    }
    if (
      focusIds.size !== input.focusSkillIds.length ||
      [...focusIds].some((skillId) => !scoreIds.has(skillId))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["focusSkillIds"],
        message: "Choose 2–4 unique focus skills from the current assessment.",
      });
    }
  });

export type SkillScoreInput = z.infer<typeof skillScoreInputSchema>;
export type SkillScoreSnapshot = z.infer<typeof skillScoreSnapshotSchema>;
export type SkillEvidence = z.infer<typeof skillEvidenceSchema>;
export type DevelopmentPhase = z.infer<typeof developmentPhaseSchema>;
export type SkillPlanInput = z.infer<typeof skillPlanInputSchema>;
export type SkillPlanSnapshot = z.infer<typeof skillPlanSnapshotSchema>;
export type SaveSkillCheckinInput = z.infer<typeof saveSkillCheckinSchema>;

export interface SkillScoreDraft {
  skillId: string;
  name: string;
  score: number | null;
  target: number | null;
  importance: number;
  isCore: boolean;
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  importance: number;
  isCore: boolean;
  sortOrder: number;
}

export interface SkillRole {
  id: string | null;
  contextKey: string;
  slug: string;
  name: string;
  description: string | null;
  skills: SkillDefinition[];
}

export interface SkillCheckin {
  id: string;
  roleId: string | null;
  roleName: string;
  checkinDate: string;
  scores: SkillScoreSnapshot[];
  quarterLabel: string | null;
  feedbackPerson: string | null;
  feedbackFrequency: string | null;
  rescoreDays: 30 | 60 | 90;
  nextCheckinDate: string;
  makeTimeBy: string | null;
  plans: SkillPlanSnapshot[];
  createdAt: string;
  updatedAt: string;
}

export interface SkillGrowthData {
  roles: SkillRole[];
  checkins: SkillCheckin[];
  historyTruncated: boolean;
}

export interface RankedFocusArea extends SkillScoreSnapshot {
  gap: number;
  focusScore: number;
}

export function roleContextKey(roleId: string | null): string {
  return roleId ?? ALLEATO_CORE_CONTEXT;
}

export function skillDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SKILL_GROWTH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

export function clampSkillScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function createUnscoredDrafts(
  skills: SkillDefinition[],
): SkillScoreDraft[] {
  return skills.map((skill) => ({
    skillId: skill.id,
    name: skill.name,
    score: null,
    target: null,
    importance: skill.importance,
    isCore: skill.isCore,
  }));
}

export function rankFocusAreas(
  scores: SkillScoreSnapshot[],
): RankedFocusArea[] {
  return scores
    .map((score, index) => {
      const gap = Math.max(score.target - score.score, 0);
      return {
        ...score,
        gap,
        focusScore: gap * score.importance,
        index,
      };
    })
    .filter((score) => score.gap > 0)
    .sort(
      (left, right) =>
        right.focusScore - left.focusScore ||
        right.gap - left.gap ||
        left.index - right.index,
    );
}

export function latestCheckinForRole(
  checkins: SkillCheckin[],
  roleId: string | null,
): SkillCheckin | null {
  const contextKey = roleContextKey(roleId);
  return (
    checkins
      .filter((checkin) => roleContextKey(checkin.roleId) === contextKey)
      .sort(
        (left, right) =>
          right.checkinDate.localeCompare(left.checkinDate) ||
          right.updatedAt.localeCompare(left.updatedAt),
      )[0] ?? null
  );
}

function addUtcDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function rescoreDates(isoDate: string): Array<{
  days: 30 | 60 | 90;
  date: string;
}> {
  return DEVELOPMENT_PHASES.map((days) => ({
    days,
    date: addUtcDays(isoDate, days),
  }));
}

export function formatSkillDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function averageCurrentScore(scores: SkillScoreSnapshot[]): number {
  if (scores.length === 0) return 0;
  return Math.round(
    scores.reduce((total, score) => total + score.score, 0) / scores.length,
  );
}

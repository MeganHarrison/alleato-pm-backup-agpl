import { z } from "zod";

import { rescoreDates, type SkillCheckin } from "./skill-growth";

/**
 * Domain contract for the Manager Coaching Session — the stateful tool that
 * replaces the static "Manager Coaching Guide" article. Pure logic + Zod
 * schemas shared by the server data access, the API routes, the five-step
 * workspace, and the two dashboards. No server-only imports here.
 */

export const COACHING_CYCLES = [
  "new",
  "30-day",
  "60-day",
  "90-day",
] as const;
export type CoachingCycle = (typeof COACHING_CYCLES)[number];

export const COACHING_STATUSES = [
  "draft",
  "awaiting_employee",
  "active",
  "completed",
  "archived",
] as const;
export type CoachingStatus = (typeof COACHING_STATUSES)[number];

export interface CoachingStepDefinition {
  index: 0 | 1 | 2 | 3 | 4;
  slug: string;
  label: string;
  description: string;
}

/** The five steps of the live session, left-rail order. */
export const COACHING_STEPS: readonly CoachingStepDefinition[] = [
  {
    index: 0,
    slug: "frame",
    label: "Set the frame",
    description: "Open the conversation and surface where friction lives.",
  },
  {
    index: 1,
    slug: "evidence",
    label: "Calibrate evidence",
    description: "Agree each score against observable evidence.",
  },
  {
    index: 2,
    slug: "focus",
    label: "Select focus skills",
    description: "Pick two to four skills by importance × gap.",
  },
  {
    index: 3,
    slug: "plan",
    label: "Build practice plan",
    description: "Turn each focus skill into a precise, observable rep.",
  },
  {
    index: 4,
    slug: "confirm",
    label: "Confirm the plan",
    description: "Lock owners, dates, and the 30/60/90 cadence.",
  },
] as const;

/* -------------------------------------------------------------------------- */
/* Capability Ladder — the human-readable translation of the 0–100 rubric.    */
/* Mirrors the bands documented in the Manager Coaching Guide MDX.            */
/* -------------------------------------------------------------------------- */

export interface CapabilityRung {
  index: 1 | 2 | 3 | 4 | 5;
  slug: string;
  label: string;
  rangeLabel: string;
  min: number;
  max: number;
  description: string;
}

export const CAPABILITY_LADDER: readonly CapabilityRung[] = [
  {
    index: 1,
    slug: "aware",
    label: "Aware",
    rangeLabel: "0–20",
    min: 0,
    max: 29,
    description: "Knows the skill exists and is beginning to recognize the work.",
  },
  {
    index: 2,
    slug: "assisted",
    label: "Assisted",
    rangeLabel: "30–50",
    min: 30,
    max: 59,
    description:
      "Completes parts of the work with an SOP, an AI assistant, or a double-check.",
  },
  {
    index: 3,
    slug: "independent",
    label: "Independent",
    rangeLabel: "60–70",
    min: 60,
    max: 79,
    description:
      "Handles most normal situations alone and asks for help on edge cases.",
  },
  {
    index: 4,
    slug: "recommends",
    label: "Recommends",
    rangeLabel: "80",
    min: 80,
    max: 89,
    description:
      "Works independently, documents decisions, and escalates with a recommendation.",
  },
  {
    index: 5,
    slug: "teaches",
    label: "Teaches",
    rangeLabel: "90–100",
    min: 90,
    max: 100,
    description:
      "Teaches the Alleato way, coaches others, and improves the repeatable process.",
  },
] as const;

/** Map any 0–100 score to its named capability rung. */
export function rungForScore(score: number): CapabilityRung {
  const clamped = Math.min(100, Math.max(0, Math.round(score)));
  return (
    CAPABILITY_LADDER.find((rung) => clamped >= rung.min && clamped <= rung.max) ??
    CAPABILITY_LADDER[0]
  );
}

/* -------------------------------------------------------------------------- */
/* Zod schemas                                                                */
/* -------------------------------------------------------------------------- */

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid YYYY-MM-DD date.");

const optionalScore = z.number().int().min(0).max(100).nullable();

/** One shared per-skill calibration row (step 2). */
export const calibrationEntrySchema = z.object({
  skillId: z.string().uuid(),
  employeeScore: optionalScore,
  managerScore: optionalScore,
  agreedScore: optionalScore,
  disagreement: z.string().trim().max(500).default(""),
  experiment: z.string().trim().max(500).default(""),
});
export type CalibrationEntry = z.infer<typeof calibrationEntrySchema>;

/** One focus-skill practice rep (step 4). */
export const practiceRepSchema = z.object({
  skillId: z.string().uuid(),
  action: z.string().trim().max(500).default(""),
  frequency: z.string().trim().max(160).default(""),
  evidence: z.string().trim().max(300).default(""),
  measure: z.string().trim().max(300).default(""),
  resource: z.string().trim().max(300).default(""),
  feedbackOwner: z.string().trim().max(120).default(""),
  feedbackTurnaround: z.string().trim().max(120).default(""),
  firstDueDate: isoDateSchema.nullable().default(null),
});
export type PracticeRep = z.infer<typeof practiceRepSchema>;

/** Private manager preparation (step 0 / pre-work). Never shared. */
export const managerPrepSchema = z.object({
  observations: z.string().max(4000).default(""),
  questions: z.string().max(2000).default(""),
  support: z.string().max(2000).default(""),
  traps: z.string().max(2000).default(""),
  evidenceNotes: z.string().max(4000).default(""),
});
export type ManagerPrep = z.infer<typeof managerPrepSchema>;

/** Lenient payload for autosave — the workspace persists partial progress. */
export const saveCoachingDraftSchema = z.object({
  cycle: z.enum(COACHING_CYCLES).optional(),
  meetingId: z.string().uuid().nullable().optional(),
  currentStep: z.number().int().min(0).max(4).optional(),
  managerPrep: managerPrepSchema.partial().optional(),
  calibration: z.array(calibrationEntrySchema).max(20).optional(),
  focusSkillIds: z.array(z.string().uuid()).max(4).optional(),
  practicePlan: z.array(practiceRepSchema).max(4).optional(),
  stopDoing: z.string().trim().max(1000).optional(),
  managerSupport: z.string().trim().max(1000).optional(),
});
export type SaveCoachingDraftInput = z.infer<typeof saveCoachingDraftSchema>;

/** Strict payload for publishing the plan to both dashboards. */
export const publishCoachingSessionSchema = z
  .object({
    focusSkillIds: z.array(z.string().uuid()).min(2).max(4),
    calibration: z.array(calibrationEntrySchema).min(1).max(20),
    practicePlan: z.array(practiceRepSchema).min(2).max(4),
    stopDoing: z.string().trim().max(1000).default(""),
    managerSupport: z.string().trim().max(1000).default(""),
  })
  .superRefine((input, ctx) => {
    const focus = new Set(input.focusSkillIds);
    if (focus.size !== input.focusSkillIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["focusSkillIds"],
        message: "Focus skills must be unique.",
      });
    }
    const planIds = new Set(input.practicePlan.map((rep) => rep.skillId));
    const missing = [...focus].filter((id) => !planIds.has(id));
    if (missing.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["practicePlan"],
        message: "Every focus skill needs a practice rep before publishing.",
      });
    }
    input.practicePlan.forEach((rep, index) => {
      if (!focus.has(rep.skillId)) return;
      if (!rep.action.trim() || !rep.frequency.trim() || !rep.evidence.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["practicePlan", index],
          message:
            "Each rep needs at least an action, a frequency, and evidence of completion.",
        });
      }
    });
  });
export type PublishCoachingSessionInput = z.infer<
  typeof publishCoachingSessionSchema
>;

/** Request body to open a new coaching session for a report. */
export const createCoachingSessionSchema = z.object({
  employeeUserId: z.string().uuid(),
  roleId: z.string().uuid().nullable().default(null),
  roleContextKey: z.string().trim().min(1).max(64).default("alleato-core"),
  cycle: z.enum(COACHING_CYCLES).default("new"),
  meetingId: z.string().uuid().nullable().default(null),
});
export type CreateCoachingSessionInput = z.infer<
  typeof createCoachingSessionSchema
>;

/** Request body for an employee sharing their assessment into a session. */
export const shareAssessmentSchema = z.object({
  checkinId: z.string().uuid(),
});

/* -------------------------------------------------------------------------- */
/* Runtime types                                                              */
/* -------------------------------------------------------------------------- */

export interface CoachingSession {
  id: string;
  managerUserId: string;
  employeeUserId: string;
  roleId: string | null;
  roleContextKey: string;
  sourceCheckinId: string | null;
  meetingId: string | null;
  cycle: CoachingCycle;
  status: CoachingStatus;
  currentStep: number;
  // NOTE: managerPrep is stored in the separate, employee-invisible
  // training_coaching_manager_prep table and loaded only for the manager view
  // (see ManagerCoachingView), never as a field on the shared session row.
  calibration: CalibrationEntry[];
  focusSkillIds: string[];
  practicePlan: PracticeRep[];
  stopDoing: string | null;
  managerSupport: string | null;
  assessmentSharedAt: string | null;
  publishedAt: string | null;
  employeeConfirmedAt: string | null;
  review30Date: string | null;
  review60Date: string | null;
  review90Date: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * What the MANAGER loads for the live workspace: the session, their private
 * prep, and the employee's shared assessment (null until the employee shares).
 */
export interface ManagerCoachingView {
  session: CoachingSession;
  managerPrep: ManagerPrep;
  assessment: SkillCheckin | null;
}

/** What the EMPLOYEE loads: the session only (never the manager's prep). */
export interface EmployeeCoachingView {
  session: CoachingSession;
}

/** Derive 30/60/90 review dates from a base date, reusing the growth cadence. */
export function coachingReviewDates(isoDate: string): {
  review30Date: string;
  review60Date: string;
  review90Date: string;
} {
  const dates = rescoreDates(isoDate);
  const byDays = new Map(dates.map((entry) => [entry.days, entry.date]));
  return {
    review30Date: byDays.get(30) ?? isoDate,
    review60Date: byDays.get(60) ?? isoDate,
    review90Date: byDays.get(90) ?? isoDate,
  };
}

/** True when the manager may read the employee's shared assessment. */
export function managerCanReadAssessment(session: CoachingSession): boolean {
  return session.assessmentSharedAt !== null && session.sourceCheckinId !== null;
}

import type { CalibrationEntry, PracticeRep } from "./coaching-session";

/**
 * The Manager Coaching Guide, restructured from prose into data. The article
 * stops being the destination and becomes contextual help *inside* the session:
 * the drawer renders COACHING_PLAYBOOK; the workspace surfaces COACHING_TIPS at
 * the moment their trigger fires (scores disagree, a rep is vague, escalation
 * comes up, reviews are being scheduled). Content is faithful to
 * content/training-guides/manager-coaching-guide.mdx.
 */

export interface CoachingStepFrame {
  stepSlug: "frame" | "evidence" | "focus" | "plan" | "confirm";
  /** Manager-facing framing shown as a small facilitator card. */
  purpose: string;
  /** Questions to ask during the step. */
  prompts: string[];
}

export const COACHING_STEP_FRAMES: Record<
  CoachingStepFrame["stepSlug"],
  CoachingStepFrame
> = {
  frame: {
    stepSlug: "frame",
    purpose:
      "This is your development plan. We're using the wheel to choose a few skills that will make the biggest difference in your work, calibrate the scores with evidence, then agree on precise reps you can own.",
    prompts: [
      "Which part of your wheel feels most accurate?",
      "Which score was hardest to choose?",
      "Where would stronger capability remove the most friction from your week?",
    ],
  },
  evidence: {
    stepSlug: "evidence",
    purpose:
      "Start with the employee's score. Ask what they can do consistently, what still needs help, and what evidence supports the number. Scores are a snapshot of current independence and judgment — a lower, accurate score beats a higher one that can't be supported.",
    prompts: [
      "What can you do here consistently, and what still needs a check?",
      "What's a recent example that supports this number?",
      "Where does this skill currently cost you the most time?",
    ],
  },
  focus: {
    stepSlug: "focus",
    purpose:
      "Don't turn every short wedge into a goal. Weigh each candidate by importance to the role × the gap between current and required capability. Keep the two to four with the highest leverage, and name one thing to stop so there's capacity to practice.",
    prompts: [
      "Which improvement would remove a constraint or a recurring error?",
      "What can we stop, delegate, or reduce to make room for this?",
    ],
  },
  plan: {
    stepSlug: "plan",
    purpose:
      "“Get better at scheduling” is not a plan. For each focus skill define the exact action, how often it happens, what proves it was done, the supporting resource, and who gives feedback and how fast. One real rep repeated with feedback beats a list of courses.",
    prompts: [
      "What exact work will you perform, and how often?",
      "What evidence proves the rep happened and whether it worked?",
      "Who reviews it, and how quickly?",
    ],
  },
  confirm: {
    stepSlug: "confirm",
    purpose:
      "Have the employee state the plan back in their own words. Confirm the first rep and its due date, the evidence they'll bring, where quick feedback comes from, and the 30/60/90-day review dates. The manager provides access and timely feedback; the employee owns the reps.",
    prompts: [
      "Can you restate the plan and the first rep in your own words?",
      "What evidence will you bring to the 30-day review?",
    ],
  },
};

export type ContextualTipTrigger =
  | "score-disagreement"
  | "scores-too-high"
  | "scores-too-low"
  | "too-many-focus"
  | "vague-practice-task"
  | "escalation"
  | "scheduling-reviews";

export interface ContextualTip {
  id: string;
  trigger: ContextualTipTrigger;
  title: string;
  body: string;
}

export const COACHING_TIPS: readonly ContextualTip[] = [
  {
    id: "disagree",
    trigger: "score-disagreement",
    title: "When you disagree with a score",
    body: "Don't force an unexplained number. Ask the employee to show the evidence behind their score, then name the observable capability you believe is missing or already present. If you still disagree, record both interpretations, agree on the behavior that would demonstrate the next level, and set a short work-based experiment to revisit it. The goal is shared calibration, not manager victory.",
  },
  {
    id: "too-high",
    trigger: "scores-too-high",
    title: "The employee scores too high",
    body: "Ask for two recent examples completed at that level of independence, and compare them with the rubric. If the evidence is incomplete, agree on the work that would prove the level instead of arguing about confidence.",
  },
  {
    id: "too-low",
    trigger: "scores-too-low",
    title: "The employee scores too low",
    body: "Ask what they've completed without rescue and name specific evidence they may be discounting. Then pick a rep that stretches the skill without taking ownership away from them.",
  },
  {
    id: "too-many",
    trigger: "too-many-focus",
    title: "The plan has too many priorities",
    body: "Return to importance and gap. Keep only the two to four skills that will materially change current performance or readiness for the next role.",
  },
  {
    id: "vague",
    trigger: "vague-practice-task",
    title: "The practice task is vague",
    body: "Rewrite it until another manager could observe whether it happened. Add a frequency, the evidence of completion, and the feedback timing. Example: “For the next four weekly look-aheads, draft the constraint log before the meeting, assign an owner and due date to every open constraint, and send the updated log within two hours.”",
  },
  {
    id: "escalation",
    trigger: "escalation",
    title: "The 1-3-1 rule for escalation",
    body: "When you catch yourself rescuing the work, ask for it back as 1-3-1: one problem, three possible solutions, and one recommendation. You can challenge the thinking without taking the task back.",
  },
  {
    id: "reviews",
    trigger: "scheduling-reviews",
    title: "30 / 60 / 90-day reviews",
    body: "Review evidence before the score. 30 days: were the reps completed, and what changed the next attempt? 60 days: is the employee handling more normal situations independently? 90 days: what does the evidence say now — re-score, keep what still matters, and replace any completed focus with the next highest-leverage skill. Don't move a score because time passed; move it when capability and evidence changed.",
  },
];

export function tipsForTrigger(
  trigger: ContextualTipTrigger,
): ContextualTip[] {
  return COACHING_TIPS.filter((tip) => tip.trigger === trigger);
}

/** Three-part feedback that moves the wheel. */
export const FEEDBACK_FRAMEWORK = {
  observation: "State what happened without guessing intent.",
  impact: "Explain what the behavior changed for the work or team.",
  nextRep: "Name the smallest specific action to repeat or change.",
} as const;

export interface PlaybookSection {
  id: string;
  title: string;
  body: string[];
}

/** The full guide, structured for the side drawer ("Open coaching playbook"). */
export const COACHING_PLAYBOOK: readonly PlaybookSection[] = [
  {
    id: "outcome",
    title: "The outcome",
    body: [
      "Leave the conversation with a shared view of the evidence behind each discussed score, no more than two to four focus skills, one precise practice plan per focus skill, and a feedback cadence with 30/60/90-day dates.",
      "If those four things aren't clear, the conversation isn't finished.",
    ],
  },
  {
    id: "before",
    title: "Before the conversation",
    body: [
      "Ask the employee to complete the wheel first. Don't pre-score them or arrive with a hidden answer key.",
      "Bring evidence, not labels. “Strong communicator” is a label. “Set the trade meeting agenda, surfaced two constraints, and documented owners before the meeting closed” is evidence. Record each example as Situation, Behavior, Outcome.",
      "Choose a private setting and protect 45 minutes. Don't combine this with compensation, discipline, or a surprise performance review.",
    ],
  },
  {
    id: "rubric",
    title: "The calibration rubric",
    body: [
      "0–20: Aware of the skill and beginning to recognize the work.",
      "30–50: Can complete parts of the work with an SOP, an AI assistant, or a manager's double-check.",
      "60–70: Can complete most normal situations independently and asks for help on edge cases.",
      "80: Can work independently, document decisions, and escalate with a clear recommendation.",
      "100: Can teach the Alleato way, coach another person, and improve the repeatable process.",
    ],
  },
  {
    id: "rep",
    title: "Turn each skill into a precise rep",
    body: [
      "Action: the exact work the employee will perform.",
      "Frequency: how often the rep happens.",
      "Evidence: what proves the rep was completed and whether it worked.",
      "Resource: the guide, SOP, example, mentor, or project situation that supports it.",
      "Feedback: who reviews it and how quickly.",
    ],
  },
  {
    id: "done",
    title: "Definition of done",
    body: [
      "The coaching cycle is working when the employee can name the focus skills, show the repeated work, explain what changed from feedback, and make a more independent decision in the next similar situation.",
    ],
  },
];

/** A score gap of this size or more between the two parties surfaces the tip. */
export const SCORE_DISAGREEMENT_THRESHOLD = 20;

/** True when employee and manager scores diverge enough to calibrate. */
export function hasScoreDisagreement(entry: CalibrationEntry): boolean {
  if (entry.employeeScore === null || entry.managerScore === null) return false;
  return Math.abs(entry.employeeScore - entry.managerScore) >= SCORE_DISAGREEMENT_THRESHOLD;
}

/** True when a focus-skill rep is too vague to observe. */
export function isPracticeRepVague(rep: PracticeRep): boolean {
  const action = rep.action.trim();
  const hasFrequency = rep.frequency.trim().length > 0;
  const hasEvidence = rep.evidence.trim().length > 0;
  return action.length < 12 || !hasFrequency || !hasEvidence;
}

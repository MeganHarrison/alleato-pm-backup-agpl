export const EMAIL_IMPORTANCE_SIGNALS = [
  "important",
  "not_important",
] as const;

export type EmailImportanceSignal = (typeof EMAIL_IMPORTANCE_SIGNALS)[number];

export const EMAIL_IMPORTANCE_CLEARED_SIGNAL = "cleared" as const;

export const EMAIL_IMPORTANCE_REASON_CATEGORIES = [
  "client_deadline",
  "decision_needed",
  "financial_risk",
  "project_blocker",
  "executive_visibility",
  "follow_up_required",
  "informational_only",
  "automated_notification",
  "marketing_noise",
  "duplicate_update",
  "routine_internal",
  "other",
] as const;

export type EmailImportanceReasonCategory =
  (typeof EMAIL_IMPORTANCE_REASON_CATEGORIES)[number];

export const EMAIL_IMPORTANCE_REASON_LABELS: Record<
  EmailImportanceReasonCategory,
  string
> = {
  client_deadline: "Client deadline",
  decision_needed: "Decision needed",
  financial_risk: "Financial risk",
  project_blocker: "Project blocker",
  executive_visibility: "Executive visibility",
  follow_up_required: "Follow-up required",
  informational_only: "Informational only",
  automated_notification: "Automated notification",
  marketing_noise: "Marketing noise",
  duplicate_update: "Duplicate update",
  routine_internal: "Routine internal",
  other: "Other",
};

export interface EmailImportanceFeedbackState {
  signal: EmailImportanceSignal;
  reasonCategory: EmailImportanceReasonCategory | null;
  reason: string | null;
  createdAt: string;
}

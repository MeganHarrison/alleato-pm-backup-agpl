export const ADMIN_FEEDBACK_BUCKET = "admin-feedback";

export const ADMIN_FEEDBACK_ATTRIBUTE = "data-feedback-id";
export const ADMIN_FEEDBACK_FALLBACK_ATTRIBUTE = "data-ai-target";
export const ADMIN_FEEDBACK_OVERLAY_ATTRIBUTE = "data-admin-feedback-root";
export const OPEN_ADMIN_FEEDBACK_COMPOSER_EVENT =
  "admin-feedback:open-composer";
export const ADMIN_FEEDBACK_SHEET_OPEN_ATTRIBUTE =
  "data-admin-feedback-sheet-open";
export const ADMIN_FEEDBACK_SHEET_OFFSET_CSS_VAR =
  "--admin-feedback-sheet-offset";
export const FEEDBACK_LAUNCHER_POSITION_CLASS = "feedback-launcher-position";

export const ADMIN_FEEDBACK_REQUEST_TYPES = [
  "bug",
  "change_request",
  "copy",
  "question",
  "feature_request",
] as const;

export type AdminFeedbackRequestType =
  (typeof ADMIN_FEEDBACK_REQUEST_TYPES)[number];

export const ADMIN_FEEDBACK_REQUEST_TYPE_LABELS: Record<
  AdminFeedbackRequestType,
  string
> = {
  bug: "Bug",
  change_request: "Change request",
  copy: "Copy / wording",
  question: "Question",
  feature_request: "Idea",
};

export const ADMIN_FEEDBACK_REQUEST_TYPE_GITHUB_LABELS: Record<
  AdminFeedbackRequestType,
  string
> = {
  bug: "feedback:bug",
  change_request: "feedback:change_request",
  copy: "feedback:copy",
  question: "feedback:question",
  feature_request: "feedback:feature_request",
};

export const ADMIN_FEEDBACK_PRODUCT_INTAKE_LABEL = "Ideas";

export const BOARD_STATUSES = [
  "submitted",
  "planned",
  "in_progress",
  "leadership_review",
  "shipped",
] as const;

export type BoardStatus = (typeof BOARD_STATUSES)[number];

export const BOARD_STATUS_LABELS: Record<BoardStatus, string> = {
  submitted: "Submitted",
  planned: "Planned",
  in_progress: "In Progress",
  leadership_review: "Leadership review",
  shipped: "Shipped",
};

export const ADMIN_FEEDBACK_SEVERITIES = ["low", "medium", "high"] as const;

export type AdminFeedbackSeverity = (typeof ADMIN_FEEDBACK_SEVERITIES)[number];

export function feedbackTargetProps(id: string) {
  return {
    [ADMIN_FEEDBACK_ATTRIBUTE]: id,
  } as const;
}

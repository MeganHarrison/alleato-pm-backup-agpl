import type { AdminFeedbackRequestType } from "@/lib/admin-feedback/constants";

export type AskAlleatoFeedbackTag = "Bug" | "Idea" | "Confused";
export type AskAlleatoFeedbackTypeLabel = "Issue" | "Wishlist" | "General thought";

export const ASK_ALLEATO_FEEDBACK_TAGS: AskAlleatoFeedbackTag[] = [
  "Bug",
  "Idea",
  "Confused",
];

export const ASK_ALLEATO_FEEDBACK_PLACEHOLDER =
  "Bug, idea, or just confused — anything works";

export function mapAskAlleatoTagToFeedbackType(
  tag: AskAlleatoFeedbackTag,
): AskAlleatoFeedbackTypeLabel {
  if (tag === "Bug") return "Issue";
  if (tag === "Idea") return "Wishlist";
  return "General thought";
}

export function mapAskAlleatoTagToRequestType(
  tag: AskAlleatoFeedbackTag,
): AdminFeedbackRequestType {
  if (tag === "Bug") return "bug";
  if (tag === "Idea") return "feature_request";
  return "question";
}

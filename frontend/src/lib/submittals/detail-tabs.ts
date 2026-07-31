export const SUBMITTAL_DETAIL_TABS = ["details", "ai-review"] as const;

export type SubmittalDetailTab = (typeof SUBMITTAL_DETAIL_TABS)[number];

export function normalizeSubmittalDetailTab(
  value: string | null,
): SubmittalDetailTab {
  return value === "ai-review" ? "ai-review" : "details";
}

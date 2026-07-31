import {
  DEFAULT_EXECUTIVE_BRIEFING_SYNTHESIS_MODEL,
  DEFAULT_EXECUTIVE_WINDOW_DAYS,
  type BrandonBriefItem,
  type BrandonBriefSourceCoverage,
  type BrandonDailyUpdatePacket,
  type DailyBriefRefreshRecord,
} from "@/lib/executive/brandon-daily-update";

export {
  DEFAULT_EXECUTIVE_BRIEFING_SYNTHESIS_MODEL,
  DEFAULT_EXECUTIVE_WINDOW_DAYS,
};

export type DailyBriefAudiencePresetId = "brandon" | "admin";

export type DailyBriefAudiencePreset = {
  id: DailyBriefAudiencePresetId;
  label: string;
  audience: string;
  description: string;
  deliveryChannels: Array<"page" | "chat" | "teams" | "email">;
};

export type DailyBriefItem = BrandonBriefItem;
export type DailyBriefSourceCoverage = BrandonBriefSourceCoverage;
export type DailyBriefPacket = BrandonDailyUpdatePacket;
export type { DailyBriefRefreshRecord };

export const DAILY_BRIEF_PRODUCT_NAME = "Daily Brief";

export const DAILY_BRIEF_SOURCE_OF_TRUTH =
  "daily_recaps.recap_kind=executive_briefing";

export const DAILY_BRIEF_PRESETS: Record<
  DailyBriefAudiencePresetId,
  DailyBriefAudiencePreset
> = {
  brandon: {
    id: "brandon",
    label: "Brandon preset",
    audience: "Brandon",
    description:
      "Prioritizes approvals, blockers, finance, people, commitments, and risk.",
    deliveryChannels: ["page", "chat", "teams", "email"],
  },
  admin: {
    id: "admin",
    label: "Admin/internal preset",
    audience: "Megan/admin",
    description:
      "Includes the canonical brief plus source coverage, warnings, stale data, and delivery diagnostics.",
    deliveryChannels: ["page", "email"],
  },
};

export function clampDailyBriefWindowDays(value: number) {
  return Number.isFinite(value)
    ? Math.min(Math.max(Math.trunc(value), 1), 14)
    : DEFAULT_EXECUTIVE_WINDOW_DAYS;
}

import type { Database } from "@/types/database.types";

export type TrainingResourceType =
  Database["public"]["Enums"]["training_resource_type"];
export type TrainingResourceLevel =
  Database["public"]["Enums"]["training_resource_level"];
export type TrainingResourceStatus =
  Database["public"]["Enums"]["training_resource_status"];
export type TrainingReviewDecision = "publish" | "archive";
export const TRAINING_REVIEW_REASON_OPTIONS = {
  publish: [
    ["field_applicable", "Strong field applicability"],
    ["trusted_provider", "Trusted provider"],
    ["right_depth", "Right level of depth"],
    ["clear_instruction", "Clear instruction"],
    ["current_content", "Current content"],
  ],
  archive: [
    ["wrong_role_topic", "Wrong role or topic"],
    ["too_basic", "Too basic"],
    ["too_advanced", "Too advanced"],
    ["outdated", "Outdated"],
    ["poor_quality", "Poor presentation quality"],
    ["promotional", "Too promotional"],
    ["too_short", "Too short"],
    ["duplicate_similar", "Duplicate or substantially similar"],
    ["unsafe_inaccurate", "Unsafe or inaccurate"],
  ],
} as const;
export type TrainingReviewReason =
  (typeof TRAINING_REVIEW_REASON_OPTIONS)[TrainingReviewDecision][number][0];
export type TrainingReviewRatings = Partial<
  Record<"relevance" | "depth" | "quality", number>
>;
export type TrainingFreshnessOutcome =
  | "healthy"
  | "unavailable"
  | "redirected"
  | "title_changed"
  | "free_unproven"
  | "paid"
  | "blocked";
export type TrainingFreshnessDecision = "keep" | "archive";

export type TrainingRole = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  aliases: string[];
  sortOrder: number;
};

export type TrainingTopic = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
};

export type TrainingResource = {
  id: string;
  topicId: string;
  topicSlug: string;
  topicName: string;
  title: string;
  description: string | null;
  url: string;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  provider: string | null;
  type: TrainingResourceType;
  level: TrainingResourceLevel;
  track: string;
  status: TrainingResourceStatus;
  durationMinutes: number | null;
  discovery?: {
    policyVersion: string;
    strategy: string;
    score: number;
    explanation: string[];
  } | null;
  /** Optional — omitted by older test fixtures. Real rows always set it. */
  createdAt?: string;
  roles: TrainingRole[];
};

export type TrainingResourceFilters = {
  role?: string;
  track?: string;
  type?: TrainingResourceType;
  level?: TrainingResourceLevel;
  status?: TrainingResourceStatus;
  query?: string;
};

export type TrainingResourceReviewInput = {
  resourceId: string;
  decision: TrainingReviewDecision;
  reasonCodes: TrainingReviewReason[];
  ratings: TrainingReviewRatings;
  notes?: string;
};

export type TrainingDiscoveryMetrics = {
  activePolicy: {
    version: string;
    explorationRate: number;
    activatedAt: string | null;
    evaluation: Record<string, unknown>;
  };
  runs: number;
  candidates: number;
  reviewed: number;
  published: number;
  archived: number;
  duplicates: number;
  approvalRate: number;
  strategyPerformance: Array<{
    strategy: string;
    reviewed: number;
    published: number;
    approval_rate: number;
  }>;
};

export type TrainingFreshnessReviewItem = {
  checkId: string;
  resource: TrainingResource;
  outcome: TrainingFreshnessOutcome;
  recommendedAction: TrainingFreshnessDecision;
  occurrenceCount: number;
  lastSeenAt: string;
  httpStatus: number | null;
  finalUrl: string | null;
  observedTitle: string | null;
};

export type TrainingFreshnessReviewInput = {
  checkId: string;
  decision: TrainingFreshnessDecision;
  notes: string;
};

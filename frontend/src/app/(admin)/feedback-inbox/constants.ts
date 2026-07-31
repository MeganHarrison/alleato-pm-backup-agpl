import {
  Archive,
  Circle,
  GitPullRequest,
  Loader2,
  PauseCircle,
  ShieldCheck,
} from "lucide-react";
import {
  ADMIN_FEEDBACK_PRODUCT_INTAKE_LABEL,
  ADMIN_FEEDBACK_REQUEST_TYPE_LABELS,
  ADMIN_FEEDBACK_REQUEST_TYPES,
} from "@/lib/admin-feedback/constants";
import type {
  DisplayStatus,
  FeedbackInboxTab,
  StatusFilter,
} from "./types";

export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "in_review", label: "In Review" },
  { value: "verified", label: "Verified" },
  { value: "deferred", label: "Deferred" },
  { value: "dispatched", label: "Dispatched" },
  { value: "all", label: "All" },
];

export const FEEDBACK_STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_review", label: "In Review" },
  { value: "verified", label: "Verified" },
  { value: "deferred", label: "Deferred" },
];

export const STATUS_OPTIONS: { value: DisplayStatus; label: string }[] = [
  { value: "open", label: "Submitted" },
  { value: "in_progress", label: "In Progress" },
  { value: "pr_created", label: "PR Created" },
  { value: "in_review", label: "In Review" },
  { value: "verified", label: "Verified" },
  { value: "deferred", label: "Deferred" },
  { value: "archived", label: "Archived" },
];

export const FEEDBACK_INBOX_TABS: { value: FeedbackInboxTab; label: string }[] = [
  { value: "all", label: "All feedback" },
  { value: "issues", label: "Issues" },
  { value: "feature_requests", label: ADMIN_FEEDBACK_PRODUCT_INTAKE_LABEL },
];

export const STATUS_META: Record<
  DisplayStatus,
  {
    icon: typeof Circle;
    className: string;
    dotClassName: string;
    label: string;
    showInList?: boolean;
  }
> = {
  open: {
    icon: Circle,
    className: "text-status-warning",
    dotClassName: "bg-status-warning",
    label: "Submitted",
  },
  in_progress: {
    icon: Loader2,
    className: "text-status-info",
    dotClassName: "bg-status-info animate-pulse",
    label: "In Progress",
    showInList: true,
  },
  pr_created: {
    icon: GitPullRequest,
    className: "text-status-info",
    dotClassName: "bg-status-info",
    label: "PR Created",
    showInList: true,
  },
  deferred: {
    icon: PauseCircle,
    className: "text-muted-foreground",
    dotClassName: "bg-muted-foreground",
    label: "Deferred",
    showInList: true,
  },
  in_review: {
    icon: ShieldCheck,
    className: "text-status-info",
    dotClassName: "bg-status-info",
    label: "In Review",
    showInList: true,
  },
  verified: {
    icon: ShieldCheck,
    className: "text-status-success",
    dotClassName: "bg-status-success",
    label: "Verified",
    showInList: true,
  },
  archived: {
    icon: Archive,
    className: "text-muted-foreground",
    dotClassName: "bg-muted-foreground",
    label: "Archived",
    showInList: true,
  },
};

export const REQUEST_TYPE_LABELS: Record<string, string> = {
  ...ADMIN_FEEDBACK_REQUEST_TYPE_LABELS,
};

export const REQUEST_TYPE_OPTIONS = ADMIN_FEEDBACK_REQUEST_TYPES.map((value) => ({
  value,
  label: ADMIN_FEEDBACK_REQUEST_TYPE_LABELS[value],
}));

export const PRIORITY_OPTIONS: { value: "high" | "medium" | "low"; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export const IN_PROGRESS_STATUSES = new Set([
  "in_progress",
  "triaged",
  "diagnosing",
  "fixing",
  "verifying",
  "in_review",
]);
export const PR_CREATED_STATUSES = new Set(["pr_created"]);
export const IN_REVIEW_STATUSES = new Set(["resolved", "in_review"]);
export const VERIFIED_STATUSES = new Set(["closed", "verified"]);
export const DEFERRED_STATUSES = new Set(["deferred"]);
export const ARCHIVED_STATUSES = new Set(["archived"]);
export const LIST_SECTION_ORDER: DisplayStatus[] = [
  "in_progress",
  "pr_created",
  "in_review",
  "open",
  "deferred",
  "verified",
];

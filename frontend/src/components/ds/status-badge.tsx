"use client";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Status variant system — ONE place for all status-to-color mappings
// ---------------------------------------------------------------------------

export type StatusVariant =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral"
  | "purple"
  | "rose";

const badgeStyles: Record<StatusVariant, string> = {
  success: "bg-success-surface text-success",
  warning: "bg-warning-surface text-warning",
  error: "bg-destructive-surface text-destructive",
  info: "bg-info/10 text-info dark:bg-info/20",
  neutral: "bg-muted text-muted-foreground",
  purple: "bg-purple-50 text-purple-600",
  rose: "bg-rose-50 text-rose-600",
};

// ---------------------------------------------------------------------------
// Domain status → variant mapping
// Add every domain status here. This is THE source of truth.
// ---------------------------------------------------------------------------

const STATUS_TO_VARIANT: Record<string, StatusVariant> = {
  // Approval statuses
  approved: "success",
  active: "success",
  accepted: "success",
  completed: "success",
  complete: "success",
  closed: "success",
  paid: "success",
  synced: "success",
  executed: "success",
  reviewed: "success",

  // Warning statuses
  pending: "warning",
  "pending approval": "warning",
  "in progress": "warning",
  "in review": "warning",
  "under review": "warning",
  "under_review": "warning",
  "revise and resubmit": "warning",
  "revision requested": "warning",
  "revision_requested": "warning",
  "changes requested": "warning",
  changes_requested: "warning",
  submitted: "warning",
  open: "info",
  partial: "warning",
  "out for bid": "warning",
  "out for signature": "warning",

  // Error statuses
  rejected: "error",
  overdue: "error",
  failed: "error",
  cancelled: "error",
  void: "error",
  deleted: "error",
  terminated: "error",

  // Info statuses
  "not synced": "info",

  // Site-map inventory statuses
  "needs review": "warning",
  "missing nav": "warning",
  "internal only": "info",
  deprecated: "neutral",
  broken: "error",
  planned: "purple",
  "design issues": "rose",

  // Neutral statuses
  draft: "neutral",
  inactive: "neutral",
  archived: "neutral",
  unknown: "neutral",
  none: "neutral",

  // Attribution / provenance statuses (project creation log)
  "legacy gap": "warning",
  legacy_gap: "warning",

  // App error statuses
  new: "error",
  triaged: "info",
  in_progress: "warning",
  needs_human: "warning",
  fixed: "success",
  ignored: "neutral",

  // Severity levels
  critical: "error",
  high: "warning",
  medium: "info",
  low: "neutral",
};

function resolveVariant(status: string): StatusVariant {
  return STATUS_TO_VARIANT[status.toLowerCase()] ?? "neutral";
}

// ---------------------------------------------------------------------------
// StatusBadge — Pass a raw status string, get the right colors automatically
// ---------------------------------------------------------------------------

interface StatusBadgeProps {
  /** The raw status string from your data (e.g. "Draft", "Approved", "Pending") */
  status: string;
  /** Override the automatic variant if needed */
  variant?: StatusVariant;
  /** Back-compat alias for older call sites that passed a domain type. */
  type?: string;
  className?: string;
}

export function StatusBadge({ status, variant, type, className }: StatusBadgeProps) {
  const resolved = variant ?? resolveVariant(type ?? status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        badgeStyles[resolved],
        className
      )}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// StatusDot — Minimal inline dot indicator for tables and compact views
// ---------------------------------------------------------------------------

const dotColors: Record<StatusVariant, string> = {
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-destructive",
  info: "bg-info",
  neutral: "bg-muted-foreground/40",
  purple: "bg-purple-500",
  rose: "bg-rose-500",
};

interface StatusDotProps {
  /** The raw status string from your data */
  status: string;
  /** Override the automatic variant if needed */
  variant?: StatusVariant;
  className?: string;
}

export function StatusDot({ status, variant, className }: StatusDotProps) {
  const resolved = variant ?? resolveVariant(status);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dotColors[resolved])} />
      <span className="text-muted-foreground">{status}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// StatusText — Plain muted text for non-emphasized statuses (e.g. "Not synced")
// ---------------------------------------------------------------------------

interface StatusTextProps {
  status: string;
  className?: string;
}

const textColors: Record<StatusVariant, string> = {
  success: "text-success",
  warning: "text-warning",
  error: "text-destructive",
  info: "text-info",
  neutral: "text-muted-foreground",
  purple: "text-purple-600",
  rose: "text-rose-600",
};

export function StatusText({ status, className }: StatusTextProps) {
  const resolved = resolveVariant(status);
  return (
    <span className={cn("text-xs font-medium", textColors[resolved], className)}>
      {status}
    </span>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface EstimateVersionBadgeProps {
  projectId: string | number;
  estimateId: number;
  estimateVersion: number | null;
  lastSyncedAt?: string | null;
  className?: string;
}

/**
 * EstimateVersionBadge — small chip indicating a prime contract was built from an estimate.
 * Links back to the source estimate. Shows revision number and last-sync timestamp on hover.
 */
export function EstimateVersionBadge({
  projectId,
  estimateId,
  estimateVersion,
  lastSyncedAt,
  className,
}: EstimateVersionBadgeProps) {
  const syncedLabel = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const title = syncedLabel ? `Last synced ${syncedLabel}` : undefined;

  return (
    <Link
      href={`/${projectId}/estimates/${estimateId}`}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5",
        "text-xs font-medium text-primary hover:bg-primary/15 transition-colors",
        className,
      )}
    >
      <FileText className="h-3 w-3" />
      Built from Estimate #{estimateId}
      {estimateVersion != null && <span className="text-primary/70">· rev {estimateVersion}</span>}
    </Link>
  );
}

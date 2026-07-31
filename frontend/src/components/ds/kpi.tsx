"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// KpiBlock — Single metric display with 3-tier text hierarchy
// ---------------------------------------------------------------------------

interface KpiBlockProps {
  label: string;
  value: string;
  delta?: {
    value: string;
    positive: boolean;
  };
  context?: string;
  size?: "small" | "medium" | "large" | "prominent" | "compact";
  href?: string;
  progress?: {
    value: number; // 0–100
    tone?: "neutral" | "warning" | "danger";
  };
}

export type { KpiBlockProps };

export function KpiBlock({
  label,
  value,
  delta,
  context,
  size = "medium",
  href,
  progress,
}: KpiBlockProps) {
  const resolvedSize =
    size === "prominent" ? "large" : size === "compact" ? "small" : size;

  const content = (
    <>
      {/* Tier 1: Eyebrow */}
      <span
        className={cn(
          "font-bold uppercase tracking-[0.08em] text-muted-foreground/60",
          resolvedSize === "small" ? "text-[9px]" : "text-[10px]"
        )}
      >
        {label}
      </span>

      {/* Tier 2: Value + optional delta */}
      <div
        className={cn(
          "flex flex-wrap items-baseline gap-x-2 gap-y-1",
          resolvedSize === "small" ? "mt-1" : "mt-2"
        )}
      >
        <span
          className={cn(
            "font-bold leading-none tracking-[-0.03em] text-foreground",
            resolvedSize === "large" && "text-2xl",
            resolvedSize === "medium" && "text-xl",
            resolvedSize === "small" && "text-lg"
          )}
        >
          {value}
        </span>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center rounded px-[7px] py-0.5 text-[11px] font-semibold",
              delta.positive
                ? "bg-green-50 text-green-600"
                : "bg-red-50 text-red-600"
            )}
          >
            {delta.positive ? "\u2191" : "\u2193"} {delta.value}
          </span>
        )}
      </div>

      {/* Tier 3: Context */}
      {context && (
        <span
          className={cn(
            "mt-1 block text-muted-foreground/60",
            resolvedSize === "small" ? "text-[10px]" : "text-[11px]"
          )}
        >
          {context}
        </span>
      )}

      {/* Optional progress bar */}
      {progress !== undefined && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-border">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              progress.tone === "danger"
                ? "bg-destructive"
                : progress.tone === "warning"
                ? "bg-amber-400"
                : "bg-primary/60"
            )}
            style={{ width: `${Math.min(100, Math.max(0, progress.value))}%` }}
          />
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="block group">
        {content}
      </Link>
    );
  }

  return <div>{content}</div>;
}

// ---------------------------------------------------------------------------
// KpiRow — Shared container for 2-4 KpiBlocks with dividers
// ---------------------------------------------------------------------------

export function KpiStrip({ metrics }: { metrics: Pick<KpiBlockProps, "label" | "value">[] }) {
  return (
    <div className="flex items-center gap-4 py-2 text-sm">
      {metrics.map((metric, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="h-3 w-px bg-border" aria-hidden />}
          <span className="flex items-baseline gap-1.5">
            <span className="text-muted-foreground">{metric.label}</span>
            <span className="font-semibold text-foreground tabular-nums">{metric.value}</span>
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

export function KpiRow({
  metrics,
  size = "medium",
  bare = false,
}: {
  metrics: KpiBlockProps[];
  size?: "small" | "medium" | "large";
  bare?: boolean;
}) {
  const itemPadding = {
    small: "p-3",
    medium: "p-4 sm:p-5",
    large: "p-5 px-6",
  }[size];

  const grid = (
    <div
      className={cn(
        "grid grid-cols-1 gap-px bg-border",
        size !== "large" && "sm:grid-cols-2",
        size === "large" && "sm:grid-cols-2 xl:grid-cols-4",
        metrics.length === 6 && size !== "large" && "xl:grid-cols-3",
        metrics.length === 5 && size !== "large" && "xl:grid-cols-5",
        metrics.length === 4 && size !== "large" && "xl:grid-cols-4",
        metrics.length === 3 && size !== "large" && "xl:grid-cols-3",
        metrics.length <= 2 && size !== "large" && "sm:grid-cols-2"
      )}
    >
      {metrics.map((metric, i) => (
        <div
          key={i}
          className={cn("min-w-0 bg-card", itemPadding)}
        >
          <KpiBlock {...metric} size={metric.size ?? size} />
        </div>
      ))}
    </div>
  );

  if (bare) return grid;

  return (
    /* eslint-disable-next-line design-system/no-design-violations -- KPI bento container uses intentional shared border */
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {grid}
    </div>
  );
}

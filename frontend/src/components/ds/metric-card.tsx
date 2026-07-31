"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import Link from "next/link";

/* =============================================================================
   METRIC CARD - Premium KPI Display Component
   =============================================================================
   A reusable component for displaying key metrics and KPIs.
   Used throughout the app for financial summaries, dashboards, etc.

   Features:
   - Large, prominent value display with proper number formatting
   - Optional change indicator (positive/negative/neutral)
   - Optional subtitle and description
   - Responsive sizing
   - Premium styling with subtle elevation

   Usage:
   <MetricCard
     label="Total Budget"
     value={1250000}
     format="currency"
     change={{ value: 5.2, type: "positive" }}
   />
   ============================================================================= */

interface MetricCardProps {
  /** Small label above the value */
  label: string;
  /** The metric value to display */
  value: number | string;
  /** Format for numeric values */
  format?: "currency" | "number" | "percent" | "none";
  /** Change indicator */
  change?: {
    value: number;
    type: "positive" | "negative" | "neutral";
    label?: string;
  };
  /** Optional subtitle below the value */
  subtitle?: string;
  /** Link to detail view */
  href?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional className */
  className?: string;
  /** Use compact styling */
  compact?: boolean;
  /** Optional action element (e.g., button) */
  action?: React.ReactNode;
}

/* Format number as currency */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/* Format number with commas */
function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/* Format as percentage */
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/* Format value based on format type */
function formatValue(value: number | string, format: MetricCardProps["format"]): string {
  if (typeof value === "string") return value;

  switch (format) {
    case "currency":
      return formatCurrency(value);
    case "number":
      return formatNumber(value);
    case "percent":
      return formatPercent(value);
    default:
      return String(value);
  }
}

export function MetricCard({
  label,
  value,
  format = "none",
  change,
  subtitle,
  href,
  size = "md",
  className,
  compact = false,
  action,
}: MetricCardProps) {
  const sizeStyles = {
    sm: {
      container: compact ? "p-4 sm:p-4" : "p-4 sm:p-4",
      label: "text-[9px] sm:text-2xs mb-1.5",
      value: "text-xl sm:text-2xl",
      change: "text-2xs mt-1.5",
    },
    md: {
      container: compact ? "p-4 sm:p-4" : "p-4 sm:p-6",
      label: "text-2xs sm:text-[11px] mb-2",
      value: "text-2xl sm:text-3xl",
      change: "text-xs mt-2",
    },
    lg: {
      container: compact ? "p-4 sm:p-6" : "p-6 sm:p-8",
      label: "text-[11px] sm:text-xs mb-2 sm:mb-4",
      value: "text-3xl sm:text-4xl md:text-5xl",
      change: "text-xs sm:text-sm mt-2 sm:mt-4",
    },
  };

  const styles = sizeStyles[size];

  const changeColors = {
    positive: "text-success",
    negative: "text-destructive",
    neutral: "text-muted-foreground",
  };

  const ChangeIcon = {
    positive: TrendingUp,
    negative: TrendingDown,
    neutral: Minus,
  };

  const content = (
    <div
      className={cn(
        "bg-card border border-border rounded-md transition-all relative",
        "shadow-[0_1px_2px_0_rgb(0_0_0/0.03)]",
        href && "cursor-pointer hover:shadow-[0_1px_3px_0_rgb(0_0_0/0.04),0_1px_2px_-1px_rgb(0_0_0/0.04)] hover:border-neutral-300/80",
        styles.container,
        className
      )}
    >
      {/* Action button in top right */}
      {action && (
        <div className="absolute top-2 right-2">
          {action}
        </div>
      )}

      {/* Label */}
      <p className={cn(
        "font-semibold tracking-[0.15em] uppercase text-neutral-500",
        styles.label
      )}>
        {label}
      </p>

      {/* Value and Change indicator */}
      <div className="flex items-center justify-between gap-4">
        {/* Value */}
        <p className={cn(
          "font-light tabular-nums tracking-tight text-neutral-900",
          styles.value
        )}>
          {formatValue(value, format)}
        </p>

        {/* Change indicator */}
        {change && (
          <div className={cn(
            "flex items-center gap-1 font-medium shrink-0",
            changeColors[change.type],
            styles.change
          )}>
            {React.createElement(ChangeIcon[change.type], {
              className: "h-3 w-3 sm:h-3.5 sm:w-3.5",
            })}
            <span>
              {change.type === "positive" ? "+" : change.type === "negative" ? "-" : ""}
              {Math.abs(change.value).toFixed(1)}%
            </span>
            {change.label && (
              <span className="text-neutral-400 ml-1">{change.label}</span>
            )}
          </div>
        )}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <p className={cn(
          "text-neutral-500 mt-2",
          size === "sm" ? "text-2xs sm:text-xs" : "text-xs sm:text-sm"
        )}>
          {subtitle}
        </p>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

/* =============================================================================
   METRIC GRID - Layout container for metrics
   ============================================================================= */

interface MetricGridProps {
  children: React.ReactNode;
  /** Number of columns */
  cols?: 2 | 3 | 4;
  /** Gap size */
  gap?: "sm" | "md" | "lg";
  /** Additional className */
  className?: string;
}

export function MetricGrid({
  children,
  cols = 3,
  gap = "md",
  className,
}: MetricGridProps) {
  const colStyles = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4",
  };

  const gapStyles = {
    sm: "gap-4 sm:gap-4",
    md: "gap-4 sm:gap-4",
    lg: "gap-4 sm:gap-6",
  };

  return (
    <div className={cn("grid", colStyles[cols], gapStyles[gap], className)}>
      {children}
    </div>
  );
}

/* =============================================================================
   METRIC SUMMARY - Inline summary display
   ============================================================================= */

interface MetricSummaryProps {
  items: Array<{
    label: string;
    value: number | string;
    format?: MetricCardProps["format"];
  }>;
  className?: string;
}

export function MetricSummary({ items, className }: MetricSummaryProps) {
  return (
    <div className={cn(
      "flex flex-wrap gap-x-6 gap-y-3 p-4 sm:p-4 bg-neutral-50/80 border border-neutral-200/60 rounded-md",
      className
    )}>
      {items.map((item, index) => (
        <div key={index} className="min-w-0">
          <p className="text-2xs font-semibold tracking-wider uppercase text-neutral-500 mb-0.5">
            {item.label}
          </p>
          <p className="text-base sm:text-lg font-medium tabular-nums text-neutral-900">
            {formatValue(item.value, item.format)}
          </p>
        </div>
      ))}
    </div>
  );
}

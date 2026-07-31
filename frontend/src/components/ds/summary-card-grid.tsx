"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

export interface SummaryCard {
  /** Unique identifier for the card */
  id: string;
  /** Label shown below the value */
  label: string;
  /** The main value to display (pre-formatted string or number) */
  value: string | number;
  /** Optional change indicator */
  change?: {
    value: number;
    direction: "up" | "down";
    /** Whether up is good (green) or bad (red). Default: up is good */
    upIsGood?: boolean;
  };
  /** Optional icon to display */
  icon?: React.ReactNode;
  /** Optional click handler */
  onClick?: () => void;
  /** Optional subtitle/helper text */
  subtitle?: string;
}

interface SummaryCardGridProps {
  /** Array of card configurations */
  cards: SummaryCard[];
  /** Number of columns on large screens. Default: auto based on card count */
  columns?: 2 | 3 | 4 | 5 | 6;
  /** Additional className for the grid container */
  className?: string;
  /** Card size variant */
  size?: "sm" | "md" | "lg";
}

const columnClasses = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

const sizeClasses = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

const valueSizeClasses = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-3xl",
};

/**
 * SummaryCardGrid - A standardized grid of summary/metric cards
 *
 * Use this component at the top of table pages to display key metrics.
 * Ensures consistent styling across all pages.
 *
 * @example
 * ```tsx
 * <SummaryCardGrid
 *   cards={[
 *     { id: 'total', label: 'Total Value', value: '$125,000' },
 *     { id: 'pending', label: 'Pending', value: 5, change: { value: 12, direction: 'up' } },
 *   ]}
 * />
 * ```
 */
export function SummaryCardGrid({
  cards,
  columns,
  className,
  size = "md",
}: SummaryCardGridProps) {
  // Auto-determine columns based on card count if not specified
  const autoColumns =
    columns ?? (cards.length <= 2 ? 2 : cards.length <= 3 ? 3 : 4);

  return (
    <div
      className={cn(
        "grid gap-4 md:grid-cols-2",
        columnClasses[autoColumns],
        className,
      )}
    >
      {cards.map((card) => (
        <SummaryCardItem key={card.id} card={card} size={size} />
      ))}
    </div>
  );
}

function SummaryCardItem({
  card,
  size,
}: {
  card: SummaryCard;
  size: "sm" | "md" | "lg";
}) {
  const { label, value, change, icon, onClick, subtitle } = card;

  const isClickable = !!onClick;
  const upIsGood = change?.upIsGood ?? true;
  const isPositiveChange = change?.direction === "up";
  const changeColor =
    (isPositiveChange && upIsGood) || (!isPositiveChange && !upIsGood)
      ? "text-success"
      : "text-destructive";

  return (
    <Card
      className={cn(
        sizeClasses[size],
        isClickable &&
          "cursor-pointer hover:border-brand hover:shadow-sm transition-all duration-200",
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className={cn("font-bold tabular-nums", valueSizeClasses[size])}>
            {value}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>

      {change && (
        <div
          className={cn("flex items-center gap-1 mt-2 text-xs", changeColor)}
        >
          {change.direction === "up" ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          <span>{change.value}%</span>
        </div>
      )}
    </Card>
  );
}

/**
 * Helper function to format currency values consistently
 */
export function formatCurrencyValue(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Helper function to format number values with commas
 */
export function formatNumberValue(num: number | null | undefined): string {
  if (num === null || num === undefined) return "0";
  return new Intl.NumberFormat("en-US").format(num);
}

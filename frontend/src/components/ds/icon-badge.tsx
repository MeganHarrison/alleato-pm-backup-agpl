import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * IconBadge — canonical rounded icon container.
 *
 * Always renders with bg-primary/10 + text-primary so icon
 * backgrounds are consistent across the entire app.
 *
 * Usage:
 *   <IconBadge><DollarSign /></IconBadge>
 *   <IconBadge size="lg"><FileText className="h-5 w-5" /></IconBadge>
 *
 * Sizes:
 *   sm  — 32×32 (h-8 w-8)  — compact lists, table cells
 *   md  — 36×36 (h-9 w-9)  — default, card headers   [default]
 *   lg  — 40×40 (h-10 w-10) — hero sections, empty states
 *   xl  — 48×48 (h-12 w-12) — large empty state icons
 */

export type IconBadgeSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<IconBadgeSize, string> = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-10 w-10",
  xl: "h-12 w-12",
};

export interface IconBadgeProps {
  children: React.ReactNode;
  size?: IconBadgeSize;
  className?: string;
}

export function IconBadge({ children, size = "md", className }: IconBadgeProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary",
        SIZE_CLASSES[size],
        className,
      )}
    >
      {children}
    </div>
  );
}

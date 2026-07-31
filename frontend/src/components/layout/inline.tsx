import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Inline component for consistent horizontal spacing.
 * Replaces manual flex layouts and gap-* classes.
 *
 * @example
 * <Inline gap="sm" align="center">
 *   <Button>Cancel</Button>
 *   <Button variant="primary">Save</Button>
 * </Inline>
 */

const gapMap = {
  xs: "gap-1", // 4px
  sm: "gap-2", // 8px
  md: "gap-4", // 16px
  lg: "gap-6", // 24px
  xl: "gap-8", // 32px
} as const;

const alignMap = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
} as const;

const justifyMap = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
  around: "justify-around",
  evenly: "justify-evenly",
} as const;

export interface InlineProps {
  /** Spacing between children */
  gap?: keyof typeof gapMap;
  /** Vertical alignment of children */
  align?: keyof typeof alignMap;
  /** Horizontal distribution of children */
  justify?: keyof typeof justifyMap;
  /** Allow wrapping to multiple lines */
  wrap?: boolean;
  /** Render as a different element */
  as?: "div" | "span" | "section" | "nav";
  /** Additional CSS classes */
  className?: string;
  /** Child elements */
  children: React.ReactNode;
}

export function Inline({
  gap = "md",
  align = "center",
  justify = "start",
  wrap = false,
  as: Component = "div",
  className,
  children,
}: InlineProps) {
  return (
    <Component
      className={cn(
        "flex",
        gapMap[gap],
        alignMap[align],
        justifyMap[justify],
        wrap && "flex-wrap",
        className,
      )}
    >
      {children}
    </Component>
  );
}

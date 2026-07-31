import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Heading component for consistent typography hierarchy.
 * Replaces raw h1-h6 elements.
 *
 * @example
 * <Heading level={1}>Page Title</Heading>
 * <Heading level={2} as="h1">Visually h2, semantically h1</Heading>
 */

const levelStyles = {
  1: "text-4xl font-bold tracking-tight lg:text-5xl",
  2: "text-3xl font-semibold tracking-tight",
  3: "text-2xl font-semibold tracking-tight",
  4: "text-xl font-semibold tracking-tight",
  5: "text-lg font-semibold",
  6: "text-base font-semibold",
} as const;

export interface HeadingProps {
  /** Visual level (sizing) of the heading */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Semantic HTML element (for accessibility) */
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  /** Additional CSS classes */
  className?: string;
  /** Heading text */
  children: React.ReactNode;
}

export function Heading({ level = 2, as, className, children }: HeadingProps) {
  // Use 'as' prop if provided, otherwise use level
  const Component =
    as || (`h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6");

  return (
    <Component className={cn("text-foreground", levelStyles[level], className)}>
      {children}
    </Component>
  );
}

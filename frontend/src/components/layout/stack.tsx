import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Stack component for consistent vertical spacing.
 * Replaces manual margin and space-y-* classes.
 *
 * @example
 * <Stack gap="lg">
 *   <Heading>Title</Heading>
 *   <Text>Description</Text>
 *   <Button>Action</Button>
 * </Stack>
 */

const gapMap = {
  xs: "gap-1", // 4px
  sm: "gap-2", // 8px
  md: "gap-4", // 16px
  lg: "gap-6", // 24px
  xl: "gap-8", // 32px
  "2xl": "gap-12", // 48px
} as const;

const alignMap = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
} as const;

export interface StackProps {
  /** Spacing between children */
  gap?: keyof typeof gapMap;
  /** Horizontal alignment of children */
  align?: keyof typeof alignMap;
  /** Render as a different element */
  as?:
    | "div"
    | "section"
    | "article"
    | "main"
    | "aside"
    | "nav"
    | "header"
    | "footer";
  /** Additional CSS classes */
  className?: string;
  /** Child elements */
  children: React.ReactNode;
}

export function Stack({
  gap = "md",
  align = "stretch",
  as: Component = "div",
  className,
  children,
}: StackProps) {
  return (
    <Component
      className={cn("flex flex-col", gapMap[gap], alignMap[align], className)}
    >
      {children}
    </Component>
  );
}

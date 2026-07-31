import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Container component for consistent page width constraints.
 * Replaces manual max-width and padding classes.
 *
 * @example
 * <Container size="lg" padding>
 *   <Stack gap="lg">
 *     <Heading>Page Title</Heading>
 *     <Text>Page content</Text>
 *   </Stack>
 * </Container>
 */

const sizeMap = {
  sm: "max-w-2xl", // 672px
  md: "max-w-4xl", // 896px
  lg: "max-w-6xl", // 1152px
  xl: "max-w-7xl", // 1280px
  full: "max-w-full", // 100%
} as const;

export interface ContainerProps {
  /** Maximum width of container */
  size?: keyof typeof sizeMap;
  /** Add horizontal padding */
  padding?: boolean;
  /** Center the container */
  center?: boolean;
  /** Render as a different element */
  as?: "div" | "section" | "article" | "main";
  /** Additional CSS classes */
  className?: string;
  /** Child elements */
  children: React.ReactNode;
}

export function Container({
  size = "lg",
  padding = true,
  center = true,
  as: Component = "div",
  className,
  children,
}: ContainerProps) {
  return (
    <Component
      className={cn(
        "w-full",
        sizeMap[size],
        center && "mx-auto",
        padding && "px-4 sm:px-6 lg:px-8",
        className,
      )}
    >
      {children}
    </Component>
  );
}

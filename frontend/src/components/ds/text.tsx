import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Text component for consistent body text styling.
 * Replaces raw p, span, and div elements.
 *
 * @example
 * <Text>Default body text</Text>
 * <Text size="sm" tone="muted">Small muted text</Text>
 * <Text weight="semibold">Bold text</Text>
 */

const sizeMap = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
} as const;

const toneMap = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  accent: "text-accent-foreground",
  destructive: "text-destructive",
  success: "text-success",
  warning: "text-warning",
} as const;

const weightMap = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
} as const;

const transformMap = {
  none: "",
  capitalize: "capitalize",
  uppercase: "uppercase",
  lowercase: "lowercase",
} as const;

export interface TextProps {
  /** Size of text */
  size?: keyof typeof sizeMap;
  /** Color tone/intent */
  tone?: keyof typeof toneMap;
  /** Optional legacy variant mapping to tone/size */
  variant?: keyof typeof toneMap | keyof typeof sizeMap;
  /** Font weight */
  weight?: keyof typeof weightMap;
  /** Text transformation */
  transform?: keyof typeof transformMap;
  /** Render as a different element */
  as?: "p" | "span" | "div" | "label";
  /** Additional CSS classes */
  className?: string;
  /** Text content */
  children: React.ReactNode;
}

export function Text({
  size = "base",
  tone = "default",
  variant,
  weight = "normal",
  transform = "none",
  as: Component = "p",
  className,
  children,
}: TextProps) {
  const isSizeVariant = (value: string): value is keyof typeof sizeMap =>
    value in sizeMap;

  const isToneVariant = (value: string): value is keyof typeof toneMap =>
    value in toneMap;

  const resolvedSize = variant && isSizeVariant(variant) ? variant : size;
  const resolvedTone = variant && isToneVariant(variant) ? variant : tone;

  return (
    <Component
      className={cn(
        sizeMap[resolvedSize],
        toneMap[resolvedTone],
        weightMap[weight],
        transformMap[transform],
        className,
      )}
    >
      {children}
    </Component>
  );
}

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface FormContainerProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Form max width based on UX best practices:
   * - 'sm' (512px): Narrow forms like login, signup
   * - 'md' (672px): Standard single-column forms (default)
   * - 'lg' (896px): Forms with more fields or side-by-side inputs
   * - 'xl' (1024px): Complex multi-column forms or forms with tables
   * - '2xl' (1152px): Wide split-layout forms with section metadata columns
   */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  /**
   * Enable/disable padding (default: true)
   */
  padding?: boolean;
  /**
   * Enable/disable card styling with background, border, and shadow (default: true)
   */
  withCard?: boolean;
}

const maxWidthClasses = {
  sm: "max-w-lg", // 512px - Login, signup, simple forms
  md: "max-w-2xl", // 672px - Standard forms (optimal for readability)
  lg: "max-w-4xl", // 896px - Forms with more content
  xl: "max-w-5xl", // 1024px - Complex forms with tables/multi-column
  "2xl": "max-w-6xl", // 1152px - Wide split-layout forms
};

/**
 * FormContainer component for form pages
 *
 * Based on UX best practices (2025):
 * - Optimal form width: 600-700px for single-column forms (default: 672px)
 * - Centered layout with comfortable padding
 * - Mobile-responsive with 8px grid system padding (16px → 24px → 32px)
 * - Optional card-like appearance with background, border, and subtle shadow
 * - Theme-aware (supports dark mode)
 * - Prevents horizontal overflow for mobile safety
 *
 * @example
 * ```tsx
 * <FormContainer maxWidth="md">
 *   <form>...</form>
 * </FormContainer>
 * ```
 */
export function FormContainer({
  children,
  className,
  maxWidth = "md",
  padding = true,
  withCard = true,
}: FormContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full",
        maxWidthClasses[maxWidth],
        // Optional card styling (theme-aware)
        withCard && [
          "bg-muted-subtle text-card-foreground",
        ],
        // Mobile-first responsive padding
        // Mobile: 16px horizontal, 24px vertical
        // Tablet: 24px horizontal, 32px vertical
        // Desktop: 32px horizontal, 32px vertical
        padding && "px-4 sm:px-6 lg:px-8 py-6 sm:py-8",
        // Prevent horizontal overflow
        "overflow-x-hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

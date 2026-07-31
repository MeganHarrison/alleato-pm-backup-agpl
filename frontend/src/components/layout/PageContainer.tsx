"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  padding?: boolean;
  paddingClassName?: string;
}

const maxWidthClasses = {
  sm: "max-w-3xl",
  md: "max-w-5xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
  "2xl": "max-w-screen-2xl",
  full: "max-w-full",
};

export function PageContainer({
  children,
  className,
  maxWidth = "full",
  padding = true,
  paddingClassName,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "flex flex-col flex-1 mx-auto w-full min-w-0",
        maxWidthClasses[maxWidth],
        // Consistent gutter on every side: 16px on mobile, 24px on tablet, 32px on desktop.
        // Matches the inset of the (tables) layout so nested PageContainers do not double-pad.
        padding && (paddingClassName ?? "px-4 sm:px-6 lg:px-8 pt-2 pb-4"),
        // Prevent horizontal overflow on all screen sizes
        "overflow-x-clip",
        className,
      )}
    >
      {children}
    </div>
  );
}

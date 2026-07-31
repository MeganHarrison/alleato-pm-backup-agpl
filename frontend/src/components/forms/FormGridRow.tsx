"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useFormDensity, type FormDensity } from "@/components/forms/Form";

interface FormGridRowProps {
  children: React.ReactNode;
  className?: string;
  gap?: FormDensity;
  align?: "start" | "center";
}

/**
 * A row inside a 12-col FormGrid.
 * Use col-span-* on children for sizing.
 * Always stacks on mobile, 12-col at md breakpoint.
 */
export function FormGridRow({
  children,
  className,
  gap,
  align = "start",
}: FormGridRowProps) {
  const formDensity = useFormDensity();
  const resolvedGap = gap ?? formDensity;
  const gapClass = resolvedGap === "compact" ? "gap-4" : "gap-6";
  const alignClass = align === "center" ? "items-center" : "items-start";

  return (
    <div
      className={cn(
        "col-span-12 grid grid-cols-1 md:grid-cols-12",
        gapClass,
        alignClass,
        className,
      )}
    >
      {children}
    </div>
  );
}

"use client";

import { cn } from "@/lib/utils";

interface EyebrowProps {
  children: React.ReactNode;
  className?: string;
}

/** Tier 1 text — 11px uppercase tracking-wider label */
export function Eyebrow({ children, className }: EyebrowProps) {
  return (
    <span
      className={cn(
        "text-[11px] font-semibold uppercase tracking-wider text-heading-label",
        className
      )}
    >
      {children}
    </span>
  );
}

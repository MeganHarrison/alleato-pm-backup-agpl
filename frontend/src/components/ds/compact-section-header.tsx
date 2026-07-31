"use client";

import type * as React from "react";

import { cn } from "@/lib/utils";
import { Eyebrow } from "./eyebrow";

interface CompactSectionHeaderProps {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function CompactSectionHeader({
  children,
  action,
  className,
}: CompactSectionHeaderProps) {
  return (
    <div className={cn("mb-3 flex items-center justify-between", className)}>
      <Eyebrow>{children}</Eyebrow>
      {action}
    </div>
  );
}

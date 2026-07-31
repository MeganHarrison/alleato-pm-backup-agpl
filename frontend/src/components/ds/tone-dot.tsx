"use client";

import { cn } from "@/lib/utils";

export type ToneDotTone = "success" | "warning" | "danger" | "info" | "neutral";

const toneClasses: Record<ToneDotTone, string> = {
  success: "bg-status-success",
  warning: "bg-status-warning",
  danger: "bg-destructive",
  info: "bg-status-info",
  neutral: "bg-muted-foreground/40",
};

interface ToneDotProps {
  tone?: ToneDotTone;
  className?: string;
}

export function ToneDot({ tone = "neutral", className }: ToneDotProps) {
  return (
    <span
      className={cn(
        "inline-flex h-1.5 w-1.5 shrink-0 rounded-full",
        toneClasses[tone],
        className,
      )}
    />
  );
}
